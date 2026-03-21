"""
Restaurant Menu — Public-facing menu + ordering API, plus staff-side menu management.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from decimal import Decimal
import uuid
import random
import string

import models_pg
from .dependencies import get_current_user, User, get_db

router = APIRouter(tags=["Menu"])


# ═══════ Pydantic Schemas ═══════

class MenuItemCreate(BaseModel):
    outlet_id: Optional[str] = None
    category: str = "General"
    name: str
    description: Optional[str] = None
    price: float = 0
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    inventory_product_id: Optional[str] = None
    inventory_linked: bool = False
    display_order: int = 0


class MenuItemUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    inventory_product_id: Optional[str] = None
    inventory_linked: Optional[bool] = None
    available: Optional[bool] = None
    display_order: Optional[int] = None
    active: Optional[bool] = None


class PublicOrderCreate(BaseModel):
    outlet_id: str
    customer_name: str
    contact_number: Optional[str] = None
    order_type: str = "dine_in"
    items: List[Dict[str, Any]]  # [{itemId, name, quantity, price}]
    notes: Optional[str] = None


class PaymentWebhook(BaseModel):
    confirmation_token: str
    payment_ref: str
    status: str = "paid"


# ═══════ Helpers ═══════

def _serialize_menu_item(item, stock_qty=None):
    d = {
        "id": item.id,
        "company_id": item.company_id,
        "outlet_id": item.outlet_id,
        "category": item.category,
        "name": item.name,
        "description": item.description,
        "price": float(item.price or 0),
        "image_url": item.image_url,
        "image_urls": item.image_urls or [],
        "inventory_product_id": item.inventory_product_id,
        "inventory_linked": item.inventory_linked,
        "available": item.available,
        "display_order": item.display_order,
        "active": item.active,
    }
    if stock_qty is not None:
        d["stock_quantity"] = stock_qty
        if item.inventory_linked and stock_qty <= 0:
            d["available"] = False
    return d


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
        "confirmation_token": order.confirmation_token,
        "whatsapp_status": order.whatsapp_status,
        "notes": order.notes,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "updated_at": order.updated_at.isoformat() if order.updated_at else None,
    }


# ═══════════════════════════════════════════════
# PUBLIC ENDPOINTS (No Auth)
# ═══════════════════════════════════════════════

@router.get("/public/menu/{outlet_id}")
async def get_public_menu(outlet_id: str, db: AsyncSession = Depends(get_db)):
    """Public menu for customer ordering portal. Checks inventory stock."""
    # Get outlet info
    outlet = (await db.execute(
        select(models_pg.Outlet).where(models_pg.Outlet.id == outlet_id)
    )).scalar_one_or_none()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    # Get company info (for branding)
    company = (await db.execute(
        select(models_pg.Company).where(models_pg.Company.id == outlet.company_id)
    )).scalar_one_or_none()

    # Get active menu items for this outlet
    stmt = select(models_pg.MenuItem).where(
        models_pg.MenuItem.company_id == outlet.company_id,
        models_pg.MenuItem.active == True,
        (models_pg.MenuItem.outlet_id == outlet_id) | (models_pg.MenuItem.outlet_id == None),
    ).order_by(models_pg.MenuItem.category, models_pg.MenuItem.display_order)

    items_result = await db.execute(stmt)
    items = items_result.scalars().all()

    # Check inventory stock for linked items
    serialized = []
    for item in items:
        stock_qty = None
        if item.inventory_linked and item.inventory_product_id:
            product = (await db.execute(
                select(models_pg.Product).where(models_pg.Product.id == item.inventory_product_id)
            )).scalar_one_or_none()
            stock_qty = product.stock_quantity if product else 0
        serialized.append(_serialize_menu_item(item, stock_qty))

    # Group by category
    categories = {}
    for s in serialized:
        cat = s["category"]
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(s)

    return {
        "outlet": {
            "id": outlet.id,
            "name": outlet.name,
            "location": outlet.location,
            "contact_phone": outlet.contact_phone,
            "portal_logo_url": getattr(outlet, "portal_logo_url", None),
            "portal_color_scheme": getattr(outlet, "portal_color_scheme", None),
            "portal_custom_colors": getattr(outlet, "portal_custom_colors", False),
        },
        "company": {
            "name": company.name if company else "Restaurant",
        },
        "categories": categories,
        "items": serialized,
    }


@router.post("/public/order")
async def create_public_order(body: PublicOrderCreate, db: AsyncSession = Depends(get_db)):
    """Customer places an order from the public portal."""
    # Validate outlet
    outlet = (await db.execute(
        select(models_pg.Outlet).where(models_pg.Outlet.id == body.outlet_id)
    )).scalar_one_or_none()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    # Calculate total and enrich items
    enriched_items = []
    total = Decimal("0")
    for item in body.items:
        item_id = item.get("itemId")
        quantity = item.get("quantity", 1)
        # Look up the menu item for price verification
        menu_item = (await db.execute(
            select(models_pg.MenuItem).where(models_pg.MenuItem.id == item_id)
        )).scalar_one_or_none()
        
        if menu_item:
            price = menu_item.price or Decimal("0")
            enriched_items.append({
                "itemId": item_id,
                "name": menu_item.name,
                "quantity": quantity,
                "price": float(price),
                "inventoryLinked": menu_item.inventory_linked,
                "inventoryProductId": menu_item.inventory_product_id,
            })
            total += price * quantity
        else:
            # Fallback to client-provided data
            price = Decimal(str(item.get("price", 0)))
            enriched_items.append({
                "itemId": item_id,
                "name": item.get("name", "Unknown"),
                "quantity": quantity,
                "price": float(price),
                "inventoryLinked": False,
            })
            total += price * quantity

    # Generate order number
    count = (await db.execute(
        select(func.count(models_pg.RestaurantOrder.id)).where(
            models_pg.RestaurantOrder.outlet_id == body.outlet_id
        )
    )).scalar() or 0
    order_number = f"ORD-{count + 1:04d}"

    # Generate OTP for delivery orders
    otp = None
    if body.order_type == "delivery":
        otp = ''.join(random.choices(string.digits, k=4))

    confirmation_token = str(uuid.uuid4())

    new_order = models_pg.RestaurantOrder(
        company_id=outlet.company_id,
        outlet_id=body.outlet_id,
        order_number=order_number,
        customer_name=body.customer_name,
        contact_number=body.contact_number,
        order_type=body.order_type,
        items=enriched_items,
        total_amount=total,
        status="New",
        payment_status="pending",  # Will be updated by payment webhook
        otp=otp,
        confirmation_token=confirmation_token,
        notes=body.notes,
    )
    db.add(new_order)
    await db.commit()
    await db.refresh(new_order)

    return {
        "message": "Order placed successfully",
        "order": _serialize_order(new_order),
        "confirmation_token": confirmation_token,
        "order_number": order_number,
    }


@router.get("/public/order/{confirmation_token}")
async def get_order_status(confirmation_token: str, db: AsyncSession = Depends(get_db)):
    """Customer checks order status via confirmation link/QR."""
    order = (await db.execute(
        select(models_pg.RestaurantOrder).where(
            models_pg.RestaurantOrder.confirmation_token == confirmation_token
        )
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Get outlet name
    outlet = (await db.execute(
        select(models_pg.Outlet).where(models_pg.Outlet.id == order.outlet_id)
    )).scalar_one_or_none()

    return {
        "order": _serialize_order(order),
        "outlet_name": outlet.name if outlet else "Restaurant",
        "outlet_info": {
            "name": outlet.name,
            "portal_color_scheme": outlet.portal_color_scheme,
            "portal_logo_url": outlet.portal_logo_url
        } if outlet else {}
    }


@router.post("/public/order/payment-webhook")
async def payment_webhook(body: PaymentWebhook, db: AsyncSession = Depends(get_db)):
    """Simulated payment gateway webhook — marks order as paid."""
    order = (await db.execute(
        select(models_pg.RestaurantOrder).where(
            models_pg.RestaurantOrder.confirmation_token == body.confirmation_token
        )
    )).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.payment_status = body.status
    order.payment_ref = body.payment_ref
    await db.commit()
    await db.refresh(order)

    return {"message": "Payment status updated", "order": _serialize_order(order)}


# ═══════════════════════════════════════════════
# STAFF ENDPOINTS (Authenticated)
# ═══════════════════════════════════════════════

@router.get("/menu/items")
async def list_menu_items(
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List menu items for the company."""
    stmt = select(models_pg.MenuItem).where(
        models_pg.MenuItem.company_id == current_user.company_id,
    )
    if outlet_id:
        stmt = stmt.where(models_pg.MenuItem.outlet_id == outlet_id)
    stmt = stmt.order_by(models_pg.MenuItem.category, models_pg.MenuItem.display_order)

    result = await db.execute(stmt)
    items = result.scalars().all()
    return [_serialize_menu_item(i) for i in items]


@router.post("/menu/items")
async def create_menu_item(
    body: MenuItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new menu item."""
    
    # Check for auto-creating inventory product
    inventory_product_id = body.inventory_product_id
    if body.inventory_linked and not inventory_product_id:
        new_product = models_pg.Product(
            company_id=current_user.company_id,
            outlet_id=body.outlet_id,
            name=body.name,
            category=body.category,
            description=body.description,
            price=body.price,
            stock_quantity=100,  # Default stock for auto-created items
            is_addon=False
        )
        db.add(new_product)
        await db.flush()
        inventory_product_id = new_product.id

    new_item = models_pg.MenuItem(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        category=body.category,
        name=body.name,
        description=body.description,
        price=body.price,
        image_url=body.image_url,
        image_urls=body.image_urls or [],
        inventory_product_id=inventory_product_id,
        inventory_linked=body.inventory_linked,
        display_order=body.display_order,
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    return _serialize_menu_item(new_item)


@router.put("/menu/items/{item_id}")
async def update_menu_item(
    item_id: str,
    body: MenuItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a menu item."""
    item = (await db.execute(
        select(models_pg.MenuItem).where(
            models_pg.MenuItem.id == item_id,
            models_pg.MenuItem.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    update_data = body.dict(exclude_unset=True)

    # Check for auto-creating inventory product on update
    is_linking = update_data.get("inventory_linked", item.inventory_linked)
    prod_id = update_data.get("inventory_product_id", item.inventory_product_id)
    
    if is_linking and not prod_id:
        new_product = models_pg.Product(
            company_id=current_user.company_id,
            outlet_id=item.outlet_id,
            name=update_data.get("name", item.name),
            category=update_data.get("category", item.category),
            description=update_data.get("description", item.description),
            price=update_data.get("price", item.price),
            stock_quantity=100,
            is_addon=False
        )
        db.add(new_product)
        await db.flush()
        update_data["inventory_product_id"] = new_product.id

    for key, value in update_data.items():
        if value is not None:
            setattr(item, key, value)

    await db.commit()
    await db.refresh(item)
    return _serialize_menu_item(item)


@router.delete("/menu/items/{item_id}")
async def delete_menu_item(
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a menu item."""
    item = (await db.execute(
        select(models_pg.MenuItem).where(
            models_pg.MenuItem.id == item_id,
            models_pg.MenuItem.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Menu item deleted"}
