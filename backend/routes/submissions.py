"""
Submission management routes.

Per-campaign:  /api/campaigns/{campaign_id}/submissions/...
Global view:   /api/submissions
Actions:       /api/submissions/{submission_id}/...
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg
from database_pg import get_db
from routes.dependencies import (
    get_campaign_type_scope,
    require_submissions_read,
    require_submissions_write,
    redact_sensitive_submission,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Retention → expiry months
# ---------------------------------------------------------------------------

_RETENTION_MONTHS = {
    "standard": 24,
    "extended": 36,
    "sensitive": 12,
    "regulated": 60,
}


# ---------------------------------------------------------------------------
# Stage-set helpers
# ---------------------------------------------------------------------------

def _get_stage_set(campaign: models_pg.Campaign, campaign_type: models_pg.CampaignType) -> dict:
    """Return the effective stage set for a campaign."""
    if campaign.lifecycle_stages_override:
        return campaign.lifecycle_stages_override
    return campaign_type.default_stage_set or {}


def _validate_transition(stage_set: dict, from_stage: str, to_stage: str) -> bool:
    """Return True if the transition is valid per the stage set transitions list."""
    transitions = stage_set.get("transitions", [])
    # No transitions defined → permissive fallback
    if not transitions:
        return True
    return any(
        t.get("from") == from_stage and t.get("to") == to_stage
        for t in transitions
    )


def _is_terminal(stage_set: dict, stage_key: str) -> dict | None:
    """Return the stage definition dict if stage_key is a terminal stage, else None."""
    for s in stage_set.get("stages", []):
        if s.get("key") == stage_key and s.get("is_terminal"):
            return s
    return None


def _is_promotion_eligible(stage_set: dict, stage_key: str) -> bool:
    for s in stage_set.get("stages", []):
        if s.get("key") == stage_key:
            return s.get("promotion_eligible", False)
    return False


def _find_terminal_stage_key(stage_set: dict, outcome: str) -> Optional[str]:
    """Return the stage key whose outcome matches, or None if not defined."""
    for s in stage_set.get("stages", []):
        if s.get("is_terminal") and s.get("outcome") == outcome:
            return s.get("key")
    return None


def _assert_campaign_type_scope(user, campaign_type_key: Optional[str]) -> None:
    """Raise 403 if the user's role restricts them from accessing this campaign type."""
    scope = get_campaign_type_scope(user.role)
    if scope is None or campaign_type_key in scope:
        return
    raise HTTPException(
        403,
        f"Your role '{user.role}' is restricted to campaign types: {', '.join(scope)}",
    )


def _get_stage_sla_hours(stage_set: dict, stage_key: str) -> int | None:
    """Return sla_hours for the given stage, or None if not defined."""
    for s in stage_set.get("stages", []):
        if s.get("key") == stage_key:
            return s.get("sla_hours")
    return None


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

def _ser_submission(
    s: models_pg.Submission,
    campaign_name: Optional[str] = None,
    campaign_type_key: Optional[str] = None,
) -> dict:
    return {
        "id": s.id,
        "campaign_id": s.campaign_id,
        "campaign_name": campaign_name,
        "campaign_type_key": campaign_type_key or s.campaign_type_snapshot,
        "source_channel": s.source_channel,
        "submitter_handle": s.submitter_handle,
        "responses": s.responses or {},
        "pii_field_names": s.pii_field_names or [],
        "common_name": s.common_name,
        "common_phone": s.common_phone,
        "common_email": s.common_email,
        "common_city": s.common_city,
        "common_pincode": s.common_pincode,
        "common_country": s.common_country,
        "score": s.score,
        "score_breakdown": s.score_breakdown or {},
        "stage": s.stage,
        "stage_entered_at": s.stage_entered_at.isoformat() if s.stage_entered_at else None,
        "assigned_to_user_id": s.assigned_to_user_id,
        "promoted_to_table": s.promoted_to_table,
        "promoted_to_id": s.promoted_to_id,
        "promoted_at": s.promoted_at.isoformat() if s.promoted_at else None,
        "lost_reason": s.lost_reason,
        "lost_at": s.lost_at.isoformat() if s.lost_at else None,
        "retention_class_snapshot": s.retention_class_snapshot,
        "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        "tags_snapshot": s.tags_snapshot or [],
        "consent_snapshot": s.consent_snapshot or {},
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


def _ser_event(e: models_pg.SubmissionEvent) -> dict:
    return {
        "id": e.id,
        "submission_id": e.submission_id,
        "kind": e.kind,
        "payload": e.payload or {},
        "actor_id": e.actor_id,
        "actor_type": e.actor_type,
        "occurred_at": e.occurred_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _get_campaign(
    campaign_id: str,
    tenant_id: str,
    db: AsyncSession,
) -> models_pg.Campaign:
    """Fetch a campaign with its campaign_type joined, scoped to tenant."""
    result = await db.execute(
        select(models_pg.Campaign).where(
            models_pg.Campaign.id == campaign_id,
            models_pg.Campaign.tenant_id == tenant_id,
        )
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(404, "Campaign not found")
    # Eagerly load campaign_type if not already loaded
    if campaign.campaign_type is None:
        ct_result = await db.execute(
            select(models_pg.CampaignType).where(
                models_pg.CampaignType.id == campaign.campaign_type_id
            )
        )
        campaign.campaign_type = ct_result.scalar_one_or_none()
    return campaign


async def _get_submission(
    submission_id: str,
    tenant_id: str,
    db: AsyncSession,
) -> models_pg.Submission:
    result = await db.execute(
        select(models_pg.Submission).where(
            models_pg.Submission.id == submission_id,
            models_pg.Submission.tenant_id == tenant_id,
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(404, "Submission not found")
    return sub


def _fire_event(
    submission_id: str,
    tenant_id: str,
    kind: str,
    payload: dict,
    actor_id: Optional[str],
) -> models_pg.SubmissionEvent:
    return models_pg.SubmissionEvent(
        id=str(uuid.uuid4()),
        submission_id=submission_id,
        tenant_id=tenant_id,
        kind=kind,
        payload=payload,
        actor_id=actor_id,
        actor_type="user" if actor_id else None,
    )


def _compute_expires_at(retention_class: str, from_dt: datetime) -> Optional[datetime]:
    months = _RETENTION_MONTHS.get(retention_class)
    if months is None:
        return None
    return from_dt + relativedelta(months=months)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class SubmissionCreate(BaseModel):
    source_channel: Optional[str] = None
    submitter_handle: Optional[str] = None
    responses: Optional[dict] = None
    pii_field_names: Optional[list] = None
    common_name: Optional[str] = None
    common_phone: Optional[str] = None
    common_email: Optional[str] = None
    common_city: Optional[str] = None
    common_pincode: Optional[str] = None
    common_country: Optional[str] = None
    consent_snapshot: Optional[dict] = None


class SubmissionUpdate(BaseModel):
    responses: Optional[dict] = None
    common_name: Optional[str] = None
    common_phone: Optional[str] = None
    common_email: Optional[str] = None
    common_city: Optional[str] = None
    common_pincode: Optional[str] = None
    common_country: Optional[str] = None
    assigned_to_user_id: Optional[str] = None
    score: Optional[int] = None
    score_breakdown: Optional[dict] = None


class AdvanceStageBody(BaseModel):
    to_stage: str
    lost_reason: Optional[str] = None


class NoteBody(BaseModel):
    text: str


class PromoteBody(BaseModel):
    reason: Optional[str] = None


class LoseBody(BaseModel):
    reason: str


# ---------------------------------------------------------------------------
# Per-campaign: list submissions
# ---------------------------------------------------------------------------

@router.get("/campaigns/{campaign_id}/submissions")
async def list_campaign_submissions(
    campaign_id: str,
    stage: Optional[str] = None,
    source_channel: Optional[str] = None,
    min_score: Optional[int] = None,
    max_score: Optional[int] = None,
    assigned_to_user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(require_submissions_read),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id

    campaign = await _get_campaign(campaign_id, tenant_id, db)
    _assert_campaign_type_scope(current_user, campaign.campaign_type.key if campaign.campaign_type else None)

    stmt = (
        select(models_pg.Submission)
        .where(
            models_pg.Submission.campaign_id == campaign_id,
            models_pg.Submission.tenant_id == tenant_id,
        )
    )

    if stage:
        stmt = stmt.where(models_pg.Submission.stage == stage)
    if source_channel:
        stmt = stmt.where(models_pg.Submission.source_channel == source_channel)
    if min_score is not None:
        stmt = stmt.where(models_pg.Submission.score >= min_score)
    if max_score is not None:
        stmt = stmt.where(models_pg.Submission.score <= max_score)
    if assigned_to_user_id:
        stmt = stmt.where(models_pg.Submission.assigned_to_user_id == assigned_to_user_id)

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    # Cursor pagination on (created_at DESC, id)
    paginated = stmt.order_by(
        desc(models_pg.Submission.created_at),
        desc(models_pg.Submission.id),
    ).limit(limit).offset(offset)

    rows = await db.execute(paginated)
    ct = campaign.campaign_type
    items = [
        redact_sensitive_submission(current_user, _ser_submission(s, campaign_name=campaign.name, campaign_type_key=ct.key if ct else None))
        for s in rows.scalars().all()
    ]

    return {"items": items, "total": total, "limit": limit, "offset": offset}


# ---------------------------------------------------------------------------
# Per-campaign: create submission
# ---------------------------------------------------------------------------

@router.post("/campaigns/{campaign_id}/submissions", status_code=201)
async def create_submission(
    campaign_id: str,
    body: SubmissionCreate,
    current_user=Depends(require_submissions_write),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id
    campaign = await _get_campaign(campaign_id, tenant_id, db)
    ct = campaign.campaign_type
    _assert_campaign_type_scope(current_user, ct.key if ct else None)

    now = datetime.now(timezone.utc)
    retention_class = campaign.retention_class or "standard"
    expires_at = _compute_expires_at(retention_class, now)

    sub = models_pg.Submission(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        campaign_id=campaign_id,
        campaign_type_snapshot=ct.key if ct else None,
        tag_group_id_snapshot=campaign.tag_group_id,
        tags_snapshot=campaign.tags or [],
        source_channel=body.source_channel,
        submitter_handle=body.submitter_handle,
        responses=body.responses or {},
        pii_field_names=body.pii_field_names or [],
        common_name=body.common_name,
        common_phone=body.common_phone,
        common_email=body.common_email,
        common_city=body.common_city,
        common_pincode=body.common_pincode,
        common_country=body.common_country,
        consent_snapshot=body.consent_snapshot or {},
        stage="new",
        stage_entered_at=now,
        retention_class_snapshot=retention_class,
        expires_at=expires_at,
        score=0,
        score_breakdown={},
    )
    db.add(sub)
    await db.flush()  # get sub.id before firing event

    event = _fire_event(sub.id, tenant_id, "created", {}, current_user.id)
    db.add(event)

    await db.commit()
    await db.refresh(sub)
    return _ser_submission(sub, campaign_name=campaign.name, campaign_type_key=ct.key if ct else None)


# ---------------------------------------------------------------------------
# Per-campaign: get single submission
# ---------------------------------------------------------------------------

@router.get("/campaigns/{campaign_id}/submissions/{submission_id}")
async def get_campaign_submission(
    campaign_id: str,
    submission_id: str,
    current_user=Depends(require_submissions_read),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id
    campaign = await _get_campaign(campaign_id, tenant_id, db)
    ct = campaign.campaign_type
    _assert_campaign_type_scope(current_user, ct.key if ct else None)

    sub = await _get_submission(submission_id, tenant_id, db)
    if sub.campaign_id != campaign_id:
        raise HTTPException(404, "Submission not found in this campaign")

    return redact_sensitive_submission(
        current_user,
        _ser_submission(sub, campaign_name=campaign.name, campaign_type_key=ct.key if ct else None),
    )


# ---------------------------------------------------------------------------
# Per-campaign: update submission
# ---------------------------------------------------------------------------

@router.put("/campaigns/{campaign_id}/submissions/{submission_id}")
async def update_campaign_submission(
    campaign_id: str,
    submission_id: str,
    body: SubmissionUpdate,
    current_user=Depends(require_submissions_write),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id
    campaign = await _get_campaign(campaign_id, tenant_id, db)
    ct = campaign.campaign_type
    _assert_campaign_type_scope(current_user, ct.key if ct else None)

    sub = await _get_submission(submission_id, tenant_id, db)
    if sub.campaign_id != campaign_id:
        raise HTTPException(404, "Submission not found in this campaign")

    changed_fields: List[str] = []
    if body.responses is not None:
        sub.responses = body.responses
        changed_fields.append("responses")
    if body.common_name is not None:
        sub.common_name = body.common_name
        changed_fields.append("common_name")
    if body.common_phone is not None:
        sub.common_phone = body.common_phone
        changed_fields.append("common_phone")
    if body.common_email is not None:
        sub.common_email = body.common_email
        changed_fields.append("common_email")
    if body.common_city is not None:
        sub.common_city = body.common_city
        changed_fields.append("common_city")
    if body.common_pincode is not None:
        sub.common_pincode = body.common_pincode
        changed_fields.append("common_pincode")
    if body.common_country is not None:
        sub.common_country = body.common_country
        changed_fields.append("common_country")
    if body.assigned_to_user_id is not None:
        sub.assigned_to_user_id = body.assigned_to_user_id
        changed_fields.append("assigned_to_user_id")
    if body.score is not None:
        sub.score = body.score
        changed_fields.append("score")
    if body.score_breakdown is not None:
        sub.score_breakdown = body.score_breakdown
        changed_fields.append("score_breakdown")

    sub.updated_at = datetime.now(timezone.utc)

    if changed_fields:
        event = _fire_event(
            sub.id,
            tenant_id,
            "field_updated",
            {"fields": changed_fields},
            current_user.id,
        )
        db.add(event)

    await db.commit()
    await db.refresh(sub)
    return redact_sensitive_submission(
        current_user,
        _ser_submission(sub, campaign_name=campaign.name, campaign_type_key=ct.key if ct else None),
    )


# ---------------------------------------------------------------------------
# Global submissions list
# ---------------------------------------------------------------------------

@router.get("/submissions")
async def list_submissions(
    campaign_id: Optional[str] = None,
    campaign_type_key: Optional[str] = None,
    stage: Optional[str] = None,
    source_channel: Optional[str] = None,
    min_score: Optional[int] = None,
    assigned_to_user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(require_submissions_read),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id

    stmt = (
        select(
            models_pg.Submission,
            models_pg.Campaign.name.label("campaign_name"),
            models_pg.CampaignType.key.label("campaign_type_key"),
        )
        .join(models_pg.Campaign, models_pg.Submission.campaign_id == models_pg.Campaign.id)
        .join(models_pg.CampaignType, models_pg.Campaign.campaign_type_id == models_pg.CampaignType.id)
        .where(models_pg.Submission.tenant_id == tenant_id)
    )

    # Enforce campaign-type scope for restricted roles
    role_scope = get_campaign_type_scope(current_user.role)
    if role_scope is not None:
        stmt = stmt.where(models_pg.CampaignType.key.in_(role_scope))

    if campaign_id:
        stmt = stmt.where(models_pg.Submission.campaign_id == campaign_id)
    if campaign_type_key:
        # Caller-supplied filter is further restricted by role scope (already applied above)
        stmt = stmt.where(models_pg.CampaignType.key == campaign_type_key)
    if stage:
        stmt = stmt.where(models_pg.Submission.stage == stage)
    if source_channel:
        stmt = stmt.where(models_pg.Submission.source_channel == source_channel)
    if min_score is not None:
        stmt = stmt.where(models_pg.Submission.score >= min_score)
    if assigned_to_user_id:
        stmt = stmt.where(models_pg.Submission.assigned_to_user_id == assigned_to_user_id)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    paginated = stmt.order_by(
        desc(models_pg.Submission.created_at),
        desc(models_pg.Submission.id),
    ).limit(limit).offset(offset)

    rows = await db.execute(paginated)
    items = []
    for row in rows.all():
        sub, camp_name, ct_key = row
        items.append(redact_sensitive_submission(
            current_user,
            _ser_submission(sub, campaign_name=camp_name, campaign_type_key=ct_key),
        ))

    return {"items": items, "total": total, "limit": limit, "offset": offset}


# ---------------------------------------------------------------------------
# Stage management
# ---------------------------------------------------------------------------

@router.post("/submissions/{submission_id}/advance-stage")
async def advance_stage(
    submission_id: str,
    body: AdvanceStageBody,
    current_user=Depends(require_submissions_write),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id
    sub = await _get_submission(submission_id, tenant_id, db)

    campaign = await _get_campaign(sub.campaign_id, tenant_id, db)
    ct = campaign.campaign_type
    _assert_campaign_type_scope(current_user, ct.key if ct else None)
    stage_set = _get_stage_set(campaign, ct)

    if not _validate_transition(stage_set, sub.stage, body.to_stage):
        raise HTTPException(
            422,
            f"Transition from '{sub.stage}' to '{body.to_stage}' is not permitted by this campaign's stage set",
        )

    terminal_def = _is_terminal(stage_set, body.to_stage)
    if terminal_def and terminal_def.get("outcome") == "lost":
        if not body.lost_reason:
            raise HTTPException(422, "lost_reason is required when advancing to a terminal lost stage")
        sub.lost_at = datetime.now(timezone.utc)
        sub.lost_reason = body.lost_reason

    old_stage = sub.stage
    sub.stage = body.to_stage
    sub.stage_entered_at = datetime.now(timezone.utc)
    sub.updated_at = datetime.now(timezone.utc)

    event = _fire_event(
        sub.id,
        tenant_id,
        "stage_changed",
        {"from": old_stage, "to": body.to_stage},
        current_user.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(sub)
    return redact_sensitive_submission(
        current_user,
        _ser_submission(sub, campaign_name=campaign.name, campaign_type_key=ct.key if ct else None),
    )


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------

@router.post("/submissions/{submission_id}/notes", status_code=201)
async def add_note(
    submission_id: str,
    body: NoteBody,
    current_user=Depends(require_submissions_write),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id
    sub = await _get_submission(submission_id, tenant_id, db)
    _assert_campaign_type_scope(current_user, sub.campaign_type_snapshot)

    event = _fire_event(
        sub.id,
        tenant_id,
        "note_added",
        {"text": body.text},
        current_user.id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return _ser_event(event)


# ---------------------------------------------------------------------------
# Submission events
# ---------------------------------------------------------------------------

@router.get("/submissions/{submission_id}/events")
async def list_submission_events(
    submission_id: str,
    current_user=Depends(require_submissions_read),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id
    sub = await _get_submission(submission_id, tenant_id, db)
    _assert_campaign_type_scope(current_user, sub.campaign_type_snapshot)

    result = await db.execute(
        select(models_pg.SubmissionEvent)
        .where(
            models_pg.SubmissionEvent.submission_id == submission_id,
            models_pg.SubmissionEvent.tenant_id == tenant_id,
        )
        .order_by(models_pg.SubmissionEvent.occurred_at)
    )
    return [_ser_event(e) for e in result.scalars().all()]


# ---------------------------------------------------------------------------
# Promote
# ---------------------------------------------------------------------------

@router.post("/submissions/{submission_id}/promote")
async def promote_submission(
    submission_id: str,
    body: PromoteBody,
    current_user=Depends(require_submissions_write),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id
    sub = await _get_submission(submission_id, tenant_id, db)

    campaign = await _get_campaign(sub.campaign_id, tenant_id, db)
    ct = campaign.campaign_type
    _assert_campaign_type_scope(current_user, ct.key if ct else None)
    stage_set = _get_stage_set(campaign, ct)

    # Check promotion eligibility
    if not _is_promotion_eligible(stage_set, sub.stage):
        raise HTTPException(
            422,
            f"Submission is in stage '{sub.stage}' which is not marked as promotion_eligible",
        )

    # Check qualification threshold
    threshold = campaign.qualification_threshold or 0
    if sub.score < threshold:
        raise HTTPException(
            422,
            f"Submission score {sub.score} is below the campaign qualification threshold of {threshold}",
        )

    if ct is None or ct.default_promotion_target is None:
        raise HTTPException(400, "This campaign type has no promotion target configured")

    target = ct.default_promotion_target

    if target in ("employees", "franchisees"):
        raise HTTPException(
            501,
            f"Motion not yet implemented: {target} promotion requires the {target} module to ship first",
        )

    if target != "customers":
        raise HTTPException(400, f"Unknown promotion target '{target}'")

    # --- Promote to customers ---
    now = datetime.now(timezone.utc)
    existing_customer: Optional[models_pg.Customer] = None

    if sub.common_phone:
        res = await db.execute(
            select(models_pg.Customer).where(
                models_pg.Customer.company_id == tenant_id,
                models_pg.Customer.phone == sub.common_phone,
            )
        )
        existing_customer = res.scalar_one_or_none()

    if not existing_customer and sub.common_email:
        res = await db.execute(
            select(models_pg.Customer).where(
                models_pg.Customer.company_id == tenant_id,
                models_pg.Customer.email == sub.common_email,
            )
        )
        existing_customer = res.scalar_one_or_none()

    was_existing = existing_customer is not None

    if existing_customer:
        customer = existing_customer
    else:
        customer = models_pg.Customer(
            id=str(uuid.uuid4()),
            company_id=tenant_id,
            name=sub.common_name or sub.submitter_handle or "Unknown",
            phone=sub.common_phone,
            email=sub.common_email,
            notes=f"Promoted from campaign submission (campaign_id={sub.campaign_id})",
        )
        db.add(customer)
        await db.flush()

    sub.promoted_to_table = "customers"
    sub.promoted_to_id = customer.id
    sub.promoted_at = now
    sub.updated_at = now

    # Advance to the terminal-won stage defined in the campaign's stage set
    won_stage_key = _find_terminal_stage_key(stage_set, "won") or "converted"
    old_stage = sub.stage
    sub.stage = won_stage_key
    sub.stage_entered_at = now

    promote_event = _fire_event(
        sub.id,
        tenant_id,
        "promoted",
        {
            "target_table": "customers",
            "target_id": customer.id,
            "was_existing": was_existing,
            "reason": body.reason,
        },
        current_user.id,
    )
    db.add(promote_event)

    if old_stage != won_stage_key:
        stage_event = _fire_event(
            sub.id,
            tenant_id,
            "stage_changed",
            {"from": old_stage, "to": won_stage_key},
            current_user.id,
        )
        db.add(stage_event)

    await db.commit()

    return {
        "status": "promoted",
        "submission_id": sub.id,
        "promoted_to_table": "customers",
        "promoted_to_id": customer.id,
        "was_existing": was_existing,
    }


# ---------------------------------------------------------------------------
# Mark lost
# ---------------------------------------------------------------------------

@router.post("/submissions/{submission_id}/lose")
async def lose_submission(
    submission_id: str,
    body: LoseBody,
    current_user=Depends(require_submissions_write),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = current_user.company_id
    sub = await _get_submission(submission_id, tenant_id, db)

    campaign = await _get_campaign(sub.campaign_id, tenant_id, db)
    ct = campaign.campaign_type
    _assert_campaign_type_scope(current_user, ct.key if ct else None)
    stage_set = _get_stage_set(campaign, ct)
    lost_stage_key = _find_terminal_stage_key(stage_set, "lost") or "lost"

    now = datetime.now(timezone.utc)
    old_stage = sub.stage
    sub.stage = lost_stage_key
    sub.stage_entered_at = now
    sub.lost_at = now
    sub.lost_reason = body.reason
    sub.updated_at = now

    event = _fire_event(
        sub.id,
        tenant_id,
        "lost",
        {"reason": body.reason, "from_stage": old_stage, "to_stage": lost_stage_key},
        current_user.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(sub)
    return _ser_submission(sub, campaign_name=campaign.name, campaign_type_key=ct.key if ct else None)


# ---------------------------------------------------------------------------
# Stage-set inspection
# ---------------------------------------------------------------------------

@router.get("/campaigns/{campaign_id}/stage-set")
async def get_campaign_stage_set(
    campaign_id: str,
    current_user=Depends(require_submissions_read),
    db: AsyncSession = Depends(get_db),
):
    """Return the effective stage set for a campaign (override or type default)."""
    tenant_id = current_user.company_id
    campaign = await _get_campaign(campaign_id, tenant_id, db)
    ct = campaign.campaign_type
    _assert_campaign_type_scope(current_user, ct.key if ct else None)
    stage_set = _get_stage_set(campaign, ct)
    return {
        "campaign_id": campaign_id,
        "is_override": bool(campaign.lifecycle_stages_override),
        "stage_set": stage_set,
    }


# ---------------------------------------------------------------------------
# Stuck-record detection
# ---------------------------------------------------------------------------

@router.get("/submissions/stuck")
async def list_stuck_submissions(
    campaign_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(require_submissions_read),
    db: AsyncSession = Depends(get_db),
):
    """Return active submissions that have exceeded their current stage's sla_hours."""
    tenant_id = current_user.company_id
    now = datetime.now(timezone.utc)

    stmt = (
        select(
            models_pg.Submission,
            models_pg.Campaign.name.label("campaign_name"),
            models_pg.Campaign.lifecycle_stages_override.label("lifecycle_stages_override"),
            models_pg.CampaignType.key.label("campaign_type_key"),
            models_pg.CampaignType.default_stage_set.label("default_stage_set"),
        )
        .join(models_pg.Campaign, models_pg.Submission.campaign_id == models_pg.Campaign.id)
        .join(models_pg.CampaignType, models_pg.Campaign.campaign_type_id == models_pg.CampaignType.id)
        .where(
            models_pg.Submission.tenant_id == tenant_id,
            models_pg.Submission.promoted_at.is_(None),
            models_pg.Submission.lost_at.is_(None),
            models_pg.Submission.stage_entered_at.isnot(None),
        )
    )

    role_scope = get_campaign_type_scope(current_user.role)
    if role_scope is not None:
        stmt = stmt.where(models_pg.CampaignType.key.in_(role_scope))

    if campaign_id:
        stmt = stmt.where(models_pg.Submission.campaign_id == campaign_id)

    rows = await db.execute(stmt.order_by(desc(models_pg.Submission.stage_entered_at)))

    stuck = []
    for row in rows.all():
        sub, camp_name, lc_override, ct_key, default_stage_set = row

        effective_stage_set = lc_override if lc_override else (default_stage_set or {})
        sla_hours = _get_stage_sla_hours(effective_stage_set, sub.stage)
        if sla_hours is None:
            continue

        elapsed_hours = (now - sub.stage_entered_at).total_seconds() / 3600
        if elapsed_hours <= sla_hours:
            continue

        item = redact_sensitive_submission(
            current_user,
            _ser_submission(sub, campaign_name=camp_name, campaign_type_key=ct_key),
        )
        item["sla_hours"] = sla_hours
        item["elapsed_hours"] = round(elapsed_hours, 1)
        item["sla_breached_by_hours"] = round(elapsed_hours - sla_hours, 1)
        stuck.append(item)

    total = len(stuck)
    return {"items": stuck[offset: offset + limit], "total": total, "limit": limit, "offset": offset}
