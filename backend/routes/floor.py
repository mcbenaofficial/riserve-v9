"""
Floor Plan — Phase 1 REST + WebSocket API.

Prefix: /floor   (mounted at /api/floor in server.py)
Tag:    Floor
Feature gate: floor_plan  (pro + custom plans)

Endpoints:
  Zones:
    POST   /floor/zones
    GET    /floor/zones
    PUT    /floor/zones/{zone_id}
    DELETE /floor/zones/{zone_id}

  Tables:
    POST   /floor/tables
    GET    /floor/tables
    PUT    /floor/tables/{table_id}
    DELETE /floor/tables/{table_id}
    POST   /floor/tables/{table_id}/regenerate-qr
    GET    /floor/tables/{table_id}/log

  Transitions:
    POST   /floor/tables/{table_id}/transition

  Servers:
    POST   /floor/servers
    GET    /floor/servers
    PUT    /floor/servers/{server_id}
    DELETE /floor/servers/{server_id}
    PUT    /floor/servers/{server_id}/assign/{table_id}

  WebSocket:
    WS     /floor/stream?token=<jwt>
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import jwt as pyjwt
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

import models_pg
from database_pg import get_db
from routes.dependencies import (
    SECRET_KEY,
    ALGORITHM,
    User,
    get_current_user,
    require_feature,
)
from services.floor_state_machine import get_allowed_transitions, transition_table
from services.ws_manager import floor_ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/floor",
    tags=["Floor"],
    dependencies=[Depends(require_feature("floor_plan"))],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _table_dict(table: models_pg.FloorTable) -> dict:
    """Serialise FloorTable ORM object to a dict, appending allowed_next_states."""
    return {
        "id": table.id,
        "company_id": table.company_id,
        "outlet_id": table.outlet_id,
        "zone_id": table.zone_id,
        "label": table.label,
        "seats_default": table.seats_default,
        "seats_max": table.seats_max,
        "shape": table.shape,
        "x_pct": float(table.x_pct) if table.x_pct is not None else 0,
        "y_pct": float(table.y_pct) if table.y_pct is not None else 0,
        "w_pct": float(table.w_pct) if table.w_pct is not None else 10,
        "h_pct": float(table.h_pct) if table.h_pct is not None else 10,
        "rotation_deg": table.rotation_deg,
        "is_combinable": table.is_combinable,
        "combine_group": table.combine_group,
        "status": table.status,
        "status_since": table.status_since.isoformat() if table.status_since else None,
        "current_session_id": table.current_session_id,
        "assigned_server_id": table.assigned_server_id,
        "qr_token": table.qr_token,
        "created_at": table.created_at.isoformat() if table.created_at else None,
        "updated_at": table.updated_at.isoformat() if table.updated_at else None,
        "allowed_next_states": get_allowed_transitions(table.status or "available"),
    }


async def _broadcast_layout_changed(company_id: str, entity: str, entity_id: str, action: str) -> None:
    await floor_ws_manager.broadcast(
        company_id,
        {
            "event_id": str(uuid.uuid4()),
            "event_type": "layout_changed",
            "company_id": company_id,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "payload": {"entity": entity, "entity_id": entity_id, "action": action},
        },
    )


# ---------------------------------------------------------------------------
# Zones
# ---------------------------------------------------------------------------

class ZoneCreate(BaseModel):
    outlet_id: str
    name: str
    sort_order: int = 0
    color: str = "#6366f1"
    layout_meta: dict = {}


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    color: Optional[str] = None
    layout_meta: Optional[dict] = None


@router.post("/zones", status_code=201)
async def create_zone(
    body: ZoneCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    zone = models_pg.FloorZone(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        name=body.name,
        sort_order=body.sort_order,
        color=body.color,
        layout_meta=body.layout_meta,
    )
    db.add(zone)
    await db.commit()
    await db.refresh(zone)
    await _broadcast_layout_changed(current_user.company_id, "zone", zone.id, "created")
    return zone


@router.get("/zones")
async def list_zones(
    outlet_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.FloorZone).where(
        models_pg.FloorZone.company_id == current_user.company_id
    )
    if outlet_id:
        stmt = stmt.where(models_pg.FloorZone.outlet_id == outlet_id)
    stmt = stmt.order_by(models_pg.FloorZone.sort_order)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/zones/{zone_id}")
async def update_zone(
    zone_id: str,
    body: ZoneUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.FloorZone).where(
            models_pg.FloorZone.id == zone_id,
            models_pg.FloorZone.company_id == current_user.company_id,
        )
    )
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    if body.name is not None:
        zone.name = body.name
    if body.sort_order is not None:
        zone.sort_order = body.sort_order
    if body.color is not None:
        zone.color = body.color
    if body.layout_meta is not None:
        zone.layout_meta = body.layout_meta

    await db.commit()
    await db.refresh(zone)
    await _broadcast_layout_changed(current_user.company_id, "zone", zone_id, "updated")
    return zone


@router.delete("/zones/{zone_id}", status_code=204)
async def delete_zone(
    zone_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.FloorZone).where(
            models_pg.FloorZone.id == zone_id,
            models_pg.FloorZone.company_id == current_user.company_id,
        )
    )
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    await db.delete(zone)
    await db.commit()
    await _broadcast_layout_changed(current_user.company_id, "zone", zone_id, "deleted")


# ---------------------------------------------------------------------------
# Tables
# ---------------------------------------------------------------------------

class TableCreate(BaseModel):
    outlet_id: str
    zone_id: Optional[str] = None
    label: str
    seats_default: int = 2
    seats_max: int = 2
    shape: str = "rect"
    x_pct: float = 0
    y_pct: float = 0
    w_pct: float = 10
    h_pct: float = 10
    rotation_deg: int = 0
    is_combinable: bool = False
    combine_group: Optional[str] = None


class TableUpdate(BaseModel):
    label: Optional[str] = None
    zone_id: Optional[str] = None
    seats_default: Optional[int] = None
    seats_max: Optional[int] = None
    shape: Optional[str] = None
    x_pct: Optional[float] = None
    y_pct: Optional[float] = None
    w_pct: Optional[float] = None
    h_pct: Optional[float] = None
    rotation_deg: Optional[int] = None
    is_combinable: Optional[bool] = None
    combine_group: Optional[str] = None


@router.post("/tables", status_code=201)
async def create_table(
    body: TableCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    table = models_pg.FloorTable(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        zone_id=body.zone_id,
        label=body.label,
        seats_default=body.seats_default,
        seats_max=body.seats_max,
        shape=body.shape,
        x_pct=body.x_pct,
        y_pct=body.y_pct,
        w_pct=body.w_pct,
        h_pct=body.h_pct,
        rotation_deg=body.rotation_deg,
        is_combinable=body.is_combinable,
        combine_group=body.combine_group,
        qr_token=str(uuid.uuid4()),
    )
    db.add(table)
    await db.commit()
    await db.refresh(table)
    await _broadcast_layout_changed(current_user.company_id, "table", table.id, "created")
    return _table_dict(table)


@router.get("/tables")
async def list_tables(
    outlet_id: Optional[str] = Query(None),
    zone_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.FloorTable).where(
        models_pg.FloorTable.company_id == current_user.company_id
    )
    if outlet_id:
        stmt = stmt.where(models_pg.FloorTable.outlet_id == outlet_id)
    if zone_id:
        stmt = stmt.where(models_pg.FloorTable.zone_id == zone_id)
    if status:
        stmt = stmt.where(models_pg.FloorTable.status == status)
    stmt = stmt.order_by(models_pg.FloorTable.label)
    result = await db.execute(stmt)
    tables = result.scalars().all()
    return [_table_dict(t) for t in tables]


@router.put("/tables/{table_id}")
async def update_table(
    table_id: str,
    body: TableUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.FloorTable).where(
            models_pg.FloorTable.id == table_id,
            models_pg.FloorTable.company_id == current_user.company_id,
        )
    )
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    for field in ("label", "zone_id", "seats_default", "seats_max", "shape",
                  "x_pct", "y_pct", "w_pct", "h_pct", "rotation_deg",
                  "is_combinable", "combine_group"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(table, field, val)

    table.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(table)
    await _broadcast_layout_changed(current_user.company_id, "table", table_id, "updated")
    return _table_dict(table)


@router.delete("/tables/{table_id}", status_code=204)
async def delete_table(
    table_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.FloorTable).where(
            models_pg.FloorTable.id == table_id,
            models_pg.FloorTable.company_id == current_user.company_id,
        )
    )
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    await db.delete(table)
    await db.commit()
    await _broadcast_layout_changed(current_user.company_id, "table", table_id, "deleted")


@router.post("/tables/{table_id}/regenerate-qr")
async def regenerate_qr(
    table_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.FloorTable).where(
            models_pg.FloorTable.id == table_id,
            models_pg.FloorTable.company_id == current_user.company_id,
        )
    )
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    new_token = str(uuid.uuid4())
    table.qr_token = new_token
    table.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"table_id": table_id, "qr_token": new_token}


@router.get("/tables/{table_id}/log")
async def get_table_log(
    table_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify table belongs to company
    exists = (
        await db.execute(
            select(models_pg.FloorTable.id).where(
                models_pg.FloorTable.id == table_id,
                models_pg.FloorTable.company_id == current_user.company_id,
            )
        )
    ).scalar_one_or_none()
    if not exists:
        raise HTTPException(status_code=404, detail="Table not found")

    total_result = await db.execute(
        select(func.count(models_pg.FloorTableLog.id)).where(
            models_pg.FloorTableLog.table_id == table_id
        )
    )
    total = total_result.scalar() or 0

    offset = (page - 1) * page_size
    rows_result = await db.execute(
        select(models_pg.FloorTableLog)
        .where(models_pg.FloorTableLog.table_id == table_id)
        .order_by(models_pg.FloorTableLog.changed_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = rows_result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": r.id,
                "table_id": r.table_id,
                "from_status": r.from_status,
                "to_status": r.to_status,
                "session_id": r.session_id,
                "server_id": r.server_id,
                "changed_by_user_id": r.changed_by_user_id,
                "changed_at": r.changed_at.isoformat() if r.changed_at else None,
                "duration_prev_ms": r.duration_prev_ms,
                "source": r.source,
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# Transitions
# ---------------------------------------------------------------------------

class TransitionBody(BaseModel):
    to_status: str
    source: str = "manual"
    session_id: Optional[str] = None
    server_id: Optional[str] = None


@router.post("/tables/{table_id}/transition")
async def transition_table_endpoint(
    table_id: str,
    body: TransitionBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    table = await transition_table(
        db=db,
        company_id=current_user.company_id,
        table_id=table_id,
        to_status=body.to_status,
        changed_by_user_id=current_user.id,
        source=body.source,
        session_id=body.session_id,
        server_id=body.server_id,
    )
    await db.commit()
    await db.refresh(table)

    table_data = _table_dict(table)

    # Broadcast WebSocket event
    ws_payload = {
        "event_id": str(uuid.uuid4()),
        "event_type": "table_state_changed",
        "company_id": current_user.company_id,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "actor": {"type": "user", "id": current_user.id},
        "payload": {
            "table_id": table_id,
            "from_status": table_data.get("status"),   # after transition this is to_status
            "to_status": body.to_status,
            "allowed_next_states": table_data["allowed_next_states"],
        },
    }
    await floor_ws_manager.broadcast(current_user.company_id, ws_payload)

    return table_data


# ---------------------------------------------------------------------------
# Servers
# ---------------------------------------------------------------------------

class ServerCreate(BaseModel):
    outlet_id: str
    staff_id: Optional[str] = None
    name: str
    code: Optional[str] = None
    active_sections: list = []
    shift_start: Optional[datetime] = None
    shift_end: Optional[datetime] = None


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    active_sections: Optional[list] = None
    shift_start: Optional[datetime] = None
    shift_end: Optional[datetime] = None
    is_active: Optional[bool] = None


@router.post("/servers", status_code=201)
async def create_server(
    body: ServerCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    server = models_pg.FloorServer(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        staff_id=body.staff_id,
        name=body.name,
        code=body.code,
        active_sections=body.active_sections,
        shift_start=body.shift_start,
        shift_end=body.shift_end,
    )
    db.add(server)
    await db.commit()
    await db.refresh(server)
    return server


@router.get("/servers")
async def list_servers(
    outlet_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(models_pg.FloorServer).where(
        models_pg.FloorServer.company_id == current_user.company_id
    )
    if outlet_id:
        stmt = stmt.where(models_pg.FloorServer.outlet_id == outlet_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/servers/{server_id}")
async def update_server(
    server_id: str,
    body: ServerUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.FloorServer).where(
            models_pg.FloorServer.id == server_id,
            models_pg.FloorServer.company_id == current_user.company_id,
        )
    )
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    for field in ("name", "code", "active_sections", "shift_start", "shift_end", "is_active"):
        val = getattr(body, field, None)
        if val is not None:
            setattr(server, field, val)

    await db.commit()
    await db.refresh(server)
    return server


@router.delete("/servers/{server_id}", status_code=204)
async def delete_server(
    server_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.FloorServer).where(
            models_pg.FloorServer.id == server_id,
            models_pg.FloorServer.company_id == current_user.company_id,
        )
    )
    server = result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    await db.delete(server)
    await db.commit()


@router.put("/servers/{server_id}/assign/{table_id}")
async def assign_server_to_table(
    server_id: str,
    table_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch server
    srv_result = await db.execute(
        select(models_pg.FloorServer).where(
            models_pg.FloorServer.id == server_id,
            models_pg.FloorServer.company_id == current_user.company_id,
        )
    )
    server = srv_result.scalar_one_or_none()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    # Fetch table
    tbl_result = await db.execute(
        select(models_pg.FloorTable).where(
            models_pg.FloorTable.id == table_id,
            models_pg.FloorTable.company_id == current_user.company_id,
        )
    )
    table = tbl_result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")

    # If previously assigned to a different server, decrement that server's count
    if table.assigned_server_id and table.assigned_server_id != server_id:
        prev_srv_result = await db.execute(
            select(models_pg.FloorServer).where(
                models_pg.FloorServer.id == table.assigned_server_id,
                models_pg.FloorServer.company_id == current_user.company_id,
            )
        )
        prev_server = prev_srv_result.scalar_one_or_none()
        if prev_server and prev_server.current_load_count > 0:
            prev_server.current_load_count -= 1

    table.assigned_server_id = server_id
    table.updated_at = datetime.now(timezone.utc)
    server.current_load_count = (server.current_load_count or 0) + 1

    await db.commit()
    return {
        "server_id": server_id,
        "table_id": table_id,
        "current_load_count": server.current_load_count,
    }


# ---------------------------------------------------------------------------
# WebSocket stream
# ---------------------------------------------------------------------------

@router.websocket("/stream")
async def floor_stream(
    websocket: WebSocket,
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Realtime floor-plan event stream.
    Client connects with ?token=<jwt>.
    Broadcasts table_state_changed and layout_changed events.
    """
    # Validate JWT manually (same logic as get_current_user)
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    # Resolve company_id from DB
    result = await db.execute(
        select(models_pg.User.company_id).where(models_pg.User.id == user_id)
    )
    company_id = result.scalar_one_or_none()
    if not company_id:
        await websocket.close(code=4003)
        return

    await floor_ws_manager.connect(websocket, company_id)
    try:
        while True:
            # Keep the connection alive; we only push, never pull
            await websocket.receive_text()
    except WebSocketDisconnect:
        floor_ws_manager.disconnect(websocket, company_id)
