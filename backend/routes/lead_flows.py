"""
Lead triggers and lead flows management.
All routes at /api/lead-flows/... and /api/lead-triggers/...
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from database_pg import get_db
from routes.dependencies import get_current_user
import models_pg

router = APIRouter(tags=["LeadFlows"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ser_flow(f: models_pg.LeadFlow) -> dict:
    return {
        "id": f.id,
        "name": f.name,
        "version": f.version,
        "graph": f.graph or {},
        "is_active": f.is_active,
        "lead_magnet": f.lead_magnet,
        "qualification_threshold": f.qualification_threshold,
        "created_at": f.created_at,
        "updated_at": f.updated_at,
    }


def _ser_trigger(t: models_pg.LeadTrigger) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "source_post_id": t.source_post_id,
        "trigger_type": t.trigger_type,
        "match_rules": t.match_rules or {},
        "flow_id": t.flow_id,
        "is_active": t.is_active,
        "daily_cap": t.daily_cap,
        "hourly_cap": t.hourly_cap,
        "applies_to": t.applies_to,
        "specific_post_ids": t.specific_post_ids or [],
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


# ---------------------------------------------------------------------------
# Lead Flows
# ---------------------------------------------------------------------------

class LeadFlowCreate(BaseModel):
    name: str
    graph: Optional[dict] = {}
    lead_magnet: Optional[dict] = None
    qualification_threshold: Optional[int] = 50


class LeadFlowUpdate(BaseModel):
    name: Optional[str] = None
    graph: Optional[dict] = None
    is_active: Optional[bool] = None
    lead_magnet: Optional[dict] = None
    qualification_threshold: Optional[int] = None


@router.get("/lead-flows")
async def list_flows(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadFlow).where(
            models_pg.LeadFlow.tenant_id == current_user.company_id
        ).order_by(desc(models_pg.LeadFlow.created_at))
    )
    return [_ser_flow(f) for f in result.scalars().all()]


@router.post("/lead-flows", status_code=201)
async def create_flow(
    body: LeadFlowCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    flow = models_pg.LeadFlow(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        name=body.name,
        graph=body.graph or {},
        is_active=True,
        lead_magnet=body.lead_magnet,
        qualification_threshold=body.qualification_threshold or 50,
    )
    db.add(flow)
    await db.commit()
    await db.refresh(flow)
    return _ser_flow(flow)


@router.get("/lead-flows/{flow_id}")
async def get_flow(
    flow_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadFlow).where(
            models_pg.LeadFlow.id == flow_id,
            models_pg.LeadFlow.tenant_id == current_user.company_id,
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(404, "Flow not found")
    return _ser_flow(flow)


@router.put("/lead-flows/{flow_id}")
async def update_flow(
    flow_id: str,
    body: LeadFlowUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadFlow).where(
            models_pg.LeadFlow.id == flow_id,
            models_pg.LeadFlow.tenant_id == current_user.company_id,
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(404, "Flow not found")
    if body.name is not None:
        flow.name = body.name
    if body.graph is not None:
        flow.graph = body.graph
        flow.version = (flow.version or 1) + 1
    if body.is_active is not None:
        flow.is_active = body.is_active
    if body.lead_magnet is not None:
        flow.lead_magnet = body.lead_magnet
    if body.qualification_threshold is not None:
        flow.qualification_threshold = body.qualification_threshold
    flow.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(flow)
    return _ser_flow(flow)


@router.delete("/lead-flows/{flow_id}", status_code=204)
async def delete_flow(
    flow_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadFlow).where(
            models_pg.LeadFlow.id == flow_id,
            models_pg.LeadFlow.tenant_id == current_user.company_id,
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(404, "Flow not found")
    await db.delete(flow)
    await db.commit()


@router.post("/lead-flows/{flow_id}/toggle")
async def toggle_flow(
    flow_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadFlow).where(
            models_pg.LeadFlow.id == flow_id,
            models_pg.LeadFlow.tenant_id == current_user.company_id,
        )
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(404, "Flow not found")
    flow.is_active = not flow.is_active
    flow.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"flow_id": flow_id, "is_active": flow.is_active}


# ---------------------------------------------------------------------------
# Lead Triggers
# ---------------------------------------------------------------------------

class LeadTriggerCreate(BaseModel):
    name: str
    trigger_type: str
    source_post_id: Optional[str] = None
    match_rules: Optional[dict] = {}
    flow_id: Optional[str] = None
    daily_cap: Optional[int] = None
    hourly_cap: Optional[int] = None
    applies_to: Optional[str] = "all_posts"
    specific_post_ids: Optional[List[str]] = []


class LeadTriggerUpdate(BaseModel):
    name: Optional[str] = None
    trigger_type: Optional[str] = None
    source_post_id: Optional[str] = None
    match_rules: Optional[dict] = None
    flow_id: Optional[str] = None
    is_active: Optional[bool] = None
    daily_cap: Optional[int] = None
    hourly_cap: Optional[int] = None
    applies_to: Optional[str] = None
    specific_post_ids: Optional[List[str]] = None


@router.get("/lead-triggers")
async def list_triggers(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadTrigger).where(
            models_pg.LeadTrigger.tenant_id == current_user.company_id
        ).order_by(desc(models_pg.LeadTrigger.created_at))
    )
    return [_ser_trigger(t) for t in result.scalars().all()]


@router.post("/lead-triggers", status_code=201)
async def create_trigger(
    body: LeadTriggerCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.flow_id:
        flow = (await db.execute(
            select(models_pg.LeadFlow).where(
                models_pg.LeadFlow.id == body.flow_id,
                models_pg.LeadFlow.tenant_id == current_user.company_id,
            )
        )).scalar_one_or_none()
        if not flow:
            raise HTTPException(404, "Lead flow not found")

    trigger = models_pg.LeadTrigger(
        id=str(uuid.uuid4()),
        tenant_id=current_user.company_id,
        name=body.name,
        trigger_type=body.trigger_type,
        source_post_id=body.source_post_id,
        match_rules=body.match_rules or {},
        flow_id=body.flow_id,
        is_active=True,
        daily_cap=body.daily_cap,
        hourly_cap=body.hourly_cap,
        applies_to=body.applies_to or "all_posts",
        specific_post_ids=body.specific_post_ids or [],
    )
    db.add(trigger)
    await db.commit()
    await db.refresh(trigger)
    return _ser_trigger(trigger)


@router.put("/lead-triggers/{trigger_id}")
async def update_trigger(
    trigger_id: str,
    body: LeadTriggerUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadTrigger).where(
            models_pg.LeadTrigger.id == trigger_id,
            models_pg.LeadTrigger.tenant_id == current_user.company_id,
        )
    )
    trigger = result.scalar_one_or_none()
    if not trigger:
        raise HTTPException(404, "Trigger not found")
    if body.name is not None:
        trigger.name = body.name
    if body.trigger_type is not None:
        trigger.trigger_type = body.trigger_type
    if body.source_post_id is not None:
        trigger.source_post_id = body.source_post_id
    if body.match_rules is not None:
        trigger.match_rules = body.match_rules
    if body.flow_id is not None:
        trigger.flow_id = body.flow_id
    if body.is_active is not None:
        trigger.is_active = body.is_active
    if body.daily_cap is not None:
        trigger.daily_cap = body.daily_cap
    if body.hourly_cap is not None:
        trigger.hourly_cap = body.hourly_cap
    if body.applies_to is not None:
        trigger.applies_to = body.applies_to
    if body.specific_post_ids is not None:
        trigger.specific_post_ids = body.specific_post_ids
    trigger.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(trigger)
    return _ser_trigger(trigger)


@router.delete("/lead-triggers/{trigger_id}", status_code=204)
async def delete_trigger(
    trigger_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadTrigger).where(
            models_pg.LeadTrigger.id == trigger_id,
            models_pg.LeadTrigger.tenant_id == current_user.company_id,
        )
    )
    trigger = result.scalar_one_or_none()
    if not trigger:
        raise HTTPException(404, "Trigger not found")
    await db.delete(trigger)
    await db.commit()


@router.post("/lead-triggers/{trigger_id}/toggle")
async def toggle_trigger(
    trigger_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.LeadTrigger).where(
            models_pg.LeadTrigger.id == trigger_id,
            models_pg.LeadTrigger.tenant_id == current_user.company_id,
        )
    )
    trigger = result.scalar_one_or_none()
    if not trigger:
        raise HTTPException(404, "Trigger not found")
    trigger.is_active = not trigger.is_active
    trigger.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"trigger_id": trigger_id, "is_active": trigger.is_active}
