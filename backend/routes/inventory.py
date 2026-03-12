from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime, timezone
import uuid
import models_pg
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, and_, or_, func, desc
from sqlalchemy.orm import selectinload
from .dependencies import get_current_user, get_db, require_manager_or_admin, enforce_outlet_access, User, require_feature

router = APIRouter(
    prefix="/inventory", 
    tags=["Inventory"],
    dependencies=[Depends(require_feature("inventory"))]
)

# Models
class ProductCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    category: str = "general"
    description: Optional[str] = None
    price: float
    cost: Optional[float] = None
    outlet_id: Optional[str] = None
    stock_quantity: int = 0
    reorder_level: int = 10
    is_addon: bool = True
    active: bool = True
    supplier_id: Optional[str] = None

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
    supplier_id: Optional[str] = None

class StockAdjustment(BaseModel):
    product_id: str
    quantity: int
    reason: str
    booking_id: Optional[str] = None

class InventorySettingsSchema(BaseModel):
    inventory_mode: str = "centralized"
    low_stock_alerts: bool = True
    allow_customer_addons: bool = False
    default_reorder_level: int = 10

# Routes
@router.get("/products")
async def get_products(
    outlet_id: Optional[str] = None,
    category: Optional[str] = None,
    low_stock: Optional[bool] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all products with optional filters"""
    stmt = select(models_pg.Product).options(
        selectinload(models_pg.Product.supplier_links).selectinload(models_pg.SupplierProduct.supplier)
    ).where(models_pg.Product.company_id == current_user.company_id)
    
    if active_only:
        stmt = stmt.where(models_pg.Product.active == True)
    
    if category:
        stmt = stmt.where(models_pg.Product.category == category)
    
    # Get inventory settings
    settings_stmt = select(models_pg.CompanySetting).where(models_pg.CompanySetting.company_id == current_user.company_id)
    settings_res = await db.execute(settings_stmt)
    settings_obj = settings_res.scalar_one_or_none()
    
    inventory_mode = "centralized"
    if settings_obj and settings_obj.inventory_settings:
        inventory_mode = settings_obj.inventory_settings.get("inventory_mode", "centralized")
    
    # Filter by outlet
    if current_user.role in ["Manager", "User"]:
        if current_user.outlets:
            if inventory_mode == "outlet_specific" and outlet_id:
                if outlet_id in current_user.outlets:
                     stmt = stmt.where(or_(models_pg.Product.outlet_id == outlet_id, models_pg.Product.outlet_id == None))
                else:
                     return [] # Requested outlet not allowed
            else:
                stmt = stmt.where(or_(models_pg.Product.outlet_id.in_(current_user.outlets), models_pg.Product.outlet_id == None))
        else:
            return []
    elif outlet_id:
        stmt = stmt.where(or_(models_pg.Product.outlet_id == outlet_id, models_pg.Product.outlet_id == None))
    
    result = await db.execute(stmt)
    products = result.scalars().all()
    
    products_list = []
    for p in products:
        p_dict = {
            "id": p.id,
            "company_id": p.company_id,
            "outlet_id": p.outlet_id,
            "name": p.name,
            "sku": p.sku,
            "category": p.category,
            "description": p.description,
            "price": float(p.price) if p.price else 0,
            "cost": float(p.cost) if p.cost else 0,
            "stock_quantity": p.stock_quantity,
            "reorder_level": p.reorder_level,
            "is_addon": p.is_addon,
            "active": p.active,
            "supplier_id": p.supplier_links[0].supplier.id if p.supplier_links and p.supplier_links[0].supplier else None,
            "supplier_name": p.supplier_links[0].supplier.name if p.supplier_links and p.supplier_links[0].supplier else None,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None
        }
        
        # Filter for low stock if requested
        if low_stock:
            if p.stock_quantity <= p.reorder_level:
                products_list.append(p_dict)
        else:
            products_list.append(p_dict)
    
    return products_list

@router.get("/products/{product_id}")
async def get_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a single product"""
    stmt = select(models_pg.Product).options(
        selectinload(models_pg.Product.supplier_links).selectinload(models_pg.SupplierProduct.supplier)
    ).where(
        models_pg.Product.id == product_id, 
        models_pg.Product.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    return {
        "id": product.id,
        "company_id": product.company_id,
        "outlet_id": product.outlet_id,
        "name": product.name,
        "sku": product.sku,
        "category": product.category,
        "description": product.description,
        "price": float(product.price) if product.price else 0,
        "cost": float(product.cost) if product.cost else 0,
        "stock_quantity": product.stock_quantity,
        "reorder_level": product.reorder_level,
        "is_addon": product.is_addon,
        "active": product.active,
        "supplier_id": product.supplier_links[0].supplier.id if product.supplier_links and product.supplier_links[0].supplier else None,
        "supplier_name": product.supplier_links[0].supplier.name if product.supplier_links and product.supplier_links[0].supplier else None,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "updated_at": product.updated_at.isoformat() if product.updated_at else None
    }

@router.post("/products")
async def create_product(
    product: ProductCreate,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new product"""
    if current_user.role == "Manager":
       if not product.outlet_id:
           raise HTTPException(status_code=403, detail="Managers must assign products to an outlet")
       enforce_outlet_access(current_user, product.outlet_id)
    
    product_id = str(uuid.uuid4())
    sku = product.sku or f"SKU-{product_id[:8].upper()}"
    
    new_product = models_pg.Product(
        id=product_id,
        company_id=current_user.company_id,
        outlet_id=product.outlet_id,
        name=product.name,
        sku=sku,
        category=product.category,
        description=product.description,
        price=product.price,
        cost=product.cost or 0,
        stock_quantity=product.stock_quantity,
        reorder_level=product.reorder_level,
        is_addon=product.is_addon,
        active=product.active
    )
    
    db.add(new_product)
    
    # Add Supplier link if provided
    if product.supplier_id:
        supplier_link = models_pg.SupplierProduct(
            id=str(uuid.uuid4()),
            company_id=current_user.company_id,
            supplier_id=product.supplier_id,
            product_id=product_id,
            lead_time_days=7,
            moq=1,
            unit_cost=product.cost or 0
        )
        db.add(supplier_link)
    
    # Log inventory action
    await log_inventory_action(db, {
        "product_id": product_id,
        "action": "created",
        "quantity": product.stock_quantity,
        "new_quantity": product.stock_quantity,
        "reason": "initial_stock",
        "user_id": current_user.id,
        "company_id": current_user.company_id
    })
    
    await db.commit()
    return {"id": product_id, "message": "Product created successfully"}

@router.put("/products/{product_id}")
async def update_product(
    product_id: str,
    product: ProductUpdate,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update a product"""
    stmt = select(models_pg.Product).where(
        models_pg.Product.id == product_id, 
        models_pg.Product.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if current_user.role == "Manager":
        if existing.outlet_id:
             enforce_outlet_access(current_user, existing.outlet_id)
        else:
             raise HTTPException(status_code=403, detail="Managers cannot update centralized products")
             
        if product.outlet_id:
             enforce_outlet_access(current_user, product.outlet_id)
    
    update_data = {k: v for k, v in product.dict().items() if v is not None and k != "supplier_id"}
    for key, value in update_data.items():
        setattr(existing, key, value)
    
    # Handle Supplier update
    if getattr(product, 'supplier_id', None) is not None:
        # Delete existing supplier links for this product
        await db.execute(delete(models_pg.SupplierProduct).where(models_pg.SupplierProduct.product_id == product_id))
        
        # Insert new supplier link
        if product.supplier_id != "":
            supplier_link = models_pg.SupplierProduct(
                id=str(uuid.uuid4()),
                company_id=current_user.company_id,
                supplier_id=product.supplier_id,
                product_id=product_id,
                lead_time_days=7,
                moq=1,
                unit_cost=product.cost if product.cost is not None else existing.cost
            )
            db.add(supplier_link)

    existing.updated_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": "Product updated successfully"}

@router.delete("/products/{product_id}")
async def delete_product(
    product_id: str,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete a product (soft delete by setting active=False)"""
    stmt = select(models_pg.Product).where(
        models_pg.Product.id == product_id, 
        models_pg.Product.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if current_user.role == "Manager":
        if existing.outlet_id:
             enforce_outlet_access(current_user, existing.outlet_id)
        else:
             raise HTTPException(status_code=403, detail="Managers cannot delete centralized products")
    
    existing.active = False
    existing.updated_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {"message": "Product deactivated successfully"}

@router.post("/stock/adjust")
async def adjust_stock(
    adjustment: StockAdjustment,
    current_user: User = Depends(require_manager_or_admin),
    db: AsyncSession = Depends(get_db)
):
    """Adjust stock quantity for a product"""
    stmt = select(models_pg.Product).where(
        models_pg.Product.id == adjustment.product_id, 
        models_pg.Product.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if current_user.role == "Manager":
       if product.outlet_id:
            enforce_outlet_access(current_user, product.outlet_id)
       else:
            raise HTTPException(status_code=403, detail="Managers cannot adjust stock for centralized products")
    
    new_quantity = (product.stock_quantity or 0) + adjustment.quantity
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    product.stock_quantity = new_quantity
    product.updated_at = datetime.now(timezone.utc)
    
    # Log inventory action
    await log_inventory_action(db, {
        "product_id": adjustment.product_id,
        "action": "adjustment",
        "quantity": adjustment.quantity,
        "new_quantity": new_quantity,
        "reason": adjustment.reason,
        "reference_id": adjustment.booking_id,
        "user_id": current_user.id,
        "company_id": current_user.company_id
    })
    
    # Check for low stock alert
    if new_quantity <= product.reorder_level:
        await create_low_stock_alert(db, product, new_quantity, current_user.company_id)
    
    await db.commit()
    return {"message": "Stock adjusted successfully", "new_quantity": new_quantity}

@router.get("/low-stock")
async def get_low_stock_products(
    outlet_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all products below reorder level"""
    stmt = select(models_pg.Product).where(
        models_pg.Product.company_id == current_user.company_id,
        models_pg.Product.active == True,
        models_pg.Product.stock_quantity <= models_pg.Product.reorder_level
    )
    
    if outlet_id:
        stmt = stmt.where(or_(models_pg.Product.outlet_id == outlet_id, models_pg.Product.outlet_id == None))
        
    if current_user.role in ["Manager", "User"]:
        if current_user.outlets:
             stmt = stmt.where(or_(models_pg.Product.outlet_id.in_(current_user.outlets), models_pg.Product.outlet_id == None))
        else:
             return []
    
    result = await db.execute(stmt)
    products = result.scalars().all()
    
    low_stock = []
    for p in products:
        low_stock.append({
            "id": p.id,
            "name": p.name,
            "stock_quantity": p.stock_quantity,
            "reorder_level": p.reorder_level,
            "outlet_id": p.outlet_id,
            "category": p.category,
            "shortage": p.reorder_level - p.stock_quantity
        })
    
    return sorted(low_stock, key=lambda x: x["shortage"], reverse=True)

@router.get("/alerts")
async def get_inventory_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get inventory alerts (low stock, etc.)"""
    stmt = select(models_pg.InventoryAlert).where(
        models_pg.InventoryAlert.company_id == current_user.company_id,
        models_pg.InventoryAlert.resolved == False
    ).order_by(desc(models_pg.InventoryAlert.created_at))
    
    result = await db.execute(stmt)
    alerts = result.scalars().all()
    
    return [
        {
            "id": a.id,
            "type": a.type,
            "product_id": a.product_id,
            "product_name": a.product_name,
            "current_quantity": a.current_quantity,
            "reorder_level": a.reorder_level,
            "outlet_id": a.outlet_id,
            "created_at": a.created_at.isoformat() if a.created_at else None
        } for a in alerts
    ]

@router.put("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark an alert as resolved"""
    stmt = select(models_pg.InventoryAlert).where(
        models_pg.InventoryAlert.id == alert_id,
        models_pg.InventoryAlert.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    alert = result.scalar_one_or_none()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.resolved = True
    # We could add resolved_by/at if we update the model
    await db.commit()
    
    return {"message": "Alert resolved"}

@router.get("/settings")
async def get_inventory_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get inventory settings for the company"""
    stmt = select(models_pg.CompanySetting).where(models_pg.CompanySetting.company_id == current_user.company_id)
    result = await db.execute(stmt)
    settings = result.scalar_one_or_none()
    
    default_settings = {
        "inventory_mode": "centralized",
        "low_stock_alerts": True,
        "allow_customer_addons": False,
        "default_reorder_level": 10
    }
    
    if not settings:
        return default_settings
        
    return settings.inventory_settings or default_settings

@router.put("/settings")
async def update_inventory_settings(
    settings: InventorySettingsSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update inventory settings"""
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = select(models_pg.CompanySetting).where(models_pg.CompanySetting.company_id == current_user.company_id)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        existing.inventory_settings = settings.dict()
        existing.updated_at = datetime.now(timezone.utc)
    else:
        new_settings = models_pg.CompanySetting(
            company_id=current_user.company_id,
            inventory_settings=settings.dict()
        )
        db.add(new_settings)
    
    await db.commit()
    return {"message": "Inventory settings updated"}

@router.get("/history")
async def get_inventory_history(
    product_id: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get inventory transaction history"""
    stmt = select(models_pg.InventoryLog).where(models_pg.InventoryLog.company_id == current_user.company_id)
    if product_id:
        stmt = stmt.where(models_pg.InventoryLog.product_id == product_id)
    
    stmt = stmt.order_by(desc(models_pg.InventoryLog.created_at)).limit(limit)
    result = await db.execute(stmt)
    history = result.scalars().all()
    
    return [
        {
            "id": h.id,
            "product_id": h.product_id,
            "action": h.action,
            "quantity": h.quantity,
            "new_quantity": h.new_quantity,
            "reason": h.reason,
            "reference_id": h.reference_id,
            "user_id": h.user_id,
            "created_at": h.created_at.isoformat() if h.created_at else None
        } for h in history
    ]

@router.get("/categories")
async def get_product_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all product categories"""
    stmt = select(models_pg.Product.category).where(
        models_pg.Product.company_id == current_user.company_id,
        models_pg.Product.active == True
    ).distinct()
    
    if current_user.role in ["Manager", "User"]:
         if current_user.outlets:
               stmt = stmt.where(or_(models_pg.Product.outlet_id.in_(current_user.outlets), models_pg.Product.outlet_id == None))
         else:
             return []
             
    result = await db.execute(stmt)
    categories = [row[0] for row in result.all()]
    
    return sorted(categories)

@router.get("/stats")
async def get_inventory_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get inventory statistics"""
    stmt = select(models_pg.Product).where(
        models_pg.Product.company_id == current_user.company_id,
        models_pg.Product.active == True
    )
    
    if current_user.role in ["Manager", "User"]:
         if current_user.outlets:
               stmt = stmt.where(or_(models_pg.Product.outlet_id.in_(current_user.outlets), models_pg.Product.outlet_id == None))
         else:
               return {
                  "total_products": 0,
                  "total_value": 0,
                  "low_stock_count": 0,
                  "out_of_stock": 0,
                  "categories": {}
              }
              
    result = await db.execute(stmt)
    products = result.scalars().all()
    
    total_products = len(products)
    total_value = sum((p.stock_quantity or 0) * float(p.cost if p.cost else p.price or 0) for p in products)
    low_stock_count = len([p for p in products if (p.stock_quantity or 0) <= (p.reorder_level or 10)])
    out_of_stock = len([p for p in products if (p.stock_quantity or 0) == 0])
    
    # Category breakdown
    categories = {}
    for p in products:
        cat = p.category or "general"
        if cat not in categories:
            categories[cat] = {"count": 0, "value": 0}
        categories[cat]["count"] += 1
        categories[cat]["value"] += (p.stock_quantity or 0) * float(p.cost if p.cost else p.price or 0)
    
    return {
        "total_products": total_products,
        "total_value": round(total_value, 2),
        "low_stock_count": low_stock_count,
        "out_of_stock": out_of_stock,
        "categories": categories
    }

# Helper functions
async def log_inventory_action(db: AsyncSession, data: dict):
    """Log an inventory action"""
    new_log = models_pg.InventoryLog(
        id=str(uuid.uuid4()),
        company_id=data.get("company_id"),
        product_id=data.get("product_id"),
        user_id=data.get("user_id"),
        action=data.get("action"),
        quantity=data.get("quantity"),
        new_quantity=data.get("new_quantity"),
        reason=data.get("reason"),
        reference_id=data.get("reference_id")
    )
    db.add(new_log)

async def create_low_stock_alert(db: AsyncSession, product: models_pg.Product, current_quantity: int, company_id: str):
    """Create a low stock alert"""
    # Check if alert already exists
    stmt = select(models_pg.InventoryAlert).where(
        models_pg.InventoryAlert.product_id == product.id,
        models_pg.InventoryAlert.resolved == False
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if not existing:
        new_alert = models_pg.InventoryAlert(
            id=str(uuid.uuid4()),
            type="low_stock",
            product_id=product.id,
            product_name=product.name,
            current_quantity=current_quantity,
            reorder_level=product.reorder_level,
            outlet_id=product.outlet_id,
            company_id=company_id,
            resolved=False
        )
        db.add(new_alert)

async def deduct_stock_for_booking(db: AsyncSession, items: List[dict], company_id: str, booking_id: str, user_id: str):
    """Deduct stock when items are added to a booking"""
    for item in items:
        stmt = select(models_pg.Product).where(
            models_pg.Product.id == item["product_id"], 
            models_pg.Product.company_id == company_id
        )
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        
        if product:
            new_quantity = (product.stock_quantity or 0) - item["quantity"]
            if new_quantity < 0:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for {product.name}")
            
            product.stock_quantity = new_quantity
            product.updated_at = datetime.now(timezone.utc)
            
            await log_inventory_action(db, {
                "product_id": item["product_id"],
                "action": "sale",
                "quantity": -item["quantity"],
                "new_quantity": new_quantity,
                "reason": "booking",
                "reference_id": booking_id,
                "user_id": user_id,
                "company_id": company_id
            })
            
            if new_quantity <= product.reorder_level:
                await create_low_stock_alert(db, product, new_quantity, company_id)
