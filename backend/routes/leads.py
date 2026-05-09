"""
Lead management routes.
All routes at /api/leads/...
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from pydantic import BaseModel

from database_pg import get_db
from routes.dependencies import get_current_user
import models_pg

router = APIRouter(prefix="/leads", tags=["Leads"])

DEFAULT_QUALIFICATION_SCORES = {
    "email_captured": 10,
    "phone_captured": 20,
    "phone_verified": 30,
    "email_verified": 20,
    "affirmative_answer": 5,
    "high_converting_post": 15,
}


def _ser_lead(l: models_pg.Lead) -> dict:
    return {
        "id": l.id,
        "source_platform": l.source_platform,
        "source_handle": l.source_handle,
        "source_external_user_id": l.source_external_user_id,
        "source_post_id": l.source_post_id,
        "source_trigger_id": l.source_trigger_id,
        "captured_at": l.captured_at,
        "status": l.status,
        "score": l.score,
        "score_breakdown": l.score_breakdown or {},
        "current_flow_id": l.current_flow_id,
        "current_node_id": l.current_node_id,
        "owner_type": l.owner_type,
        "owner_id": l.owner_id,
        "expires_at": l.expires_at,
        "attributes": l.attributes or {},
        "captured_phone": l.captured_phone,
        "captured_email": l.captured_email,
        "captured_name": l.captured_name,
        "phone_verified": l.phone_verified,
        "email_verified": l.email_verified,
        "promoted_to_customer_id": l.promoted_to_customer_id,
        "promoted_at": l.promoted_at,
        "conversation_id": l.conversation_id,
    }


def _ser_event(e: models_pg.LeadEvent) -> dict:
    return {
        "id": e.id,
        "lead_id": e.lead_id,
        "kind": e.kind,
        "payload": e.payload or {},
        "occurred_at": e.occurred_at,
    }


def _compute_score(lead: models_pg.Lead) -> tuple[int, dict]:
    breakdown = {}
    score = 0
    if lead.captured_email:
        breakdown["email_captured"] = DEFAULT_QUALIFICATION_SCORES["email_captured"]
        score += DEFAULT_QUALIFICATION_SCORES["email_captured"]
    if lead.captured_phone:
        breakdown["phone_captured"] = DEFAULT_QUALIFICATION_SCORES["phone_captured"]
        score += DEFAULT_QUALIFICATION_SCORES["phone_captured"]
    if lead.phone_verified:
        breakdown["phone_verified"] = DEFAULT_QUALIFICATION_SCORES["phone_verified"]
        score += DEFAULT_QUALIFICATION_SCORES["phone_verified"]
    if lead.email_verified:
        breakdown["email_verified"] = DEFAULT_QUALIFICATION_SCORES["email_verified"]
        score += DEFAULT_QUALIFICATION_SCORES["email_verified"]
    attrs = lead.attributes or {}
    affirmative_count = sum(1 for v in attrs.values() if v is True or v == "yes")
    if affirmative_count:
        pts = affirmative_count * DEFAULT_QUALIFICATION_SCORES["affirmative_answer"]
        breakdown["affirmative_answers"] = pts
        score += pts
    return score, breakdown


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

class LeadCreate(BaseModel):
    source_platform: Optional[str] = "instagram"
    source_handle: Optional[str] = None
    source_external_user_id: Optional[str] = None
    source_post_id: Optional[str] = None
    source_trigger_id: Optional[str] = None
    source_account_id: Optional[str] = None
    current_flow_id: Optional[str] = None
    attributes: Optional[dict] = {}


class LeadUpdate(BaseModel):
    status: Optional[str] = None
    owner_type: Optional[str] = None
    owner_id: Optional[str] = None
    captured_phone: Optional[str] = None
    captured_email: Optional[str] = None
    captured_name: Optional[str] = None
    phone_verified: Optional[bool] = None
    email_verified: Optional[bool] = None
    attributes: Optional[dict] = None
    current_node_id: Optional[str] = None
    flow_state: Optional[dict] = None


@router.get("")
async def list_leads(
    status: Optional[str] = None,
    min_score: Optional[int] = None,
    source_post_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.Lead).where(
        models_pg.Lead.tenant_id == current_user.company_id
    )
    if status:
        stmt = stmt.where(models_pg.Lead.status == status)
    if min_score is not None:
        stmt = stmt.where(models_pg.Lead.score >= min_score)
    if source_post_id:
        stmt = stmt.where(models_pg.Lead.source_post_id == source_post_id)
    stmt = stmt.order_by(desc(models_pg.Lead.captured_at))
    result = await db.execute(stmt)
    return [_ser_lead(l) for l in result.scalars().all()]


@router.get("/counts")
async def lead_counts(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Counts per status for the kanban board headers."""
    result = await db.execute(
        select(models_pg.Lead.status, func.count(models_pg.Lead.id))
        .where(models_pg.Lead.tenant_id == current_user.company_id)
        .group_by(models_pg.Lead.status)
    )
    return {row[0]: row[1] for row in result.all()}


@router.get("/{lead_id}")
async def get_lead(
    lead_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.Lead).where(
            models_pg.Lead.id == lead_id,
            models_pg.Lead.tenant_id == current_user.company_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")
    return _ser_lead(lead)


@router.post("", status_code=201)
async def create_lead(
    body: LeadCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lead = models_pg.Lead(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        source_platform=body.source_platform or "instagram",
        source_handle=body.source_handle,
        source_external_user_id=body.source_external_user_id,
        source_post_id=body.source_post_id,
        source_trigger_id=body.source_trigger_id,
        source_account_id=body.source_account_id,
        current_flow_id=body.current_flow_id,
        status="new",
        score=0,
        score_breakdown={},
        attributes=body.attributes or {},
        owner_type="bot",
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return _ser_lead(lead)


@router.put("/{lead_id}")
async def update_lead(
    lead_id: str,
    body: LeadUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.Lead).where(
            models_pg.Lead.id == lead_id,
            models_pg.Lead.tenant_id == current_user.company_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")

    if body.status is not None:
        lead.status = body.status
    if body.owner_type is not None:
        lead.owner_type = body.owner_type
    if body.owner_id is not None:
        lead.owner_id = body.owner_id
    if body.captured_phone is not None:
        lead.captured_phone = body.captured_phone
    if body.captured_email is not None:
        lead.captured_email = body.captured_email
    if body.captured_name is not None:
        lead.captured_name = body.captured_name
    if body.phone_verified is not None:
        lead.phone_verified = body.phone_verified
    if body.email_verified is not None:
        lead.email_verified = body.email_verified
    if body.attributes is not None:
        lead.attributes = {**(lead.attributes or {}), **body.attributes}
    if body.current_node_id is not None:
        lead.current_node_id = body.current_node_id
    if body.flow_state is not None:
        lead.flow_state = body.flow_state

    # Recompute score after every update
    score, breakdown = _compute_score(lead)
    lead.score = score
    lead.score_breakdown = breakdown

    await db.commit()
    await db.refresh(lead)
    return _ser_lead(lead)


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(
    lead_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.Lead).where(
            models_pg.Lead.id == lead_id,
            models_pg.Lead.tenant_id == current_user.company_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")
    await db.delete(lead)
    await db.commit()


# ---------------------------------------------------------------------------
# Lead Events
# ---------------------------------------------------------------------------

class LeadEventCreate(BaseModel):
    kind: str
    payload: Optional[dict] = {}


@router.get("/{lead_id}/events")
async def list_lead_events(
    lead_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadEvent).where(
            models_pg.LeadEvent.lead_id == lead_id,
            models_pg.LeadEvent.tenant_id == current_user.company_id,
        ).order_by(models_pg.LeadEvent.occurred_at)
    )
    return [_ser_event(e) for e in result.scalars().all()]


@router.post("/{lead_id}/events", status_code=201)
async def add_lead_event(
    lead_id: str,
    body: LeadEventCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    lead = (await db.execute(
        select(models_pg.Lead).where(
            models_pg.Lead.id == lead_id,
            models_pg.Lead.tenant_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")

    event = models_pg.LeadEvent(
        id=str(uuid.uuid4()),
        lead_id=lead_id,
        tenant_id=current_user.company_id,
        kind=body.kind,
        payload=body.payload or {},
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return _ser_event(event)


# ---------------------------------------------------------------------------
# Promote to Customer
# ---------------------------------------------------------------------------

class PromoteBody(BaseModel):
    reason: Optional[str] = "manual_promotion"


@router.post("/{lead_id}/promote")
async def promote_to_customer(
    lead_id: str,
    body: PromoteBody,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Promote a lead to a Customer record. Requires verified phone or email."""
    result = await db.execute(
        select(models_pg.Lead).where(
            models_pg.Lead.id == lead_id,
            models_pg.Lead.tenant_id == current_user.company_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")
    if not (lead.phone_verified or lead.email_verified or lead.captured_phone or lead.captured_email):
        raise HTTPException(400, "Lead must have a captured phone or email before promotion")
    if lead.promoted_to_customer_id:
        raise HTTPException(409, "Lead already promoted")

    existing_customer = None
    if lead.captured_phone:
        res = await db.execute(
            select(models_pg.Customer).where(
                models_pg.Customer.company_id == current_user.company_id,
                models_pg.Customer.phone == lead.captured_phone,
            )
        )
        existing_customer = res.scalar_one_or_none()
    if not existing_customer and lead.captured_email:
        res = await db.execute(
            select(models_pg.Customer).where(
                models_pg.Customer.company_id == current_user.company_id,
                models_pg.Customer.email == lead.captured_email,
            )
        )
        existing_customer = res.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if existing_customer:
        customer = existing_customer
    else:
        customer = models_pg.Customer(
            id=str(uuid.uuid4()),
            company_id=current_user.company_id,
            name=lead.captured_name or lead.source_handle or "Unknown",
            email=lead.captured_email,
            phone=lead.captured_phone,
            notes=f"Promoted from Instagram lead @{lead.source_handle}",
            created_at=now,
        )
        db.add(customer)
        await db.flush()

    # Add identity link
    identity = models_pg.MktCustomerIdentity(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        customer_id=customer.id,
        channel="instagram",
        external_id=lead.source_external_user_id or lead.source_handle or "",
        verified=lead.phone_verified or lead.email_verified,
        source="lead_capture",
    )
    db.add(identity)

    lead.promoted_to_customer_id = customer.id
    lead.promoted_at = now
    lead.status = "converted"

    event = models_pg.LeadEvent(
        id=str(uuid.uuid4()),
        lead_id=lead_id,
        tenant_id=current_user.company_id,
        kind="promoted_to_customer",
        payload={
            "customer_id": customer.id,
            "reason": body.reason,
            "promoted_by": current_user.id,
        },
    )
    db.add(event)
    await db.commit()

    return {
        "status": "promoted",
        "lead_id": lead_id,
        "customer_id": customer.id,
        "was_existing": existing_customer is not None,
    }


# ---------------------------------------------------------------------------
# Block / Opt-out
# ---------------------------------------------------------------------------

@router.post("/{lead_id}/block")
async def block_lead(
    lead_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark lead as blocked and record consent revocation."""
    result = await db.execute(
        select(models_pg.Lead).where(
            models_pg.Lead.id == lead_id,
            models_pg.Lead.tenant_id == current_user.company_id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")
    lead.status = "blocked"
    event = models_pg.LeadEvent(
        id=str(uuid.uuid4()),
        lead_id=lead_id,
        tenant_id=current_user.company_id,
        kind="blocked",
        payload={"reason": "opt_out", "blocked_by": current_user.id},
    )
    db.add(event)
    await db.commit()
    return {"status": "blocked", "lead_id": lead_id}


# ---------------------------------------------------------------------------
# Qualification Rules
# ---------------------------------------------------------------------------

class QualificationRuleCreate(BaseModel):
    rule: dict


@router.get("/qualification-rules")
async def list_qualification_rules(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadQualificationRule).where(
            models_pg.LeadQualificationRule.tenant_id == current_user.company_id
        )
    )
    return [{"id": r.id, "rule": r.rule, "created_at": r.created_at} for r in result.scalars().all()]


@router.post("/qualification-rules", status_code=201)
async def create_qualification_rule(
    body: QualificationRuleCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = models_pg.LeadQualificationRule(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        rule=body.rule,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"id": rule.id, "rule": rule.rule, "created_at": rule.created_at}


@router.delete("/qualification-rules/{rule_id}", status_code=204)
async def delete_qualification_rule(
    rule_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadQualificationRule).where(
            models_pg.LeadQualificationRule.id == rule_id,
            models_pg.LeadQualificationRule.tenant_id == current_user.company_id,
        )
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(404, "Rule not found")
    await db.delete(rule)
    await db.commit()
