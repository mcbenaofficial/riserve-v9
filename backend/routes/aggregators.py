"""
Aggregator integrations API.

Covers:
  - AggregatorConnection CRUD (which platforms are wired to which outlets)
  - Manual order import (JSON payload — used when platform API isn't available)
  - Customer identity resolution (match aggregator customer to known Customer)
  - First-party bridge (mark that we've sent a re-capture offer for an order)
  - Attribution summary (aggregator vs direct cohort stats)
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database_pg import get_db
from models_pg import AggregatorConnection, AggregatorOrder, Customer
from routes.dependencies import get_current_user

router = APIRouter(prefix="/aggregators", tags=["aggregators"])

VALID_PLATFORMS = ["zomato", "swiggy", "justdial", "practo", "urban_company", "tripadvisor"]
VALID_STATUSES = ["active", "manual", "inactive", "error"]


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class ConnectionCreate(BaseModel):
    platform: str
    outlet_id: Optional[str] = None
    status: str = "manual"
    api_key: Optional[str] = None
    meta: Dict[str, Any] = {}


class ConnectionUpdate(BaseModel):
    outlet_id: Optional[str] = None
    status: Optional[str] = None
    api_key: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None


class OrderImportItem(BaseModel):
    name: str
    quantity: int = 1
    price: Optional[float] = None


class OrderImport(BaseModel):
    platform: str
    external_order_id: str
    connection_id: Optional[str] = None
    outlet_id: Optional[str] = None
    external_customer_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    amount: Optional[float] = None
    items: List[OrderImportItem] = []
    status: str = "delivered"
    ordered_at: Optional[str] = None   # ISO 8601


class BulkImport(BaseModel):
    orders: List[OrderImport]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _connection_out(c: AggregatorConnection) -> dict:
    return {
        "id": c.id,
        "platform": c.platform,
        "outlet_id": c.outlet_id,
        "status": c.status,
        "has_api_key": bool(c.api_key),
        "meta": c.meta or {},
        "last_sync_at": c.last_sync_at.isoformat() if c.last_sync_at else None,
        "order_count": c.order_count or 0,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _order_out(o: AggregatorOrder) -> dict:
    return {
        "id": o.id,
        "platform": o.platform,
        "connection_id": o.connection_id,
        "outlet_id": o.outlet_id,
        "external_order_id": o.external_order_id,
        "external_customer_id": o.external_customer_id,
        "customer_name": o.customer_name,
        "customer_phone": o.customer_phone,
        "customer_email": o.customer_email,
        "amount": float(o.amount) if o.amount is not None else None,
        "items": o.items or [],
        "status": o.status,
        "ordered_at": o.ordered_at.isoformat() if o.ordered_at else None,
        "resolved_customer_id": o.resolved_customer_id,
        "resolution_confidence": float(o.resolution_confidence) if o.resolution_confidence is not None else None,
        "first_party_bridge_sent": o.first_party_bridge_sent,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


def _normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Strip non-digits for loose phone matching."""
    if not raw:
        return None
    digits = re.sub(r'\D', '', raw)
    # Match last 10 digits for Indian numbers
    return digits[-10:] if len(digits) >= 10 else digits


async def _resolve_customer(
    db: AsyncSession,
    company_id: str,
    phone: Optional[str],
    email: Optional[str],
    name: Optional[str],
) -> tuple:
    """
    Attempt to match an aggregator order to a known Customer.
    Returns (customer_id, confidence). Confidence: 1.0 = phone match, 0.7 = email, 0 = no match.
    """
    if phone:
        norm = _normalize_phone(phone)
        if norm:
            stmt = select(Customer).where(
                Customer.company_id == company_id,
                func.regexp_replace(Customer.phone, r'\D', '', 'g').like(f'%{norm}')
            )
            result = await db.execute(stmt)
            customer = result.scalars().first()
            if customer:
                return customer.id, 1.0

    if email:
        stmt = select(Customer).where(
            Customer.company_id == company_id,
            Customer.email == email.lower().strip()
        )
        result = await db.execute(stmt)
        customer = result.scalars().first()
        if customer:
            return customer.id, 0.7

    return None, 0.0


# ---------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------

@router.get("/connections")
async def list_connections(
    outlet_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = current_user.company_id
    stmt = select(AggregatorConnection).where(AggregatorConnection.company_id == company_id)
    if outlet_id:
        stmt = stmt.where(AggregatorConnection.outlet_id == outlet_id)
    stmt = stmt.order_by(AggregatorConnection.platform)
    result = await db.execute(stmt)
    return [_connection_out(c) for c in result.scalars().all()]


@router.post("/connections", status_code=201)
async def create_connection(
    body: ConnectionCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.platform not in VALID_PLATFORMS:
        raise HTTPException(400, f"platform must be one of {VALID_PLATFORMS}")
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of {VALID_STATUSES}")

    company_id = current_user.company_id

    # Prevent duplicate platform+outlet
    existing = await db.execute(
        select(AggregatorConnection).where(
            AggregatorConnection.company_id == company_id,
            AggregatorConnection.platform == body.platform,
            AggregatorConnection.outlet_id == body.outlet_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(409, "A connection for this platform and outlet already exists")

    conn = AggregatorConnection(
        company_id=company_id,
        platform=body.platform,
        outlet_id=body.outlet_id,
        status=body.status,
        api_key=body.api_key,
        meta=body.meta,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(conn)
    await db.commit()
    await db.refresh(conn)
    return _connection_out(conn)


@router.put("/connections/{connection_id}")
async def update_connection(
    connection_id: str,
    body: ConnectionUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = current_user.company_id
    result = await db.execute(
        select(AggregatorConnection).where(
            AggregatorConnection.id == connection_id,
            AggregatorConnection.company_id == company_id,
        )
    )
    conn = result.scalars().first()
    if not conn:
        raise HTTPException(404, "Connection not found")

    if body.outlet_id is not None:
        conn.outlet_id = body.outlet_id
    if body.status is not None:
        if body.status not in VALID_STATUSES:
            raise HTTPException(400, f"status must be one of {VALID_STATUSES}")
        conn.status = body.status
    if body.api_key is not None:
        conn.api_key = body.api_key
    if body.meta is not None:
        conn.meta = body.meta

    conn.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(conn)
    return _connection_out(conn)


@router.delete("/connections/{connection_id}", status_code=204)
async def delete_connection(
    connection_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = current_user.company_id
    result = await db.execute(
        select(AggregatorConnection).where(
            AggregatorConnection.id == connection_id,
            AggregatorConnection.company_id == company_id,
        )
    )
    conn = result.scalars().first()
    if not conn:
        raise HTTPException(404, "Connection not found")
    await db.delete(conn)
    await db.commit()


@router.post("/connections/{connection_id}/sync")
async def sync_connection(
    connection_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attempt live API sync. Returns status; most platforms fall back to manual."""
    company_id = current_user.company_id
    result = await db.execute(
        select(AggregatorConnection).where(
            AggregatorConnection.id == connection_id,
            AggregatorConnection.company_id == company_id,
        )
    )
    conn = result.scalars().first()
    if not conn:
        raise HTTPException(404, "Connection not found")

    from channels.aggregator import AGGREGATOR_ADAPTERS
    adapter = AGGREGATOR_ADAPTERS.get(conn.platform)
    if not adapter:
        return {"status": "error", "message": f"No adapter for platform '{conn.platform}'"}

    try:
        orders = await adapter.fetch_orders(
            connection_meta=conn.meta or {},
            since=conn.last_sync_at,
        )
        conn.last_sync_at = datetime.now(timezone.utc)
        conn.status = "active"
        await db.commit()
        return {"status": "ok", "orders_fetched": len(orders)}
    except NotImplementedError as e:
        return {"status": "manual_required", "message": str(e)}
    except Exception as e:
        conn.status = "error"
        await db.commit()
        return {"status": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

@router.get("/orders")
async def list_orders(
    platform: Optional[str] = None,
    outlet_id: Optional[str] = None,
    resolved: Optional[bool] = None,
    bridge_pending: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    company_id = current_user.company_id
    stmt = select(AggregatorOrder).where(AggregatorOrder.company_id == company_id)

    if platform:
        stmt = stmt.where(AggregatorOrder.platform == platform)
    if outlet_id:
        stmt = stmt.where(AggregatorOrder.outlet_id == outlet_id)
    if resolved is True:
        stmt = stmt.where(AggregatorOrder.resolved_customer_id.isnot(None))
    elif resolved is False:
        stmt = stmt.where(AggregatorOrder.resolved_customer_id.is_(None))
    if bridge_pending is True:
        stmt = stmt.where(
            AggregatorOrder.first_party_bridge_sent == False,
            AggregatorOrder.resolved_customer_id.isnot(None),
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar()

    stmt = stmt.order_by(AggregatorOrder.ordered_at.desc().nullslast()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    orders = result.scalars().all()

    return {"total": total, "items": [_order_out(o) for o in orders]}


@router.post("/orders/import", status_code=201)
async def import_orders(
    body: BulkImport,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Bulk manual import. Skips duplicates (same platform + external_order_id).
    Attempts auto-resolution against existing customers on import.
    """
    company_id = current_user.company_id
    imported = 0
    skipped = 0
    resolved = 0

    for raw in body.orders:
        if raw.platform not in VALID_PLATFORMS:
            continue

        # Dedup
        exists = await db.execute(
            select(AggregatorOrder).where(
                AggregatorOrder.company_id == company_id,
                AggregatorOrder.platform == raw.platform,
                AggregatorOrder.external_order_id == raw.external_order_id,
            )
        )
        if exists.scalars().first():
            skipped += 1
            continue

        ordered_at = None
        if raw.ordered_at:
            try:
                ordered_at = datetime.fromisoformat(raw.ordered_at.replace("Z", "+00:00"))
            except ValueError:
                pass

        customer_id, confidence = await _resolve_customer(
            db, company_id, raw.customer_phone, raw.customer_email, raw.customer_name
        )
        if customer_id:
            resolved += 1

        order = AggregatorOrder(
            company_id=company_id,
            outlet_id=raw.outlet_id,
            connection_id=raw.connection_id,
            platform=raw.platform,
            external_order_id=raw.external_order_id,
            external_customer_id=raw.external_customer_id,
            customer_name=raw.customer_name,
            customer_phone=raw.customer_phone,
            customer_email=raw.customer_email,
            amount=raw.amount,
            items=[i.model_dump() for i in raw.items],
            status=raw.status,
            ordered_at=ordered_at,
            resolved_customer_id=customer_id,
            resolution_confidence=confidence if customer_id else None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(order)
        imported += 1

        # Update connection order_count if connection_id provided
        if raw.connection_id:
            conn_result = await db.execute(
                select(AggregatorConnection).where(
                    AggregatorConnection.id == raw.connection_id,
                    AggregatorConnection.company_id == company_id,
                )
            )
            conn = conn_result.scalars().first()
            if conn:
                conn.order_count = (conn.order_count or 0) + 1
                conn.last_sync_at = datetime.now(timezone.utc)

    await db.commit()
    return {"imported": imported, "skipped": skipped, "auto_resolved": resolved}


@router.post("/orders/{order_id}/resolve")
async def resolve_order(
    order_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run customer identity resolution for a single order."""
    company_id = current_user.company_id
    result = await db.execute(
        select(AggregatorOrder).where(
            AggregatorOrder.id == order_id,
            AggregatorOrder.company_id == company_id,
        )
    )
    order = result.scalars().first()
    if not order:
        raise HTTPException(404, "Order not found")

    customer_id, confidence = await _resolve_customer(
        db, company_id, order.customer_phone, order.customer_email, order.customer_name
    )
    order.resolved_customer_id = customer_id
    order.resolution_confidence = confidence if customer_id else None
    await db.commit()
    await db.refresh(order)
    return _order_out(order)


@router.patch("/orders/{order_id}/resolve-manual")
async def resolve_order_manual(
    order_id: str,
    customer_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manually link an order to a specific Customer record."""
    company_id = current_user.company_id
    result = await db.execute(
        select(AggregatorOrder).where(
            AggregatorOrder.id == order_id,
            AggregatorOrder.company_id == company_id,
        )
    )
    order = result.scalars().first()
    if not order:
        raise HTTPException(404, "Order not found")

    customer_check = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.company_id == company_id)
    )
    if not customer_check.scalars().first():
        raise HTTPException(404, "Customer not found")

    order.resolved_customer_id = customer_id
    order.resolution_confidence = 1.0
    await db.commit()
    await db.refresh(order)
    return _order_out(order)


@router.post("/orders/{order_id}/bridge")
async def mark_bridge_sent(
    order_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark that a first-party re-capture offer was sent for this aggregator order."""
    company_id = current_user.company_id
    result = await db.execute(
        select(AggregatorOrder).where(
            AggregatorOrder.id == order_id,
            AggregatorOrder.company_id == company_id,
        )
    )
    order = result.scalars().first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.first_party_bridge_sent = True
    await db.commit()
    return {"ok": True}


# ---------------------------------------------------------------------------
# Attribution summary
# ---------------------------------------------------------------------------

@router.get("/attribution")
async def get_attribution(
    outlet_id: Optional[str] = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns cohort attribution stats:
    - Orders by platform
    - Resolution rate (% of aggregator orders matched to a known customer)
    - First-party bridge conversion rate
    - Repeat customer rate per platform (orders with resolved_customer also having
      a second aggregator order — rough proxy for retention)
    """
    company_id = current_user.company_id

    base = select(AggregatorOrder).where(AggregatorOrder.company_id == company_id)
    if outlet_id:
        base = base.where(AggregatorOrder.outlet_id == outlet_id)

    result = await db.execute(base)
    all_orders = result.scalars().all()

    if not all_orders:
        return {
            "total_orders": 0,
            "total_gmv": 0,
            "resolution_rate": 0,
            "bridge_sent_rate": 0,
            "by_platform": [],
        }

    total = len(all_orders)
    total_gmv = sum(float(o.amount or 0) for o in all_orders)
    resolved_count = sum(1 for o in all_orders if o.resolved_customer_id)
    bridge_sent_count = sum(1 for o in all_orders if o.first_party_bridge_sent)

    # Group by platform
    from collections import defaultdict
    platform_groups = defaultdict(list)
    for o in all_orders:
        platform_groups[o.platform].append(o)

    by_platform = []
    for platform, orders in sorted(platform_groups.items()):
        p_total = len(orders)
        p_gmv = sum(float(o.amount or 0) for o in orders)
        p_resolved = sum(1 for o in orders if o.resolved_customer_id)
        p_bridge = sum(1 for o in orders if o.first_party_bridge_sent)

        # Repeat customers: resolved customers with >1 order on this platform
        customer_order_counts: dict[str, int] = defaultdict(int)
        for o in orders:
            if o.resolved_customer_id:
                customer_order_counts[o.resolved_customer_id] += 1
        repeat_customers = sum(1 for c in customer_order_counts.values() if c > 1)

        by_platform.append({
            "platform": platform,
            "order_count": p_total,
            "gmv": round(p_gmv, 2),
            "resolution_rate": round(p_resolved / p_total, 3) if p_total else 0,
            "bridge_sent_rate": round(p_bridge / p_total, 3) if p_total else 0,
            "repeat_customer_count": repeat_customers,
            "unique_resolved_customers": len(customer_order_counts),
        })

    return {
        "total_orders": total,
        "total_gmv": round(total_gmv, 2),
        "resolution_rate": round(resolved_count / total, 3) if total else 0,
        "bridge_sent_rate": round(bridge_sent_count / total, 3) if total else 0,
        "by_platform": by_platform,
    }
