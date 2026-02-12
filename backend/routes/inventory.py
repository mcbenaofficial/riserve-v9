from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from .dependencies import get_current_user, get_db

router = APIRouter(prefix="/inventory", tags=["Inventory"])

# Models
class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str = "general"  # general, consumables, accessories, parts, retail
    description: Optional[str] = None
    price: float
    cost: Optional[float] = None
    outlet_id: Optional[str] = None  # null = available at all outlets (if centralized)
    stock_quantity: int = 0
    reorder_level: int = 10
    is_addon: bool = True  # Can be added to bookings
    active: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    outlet_id: Optional[str] = None
    stock_quantity: Optional[int] = None
    reorder_level: Optional[int] = None
    is_addon: Optional[bool] = None
    active: Optional[bool] = None

class StockAdjustment(BaseModel):
    product_id: str
    quantity: int  # Positive to add, negative to deduct
    reason: str  # "sale", "restock", "damaged", "adjustment", "booking"
    booking_id: Optional[str] = None

class InventorySettings(BaseModel):
    inventory_mode: str = "centralized"  # "centralized" or "outlet_specific"
    low_stock_alerts: bool = True
    allow_customer_addons: bool = False  # Whether customers can add products during booking
    default_reorder_level: int = 10

class BookingItem(BaseModel):
    product_id: str
    quantity: int

# Routes
@router.get("/products")
async def get_products(
    outlet_id: Optional[str] = None,
    category: Optional[str] = None,
    low_stock: Optional[bool] = None,
    active_only: bool = True,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all products with optional filters"""
    query = {"company_id": current_user.company_id}
    
    if active_only:
        query["active"] = True
    
    if category:
        query["category"] = category
    
    # Get inventory settings
    settings = await db.company_settings.find_one(
        {"company_id": current_user.company_id},
        {"_id": 0, "inventory_settings": 1}
    )
    inventory_mode = settings.get("inventory_settings", {}).get("inventory_mode", "centralized") if settings else "centralized"
    
    # Filter by outlet based on inventory mode
    if inventory_mode == "outlet_specific" and outlet_id:
        query["$or"] = [{"outlet_id": outlet_id}, {"outlet_id": None}]
    elif outlet_id:
        query["$or"] = [{"outlet_id": outlet_id}, {"outlet_id": None}]
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    
    # Filter for low stock if requested
    if low_stock:
        products = [p for p in products if p.get("stock_quantity", 0) <= p.get("reorder_level", 10)]
    
    return products

@router.get("/products/{product_id}")
async def get_product(
    product_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get a single product"""
    product = await db.products.find_one(
        {"id": product_id, "company_id": current_user.company_id},
        {"_id": 0}
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@router.post("/products")
async def create_product(
    product: ProductCreate,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Create a new product"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    product_id = str(uuid.uuid4())
    sku = product.sku or f"SKU-{product_id[:8].upper()}"
    
    product_doc = {
        "id": product_id,
        "name": product.name,
        "sku": sku,
        "category": product.category,
        "description": product.description,
        "price": product.price,
        "cost": product.cost or 0,
        "outlet_id": product.outlet_id,
        "stock_quantity": product.stock_quantity,
        "reorder_level": product.reorder_level,
        "is_addon": product.is_addon,
        "active": product.active,
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.products.insert_one(product_doc)
    
    # Log inventory action
    await log_inventory_action(db, {
        "product_id": product_id,
        "action": "created",
        "quantity": product.stock_quantity,
        "reason": "initial_stock",
        "user_id": current_user.id,
        "company_id": current_user.company_id
    })
    
    return {"id": product_id, "message": "Product created successfully"}

@router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    product: ProductUpdate,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update a product"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.products.find_one(
        {"id": product_id, "company_id": current_user.company_id}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {k: v for k, v in product.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.products.update_one(
        {"id": product_id},
        {"$set": update_data}
    )
    
    return {"message": "Product updated successfully"}

@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Delete a product (soft delete by setting active=False)"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.products.update_one(
        {"id": product_id, "company_id": current_user.company_id},
        {"$set": {"active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return {"message": "Product deleted successfully"}

@router.post("/stock/adjust")
async def adjust_stock(
    adjustment: StockAdjustment,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Adjust stock quantity for a product"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    product = await db.products.find_one(
        {"id": adjustment.product_id, "company_id": current_user.company_id}
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    new_quantity = product.get("stock_quantity", 0) + adjustment.quantity
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    await db.products.update_one(
        {"id": adjustment.product_id},
        {
            "$set": {
                "stock_quantity": new_quantity,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Log inventory action
    await log_inventory_action(db, {
        "product_id": adjustment.product_id,
        "action": "adjustment",
        "quantity": adjustment.quantity,
        "new_quantity": new_quantity,
        "reason": adjustment.reason,
        "booking_id": adjustment.booking_id,
        "user_id": current_user.id,
        "company_id": current_user.company_id
    })
    
    # Check for low stock alert
    if new_quantity <= product.get("reorder_level", 10):
        await create_low_stock_alert(db, product, new_quantity, current_user.company_id)
    
    return {"message": "Stock adjusted successfully", "new_quantity": new_quantity}

@router.get("/low-stock")
async def get_low_stock_products(
    outlet_id: Optional[str] = None,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all products below reorder level"""
    query = {"company_id": current_user.company_id, "active": True}
    
    if outlet_id:
        query["$or"] = [{"outlet_id": outlet_id}, {"outlet_id": None}]
    
    products = await db.products.find(query, {"_id": 0}).to_list(1000)
    
    low_stock = [
        {
            **p,
            "shortage": p.get("reorder_level", 10) - p.get("stock_quantity", 0)
        }
        for p in products 
        if p.get("stock_quantity", 0) <= p.get("reorder_level", 10)
    ]
    
    return sorted(low_stock, key=lambda x: x["shortage"], reverse=True)

@router.get("/alerts")
async def get_inventory_alerts(
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get inventory alerts (low stock, etc.)"""
    alerts = await db.inventory_alerts.find(
        {"company_id": current_user.company_id, "resolved": False},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return alerts

@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Mark an alert as resolved"""
    result = await db.inventory_alerts.update_one(
        {"id": alert_id, "company_id": current_user.company_id},
        {
            "$set": {
                "resolved": True,
                "resolved_by": current_user.id,
                "resolved_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert resolved"}

@router.get("/settings")
async def get_inventory_settings(
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get inventory settings for the company"""
    settings = await db.company_settings.find_one(
        {"company_id": current_user.company_id},
        {"_id": 0, "inventory_settings": 1}
    )
    
    default_settings = {
        "inventory_mode": "centralized",
        "low_stock_alerts": True,
        "allow_customer_addons": False,
        "default_reorder_level": 10
    }
    
    return settings.get("inventory_settings", default_settings) if settings else default_settings

@router.put("/settings")
async def update_inventory_settings(
    settings: InventorySettings,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Update inventory settings"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.company_settings.update_one(
        {"company_id": current_user.company_id},
        {
            "$set": {
                "inventory_settings": settings.dict(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {"message": "Inventory settings updated"}

@router.get("/history")
async def get_inventory_history(
    product_id: Optional[str] = None,
    limit: int = 50,
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get inventory transaction history"""
    query = {"company_id": current_user.company_id}
    if product_id:
        query["product_id"] = product_id
    
    history = await db.inventory_log.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return history

@router.get("/categories")
async def get_product_categories(
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get all product categories"""
    products = await db.products.find(
        {"company_id": current_user.company_id, "active": True},
        {"category": 1, "_id": 0}
    ).to_list(1000)
    
    categories = list(set(p.get("category", "general") for p in products))
    return sorted(categories)

@router.get("/stats")
async def get_inventory_stats(
    current_user = Depends(get_current_user),
    db = Depends(get_db)
):
    """Get inventory statistics"""
    products = await db.products.find(
        {"company_id": current_user.company_id, "active": True},
        {"_id": 0}
    ).to_list(1000)
    
    total_products = len(products)
    total_value = sum(p.get("stock_quantity", 0) * p.get("cost", p.get("price", 0)) for p in products)
    low_stock_count = len([p for p in products if p.get("stock_quantity", 0) <= p.get("reorder_level", 10)])
    out_of_stock = len([p for p in products if p.get("stock_quantity", 0) == 0])
    
    # Category breakdown
    categories = {}
    for p in products:
        cat = p.get("category", "general")
        if cat not in categories:
            categories[cat] = {"count": 0, "value": 0}
        categories[cat]["count"] += 1
        categories[cat]["value"] += p.get("stock_quantity", 0) * p.get("cost", p.get("price", 0))
    
    return {
        "total_products": total_products,
        "total_value": round(total_value, 2),
        "low_stock_count": low_stock_count,
        "out_of_stock": out_of_stock,
        "categories": categories
    }

# Helper functions
async def log_inventory_action(db, data: dict):
    """Log an inventory action"""
    log_entry = {
        "id": str(uuid.uuid4()),
        **data,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.inventory_log.insert_one(log_entry)

async def create_low_stock_alert(db, product: dict, current_quantity: int, company_id: str):
    """Create a low stock alert"""
    # Check if alert already exists
    existing = await db.inventory_alerts.find_one({
        "product_id": product["id"],
        "resolved": False
    })
    
    if not existing:
        alert = {
            "id": str(uuid.uuid4()),
            "type": "low_stock",
            "product_id": product["id"],
            "product_name": product["name"],
            "current_quantity": current_quantity,
            "reorder_level": product.get("reorder_level", 10),
            "outlet_id": product.get("outlet_id"),
            "company_id": company_id,
            "resolved": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.inventory_alerts.insert_one(alert)

async def deduct_stock_for_booking(db, items: List[dict], company_id: str, booking_id: str, user_id: str):
    """Deduct stock when items are added to a booking"""
    for item in items:
        product = await db.products.find_one({"id": item["product_id"], "company_id": company_id})
        if product:
            new_quantity = product.get("stock_quantity", 0) - item["quantity"]
            if new_quantity < 0:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product['name']}")
            
            await db.products.update_one(
                {"id": item["product_id"]},
                {"$set": {"stock_quantity": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            await log_inventory_action(db, {
                "product_id": item["product_id"],
                "action": "sale",
                "quantity": -item["quantity"],
                "new_quantity": new_quantity,
                "reason": "booking",
                "booking_id": booking_id,
                "user_id": user_id,
                "company_id": company_id
            })
            
            if new_quantity <= product.get("reorder_level", 10):
                await create_low_stock_alert(db, product, new_quantity, company_id)
