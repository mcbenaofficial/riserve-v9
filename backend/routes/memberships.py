from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from decimal import Decimal
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, and_
import models_pg

from .dependencies import get_db, get_current_user, require_admin, User

router = APIRouter(prefix="/memberships", tags=["Memberships"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class PlanCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    price_monthly: float = 0
    price_yearly: float = 0
    currency: str = "INR"
    benefits: list = []
    color: Optional[str] = None
    sort_order: int = 0

class EnrollMemberBody(BaseModel):
    customer_id: str
    plan_id: str
    renewal_mode: str = "manual"
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None

class UpdateMemberBody(BaseModel):
    plan_id: Optional[str] = None
    renewal_mode: Optional[str] = None
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None

class RenewBody(BaseModel):
    expires_at: datetime
    notes: Optional[str] = None

class CancelBody(BaseModel):
    notes: Optional[str] = None

class IssueCreditsBody(BaseModel):
    amount: float
    description: str
    reference_id: Optional[str] = None


# ─── Helper ─────────────────────────────────────────────────────────────────

def _plan_dict(p: models_pg.MembershipPlan) -> dict:
    return {
        "id": p.id,
        "company_id": p.company_id,
        "name": p.name,
        "slug": p.slug,
        "description": p.description,
        "price_monthly": float(p.price_monthly or 0),
        "price_yearly": float(p.price_yearly or 0),
        "currency": p.currency,
        "is_active": p.is_active,
        "sort_order": p.sort_order,
        "benefits": p.benefits or [],
        "color": p.color,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _membership_dict(m: models_pg.Membership, customer=None, plan=None) -> dict:
    return {
        "id": m.id,
        "company_id": m.company_id,
        "customer_id": m.customer_id,
        "customer_name": customer.name if customer else None,
        "customer_email": customer.email if customer else None,
        "customer_phone": customer.phone if customer else None,
        "plan_id": m.plan_id,
        "plan_name": plan.name if plan else None,
        "plan_color": plan.color if plan else None,
        "status": m.status,
        "enrolled_at": m.enrolled_at.isoformat() if m.enrolled_at else None,
        "expires_at": m.expires_at.isoformat() if m.expires_at else None,
        "renewal_mode": m.renewal_mode,
        "cancelled_at": m.cancelled_at.isoformat() if m.cancelled_at else None,
        "notes": m.notes,
        "credits_balance": float(m.credits_balance or 0),
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


def _tx_dict(t: models_pg.MembershipTransaction) -> dict:
    return {
        "id": t.id,
        "membership_id": t.membership_id,
        "customer_id": t.customer_id,
        "transaction_type": t.transaction_type,
        "amount": float(t.amount),
        "description": t.description,
        "reference_id": t.reference_id,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


def _event_dict(e: models_pg.MembershipEvent) -> dict:
    return {
        "id": e.id,
        "membership_id": e.membership_id,
        "event_type": e.event_type,
        "metadata": e.event_metadata or {},
        "created_by": e.created_by,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


async def _log_event(db: AsyncSession, membership_id: str, company_id: str, event_type: str, metadata: dict, created_by: str):
    ev = models_pg.MembershipEvent(
        id=str(uuid.uuid4()),
        company_id=company_id,
        membership_id=membership_id,
        event_type=event_type,
        event_metadata=metadata,
        created_by=created_by,
        created_at=datetime.now(timezone.utc),
    )
    db.add(ev)


# ─── Plans ───────────────────────────────────────────────────────────────────

@router.get("/plans")
async def get_plans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.MembershipPlan).where(
        models_pg.MembershipPlan.company_id == current_user.company_id
    ).order_by(models_pg.MembershipPlan.sort_order, models_pg.MembershipPlan.created_at)
    res = await db.execute(stmt)
    plans = res.scalars().all()

    # Attach member counts
    counts_stmt = (
        select(models_pg.Membership.plan_id, func.count(models_pg.Membership.id))
        .where(
            models_pg.Membership.company_id == current_user.company_id,
            models_pg.Membership.status == "active",
        )
        .group_by(models_pg.Membership.plan_id)
    )
    counts_res = await db.execute(counts_stmt)
    counts = {row[0]: row[1] for row in counts_res.all()}

    result = []
    for p in plans:
        d = _plan_dict(p)
        d["active_member_count"] = counts.get(p.id, 0)
        result.append(d)
    return result


@router.post("/plans")
async def create_plan(
    body: PlanCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    plan = models_pg.MembershipPlan(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        name=body.name,
        slug=body.slug,
        description=body.description,
        price_monthly=body.price_monthly,
        price_yearly=body.price_yearly,
        currency=body.currency,
        benefits=body.benefits,
        color=body.color,
        sort_order=body.sort_order,
        is_active=True,
        created_at=now,
    )
    # Check slug uniqueness within company
    slug_check = await db.execute(
        select(models_pg.MembershipPlan).where(
            models_pg.MembershipPlan.company_id == current_user.company_id,
            models_pg.MembershipPlan.slug == body.slug,
        )
    )
    if slug_check.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"A plan with slug '{body.slug}' already exists.")
    db.add(plan)
    await db.commit()
    d = _plan_dict(plan)
    d["active_member_count"] = 0
    return d


@router.put("/plans/{plan_id}")
async def update_plan(
    plan_id: str,
    body: PlanCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.MembershipPlan).where(
        models_pg.MembershipPlan.id == plan_id,
        models_pg.MembershipPlan.company_id == current_user.company_id,
    )
    res = await db.execute(stmt)
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Check slug uniqueness (excluding self)
    if body.slug != plan.slug:
        slug_check = await db.execute(
            select(models_pg.MembershipPlan).where(
                models_pg.MembershipPlan.company_id == current_user.company_id,
                models_pg.MembershipPlan.slug == body.slug,
                models_pg.MembershipPlan.id != plan_id,
            )
        )
        if slug_check.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"A plan with slug '{body.slug}' already exists.")

    plan.name = body.name
    plan.slug = body.slug
    plan.description = body.description
    plan.price_monthly = body.price_monthly
    plan.price_yearly = body.price_yearly
    plan.currency = body.currency
    plan.benefits = body.benefits
    plan.color = body.color
    plan.sort_order = body.sort_order
    plan.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return _plan_dict(plan)


@router.delete("/plans/{plan_id}")
async def delete_plan(
    plan_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Check no active or paused members
    count_stmt = select(func.count(models_pg.Membership.id)).where(
        models_pg.Membership.plan_id == plan_id,
        models_pg.Membership.company_id == current_user.company_id,
        models_pg.Membership.status.in_(["active", "paused"]),
    )
    count_res = await db.execute(count_stmt)
    count = count_res.scalar()
    if count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete plan with {count} active or paused members. Reassign or cancel them first.")

    stmt = delete(models_pg.MembershipPlan).where(
        models_pg.MembershipPlan.id == plan_id,
        models_pg.MembershipPlan.company_id == current_user.company_id,
    )
    res = await db.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    await db.commit()
    return {"message": "Plan deleted"}


@router.patch("/plans/{plan_id}/toggle-active")
async def toggle_plan_active(
    plan_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models_pg.MembershipPlan).where(
            models_pg.MembershipPlan.id == plan_id,
            models_pg.MembershipPlan.company_id == current_user.company_id,
        )
    )
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    plan.is_active = not plan.is_active
    plan.updated_at = datetime.now(timezone.utc)
    await db.commit()
    d = _plan_dict(plan)
    d["active_member_count"] = 0
    return d


# ─── Members ─────────────────────────────────────────────────────────────────

@router.get("/members")
async def get_members(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    plan_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(models_pg.Membership, models_pg.Customer, models_pg.MembershipPlan)
        .join(models_pg.Customer, models_pg.Membership.customer_id == models_pg.Customer.id)
        .outerjoin(models_pg.MembershipPlan, models_pg.Membership.plan_id == models_pg.MembershipPlan.id)
        .where(models_pg.Membership.company_id == current_user.company_id)
    )

    if status:
        stmt = stmt.where(models_pg.Membership.status == status)
    if plan_id:
        stmt = stmt.where(models_pg.Membership.plan_id == plan_id)
    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(
            models_pg.Customer.name.ilike(search_term) |
            models_pg.Customer.email.ilike(search_term) |
            models_pg.Customer.phone.ilike(search_term)
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    count_res = await db.execute(count_stmt)
    total = count_res.scalar()

    stmt = stmt.order_by(models_pg.Membership.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    res = await db.execute(stmt)
    rows = res.all()

    members = [_membership_dict(m, customer=c, plan=p) for m, c, p in rows]
    return {"members": members, "total": total, "page": page, "per_page": per_page}


@router.post("/members")
async def enroll_member(
    body: EnrollMemberBody,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Verify customer exists and belongs to company
    cust_res = await db.execute(
        select(models_pg.Customer).where(
            models_pg.Customer.id == body.customer_id,
            models_pg.Customer.company_id == current_user.company_id,
        )
    )
    customer = cust_res.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Verify plan exists
    plan_res = await db.execute(
        select(models_pg.MembershipPlan).where(
            models_pg.MembershipPlan.id == body.plan_id,
            models_pg.MembershipPlan.company_id == current_user.company_id,
        )
    )
    plan = plan_res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Guard: one active/paused membership per customer per company
    existing_stmt = select(models_pg.Membership).where(
        models_pg.Membership.company_id == current_user.company_id,
        models_pg.Membership.customer_id == body.customer_id,
        models_pg.Membership.status.in_(["active", "paused"]),
    )
    existing_res = await db.execute(existing_stmt)
    existing = existing_res.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Customer already has an active membership (ID: {existing.id}). Cancel or pause it before enrolling again.")

    now = datetime.now(timezone.utc)
    membership = models_pg.Membership(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        customer_id=body.customer_id,
        plan_id=body.plan_id,
        status="active",
        enrolled_at=now,
        expires_at=body.expires_at,
        renewal_mode=body.renewal_mode,
        notes=body.notes,
        credits_balance=0,
        created_at=now,
    )
    db.add(membership)
    await db.flush()

    await _log_event(db, membership.id, current_user.company_id, "enrolled",
                     {"plan_id": body.plan_id, "plan_name": plan.name}, current_user.id)
    await db.commit()
    return _membership_dict(membership, customer=customer, plan=plan)


@router.get("/members/{membership_id}")
async def get_member(
    membership_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(models_pg.Membership, models_pg.Customer, models_pg.MembershipPlan)
        .join(models_pg.Customer, models_pg.Membership.customer_id == models_pg.Customer.id)
        .outerjoin(models_pg.MembershipPlan, models_pg.Membership.plan_id == models_pg.MembershipPlan.id)
        .where(
            models_pg.Membership.id == membership_id,
            models_pg.Membership.company_id == current_user.company_id,
        )
    )
    res = await db.execute(stmt)
    row = res.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Membership not found")

    m, customer, plan = row
    result = _membership_dict(m, customer=customer, plan=plan)

    # Attach transactions and events
    tx_res = await db.execute(
        select(models_pg.MembershipTransaction)
        .where(models_pg.MembershipTransaction.membership_id == membership_id)
        .order_by(models_pg.MembershipTransaction.created_at.desc())
        .limit(50)
    )
    result["transactions"] = [_tx_dict(t) for t in tx_res.scalars().all()]

    ev_res = await db.execute(
        select(models_pg.MembershipEvent)
        .where(models_pg.MembershipEvent.membership_id == membership_id)
        .order_by(models_pg.MembershipEvent.created_at.desc())
        .limit(50)
    )
    result["events"] = [_event_dict(e) for e in ev_res.scalars().all()]

    return result


@router.put("/members/{membership_id}")
async def update_member(
    membership_id: str,
    body: UpdateMemberBody,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models_pg.Membership).where(
            models_pg.Membership.id == membership_id,
            models_pg.Membership.company_id == current_user.company_id,
        )
    )
    m = res.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")

    old_plan_id = m.plan_id
    if body.plan_id is not None:
        # Verify the new plan belongs to this company
        plan_check = await db.execute(
            select(models_pg.MembershipPlan).where(
                models_pg.MembershipPlan.id == body.plan_id,
                models_pg.MembershipPlan.company_id == current_user.company_id,
            )
        )
        if not plan_check.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Plan not found")
        m.plan_id = body.plan_id
    if body.renewal_mode is not None:
        m.renewal_mode = body.renewal_mode
    if body.expires_at is not None:
        m.expires_at = body.expires_at
    if body.notes is not None:
        m.notes = body.notes
    m.updated_at = datetime.now(timezone.utc)

    if body.plan_id and body.plan_id != old_plan_id:
        await _log_event(db, m.id, current_user.company_id, "plan_changed",
                         {"old_plan_id": old_plan_id, "new_plan_id": body.plan_id}, current_user.id)
    await db.commit()
    return _membership_dict(m)


# ─── Lifecycle Actions ───────────────────────────────────────────────────────

@router.post("/members/{membership_id}/renew")
async def renew_member(
    membership_id: str,
    body: RenewBody,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models_pg.Membership).where(
            models_pg.Membership.id == membership_id,
            models_pg.Membership.company_id == current_user.company_id,
        )
    )
    m = res.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")

    m.expires_at = body.expires_at
    m.status = "active"
    m.updated_at = datetime.now(timezone.utc)

    await _log_event(db, m.id, current_user.company_id, "renewed",
                     {"new_expires_at": body.expires_at.isoformat(), "notes": body.notes}, current_user.id)
    await db.commit()
    cust_res = await db.execute(select(models_pg.Customer).where(models_pg.Customer.id == m.customer_id))
    customer = cust_res.scalar_one_or_none()
    plan = (await db.execute(select(models_pg.MembershipPlan).where(models_pg.MembershipPlan.id == m.plan_id))).scalar_one_or_none() if m.plan_id else None
    return _membership_dict(m, customer=customer, plan=plan)


@router.post("/members/{membership_id}/cancel")
async def cancel_member(
    membership_id: str,
    body: CancelBody,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models_pg.Membership).where(
            models_pg.Membership.id == membership_id,
            models_pg.Membership.company_id == current_user.company_id,
        )
    )
    m = res.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")
    if m.status == "cancelled":
        raise HTTPException(status_code=400, detail="Membership is already cancelled.")

    now = datetime.now(timezone.utc)
    m.status = "cancelled"
    m.cancelled_at = now
    m.updated_at = now
    if body.notes:
        m.notes = body.notes

    await _log_event(db, m.id, current_user.company_id, "cancelled",
                     {"notes": body.notes}, current_user.id)
    await db.commit()
    cust_res = await db.execute(select(models_pg.Customer).where(models_pg.Customer.id == m.customer_id))
    customer = cust_res.scalar_one_or_none()
    plan = (await db.execute(select(models_pg.MembershipPlan).where(models_pg.MembershipPlan.id == m.plan_id))).scalar_one_or_none() if m.plan_id else None
    return _membership_dict(m, customer=customer, plan=plan)


@router.post("/members/{membership_id}/pause")
async def pause_member(
    membership_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models_pg.Membership).where(
            models_pg.Membership.id == membership_id,
            models_pg.Membership.company_id == current_user.company_id,
        )
    )
    m = res.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")
    if m.status != "active":
        raise HTTPException(status_code=400, detail=f"Cannot pause a membership with status '{m.status}'. Only active memberships can be paused.")

    m.status = "paused"
    m.updated_at = datetime.now(timezone.utc)
    await _log_event(db, m.id, current_user.company_id, "paused", {}, current_user.id)
    await db.commit()
    cust_res = await db.execute(select(models_pg.Customer).where(models_pg.Customer.id == m.customer_id))
    customer = cust_res.scalar_one_or_none()
    plan = (await db.execute(select(models_pg.MembershipPlan).where(models_pg.MembershipPlan.id == m.plan_id))).scalar_one_or_none() if m.plan_id else None
    return _membership_dict(m, customer=customer, plan=plan)


@router.post("/members/{membership_id}/resume")
async def resume_member(
    membership_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models_pg.Membership).where(
            models_pg.Membership.id == membership_id,
            models_pg.Membership.company_id == current_user.company_id,
        )
    )
    m = res.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")
    if m.status != "paused":
        raise HTTPException(status_code=400, detail=f"Cannot resume a membership with status '{m.status}'. Only paused memberships can be resumed.")

    m.status = "active"
    m.updated_at = datetime.now(timezone.utc)
    await _log_event(db, m.id, current_user.company_id, "resumed", {}, current_user.id)
    await db.commit()
    cust_res = await db.execute(select(models_pg.Customer).where(models_pg.Customer.id == m.customer_id))
    customer = cust_res.scalar_one_or_none()
    plan = (await db.execute(select(models_pg.MembershipPlan).where(models_pg.MembershipPlan.id == m.plan_id))).scalar_one_or_none() if m.plan_id else None
    return _membership_dict(m, customer=customer, plan=plan)


@router.post("/members/{membership_id}/credits")
async def issue_credits(
    membership_id: str,
    body: IssueCreditsBody,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(models_pg.Membership).where(
            models_pg.Membership.id == membership_id,
            models_pg.Membership.company_id == current_user.company_id,
        )
    )
    m = res.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")

    tx_type = "credit_issued" if body.amount > 0 else "credit_redeemed"
    m.credits_balance = Decimal(str(m.credits_balance or 0)) + Decimal(str(body.amount))
    m.updated_at = datetime.now(timezone.utc)

    tx = models_pg.MembershipTransaction(
        id=str(uuid.uuid4()),
        company_id=current_user.company_id,
        membership_id=m.id,
        customer_id=m.customer_id,
        transaction_type=tx_type,
        amount=body.amount,
        description=body.description,
        reference_id=body.reference_id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(tx)

    await _log_event(db, m.id, current_user.company_id, "benefit_used",
                     {"amount": body.amount, "description": body.description}, current_user.id)
    await db.commit()
    return {"credits_balance": float(m.credits_balance), "transaction": _tx_dict(tx)}


# ─── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    cid = current_user.company_id
    now = datetime.now(timezone.utc)

    # Total counts by status
    status_stmt = (
        select(models_pg.Membership.status, func.count(models_pg.Membership.id))
        .where(models_pg.Membership.company_id == cid)
        .group_by(models_pg.Membership.status)
    )
    status_res = await db.execute(status_stmt)
    status_counts = {row[0]: row[1] for row in status_res.all()}

    total = sum(status_counts.values())
    active = status_counts.get("active", 0)
    expired = status_counts.get("expired", 0)
    cancelled = status_counts.get("cancelled", 0)
    paused = status_counts.get("paused", 0)

    # New this month
    from datetime import timedelta
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_stmt = select(func.count(models_pg.Membership.id)).where(
        models_pg.Membership.company_id == cid,
        models_pg.Membership.enrolled_at >= month_start,
    )
    new_res = await db.execute(new_stmt)
    new_this_month = new_res.scalar() or 0

    # Expiring in 7 days
    seven_days = now + timedelta(days=7)
    expiring_stmt = select(func.count(models_pg.Membership.id)).where(
        models_pg.Membership.company_id == cid,
        models_pg.Membership.status == "active",
        models_pg.Membership.expires_at.isnot(None),
        models_pg.Membership.expires_at <= seven_days,
        models_pg.Membership.expires_at >= now,
    )
    expiring_res = await db.execute(expiring_stmt)
    expiring_soon = expiring_res.scalar() or 0

    # Members by plan
    by_plan_stmt = (
        select(models_pg.MembershipPlan.name, func.count(models_pg.Membership.id))
        .join(models_pg.Membership, models_pg.Membership.plan_id == models_pg.MembershipPlan.id)
        .where(
            models_pg.MembershipPlan.company_id == cid,
            models_pg.Membership.company_id == cid,
            models_pg.Membership.status == "active",
        )
        .group_by(models_pg.MembershipPlan.name)
    )
    by_plan_res = await db.execute(by_plan_stmt)
    members_by_plan = [{"plan_name": row[0], "count": row[1]} for row in by_plan_res.all()]

    # Total credits issued
    credits_stmt = select(func.sum(models_pg.MembershipTransaction.amount)).where(
        models_pg.MembershipTransaction.company_id == cid,
        models_pg.MembershipTransaction.transaction_type == "credit_issued",
    )
    credits_res = await db.execute(credits_stmt)
    total_credits_issued = float(credits_res.scalar() or 0)

    # Recent enrollments (last 5)
    recent_stmt = (
        select(models_pg.Membership, models_pg.Customer, models_pg.MembershipPlan)
        .join(models_pg.Customer, models_pg.Membership.customer_id == models_pg.Customer.id)
        .outerjoin(models_pg.MembershipPlan, models_pg.Membership.plan_id == models_pg.MembershipPlan.id)
        .where(models_pg.Membership.company_id == cid)
        .order_by(models_pg.Membership.enrolled_at.desc())
        .limit(5)
    )
    recent_res = await db.execute(recent_stmt)
    recent_enrollments = [_membership_dict(m, c, p) for m, c, p in recent_res.all()]

    # Recent cancellations (last 5)
    cancel_stmt = (
        select(models_pg.Membership, models_pg.Customer, models_pg.MembershipPlan)
        .join(models_pg.Customer, models_pg.Membership.customer_id == models_pg.Customer.id)
        .outerjoin(models_pg.MembershipPlan, models_pg.Membership.plan_id == models_pg.MembershipPlan.id)
        .where(
            models_pg.Membership.company_id == cid,
            models_pg.Membership.status == "cancelled",
        )
        .order_by(models_pg.Membership.cancelled_at.desc())
        .limit(5)
    )
    cancel_res = await db.execute(cancel_stmt)
    recent_cancellations = [_membership_dict(m, c, p) for m, c, p in cancel_res.all()]

    return {
        "total_members": total,
        "active_members": active,
        "expired_members": expired,
        "cancelled_members": cancelled,
        "paused_members": paused,
        "new_this_month": new_this_month,
        "expiring_soon": expiring_soon,
        "members_by_plan": members_by_plan,
        "total_credits_issued": total_credits_issued,
        "recent_enrollments": recent_enrollments,
        "recent_cancellations": recent_cancellations,
    }


# ─── Transactions ────────────────────────────────────────────────────────────

@router.get("/transactions")
async def get_transactions(
    membership_id: Optional[str] = Query(None),
    customer_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.MembershipTransaction).where(
        models_pg.MembershipTransaction.company_id == current_user.company_id
    )
    if membership_id:
        stmt = stmt.where(models_pg.MembershipTransaction.membership_id == membership_id)
    if customer_id:
        stmt = stmt.where(models_pg.MembershipTransaction.customer_id == customer_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar()

    stmt = stmt.order_by(models_pg.MembershipTransaction.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    res = await db.execute(stmt)
    txs = res.scalars().all()

    return {"transactions": [_tx_dict(t) for t in txs], "total": total, "page": page, "per_page": per_page}
