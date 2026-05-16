"""Virtual Team Marketplace — agent catalog, subscriptions, and execution."""
from __future__ import annotations

import os
import time
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import get_db
from models_pg import (
    AgentCategory, VirtualAgent, CompanyAgentTier,
    CompanyAgentSubscription, MarketplaceAgentRun,
)
from routes.dependencies import get_current_user, require_admin, require_feature
from services.books_ledger import post_financial_event
from ai_runtime.gateway import call_model

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/marketplace",
    tags=["marketplace"],
    dependencies=[Depends(require_feature("agents_marketplace"))],
)

_AGENT_MODEL = os.environ.get("AGENT_MODEL", "openrouter/google/gemma-3-27b-it")

# ---------------------------------------------------------------------------
# Tier definitions (single source of truth)
# ---------------------------------------------------------------------------
TIER_DEFS = {
    "indie":   {"label": "Indie",   "total_limit": 3,  "allows_custom": False, "token_allowance": 500_000,    "price_monthly": 0},
    "startup": {"label": "Startup", "total_limit": 10, "allows_custom": False, "token_allowance": 2_000_000,  "price_monthly": 2999},
    "studio":  {"label": "Studio",  "total_limit": 15, "allows_custom": False, "token_allowance": 5_000_000,  "price_monthly": 6999},
    "firm":    {"label": "Firm",    "total_limit": 28, "allows_custom": False, "token_allowance": 15_000_000, "price_monthly": 14999},
    "corp":    {"label": "Corp",    "total_limit": 9999, "allows_custom": True, "token_allowance": 999_999_999, "price_monthly": 29999},
}

# ---------------------------------------------------------------------------
# Serialisers
# ---------------------------------------------------------------------------

def _category_dict(cat: AgentCategory) -> dict:
    return {
        "id": cat.id, "key": cat.key, "name": cat.name,
        "description": cat.description, "icon_key": cat.icon_key,
        "accent_color": cat.accent_color, "sort_order": cat.sort_order,
    }


def _agent_dict(agent: VirtualAgent, sub: Optional[CompanyAgentSubscription] = None) -> dict:
    return {
        "id": agent.id,
        "category_id": agent.category_id,
        "company_id": agent.company_id,
        "name": agent.name,
        "slug": agent.slug,
        "tagline": agent.tagline,
        "description": agent.description,
        "capabilities": agent.capabilities or [],
        "agent_tier": agent.agent_tier,
        "tier_required": agent.tier_required,
        "value_metric_type": agent.value_metric_type,
        "price_per_1k_tokens": float(agent.price_per_1k_tokens or 0),
        "base_token_estimate": agent.base_token_estimate,
        "is_featured": agent.is_featured,
        "is_free_eligible": agent.is_free_eligible,
        "accent_color": agent.accent_color,
        "thumbnail_url": agent.thumbnail_url,
        "sort_order": agent.sort_order,
        # subscription context
        "subscription": {
            "id": sub.id,
            "status": sub.status,
            "is_free_pick": sub.is_free_pick,
            "subscribed_at": sub.subscribed_at.isoformat(),
        } if sub else None,
    }


def _tier_dict(tier: CompanyAgentTier, active_count: int) -> dict:
    defn = TIER_DEFS.get(tier.tier_key, TIER_DEFS["indie"])
    return {
        "id": tier.id,
        "tier_key": tier.tier_key,
        "tier_label": defn["label"],
        "total_agent_limit": tier.total_agent_limit,
        "allows_custom_agents": tier.allows_custom_agents,
        "token_allowance_monthly": tier.token_allowance_monthly,
        "token_used_this_cycle": tier.token_used_this_cycle,
        "token_pct_used": round(tier.token_used_this_cycle / max(tier.token_allowance_monthly, 1) * 100, 1),
        "price_monthly": float(tier.price_monthly or 0),
        "currency": tier.currency,
        "billing_cycle_start": tier.billing_cycle_start.isoformat() if tier.billing_cycle_start else None,
        "active_agent_count": active_count,
        "available_slots": max(0, tier.total_agent_limit - active_count),
        "upgrade_options": [
            {"tier_key": k, **{kk: vv for kk, vv in v.items()}}
            for k, v in TIER_DEFS.items()
            if v["total_limit"] > tier.total_agent_limit
        ],
    }


def _run_dict(run: MarketplaceAgentRun) -> dict:
    return {
        "id": run.id,
        "agent_id": run.agent_id,
        "status": run.status,
        "trigger_type": run.trigger_type,
        "tokens_in": run.tokens_in,
        "tokens_out": run.tokens_out,
        "model_used": run.model_used,
        "estimated_cost_usd": float(run.estimated_cost_usd or 0),
        "value_metric_amount": float(run.value_metric_amount) if run.value_metric_amount is not None else None,
        "duration_ms": run.duration_ms,
        "error_message": run.error_message,
        "output": run.output_payload.get("text") if run.output_payload else None,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_or_create_tier(company_id: str, db: AsyncSession) -> CompanyAgentTier:
    result = await db.execute(
        select(CompanyAgentTier).where(CompanyAgentTier.company_id == company_id)
    )
    tier = result.scalar_one_or_none()
    if not tier:
        defn = TIER_DEFS["indie"]
        tier = CompanyAgentTier(
            company_id=company_id,
            tier_key="indie",
            total_agent_limit=defn["total_limit"],
            allows_custom_agents=defn["allows_custom"],
            token_allowance_monthly=defn["token_allowance"],
            price_monthly=defn["price_monthly"],
        )
        db.add(tier)
        await db.flush()
    return tier


async def _active_subscription_count(company_id: str, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).where(
            and_(
                CompanyAgentSubscription.company_id == company_id,
                CompanyAgentSubscription.status == "active",
            )
        )
    )
    return result.scalar_one() or 0


async def _sub_map(company_id: str, db: AsyncSession) -> dict[str, CompanyAgentSubscription]:
    result = await db.execute(
        select(CompanyAgentSubscription).where(
            and_(
                CompanyAgentSubscription.company_id == company_id,
                CompanyAgentSubscription.status == "active",
            )
        )
    )
    return {s.agent_id: s for s in result.scalars().all()}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SubscribeBody(BaseModel):
    agent_id: str

class OnboardingSelectBody(BaseModel):
    agent_ids: list[str]  # exactly 3, all is_free_eligible

class TierUpgradeBody(BaseModel):
    tier_key: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None

class RunAgentBody(BaseModel):
    input: dict = {}

class CreateCustomAgentBody(BaseModel):
    flow_id: str
    name: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    capabilities: list[str] = []
    value_metric_type: Optional[str] = None
    accent_color: Optional[str] = None

class SuperAdminAgentBody(BaseModel):
    category_id: Optional[str] = None
    name: str
    slug: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    capabilities: list[str] = []
    system_prompt: dict = {}
    agent_tier: str = "basic"
    tier_required: str = "indie"
    value_metric_type: Optional[str] = None
    price_per_1k_tokens: float = 0.0
    base_token_estimate: int = 500
    is_featured: bool = False
    is_free_eligible: bool = False
    sort_order: int = 0
    accent_color: Optional[str] = None
    thumbnail_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Catalog endpoints
# ---------------------------------------------------------------------------

@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(select(AgentCategory).order_by(AgentCategory.sort_order))
    cats = result.scalars().all()

    # enrich with agent counts
    count_result = await db.execute(
        select(VirtualAgent.category_id, func.count().label("cnt"))
        .where(and_(VirtualAgent.is_active == True, VirtualAgent.company_id == None))
        .group_by(VirtualAgent.category_id)
    )
    counts = {row.category_id: row.cnt for row in count_result}
    return [{"agent_count": counts.get(c.id, 0), **_category_dict(c)} for c in cats]


@router.get("/agents")
async def list_agents(
    category: Optional[str] = Query(None),
    agent_tier: Optional[str] = Query(None),
    tier_required: Optional[str] = Query(None),
    free_eligible: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    filters = [VirtualAgent.is_active == True]
    # system agents only (not tenant custom)
    filters.append(VirtualAgent.company_id == None)

    if category:
        cat_result = await db.execute(select(AgentCategory).where(AgentCategory.key == category))
        cat = cat_result.scalar_one_or_none()
        if cat:
            filters.append(VirtualAgent.category_id == cat.id)

    if agent_tier:
        filters.append(VirtualAgent.agent_tier == agent_tier)
    if tier_required:
        filters.append(VirtualAgent.tier_required == tier_required)
    if free_eligible is not None:
        filters.append(VirtualAgent.is_free_eligible == free_eligible)
    if search:
        term = f"%{search}%"
        from sqlalchemy import or_
        filters.append(or_(
            VirtualAgent.name.ilike(term),
            VirtualAgent.tagline.ilike(term),
            VirtualAgent.description.ilike(term),
        ))

    result = await db.execute(
        select(VirtualAgent).where(and_(*filters)).order_by(
            VirtualAgent.is_featured.desc(), VirtualAgent.sort_order
        )
    )
    agents = result.scalars().all()
    subs = await _sub_map(current_user.company_id, db)
    return [_agent_dict(a, subs.get(a.id)) for a in agents]


@router.get("/agents/{slug}")
async def get_agent(slug: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(VirtualAgent).where(and_(VirtualAgent.slug == slug, VirtualAgent.is_active == True))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    subs = await _sub_map(current_user.company_id, db)

    # 30-day metrics
    from sqlalchemy import text
    metrics_result = await db.execute(
        select(
            func.count(MarketplaceAgentRun.id).label("total_runs"),
            func.sum(MarketplaceAgentRun.tokens_in + MarketplaceAgentRun.tokens_out).label("total_tokens"),
            func.sum(MarketplaceAgentRun.estimated_cost_usd).label("total_cost"),
            func.sum(MarketplaceAgentRun.value_metric_amount).label("total_value"),
        ).where(
            and_(
                MarketplaceAgentRun.agent_id == agent.id,
                MarketplaceAgentRun.company_id == current_user.company_id,
                MarketplaceAgentRun.status == "success",
            )
        )
    )
    m = metrics_result.one()
    metrics = {
        "total_runs": m.total_runs or 0,
        "total_tokens": int(m.total_tokens or 0),
        "total_cost_usd": float(m.total_cost or 0),
        "total_value": float(m.total_value or 0),
    }
    return {**_agent_dict(agent, subs.get(agent.id)), "metrics": metrics}


# ---------------------------------------------------------------------------
# My Team endpoints
# ---------------------------------------------------------------------------

@router.get("/tier")
async def get_tier(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    tier = await _get_or_create_tier(current_user.company_id, db)
    await db.commit()
    count = await _active_subscription_count(current_user.company_id, db)
    return _tier_dict(tier, count)


@router.get("/team")
async def get_team(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    tier = await _get_or_create_tier(current_user.company_id, db)
    await db.commit()

    sub_result = await db.execute(
        select(CompanyAgentSubscription).where(
            and_(
                CompanyAgentSubscription.company_id == current_user.company_id,
                CompanyAgentSubscription.status == "active",
            )
        )
    )
    subs = sub_result.scalars().all()
    agent_ids = [s.agent_id for s in subs]
    sub_by_agent = {s.agent_id: s for s in subs}

    agents = []
    if agent_ids:
        agent_result = await db.execute(
            select(VirtualAgent).where(VirtualAgent.id.in_(agent_ids))
        )
        agents = agent_result.scalars().all()

    # per-agent run metrics (last 30 days)
    metrics_result = await db.execute(
        select(
            MarketplaceAgentRun.agent_id,
            func.count(MarketplaceAgentRun.id).label("total_runs"),
            func.sum(
                (MarketplaceAgentRun.status == "success").cast(sa_integer())
            ).label("successful_runs"),
            func.sum(MarketplaceAgentRun.tokens_in + MarketplaceAgentRun.tokens_out).label("total_tokens"),
            func.sum(MarketplaceAgentRun.estimated_cost_usd).label("total_cost"),
            func.sum(MarketplaceAgentRun.value_metric_amount).label("total_value"),
            func.max(MarketplaceAgentRun.started_at).label("last_run_at"),
        ).where(
            and_(
                MarketplaceAgentRun.company_id == current_user.company_id,
                MarketplaceAgentRun.agent_id.in_(agent_ids),
            )
        ).group_by(MarketplaceAgentRun.agent_id)
    ) if agent_ids else None

    metrics_map: dict = {}
    if metrics_result:
        for row in metrics_result:
            total = row.total_runs or 0
            success = int(row.successful_runs or 0)
            metrics_map[row.agent_id] = {
                "total_runs": total,
                "successful_runs": success,
                "success_rate": round(success / max(total, 1) * 100, 1),
                "total_tokens": int(row.total_tokens or 0),
                "total_cost_usd": float(row.total_cost or 0),
                "total_value": float(row.total_value or 0),
                "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
            }

    team_agents = []
    for a in agents:
        sub = sub_by_agent.get(a.id)
        agent_data = _agent_dict(a, sub)
        agent_data["metrics"] = metrics_map.get(a.id, {
            "total_runs": 0, "successful_runs": 0, "success_rate": 0,
            "total_tokens": 0, "total_cost_usd": 0, "total_value": 0, "last_run_at": None,
        })
        team_agents.append(agent_data)

    active_count = len(subs)
    return {
        "tier": _tier_dict(tier, active_count),
        "agents": team_agents,
    }


def sa_integer():
    import sqlalchemy as sa
    return sa.Integer


@router.post("/team/subscribe")
async def subscribe_agent(
    body: SubscribeBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tier = await _get_or_create_tier(current_user.company_id, db)
    active_count = await _active_subscription_count(current_user.company_id, db)

    if active_count >= tier.total_agent_limit:
        raise HTTPException(402, f"Agent limit reached for {tier.tier_key} tier. Upgrade to add more agents.")

    # Load agent
    result = await db.execute(select(VirtualAgent).where(VirtualAgent.id == body.agent_id))
    agent = result.scalar_one_or_none()
    if not agent or not agent.is_active:
        raise HTTPException(404, "Agent not found")

    # Check tier eligibility
    tier_order = list(TIER_DEFS.keys())
    if tier_order.index(agent.tier_required) > tier_order.index(tier.tier_key):
        raise HTTPException(402, f"This agent requires the '{agent.tier_required}' tier or higher.")

    # Check duplicate
    dup = await db.execute(
        select(CompanyAgentSubscription).where(
            and_(
                CompanyAgentSubscription.company_id == current_user.company_id,
                CompanyAgentSubscription.agent_id == body.agent_id,
            )
        )
    )
    existing = dup.scalar_one_or_none()
    if existing:
        if existing.status == "active":
            raise HTTPException(409, "Already subscribed to this agent")
        existing.status = "active"
        existing.cancelled_at = None
        await db.commit()
        return {"message": "Agent reactivated", "subscription_id": existing.id}

    sub = CompanyAgentSubscription(
        company_id=current_user.company_id,
        agent_id=body.agent_id,
        tier_id=tier.id,
    )
    db.add(sub)
    await db.commit()
    return {"message": "Agent added to your team", "subscription_id": sub.id}


@router.post("/team/{agent_id}/pause")
async def pause_agent(agent_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(CompanyAgentSubscription).where(
            and_(
                CompanyAgentSubscription.company_id == current_user.company_id,
                CompanyAgentSubscription.agent_id == agent_id,
                CompanyAgentSubscription.status == "active",
            )
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Active subscription not found")
    sub.status = "paused"
    await db.commit()
    return {"message": "Agent paused"}


@router.post("/team/{agent_id}/cancel")
async def cancel_agent(agent_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(CompanyAgentSubscription).where(
            and_(
                CompanyAgentSubscription.company_id == current_user.company_id,
                CompanyAgentSubscription.agent_id == agent_id,
                CompanyAgentSubscription.status.in_(["active", "paused"]),
            )
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Subscription not found")
    sub.status = "cancelled"
    sub.cancelled_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Agent removed from team"}


# ---------------------------------------------------------------------------
# Onboarding — pick 3 free agents (Indie tier, one-time)
# ---------------------------------------------------------------------------

@router.get("/onboarding/options")
async def onboarding_options(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(VirtualAgent).where(
            and_(VirtualAgent.is_free_eligible == True, VirtualAgent.is_active == True)
        ).order_by(VirtualAgent.sort_order)
    )
    agents = result.scalars().all()
    # Check if already completed
    sub_result = await db.execute(
        select(CompanyAgentSubscription).where(
            and_(
                CompanyAgentSubscription.company_id == current_user.company_id,
                CompanyAgentSubscription.is_free_pick == True,
            )
        )
    )
    existing = sub_result.scalars().all()
    return {
        "already_selected": [s.agent_id for s in existing],
        "onboarding_complete": len(existing) > 0,
        "agents": [_agent_dict(a) for a in agents],
    }


@router.post("/onboarding/select")
async def onboarding_select(
    body: OnboardingSelectBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if len(body.agent_ids) != 3:
        raise HTTPException(400, "You must select exactly 3 agents")

    # Ensure not already onboarded
    dup = await db.execute(
        select(CompanyAgentSubscription).where(
            and_(
                CompanyAgentSubscription.company_id == current_user.company_id,
                CompanyAgentSubscription.is_free_pick == True,
            )
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(409, "Onboarding already completed")

    # Validate agents are free-eligible
    result = await db.execute(
        select(VirtualAgent).where(VirtualAgent.id.in_(body.agent_ids))
    )
    agents = result.scalars().all()
    if len(agents) != 3:
        raise HTTPException(400, "One or more agents not found")
    for a in agents:
        if not a.is_free_eligible:
            raise HTTPException(400, f"Agent '{a.name}' is not available on the free tier")

    tier = await _get_or_create_tier(current_user.company_id, db)

    for agent in agents:
        sub = CompanyAgentSubscription(
            company_id=current_user.company_id,
            agent_id=agent.id,
            tier_id=tier.id,
            is_free_pick=True,
        )
        db.add(sub)

    await db.commit()
    return {"message": "Your virtual team is ready", "agent_ids": body.agent_ids}


# ---------------------------------------------------------------------------
# Tier upgrade
# ---------------------------------------------------------------------------

@router.post("/tier/order")
async def create_tier_upgrade_order(
    body: TierUpgradeBody,
    current_user=Depends(get_current_user),
):
    """Create a Razorpay payment order for a tier upgrade. Frontend completes payment then calls /tier/upgrade."""
    if body.tier_key not in TIER_DEFS:
        raise HTTPException(400, f"Invalid tier: {body.tier_key}")

    defn = TIER_DEFS[body.tier_key]
    price = float(defn["price_monthly"] or 0)
    if price == 0:
        raise HTTPException(400, "This tier is free — call /tier/upgrade directly")

    from services.razorpay_service import create_platform_order
    result = await create_platform_order(
        amount_inr=price,
        receipt=f"mkt_{body.tier_key}_{current_user.company_id[:8]}",
        notes={"company_id": current_user.company_id, "tier_key": body.tier_key},
    )
    if not result["success"]:
        raise HTTPException(500, f"Could not create payment order: {result.get('error', 'Unknown error')}")

    return {
        "order_id": result["order_id"],
        "amount": price,
        "currency": "INR",
        "key_id": result["key_id"],
        "tier_key": body.tier_key,
        "tier_label": defn["label"],
    }


@router.post("/tier/upgrade")
async def upgrade_tier(
    body: TierUpgradeBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if body.tier_key not in TIER_DEFS:
        raise HTTPException(400, f"Invalid tier: {body.tier_key}")

    tier = await _get_or_create_tier(current_user.company_id, db)
    tier_order = list(TIER_DEFS.keys())
    if tier_order.index(body.tier_key) <= tier_order.index(tier.tier_key):
        raise HTTPException(400, "Can only upgrade to a higher tier")

    defn = TIER_DEFS[body.tier_key]
    price = float(defn["price_monthly"] or 0)

    # Verify Razorpay payment before upgrading for paid tiers
    if price > 0:
        if not body.razorpay_order_id or not body.razorpay_payment_id or not body.razorpay_signature:
            raise HTTPException(
                402,
                detail={
                    "message": f"Payment required to upgrade to {defn['label']} (₹{price:,.0f}/mo). Call POST /marketplace/tier/order first.",
                    "price": price,
                    "tier_key": body.tier_key,
                }
            )
        from services.razorpay_service import verify_payment_signature
        if not verify_payment_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
            raise HTTPException(400, "Invalid payment signature — upgrade rejected")

    tier.tier_key = body.tier_key
    tier.total_agent_limit = defn["total_limit"]
    tier.allows_custom_agents = defn["allows_custom"]
    tier.token_allowance_monthly = defn["token_allowance"]
    tier.price_monthly = defn["price_monthly"]
    tier.billing_cycle_start = datetime.now(timezone.utc)
    tier.updated_at = datetime.now(timezone.utc)
    await db.commit()

    if price > 0:
        await post_financial_event(
            db,
            company_id=current_user.company_id,
            event_type="marketplace_subscription",
            source_id=body.razorpay_payment_id or f"{current_user.company_id}_tier_{body.tier_key}_{datetime.now(timezone.utc).strftime('%Y%m')}",
            amount=price,
            metadata={"description": f"Marketplace tier upgrade — {defn['label']}"},
        )
        await db.commit()

    count = await _active_subscription_count(current_user.company_id, db)
    return {"message": f"Upgraded to {defn['label']}", "tier": _tier_dict(tier, count)}


# ---------------------------------------------------------------------------
# Agent execution
# ---------------------------------------------------------------------------

@router.post("/agents/{slug}/run")
async def run_agent(
    slug: str,
    body: RunAgentBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # Load agent
    result = await db.execute(
        select(VirtualAgent).where(and_(VirtualAgent.slug == slug, VirtualAgent.is_active == True))
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")

    # Confirm subscription
    sub_result = await db.execute(
        select(CompanyAgentSubscription).where(
            and_(
                CompanyAgentSubscription.company_id == current_user.company_id,
                CompanyAgentSubscription.agent_id == agent.id,
                CompanyAgentSubscription.status == "active",
            )
        )
    )
    sub = sub_result.scalar_one_or_none()
    if not sub:
        raise HTTPException(403, "You are not subscribed to this agent")

    # Token budget check
    tier = await _get_or_create_tier(current_user.company_id, db)
    if tier.token_used_this_cycle >= tier.token_allowance_monthly and tier.tier_key == "indie":
        raise HTTPException(429, "Monthly token allowance exhausted. Upgrade your tier to continue.")

    # Create run record
    run = MarketplaceAgentRun(
        company_id=current_user.company_id,
        agent_id=agent.id,
        subscription_id=sub.id,
        triggered_by=current_user.id,
        trigger_type="manual",
        status="running",
        input_payload=body.input,
        model_used=_AGENT_MODEL,
    )
    db.add(run)
    await db.flush()
    run_id = run.id
    await db.commit()

    # Build LLM messages from agent system_prompt config
    sp = agent.system_prompt or {}
    system_content = sp.get("instructions", f"You are {agent.name}. {agent.tagline or ''}")
    output_format = sp.get("output_format", "")
    if output_format:
        system_content += f"\n\nOutput format: {output_format}"

    user_content = body.input.get("message") or body.input.get("text") or str(body.input)
    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]

    t0 = time.monotonic()
    try:
        llm_result = await call_model(
            prompt_id=f"agent_{agent.slug}",
            messages=messages,
            tools=None,
            tenant_id=current_user.company_id,
            agent_name=agent.name,
            model_override=_AGENT_MODEL,
        )
        duration_ms = int((time.monotonic() - t0) * 1000)

        # Extract value metric from output (heuristic — agent-specific)
        value_amount = _extract_value_metric(agent.value_metric_type, llm_result.response_text)
        cost_usd = float(agent.price_per_1k_tokens or 0) * (llm_result.usage.tokens_in + llm_result.usage.tokens_out) / 1000

        # Update run record
        run_result = await db.execute(select(MarketplaceAgentRun).where(MarketplaceAgentRun.id == run_id))
        run_obj = run_result.scalar_one()
        run_obj.status = "success"
        run_obj.output_payload = {"text": llm_result.response_text, "tool_calls": llm_result.tool_calls}
        run_obj.tokens_in = llm_result.usage.tokens_in
        run_obj.tokens_out = llm_result.usage.tokens_out
        run_obj.estimated_cost_usd = cost_usd
        run_obj.value_metric_amount = value_amount
        run_obj.duration_ms = duration_ms
        run_obj.completed_at = datetime.now(timezone.utc)

        # Deduct from token budget
        tier_result = await db.execute(
            select(CompanyAgentTier).where(CompanyAgentTier.company_id == current_user.company_id)
        )
        t = tier_result.scalar_one()
        t.token_used_this_cycle = (t.token_used_this_cycle or 0) + llm_result.usage.tokens_in + llm_result.usage.tokens_out
        await db.commit()

        return {
            "run_id": run_id,
            "status": "success",
            "output": llm_result.response_text,
            "tokens_used": llm_result.usage.tokens_in + llm_result.usage.tokens_out,
            "cost_usd": cost_usd,
            "value_metric_type": agent.value_metric_type,
            "value_metric_amount": float(value_amount) if value_amount is not None else None,
            "duration_ms": duration_ms,
        }

    except Exception as exc:
        duration_ms = int((time.monotonic() - t0) * 1000)
        logger.error("Agent run failed: %s", exc)
        run_result = await db.execute(select(MarketplaceAgentRun).where(MarketplaceAgentRun.id == run_id))
        run_obj = run_result.scalar_one_or_none()
        if run_obj:
            run_obj.status = "failure"
            run_obj.error_message = str(exc)
            run_obj.duration_ms = duration_ms
            run_obj.completed_at = datetime.now(timezone.utc)
            await db.commit()
        raise HTTPException(500, f"Agent execution failed: {exc}")


@router.get("/runs/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(MarketplaceAgentRun).where(
            and_(MarketplaceAgentRun.id == run_id, MarketplaceAgentRun.company_id == current_user.company_id)
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")
    return _run_dict(run)


def _extract_value_metric(metric_type: Optional[str], text: str) -> Optional[Decimal]:
    """Heuristic extraction of value metric from agent output text."""
    if not metric_type:
        return None
    if metric_type == "tasks_completed":
        return Decimal("1")
    # For other metric types, return 1 as a baseline — can be refined per agent
    return Decimal("1")


# ---------------------------------------------------------------------------
# Team metrics
# ---------------------------------------------------------------------------

@router.get("/metrics")
async def team_metrics(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(
            func.count(MarketplaceAgentRun.id).label("total_runs"),
            func.sum((MarketplaceAgentRun.status == "success").cast(sa_integer())).label("successful_runs"),
            func.sum(MarketplaceAgentRun.tokens_in + MarketplaceAgentRun.tokens_out).label("total_tokens"),
            func.sum(MarketplaceAgentRun.estimated_cost_usd).label("total_cost"),
        ).where(MarketplaceAgentRun.company_id == current_user.company_id)
    )
    m = result.one()
    total = m.total_runs or 0
    success = int(m.successful_runs or 0)
    return {
        "total_runs": total,
        "successful_runs": success,
        "success_rate": round(success / max(total, 1) * 100, 1),
        "total_tokens": int(m.total_tokens or 0),
        "total_cost_usd": float(m.total_cost or 0),
    }


@router.get("/metrics/{agent_id}")
async def agent_metrics(agent_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(
            func.count(MarketplaceAgentRun.id).label("total_runs"),
            func.sum((MarketplaceAgentRun.status == "success").cast(sa_integer())).label("successful_runs"),
            func.sum(MarketplaceAgentRun.tokens_in + MarketplaceAgentRun.tokens_out).label("total_tokens"),
            func.sum(MarketplaceAgentRun.estimated_cost_usd).label("total_cost"),
            func.sum(MarketplaceAgentRun.value_metric_amount).label("total_value"),
            func.max(MarketplaceAgentRun.started_at).label("last_run_at"),
        ).where(
            and_(MarketplaceAgentRun.company_id == current_user.company_id, MarketplaceAgentRun.agent_id == agent_id)
        )
    )
    m = result.one()
    total = m.total_runs or 0
    success = int(m.successful_runs or 0)

    # Last 10 runs
    runs_result = await db.execute(
        select(MarketplaceAgentRun).where(
            and_(MarketplaceAgentRun.company_id == current_user.company_id, MarketplaceAgentRun.agent_id == agent_id)
        ).order_by(MarketplaceAgentRun.started_at.desc()).limit(10)
    )
    recent_runs = [_run_dict(r) for r in runs_result.scalars().all()]

    return {
        "total_runs": total,
        "successful_runs": success,
        "success_rate": round(success / max(total, 1) * 100, 1),
        "total_tokens": int(m.total_tokens or 0),
        "total_cost_usd": float(m.total_cost or 0),
        "total_value": float(m.total_value or 0),
        "last_run_at": m.last_run_at.isoformat() if m.last_run_at else None,
        "recent_runs": recent_runs,
    }


# ---------------------------------------------------------------------------
# Corp: Custom agents
# ---------------------------------------------------------------------------

@router.post("/custom-agents")
async def create_custom_agent(
    body: CreateCustomAgentBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    tier = await _get_or_create_tier(current_user.company_id, db)
    if not tier.allows_custom_agents:
        raise HTTPException(403, "Custom agents are available on the Corp tier only")

    agent = VirtualAgent(
        company_id=current_user.company_id,
        flow_id=body.flow_id,
        name=body.name,
        slug=f"custom-{body.name.lower().replace(' ', '-')}-{current_user.company_id[:6]}",
        tagline=body.tagline,
        description=body.description,
        capabilities=body.capabilities,
        agent_tier="custom",
        tier_required="corp",
        value_metric_type=body.value_metric_type,
        is_free_eligible=False,
        accent_color=body.accent_color,
    )
    db.add(agent)
    await db.commit()
    return _agent_dict(agent)


@router.delete("/custom-agents/{agent_id}")
async def delete_custom_agent(agent_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(VirtualAgent).where(
            and_(VirtualAgent.id == agent_id, VirtualAgent.company_id == current_user.company_id)
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Custom agent not found")
    await db.delete(agent)
    await db.commit()
    return {"message": "Custom agent deleted"}


# ---------------------------------------------------------------------------
# SuperAdmin: seed / manage catalog
# ---------------------------------------------------------------------------

@router.post("/admin/agents")
async def admin_create_agent(
    body: SuperAdminAgentBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    agent = VirtualAgent(
        category_id=body.category_id,
        name=body.name,
        slug=body.slug,
        tagline=body.tagline,
        description=body.description,
        capabilities=body.capabilities,
        system_prompt=body.system_prompt,
        agent_tier=body.agent_tier,
        tier_required=body.tier_required,
        value_metric_type=body.value_metric_type,
        price_per_1k_tokens=body.price_per_1k_tokens,
        base_token_estimate=body.base_token_estimate,
        is_featured=body.is_featured,
        is_free_eligible=body.is_free_eligible,
        sort_order=body.sort_order,
        accent_color=body.accent_color,
        thumbnail_url=body.thumbnail_url,
    )
    db.add(agent)
    await db.commit()
    return _agent_dict(agent)


@router.put("/admin/agents/{agent_id}")
async def admin_update_agent(
    agent_id: str,
    body: SuperAdminAgentBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_admin),
):
    result = await db.execute(select(VirtualAgent).where(VirtualAgent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(404, "Agent not found")
    for field, val in body.dict(exclude_unset=True).items():
        setattr(agent, field, val)
    agent.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return _agent_dict(agent)
