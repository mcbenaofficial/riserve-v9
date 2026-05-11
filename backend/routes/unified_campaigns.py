"""
Unified Campaign system routes (Addendum 6.2).

Handles CRUD for:
  - campaign_types       (read-only reference table, globally seeded)
  - campaign_tag_groups  (full CRUD, tenant-scoped)
  - campaigns            (full CRUD + lifecycle actions, tenant-scoped)
  - campaign_templates   (list + use/clone, built-in + tenant-scoped)

All routes mounted at /api by server.py.
Tenant isolation: current_user.company_id  →  models.tenant_id
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, List

import jsonschema
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update, func
from pydantic import BaseModel

from database_pg import get_db
from routes.dependencies import get_current_user
import models_pg
import schemas

router = APIRouter(tags=["Unified Campaigns"])


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _ser_campaign_type(ct: models_pg.CampaignType) -> dict:
    return {
        "id": ct.id,
        "key": ct.key,
        "display_name": ct.display_name,
        "description": ct.description,
        "default_stage_set": ct.default_stage_set,
        "default_promotion_target": ct.default_promotion_target,
        "default_retention_class": ct.default_retention_class,
        "meta_ad_category": ct.meta_ad_category,
        "requires_legal_disclosure": ct.requires_legal_disclosure,
    }


def _ser_tag_group(g: models_pg.CampaignTagGroup) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "description": g.description,
        "color_hex": g.color_hex,
        "created_by": g.created_by,
        "created_at": g.created_at.isoformat(),
    }


def _ser_campaign(
    c: models_pg.Campaign,
    type_key: Optional[str] = None,
    type_display: Optional[str] = None,
    submission_count: int = 0,
) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "internal_notes": c.internal_notes,
        "campaign_type_id": c.campaign_type_id,
        "campaign_type_key": type_key,
        "campaign_type_display": type_display,
        "tag_group_id": c.tag_group_id,
        "tags": c.tags or [],
        "status": c.status,
        "form_schema": c.form_schema or {},
        "audience_spec": c.audience_spec or {},
        "creative_refs": c.creative_refs or {},
        "lifecycle_stages_override": c.lifecycle_stages_override,
        "qualification_threshold": c.qualification_threshold,
        "retention_class": c.retention_class,
        "disclosure_footer": c.disclosure_footer,
        "agent_persona_id": c.agent_persona_id,
        "agent_autonomy_level": c.agent_autonomy_level,
        "start_at": c.start_at.isoformat() if c.start_at else None,
        "end_at": c.end_at.isoformat() if c.end_at else None,
        "daily_submission_cap": c.daily_submission_cap,
        "total_submission_cap": c.total_submission_cap,
        "created_by": c.created_by,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
        "submission_count": submission_count,
    }


def _ser_template(
    t: models_pg.CampaignTemplate,
    type_key: Optional[str] = None,
) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "campaign_type_id": t.campaign_type_id,
        "campaign_type_key": type_key,
        "form_schema": t.form_schema or {},
        "audience_spec": t.audience_spec or {},
        "default_creative_pattern": t.default_creative_pattern or {},
        "is_built_in": t.is_built_in,
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_campaign_type(
    db: AsyncSession, campaign_type_id: str
) -> Optional[models_pg.CampaignType]:
    result = await db.execute(
        select(models_pg.CampaignType).where(
            models_pg.CampaignType.id == campaign_type_id
        )
    )
    return result.scalar_one_or_none()


async def _fetch_campaign_owned(
    db: AsyncSession, campaign_id: str, tenant_id: str
) -> models_pg.Campaign:
    result = await db.execute(
        select(models_pg.Campaign).where(
            models_pg.Campaign.id == campaign_id,
            models_pg.Campaign.tenant_id == tenant_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return c


async def _enrich_campaign(
    db: AsyncSession, c: models_pg.Campaign
) -> dict:
    ct = await _fetch_campaign_type(db, c.campaign_type_id)
    return _ser_campaign(
        c,
        type_key=ct.key if ct else None,
        type_display=ct.display_name if ct else None,
    )


def _validate_form_schema(data: dict) -> None:
    """Validate form_schema if non-empty; raise 400 on failure."""
    if not data:
        return
    try:
        schemas.validate_form_schema(data)
    except jsonschema.ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e.message))


def _validate_audience_spec(data: dict) -> None:
    """Validate audience_spec if non-empty; raise 400 on failure."""
    if not data:
        return
    try:
        schemas.validate_audience_spec(data)
    except jsonschema.ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e.message))


# ---------------------------------------------------------------------------
# Pydantic bodies
# ---------------------------------------------------------------------------

class TagGroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color_hex: Optional[str] = None


class TagGroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color_hex: Optional[str] = None


class CampaignCreate(BaseModel):
    name: str
    description: Optional[str] = None
    internal_notes: Optional[str] = None
    campaign_type_id: str
    tag_group_id: Optional[str] = None
    tags: Optional[List[str]] = None
    form_schema: Optional[dict] = None
    audience_spec: Optional[dict] = None
    creative_refs: Optional[dict] = None
    lifecycle_stages_override: Optional[dict] = None
    qualification_threshold: Optional[int] = None
    agent_autonomy_level: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    daily_submission_cap: Optional[int] = None
    total_submission_cap: Optional[int] = None
    retention_class: Optional[str] = None
    disclosure_footer: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    internal_notes: Optional[str] = None
    campaign_type_id: Optional[str] = None
    tag_group_id: Optional[str] = None
    tags: Optional[List[str]] = None
    form_schema: Optional[dict] = None
    audience_spec: Optional[dict] = None
    creative_refs: Optional[dict] = None
    lifecycle_stages_override: Optional[dict] = None
    qualification_threshold: Optional[int] = None
    agent_autonomy_level: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    daily_submission_cap: Optional[int] = None
    total_submission_cap: Optional[int] = None
    retention_class: Optional[str] = None
    disclosure_footer: Optional[str] = None


class TemplateUseBody(BaseModel):
    name: str
    tag_group_id: Optional[str] = None


# ===========================================================================
# CAMPAIGN TYPES  (global reference table — no tenant filter)
# ===========================================================================

@router.get("/campaign-types")
async def list_campaign_types(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(models_pg.CampaignType))
    types = result.scalars().all()
    return [_ser_campaign_type(ct) for ct in types]


# ===========================================================================
# CAMPAIGN TAG GROUPS
# ===========================================================================

@router.get("/campaign-tag-groups")
async def list_tag_groups(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.CampaignTagGroup).where(
            models_pg.CampaignTagGroup.tenant_id == current_user.company_id
        )
    )
    groups = result.scalars().all()
    return [_ser_tag_group(g) for g in groups]


@router.post("/campaign-tag-groups", status_code=status.HTTP_201_CREATED)
async def create_tag_group(
    body: TagGroupCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    g = models_pg.CampaignTagGroup(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        name=body.name,
        description=body.description,
        color_hex=body.color_hex,
        created_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return _ser_tag_group(g)


@router.put("/campaign-tag-groups/{group_id}")
async def update_tag_group(
    group_id: str,
    body: TagGroupUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.CampaignTagGroup).where(
            models_pg.CampaignTagGroup.id == group_id,
            models_pg.CampaignTagGroup.tenant_id == current_user.company_id,
        )
    )
    g = result.scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Tag group not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(g, field, value)

    await db.commit()
    await db.refresh(g)
    return _ser_tag_group(g)


@router.delete("/campaign-tag-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tag_group(
    group_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.CampaignTagGroup).where(
            models_pg.CampaignTagGroup.id == group_id,
            models_pg.CampaignTagGroup.tenant_id == current_user.company_id,
        )
    )
    g = result.scalar_one_or_none()
    if not g:
        raise HTTPException(status_code=404, detail="Tag group not found")

    await db.delete(g)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# CAMPAIGNS
# ===========================================================================

@router.get("/campaigns")
async def list_campaigns(
    campaign_status: Optional[str] = None,
    campaign_type_key: Optional[str] = None,
    tag_group_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(models_pg.Campaign).where(
        models_pg.Campaign.tenant_id == current_user.company_id
    )

    if campaign_status:
        query = query.where(models_pg.Campaign.status == campaign_status)
    if tag_group_id:
        query = query.where(models_pg.Campaign.tag_group_id == tag_group_id)

    # Filter by campaign_type_key requires a join
    if campaign_type_key:
        query = query.join(
            models_pg.CampaignType,
            models_pg.Campaign.campaign_type_id == models_pg.CampaignType.id,
        ).where(models_pg.CampaignType.key == campaign_type_key)

    query = query.order_by(models_pg.Campaign.created_at.desc())
    result = await db.execute(query)
    campaigns = result.scalars().all()

    # Bulk-fetch campaign types referenced
    type_ids = list({c.campaign_type_id for c in campaigns})
    types_by_id: dict[str, models_pg.CampaignType] = {}
    if type_ids:
        t_result = await db.execute(
            select(models_pg.CampaignType).where(
                models_pg.CampaignType.id.in_(type_ids)
            )
        )
        for ct in t_result.scalars().all():
            types_by_id[ct.id] = ct

    # Bulk submission counts
    campaign_ids = [c.id for c in campaigns]
    counts_by_id: dict[str, int] = {}
    if campaign_ids:
        counts_result = await db.execute(
            select(
                models_pg.Submission.campaign_id,
                func.count(models_pg.Submission.id).label("cnt"),
            )
            .where(models_pg.Submission.campaign_id.in_(campaign_ids))
            .group_by(models_pg.Submission.campaign_id)
        )
        for row in counts_result.all():
            counts_by_id[row[0]] = row[1]

    return [
        _ser_campaign(
            c,
            type_key=types_by_id.get(c.campaign_type_id, None) and types_by_id[c.campaign_type_id].key,
            type_display=types_by_id.get(c.campaign_type_id, None) and types_by_id[c.campaign_type_id].display_name,
            submission_count=counts_by_id.get(c.id, 0),
        )
        for c in campaigns
    ]


@router.post("/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(
    body: CampaignCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate campaign_type exists
    ct = await _fetch_campaign_type(db, body.campaign_type_id)
    if not ct:
        raise HTTPException(status_code=404, detail="Campaign type not found")

    # Validate schemas if provided
    _validate_form_schema(body.form_schema or {})
    _validate_audience_spec(body.audience_spec or {})

    # Default retention_class from campaign type if not supplied
    retention_class = body.retention_class or ct.default_retention_class or "standard"

    now = datetime.now(timezone.utc)
    c = models_pg.Campaign(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        name=body.name,
        description=body.description,
        internal_notes=body.internal_notes,
        campaign_type_id=body.campaign_type_id,
        tag_group_id=body.tag_group_id,
        tags=body.tags or [],
        status="draft",
        form_schema=body.form_schema or {},
        audience_spec=body.audience_spec or {},
        creative_refs=body.creative_refs or {},
        lifecycle_stages_override=body.lifecycle_stages_override,
        qualification_threshold=body.qualification_threshold if body.qualification_threshold is not None else 40,
        agent_autonomy_level=body.agent_autonomy_level or "L1",
        start_at=body.start_at,
        end_at=body.end_at,
        daily_submission_cap=body.daily_submission_cap,
        total_submission_cap=body.total_submission_cap,
        retention_class=retention_class,
        disclosure_footer=body.disclosure_footer,
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _ser_campaign(c, type_key=ct.key, type_display=ct.display_name)


@router.get("/campaigns/{campaign_id}")
async def get_campaign(
    campaign_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _fetch_campaign_owned(db, campaign_id, current_user.company_id)
    return await _enrich_campaign(db, c)


@router.put("/campaigns/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _fetch_campaign_owned(db, campaign_id, current_user.company_id)

    update_data = body.model_dump(exclude_unset=True)

    # If campaign_type_id is changing, validate the new type exists
    if "campaign_type_id" in update_data:
        ct = await _fetch_campaign_type(db, update_data["campaign_type_id"])
        if not ct:
            raise HTTPException(status_code=404, detail="Campaign type not found")

    # Re-validate schemas if they are being changed
    if "form_schema" in update_data:
        _validate_form_schema(update_data["form_schema"] or {})
    if "audience_spec" in update_data:
        _validate_audience_spec(update_data["audience_spec"] or {})

    for field, value in update_data.items():
        setattr(c, field, value)

    c.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(c)
    return await _enrich_campaign(db, c)


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    c = await _fetch_campaign_owned(db, campaign_id, current_user.company_id)

    # Guard: do not delete campaigns that have active submissions
    sub_count_result = await db.execute(
        select(func.count()).where(
            models_pg.Submission.campaign_id == campaign_id,
            models_pg.Submission.tenant_id == current_user.company_id,
        )
    )
    sub_count = sub_count_result.scalar_one()
    if sub_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete campaign with {sub_count} submission(s). Archive it instead.",
        )

    await db.delete(c)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Lifecycle actions
# ---------------------------------------------------------------------------

async def _set_campaign_status(
    campaign_id: str,
    new_status: str,
    current_user,
    db: AsyncSession,
) -> dict:
    c = await _fetch_campaign_owned(db, campaign_id, current_user.company_id)
    c.status = new_status
    c.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(c)
    return await _enrich_campaign(db, c)


@router.post("/campaigns/{campaign_id}/activate")
async def activate_campaign(
    campaign_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _set_campaign_status(campaign_id, "active", current_user, db)


@router.post("/campaigns/{campaign_id}/pause")
async def pause_campaign(
    campaign_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _set_campaign_status(campaign_id, "paused", current_user, db)


@router.post("/campaigns/{campaign_id}/archive")
async def archive_campaign(
    campaign_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _set_campaign_status(campaign_id, "archived", current_user, db)


# ===========================================================================
# CAMPAIGN TEMPLATES
# ===========================================================================

@router.get("/campaign-templates")
async def list_campaign_templates(
    campaign_type_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns built-in templates (tenant_id IS NULL) plus the tenant's own templates.
    Optionally filtered by campaign_type_id.
    """
    from sqlalchemy import or_

    query = (
        select(models_pg.CampaignTemplate)
        .where(
            models_pg.CampaignTemplate.is_active == True,
            or_(
                models_pg.CampaignTemplate.tenant_id.is_(None),
                models_pg.CampaignTemplate.tenant_id == current_user.company_id,
            ),
        )
    )

    if campaign_type_id:
        query = query.where(
            models_pg.CampaignTemplate.campaign_type_id == campaign_type_id
        )

    result = await db.execute(query)
    templates = result.scalars().all()

    # Bulk-fetch campaign types
    type_ids = list({t.campaign_type_id for t in templates})
    types_by_id: dict[str, models_pg.CampaignType] = {}
    if type_ids:
        t_result = await db.execute(
            select(models_pg.CampaignType).where(
                models_pg.CampaignType.id.in_(type_ids)
            )
        )
        for ct in t_result.scalars().all():
            types_by_id[ct.id] = ct

    return [
        _ser_template(
            t,
            type_key=types_by_id[t.campaign_type_id].key if t.campaign_type_id in types_by_id else None,
        )
        for t in templates
    ]


@router.post("/campaign-templates/{template_id}/use", status_code=status.HTTP_201_CREATED)
async def use_campaign_template(
    template_id: str,
    body: TemplateUseBody,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Clone a template into a new Campaign owned by the current tenant.
    """
    from sqlalchemy import or_

    result = await db.execute(
        select(models_pg.CampaignTemplate).where(
            models_pg.CampaignTemplate.id == template_id,
            models_pg.CampaignTemplate.is_active == True,
            or_(
                models_pg.CampaignTemplate.tenant_id.is_(None),
                models_pg.CampaignTemplate.tenant_id == current_user.company_id,
            ),
        )
    )
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")

    ct = await _fetch_campaign_type(db, tmpl.campaign_type_id)

    now = datetime.now(timezone.utc)
    c = models_pg.Campaign(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        name=body.name,
        description=tmpl.description,
        campaign_type_id=tmpl.campaign_type_id,
        tag_group_id=body.tag_group_id,
        tags=[],
        status="draft",
        form_schema=tmpl.form_schema or {},
        audience_spec=tmpl.audience_spec or {},
        creative_refs={},
        qualification_threshold=40,
        agent_autonomy_level="L1",
        retention_class=(ct.default_retention_class if ct else "standard") or "standard",
        created_by=current_user.id,
        created_at=now,
        updated_at=now,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _ser_campaign(
        c,
        type_key=ct.key if ct else None,
        type_display=ct.display_name if ct else None,
    )
