"""Flows — persistent storage for the Flow.js visual agent builder."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import get_db
from models_pg import Flow, VirtualAgent
from routes.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/flows", tags=["flows"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class FlowCreateBody(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: list = []
    edges: list = []
    viewport: dict = {}

class FlowUpdateBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    nodes: Optional[list] = None
    edges: Optional[list] = None
    viewport: Optional[dict] = None

class PublishAsAgentBody(BaseModel):
    name: str
    tagline: Optional[str] = None
    description: Optional[str] = None
    capabilities: list[str] = []
    value_metric_type: Optional[str] = None
    accent_color: Optional[str] = None


# ---------------------------------------------------------------------------
# Serialiser
# ---------------------------------------------------------------------------

def _flow_dict(flow: Flow, include_graph: bool = True) -> dict:
    d = {
        "id": flow.id,
        "name": flow.name,
        "description": flow.description,
        "status": flow.status,
        "created_by": flow.created_by,
        "created_at": flow.created_at.isoformat() if flow.created_at else None,
        "updated_at": flow.updated_at.isoformat() if flow.updated_at else None,
    }
    if include_graph:
        d["nodes"] = flow.nodes or []
        d["edges"] = flow.edges or []
        d["viewport"] = flow.viewport or {}
    return d


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_flows(db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(Flow)
        .where(Flow.company_id == current_user.company_id)
        .order_by(Flow.updated_at.desc().nullslast(), Flow.created_at.desc())
    )
    flows = result.scalars().all()
    return [_flow_dict(f, include_graph=False) for f in flows]


@router.post("")
async def create_flow(
    body: FlowCreateBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    flow = Flow(
        company_id=current_user.company_id,
        name=body.name,
        description=body.description,
        nodes=body.nodes,
        edges=body.edges,
        viewport=body.viewport,
        created_by=current_user.id,
    )
    db.add(flow)
    await db.commit()
    return _flow_dict(flow)


@router.get("/{flow_id}")
async def get_flow(flow_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(Flow).where(and_(Flow.id == flow_id, Flow.company_id == current_user.company_id))
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(404, "Flow not found")
    return _flow_dict(flow)


@router.put("/{flow_id}")
async def update_flow(
    flow_id: str,
    body: FlowUpdateBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(Flow).where(and_(Flow.id == flow_id, Flow.company_id == current_user.company_id))
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(404, "Flow not found")

    for field, val in body.dict(exclude_none=True).items():
        setattr(flow, field, val)
    flow.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return _flow_dict(flow)


@router.delete("/{flow_id}")
async def delete_flow(flow_id: str, db: AsyncSession = Depends(get_db), current_user=Depends(get_current_user)):
    result = await db.execute(
        select(Flow).where(and_(Flow.id == flow_id, Flow.company_id == current_user.company_id))
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(404, "Flow not found")
    await db.delete(flow)
    await db.commit()
    return {"message": "Flow deleted"}


@router.post("/{flow_id}/publish-as-agent")
async def publish_as_agent(
    flow_id: str,
    body: PublishAsAgentBody,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Corp tier: wrap a saved flow as a custom agent in the marketplace."""
    from routes.marketplace import _get_or_create_tier

    tier = await _get_or_create_tier(current_user.company_id, db)
    if not tier.allows_custom_agents:
        raise HTTPException(403, "Custom agents require the Corp tier")

    result = await db.execute(
        select(Flow).where(and_(Flow.id == flow_id, Flow.company_id == current_user.company_id))
    )
    flow = result.scalar_one_or_none()
    if not flow:
        raise HTTPException(404, "Flow not found")

    # Check if already published
    existing = await db.execute(
        select(VirtualAgent).where(VirtualAgent.flow_id == flow_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "This flow is already published as an agent")

    slug = f"custom-{body.name.lower().replace(' ', '-')}-{current_user.company_id[:6]}"
    agent = VirtualAgent(
        company_id=current_user.company_id,
        flow_id=flow_id,
        name=body.name,
        slug=slug,
        tagline=body.tagline,
        description=body.description,
        capabilities=body.capabilities,
        agent_tier="custom",
        tier_required="corp",
        value_metric_type=body.value_metric_type,
        is_free_eligible=False,
        accent_color=body.accent_color,
        system_prompt={"instructions": f"Execute the flow: {body.name}. {body.description or ''}"},
    )
    db.add(agent)
    flow.status = "active"
    await db.commit()
    return {"message": "Flow published as agent", "agent_id": agent.id, "slug": slug}
