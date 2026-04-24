"""
Restaurant Orders — Staff-side order management API.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
import uuid

import models_pg
from .dependencies import get_current_user, User, get_db

router = APIRouter(prefix="/orders", tags=["Restaurant Orders"])


# ═══════ Pydantic Schemas ═══════

class OrderStatusUpdate(BaseModel):
    status: str  # New, Preparing, ReadyToCollect, Completed, Cancelled


class ManualOrderCreate(BaseModel):
    outlet_id: str
    customer_name: str
    contact_number: Optional[str] = None
    order_type: str = "dine_in"
    items: List[Dict[str, Any]]
    notes: Optional[str] = None
    payment_status: str = "paid"


def _serialize_order(order):
    return {
        "id": order.id,
        "order_number": order.order_number,
        "company_id": order.company_id,
        "outlet_id": order.outlet_id,
        "customer_name": order.customer_name,
        "contact_number": order.contact_number,
        "order_type": order.order_type,
        "items": order.items or [],
        "total_amount": float(order.total_amount or 0),
        "status": order.status,
        "payment_status": order.payment_status,
        "payment_ref": order.payment_ref,
        "otp": order.otp,
        "confirmation_token": order.confirmation_token,
        "whatsapp_status": order.whatsapp_status,
        "notes": order.notes,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
    }


# ═══════ Active Orders ═══════

@router.get("/active")
async def get_active_orders(
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all active orders (New, Preparing, ReadyToCollect) for the company."""
    stmt = select(models_pg.RestaurantOrder).where(
        models_pg.RestaurantOrder.company_id == current_user.company_id,
        models_pg.RestaurantOrder.status.in_(["New", "Preparing", "ReadyToCollect"]),
    )
    if outlet_id:
        stmt = stmt.where(models_pg.RestaurantOrder.outlet_id == outlet_id)
    stmt = stmt.order_by(desc(models_pg.RestaurantOrder.created_at))

    result = await db.execute(stmt)
    orders = result.scalars().all()
    return [_serialize_order(o) for o in orders]


# ═══════ Kitchen View ═══════

@router.get("/kitchen")
async def get_kitchen_orders(
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get preparing orders + aggregated item counts for kitchen display."""
    stmt = select(models_pg.RestaurantOrder).where(
        models_pg.RestaurantOrder.company_id == current_user.company_id,
        models_pg.RestaurantOrder.status == "Preparing",
    )
    if outlet_id:
        stmt = stmt.where(models_pg.RestaurantOrder.outlet_id == outlet_id)
    stmt = stmt.order_by(models_pg.RestaurantOrder.created_at)

    result = await db.execute(stmt)
    orders = result.scalars().all()

    # Build aggregated items
    aggregated = {}
    for order in orders:
        for item in (order.items or []):
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            aggregated[name] = aggregated.get(name, 0) + qty

    aggregated_items = [{"name": k, "quantity": v} for k, v in sorted(aggregated.items(), key=lambda x: -x[1])]

    return {
        "orders": [_serialize_order(o) for o in orders],
        "aggregated_items": aggregated_items,
    }


# ═══════ Pickup View ═══════

@router.get("/pickup")
async def get_pickup_orders(
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get orders ready for collection."""
    stmt = select(models_pg.RestaurantOrder).where(
        models_pg.RestaurantOrder.company_id == current_user.company_id,
        models_pg.RestaurantOrder.status == "ReadyToCollect",
    )
    if outlet_id:
        stmt = stmt.where(models_pg.RestaurantOrder.outlet_id == outlet_id)
    stmt = stmt.order_by(models_pg.RestaurantOrder.created_at)

    result = await db.execute(stmt)
    orders = result.scalars().all()
    return [_serialize_order(o) for o in orders]


# ═══════ Completed Orders ═══════

@router.get("/completed")
async def get_completed_orders(
    outlet_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get completed and cancelled orders."""
    stmt = select(models_pg.RestaurantOrder).where(
        models_pg.RestaurantOrder.company_id == current_user.company_id,
        models_pg.RestaurantOrder.status.in_(["Completed", "Cancelled"]),
    )
    if outlet_id:
        stmt = stmt.where(models_pg.RestaurantOrder.outlet_id == outlet_id)
    stmt = stmt.order_by(desc(models_pg.RestaurantOrder.updated_at)).limit(limit)

    result = await db.execute(stmt)
    orders = result.scalars().all()
    return [_serialize_order(o) for o in orders]


# ═══════ Update Status ═══════

VALID_TRANSITIONS = {
    "New": ["Preparing", "Cancelled"],
    "Preparing": ["ReadyToCollect", "Cancelled"],
    "ReadyToCollect": ["Completed", "Cancelled"],
}


@router.put("/{order_id}/status")
async def update_order_status(
    order_id: str,
    body: OrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Advance order status."""
    order = (await db.execute(
        select(models_pg.RestaurantOrder).where(
            models_pg.RestaurantOrder.id == order_id,
            models_pg.RestaurantOrder.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed = VALID_TRANSITIONS.get(order.status, [])
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Cannot transition from {order.status} to {body.status}")

    order.status = body.status

    # If completed and inventory linked, deduct stock
    if body.status == "Completed":
        for item in (order.items or []):
            if item.get("inventoryLinked") and item.get("inventoryProductId"):
                product = (await db.execute(
                    select(models_pg.Product).where(models_pg.Product.id == item["inventoryProductId"])
                )).scalar_one_or_none()
                if product:
                    product.stock_quantity = max(0, (product.stock_quantity or 0) - item.get("quantity", 1))

    await db.commit()
    await db.refresh(order)

    if body.status == "Completed":
        await _auto_invoice_order(order, db)

    return _serialize_order(order)


# ═══════ Verify QR / Complete via Token ═══════

@router.post("/verify-qr")
async def verify_qr(
    confirmation_token: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Scan QR to complete an order at pickup counter."""
    order = (await db.execute(
        select(models_pg.RestaurantOrder).where(
            models_pg.RestaurantOrder.confirmation_token == confirmation_token,
            models_pg.RestaurantOrder.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "Completed":
        return {"message": "Order already completed", "order": _serialize_order(order)}

    if order.status != "ReadyToCollect":
        raise HTTPException(status_code=400, detail=f"Order is in '{order.status}' state, not ready for collection")

    order.status = "Completed"
    await db.commit()
    await db.refresh(order)
    await _auto_invoice_order(order, db)
    return {"message": "Order completed successfully", "order": _serialize_order(order)}


# ═══════ Create Order (Staff POS) ═══════

@router.post("")
async def create_order_from_pos(
    body: ManualOrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Staff creates an order via POS."""
    # Generate order number
    count = (await db.execute(
        select(func.count(models_pg.RestaurantOrder.id)).where(
            models_pg.RestaurantOrder.outlet_id == body.outlet_id
        )
    )).scalar() or 0
    order_number = f"ORD-{count + 1:04d}"

    total = sum(item.get("price", 0) * item.get("quantity", 1) for item in body.items)

    new_order = models_pg.RestaurantOrder(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        order_number=order_number,
        customer_name=body.customer_name,
        contact_number=body.contact_number,
        order_type=body.order_type,
        items=body.items,
        total_amount=total,
        status="New",
        payment_status=body.payment_status,
        confirmation_token=str(uuid.uuid4()),
    )
    db.add(new_order)
    await db.commit()
    await db.refresh(new_order)
    return _serialize_order(new_order)


# ═══════ Stats ═══════

@router.get("/stats")
async def get_order_stats(
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Order statistics for today."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    base = select(models_pg.RestaurantOrder).where(
        models_pg.RestaurantOrder.company_id == current_user.company_id,
        models_pg.RestaurantOrder.created_at >= today_start,
    )
    if outlet_id:
        base = base.where(models_pg.RestaurantOrder.outlet_id == outlet_id)

    result = await db.execute(base)
    orders = result.scalars().all()

    total = len(orders)
    by_status = {}
    total_revenue = 0
    for o in orders:
        by_status[o.status] = by_status.get(o.status, 0) + 1
        if o.status == "Completed":
            total_revenue += float(o.total_amount or 0)

    return {
        "total_orders_today": total,
        "by_status": by_status,
        "total_revenue_today": total_revenue,
        "active_count": by_status.get("New", 0) + by_status.get("Preparing", 0) + by_status.get("ReadyToCollect", 0),
    }


async def _auto_invoice_order(order: models_pg.RestaurantOrder, db: AsyncSession) -> None:
    """Create a draft invoice for a completed restaurant order if the company setting is on."""
    inv_settings = (await db.execute(
        select(models_pg.InvoiceSettings).where(
            models_pg.InvoiceSettings.company_id == order.company_id
        )
    )).scalar_one_or_none()

    if not inv_settings or not inv_settings.auto_generate_from_order:
        return

    # Skip if invoice already exists for this order
    existing = (await db.execute(
        select(models_pg.Invoice).where(
            models_pg.Invoice.order_id == order.id,
            models_pg.Invoice.status != "void",
        )
    )).scalar_one_or_none()
    if existing:
        return

    # Map order items → invoice line items
    items = []
    for oi in (order.items or []):
        name = oi.get("name", "Item")
        qty = float(oi.get("quantity", 1))
        price = float(oi.get("price", 0))
        items.append({
            "description": name,
            "quantity": qty,
            "unit_price": price,
            "tax_rate": float(inv_settings.default_tax_rate or 0),
            "discount": 0,
            "amount": qty * price,
        })

    subtotal = float(order.total_amount or 0)
    tax_rate = float(inv_settings.default_tax_rate or 0)
    tax_amount = round(subtotal * tax_rate / 100, 2)

    number = inv_settings.next_number
    invoice_number = f"{inv_settings.prefix}-{number:04d}"
    inv_settings.next_number = number + 1

    inv = models_pg.Invoice(
        id=str(uuid.uuid4()),
        company_id=order.company_id,
        order_id=order.id,
        outlet_id=order.outlet_id,
        invoice_number=invoice_number,
        customer_name=order.customer_name,
        customer_phone=order.contact_number,
        items=items or [{"description": f"Order {order.order_number}", "quantity": 1,
                         "unit_price": subtotal, "tax_rate": tax_rate, "discount": 0, "amount": subtotal}],
        subtotal=subtotal,
        discount_amount=0,
        tax_amount=tax_amount,
        total_amount=subtotal + tax_amount,
        paid_amount=0,
        currency=inv_settings.currency,
        currency_symbol=inv_settings.currency_symbol,
        issue_date=date.today(),
        payment_terms=inv_settings.default_payment_terms,
        notes=inv_settings.default_notes,
        footer=inv_settings.default_footer,
        status="sent" if inv_settings.auto_send_on_generate else "draft",
        sent_at=datetime.now(timezone.utc) if inv_settings.auto_send_on_generate else None,
    )
    db.add(inv)
    await db.commit()
