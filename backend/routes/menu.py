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
import os
import logging
import httpx

import models_pg
from .dependencies import get_current_user, User, get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Menu"])


# ═══════ Pydantic Schemas ═══════

class MenuCategoryCreate(BaseModel):
    outlet_id: Optional[str] = None
    name: str
    icon: Optional[str] = None
    display_order: int = 0


class MenuCategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    display_order: Optional[int] = None
    active: Optional[bool] = None


class MenuItemCreate(BaseModel):
    outlet_id: Optional[str] = None
    category: str = "General"
    name: str
    description: Optional[str] = None
    nutritional_value: Optional[str] = None
    price: float = 0
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    icon: Optional[str] = None
    inventory_product_id: Optional[str] = None
    inventory_linked: bool = False
    display_order: int = 0


class MenuItemUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    nutritional_value: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    icon: Optional[str] = None
    inventory_product_id: Optional[str] = None
    inventory_linked: Optional[bool] = None
    available: Optional[bool] = None
    is_veg: Optional[bool] = None
    display_order: Optional[int] = None
    active: Optional[bool] = None


class AIMenuFieldRequest(BaseModel):
    item_name: str
    business_type: Optional[str] = None
    serving_size: Optional[str] = None


class PublicOrderCreate(BaseModel):
    outlet_id: str
    customer_name: str
    contact_number: Optional[str] = None
    order_type: str = "dine_in"
    items: List[Dict[str, Any]]  # [{itemId, name, quantity, price}]
    notes: Optional[str] = None


class AISuggestRequest(BaseModel):
    outlet_id: str
    preference: str


class PaymentWebhook(BaseModel):
    confirmation_token: str
    payment_ref: str
    status: str = "paid"


# ═══════ Helpers ═══════

def _serialize_category(cat):
    return {
        "id": cat.id,
        "name": cat.name,
        "icon": cat.icon,
        "display_order": cat.display_order,
        "active": cat.active,
    }


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
        "icon": getattr(item, "icon", None),
        "inventory_product_id": item.inventory_product_id,
        "inventory_linked": item.inventory_linked,
        "available": item.available,
        "display_order": item.display_order,
        "active": item.active,
        "is_veg": getattr(item, "is_veg", True),
        "nutritional_value": getattr(item, "nutritional_value", None),
        "is_bestseller": getattr(item, "is_bestseller", False),
        "tags": getattr(item, "tags", []) or [],
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
        "pickup_pin": getattr(order, "pickup_pin", None),
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

    # Fetch user-defined category ordering + icons
    cat_rows = (await db.execute(
        select(models_pg.MenuCategory).where(
            models_pg.MenuCategory.company_id == outlet.company_id,
            models_pg.MenuCategory.active == True,
        ).order_by(models_pg.MenuCategory.display_order)
    )).scalars().all()
    # Build lookup: name -> {icon, display_order}
    cat_meta: Dict[str, Any] = {c.name: {"icon": c.icon, "display_order": c.display_order} for c in cat_rows}

    # Get active menu items for this outlet
    stmt = select(models_pg.MenuItem).where(
        models_pg.MenuItem.company_id == outlet.company_id,
        models_pg.MenuItem.active == True,
        (models_pg.MenuItem.outlet_id == outlet_id) | (models_pg.MenuItem.outlet_id == None),
    ).order_by(models_pg.MenuItem.display_order)

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

    # Aggregate order counts per item from recent orders (last 90 days)
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    orders_result = await db.execute(
        select(models_pg.RestaurantOrder.items).where(
            models_pg.RestaurantOrder.outlet_id == outlet_id,
            models_pg.RestaurantOrder.status != "Cancelled",
            models_pg.RestaurantOrder.created_at >= cutoff,
        )
    )
    order_counts: Dict[str, int] = {}
    for (order_items,) in orders_result.fetchall():
        for oi in (order_items or []):
            iid = oi.get("itemId") or oi.get("id")
            if iid:
                order_counts[iid] = order_counts.get(iid, 0) + (oi.get("quantity", 1))

    # Attach order_count to each serialized item
    for s in serialized:
        s["order_count"] = order_counts.get(s["id"], 0)

    # Group by category, sorted by user-defined category display_order
    categories_grouped: Dict[str, List] = {}
    for s in serialized:
        cat = s["category"]
        if cat not in categories_grouped:
            categories_grouped[cat] = []
        categories_grouped[cat].append(s)

    # Sort category keys by display_order (known categories first, then alphabetical for unknowns)
    def _cat_sort_key(name: str):
        if name in cat_meta:
            return (0, cat_meta[name]["display_order"], name)
        return (1, 999, name)

    sorted_categories: Dict[str, List] = {
        k: categories_grouped[k]
        for k in sorted(categories_grouped.keys(), key=_cat_sort_key)
    }

    # Build category info list (icon + order) for the portal
    category_info = []
    for name in sorted_categories:
        info = cat_meta.get(name, {})
        category_info.append({"name": name, "icon": info.get("icon"), "display_order": info.get("display_order", 999)})

    cs = outlet.portal_color_scheme or {}
    return {
        "outlet": {
            "id": outlet.id,
            "name": outlet.name,
            "location": outlet.location,
            "contact_phone": outlet.contact_phone,
            "portal_logo_url": getattr(outlet, "portal_logo_url", None),
            "portal_color_scheme": cs,
            "portal_custom_colors": getattr(outlet, "portal_custom_colors", False),
            "cover_image_url": cs.get("coverImageUrl"),
            "opening_hours": cs.get("openingHours"),
            "cuisine_type": cs.get("cuisineType"),
        },
        "company": {
            "name": company.name if company else "Restaurant",
        },
        "categories": sorted_categories,
        "category_info": category_info,
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

    # Always generate a 4-digit pickup PIN for collection verification
    pickup_pin = ''.join(random.choices(string.digits, k=4))
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
        pickup_pin=pickup_pin,
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


@router.post("/public/menu/ai/suggest")
async def suggest_dishes(body: AISuggestRequest, db: AsyncSession = Depends(get_db)):
    """AI dish suggestion for the public ordering portal — no auth required."""
    import json as _json

    outlet = (await db.execute(
        select(models_pg.Outlet).where(models_pg.Outlet.id == body.outlet_id)
    )).scalar_one_or_none()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")

    items = (await db.execute(
        select(models_pg.MenuItem).where(
            models_pg.MenuItem.company_id == outlet.company_id,
            models_pg.MenuItem.active == True,
            models_pg.MenuItem.available == True,
            (models_pg.MenuItem.outlet_id == body.outlet_id) | (models_pg.MenuItem.outlet_id == None),
        ).order_by(models_pg.MenuItem.display_order)
    )).scalars().all()

    if not items:
        return {"suggestions": []}

    items_list = "\n".join([
        f"- {item.name} | Category: {item.category} | {'Veg' if item.is_veg else 'Non-Veg'}"
        for item in items[:60]
    ])

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful restaurant concierge. Given a menu and a customer's mood or craving, "
                "suggest 4–5 dishes that best match. "
                "Return ONLY a valid JSON array — no markdown, no explanation — in this exact format:\n"
                '[{"item_name": "Exact Dish Name", "reason": "One sentence why it matches"}]\n'
                "The item_name must exactly match a name from the provided menu list."
            ),
        },
        {
            "role": "user",
            "content": f"Customer preference: {body.preference[:300]}\n\nMenu:\n{items_list}",
        },
    ]

    try:
        raw = await _openrouter_chat(messages)
        raw = raw.strip()
        start = raw.find('[')
        end = raw.rfind(']') + 1
        suggestions = _json.loads(raw[start:end]) if start >= 0 and end > start else []
        return {"suggestions": suggestions[:5]}
    except Exception as e:
        logger.error(f"AI suggest failed: {e}")
        return {"suggestions": []}


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
        icon=body.icon,
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


# ═══════════════════════════════════════════════
# MENU CATEGORY ENDPOINTS (Authenticated)
# ═══════════════════════════════════════════════

@router.get("/menu/categories")
async def list_menu_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all menu categories for the company, ordered by display_order."""
    result = await db.execute(
        select(models_pg.MenuCategory).where(
            models_pg.MenuCategory.company_id == current_user.company_id,
            models_pg.MenuCategory.active == True,
        ).order_by(models_pg.MenuCategory.display_order)
    )
    cats = result.scalars().all()
    return [_serialize_category(c) for c in cats]


@router.post("/menu/categories")
async def create_menu_category(
    body: MenuCategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new menu category."""
    new_cat = models_pg.MenuCategory(
        company_id=current_user.company_id,
        outlet_id=body.outlet_id,
        name=body.name,
        icon=body.icon,
        display_order=body.display_order,
    )
    db.add(new_cat)
    await db.commit()
    await db.refresh(new_cat)
    return _serialize_category(new_cat)


@router.put("/menu/categories/{category_id}")
async def update_menu_category(
    category_id: str,
    body: MenuCategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a menu category."""
    cat = (await db.execute(
        select(models_pg.MenuCategory).where(
            models_pg.MenuCategory.id == category_id,
            models_pg.MenuCategory.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    for key, value in body.dict(exclude_unset=True).items():
        setattr(cat, key, value)

    await db.commit()
    await db.refresh(cat)
    return _serialize_category(cat)


@router.delete("/menu/categories/{category_id}")
async def delete_menu_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a menu category."""
    cat = (await db.execute(
        select(models_pg.MenuCategory).where(
            models_pg.MenuCategory.id == category_id,
            models_pg.MenuCategory.company_id == current_user.company_id,
        )
    )).scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(cat)
    await db.commit()
    return {"message": "Category deleted"}


# ═══════════════════════════════════════════════
# AI GENERATION ENDPOINTS
# ═══════════════════════════════════════════════

_OPENROUTER_MODEL = "google/gemma-4-26b-a4b-it"
_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


async def _openrouter_chat(messages: list[dict]) -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI service not configured.")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            _OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://riserve.app",
                "X-Title": "Riserve",
            },
            json={"model": _OPENROUTER_MODEL, "messages": messages},
        )
    if resp.status_code != 200:
        logger.error(f"OpenRouter error {resp.status_code}: {resp.text}")
        raise HTTPException(status_code=502, detail=f"AI service error: {resp.text}")
    return resp.json()["choices"][0]["message"]["content"].strip()


@router.post("/menu/ai/description")
async def generate_menu_description(
    body: AIMenuFieldRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate a Ramsay-style menu description for an item."""
    business_context = body.business_type or "restaurant"
    messages = [
        {
            "role": "system",
            "content": (
                "You are Gordon Ramsay writing menu descriptions. "
                "Your descriptions are vivid, sensory, and passionate — they make the dish irresistible. "
                "Use evocative language about texture, aroma, and flavour. "
                "Keep it to 1–2 punchy sentences. No fluff. Never mention Gordon Ramsay by name."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Write a menu description for '{body.item_name}' served at a {business_context}. "
                "Make it mouth-watering and confident. Output only the description text, nothing else."
            ),
        },
    ]
    try:
        result = await _openrouter_chat(messages)
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI description generation failed: {e}")
        raise HTTPException(status_code=500, detail="AI generation failed.")


@router.post("/menu/ai/nutrition")
async def generate_nutritional_value(
    body: AIMenuFieldRequest,
    current_user: User = Depends(get_current_user),
):
    """Generate estimated nutritional information for a menu item."""
    serving_hint = f" (serving size: {body.serving_size})" if body.serving_size else ""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a certified nutritionist and food scientist. "
                "Given a dish name and optional serving size, provide a realistic nutritional estimate. "
                "Format your response EXACTLY as a compact single-line breakdown like this example: "
                "Calories: 320 kcal | Protein: 18g | Carbs: 28g | Fat: 14g | Fibre: 3g | Sugar: 4g | Sodium: 480mg. "
                "Base your estimates on standard recipes and typical restaurant portions. "
                "Output only the nutritional line, nothing else."
            ),
        },
        {
            "role": "user",
            "content": f"Provide nutritional estimates for '{body.item_name}'{serving_hint}.",
        },
    ]
    try:
        result = await _openrouter_chat(messages)
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI nutrition generation failed: {e}")
        raise HTTPException(status_code=500, detail="AI generation failed.")
