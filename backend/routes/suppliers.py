from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from typing import List, Optional
from datetime import datetime, timezone, timedelta

from database_pg import get_db
from .dependencies import get_current_user, User, require_feature
import models_pg as models
from pydantic import BaseModel, ConfigDict
import math

router = APIRouter(
    prefix="/suppliers", 
    tags=["Suppliers"],
    dependencies=[Depends(require_feature("inventory"))]
)

# Pydantic Schemas
class SupplierCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None
    active: Optional[bool] = None

class SupplierResponse(BaseModel):
    id: str
    company_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    contact_person: Optional[str] = None
    notes: Optional[str] = None
    active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SupplierProductLinkCreate(BaseModel):
    product_id: str
    lead_time_days: int = 0
    moq: int = 1
    unit_cost: Optional[float] = None

class SupplierProductLinkUpdate(BaseModel):
    lead_time_days: Optional[int] = None
    moq: Optional[int] = None
    unit_cost: Optional[float] = None

class SupplierProductLinkResponse(BaseModel):
    id: str
    supplier_id: str
    product_id: str
    lead_time_days: int
    moq: int
    unit_cost: Optional[float] = None
    
    product_name: Optional[str] = None
    product_sku: Optional[str] = None
    current_stock: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

# Endpoints
@router.get("", response_model=List[SupplierResponse])
async def get_suppliers(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(models.Supplier).where(models.Supplier.company_id == current_user.company_id).order_by(models.Supplier.name)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=SupplierResponse)
async def create_supplier(supplier: SupplierCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    db_supplier = models.Supplier(
        company_id=current_user.company_id,
        **supplier.model_dump()
    )
    db.add(db_supplier)
    await db.commit()
    await db.refresh(db_supplier)
    return db_supplier

@router.get("/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(supplier_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(models.Supplier).where(
        models.Supplier.id == supplier_id,
        models.Supplier.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return supplier

@router.put("/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(supplier_id: str, update_data: SupplierUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(models.Supplier).where(
        models.Supplier.id == supplier_id,
        models.Supplier.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(supplier, key, value)
        
    await db.commit()
    await db.refresh(supplier)
    return supplier

@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(models.Supplier).where(
        models.Supplier.id == supplier_id,
        models.Supplier.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    supplier = result.scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    await db.delete(supplier)
    await db.commit()
    return {"status": "success"}

# Product Links
@router.get("/{supplier_id}/products", response_model=List[SupplierProductLinkResponse])
async def get_supplier_products(supplier_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(models.SupplierProduct, models.Product).join(
        models.Product, models.SupplierProduct.product_id == models.Product.id
    ).where(
        models.SupplierProduct.supplier_id == supplier_id,
        models.SupplierProduct.company_id == current_user.company_id
    )
    result = await db.execute(stmt)
    links = result.all()
    
    results = []
    for link, product in links:
        resp = SupplierProductLinkResponse.model_validate(link)
        resp.product_name = product.name
        resp.product_sku = product.sku
        resp.current_stock = product.stock_quantity
        results.append(resp)
        
    return results

@router.post("/{supplier_id}/products", response_model=SupplierProductLinkResponse)
async def link_product_to_supplier(
    supplier_id: str, 
    link_data: SupplierProductLinkCreate, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    # Verify supplier
    s_stmt = select(models.Supplier).where(
        models.Supplier.id == supplier_id, models.Supplier.company_id == current_user.company_id
    )
    supplier = (await db.execute(s_stmt)).scalar_one_or_none()
    
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Verify product
    p_stmt = select(models.Product).where(
        models.Product.id == link_data.product_id, models.Product.company_id == current_user.company_id
    )
    product = (await db.execute(p_stmt)).scalar_one_or_none()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check if link already exists
    e_stmt = select(models.SupplierProduct).where(
        models.SupplierProduct.supplier_id == supplier_id,
        models.SupplierProduct.product_id == link_data.product_id
    )
    existing = (await db.execute(e_stmt)).scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="Product is already linked to this supplier")

    db_link = models.SupplierProduct(
        company_id=current_user.company_id,
        supplier_id=supplier_id,
        **link_data.model_dump()
    )
    
    db.add(db_link)
    await db.commit()
    await db.refresh(db_link)
    
    resp = SupplierProductLinkResponse.model_validate(db_link)
    resp.product_name = product.name
    resp.product_sku = product.sku
    resp.current_stock = product.stock_quantity
    
    return resp

@router.put("/{supplier_id}/products/{link_id}", response_model=SupplierProductLinkResponse)
async def update_supplier_product_link(
    supplier_id: str, 
    link_id: str,
    link_data: SupplierProductLinkUpdate, 
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    l_stmt = select(models.SupplierProduct).where(
        models.SupplierProduct.id == link_id,
        models.SupplierProduct.supplier_id == supplier_id,
        models.SupplierProduct.company_id == current_user.company_id
    )
    link = (await db.execute(l_stmt)).scalar_one_or_none()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
        
    for key, value in link_data.model_dump(exclude_unset=True).items():
        setattr(link, key, value)
        
    await db.commit()
    await db.refresh(link)
    
    # Get product info for response
    p_stmt = select(models.Product).where(models.Product.id == link.product_id)
    product = (await db.execute(p_stmt)).scalar_one_or_none()
    
    resp = SupplierProductLinkResponse.model_validate(link)
    if product:
        resp.product_name = product.name
        resp.product_sku = product.sku
        resp.current_stock = product.stock_quantity
        
    return resp

@router.delete("/{supplier_id}/products/{link_id}")
async def delete_supplier_product_link(
    supplier_id: str, 
    link_id: str,
    current_user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_db)
):
    l_stmt = select(models.SupplierProduct).where(
        models.SupplierProduct.id == link_id,
        models.SupplierProduct.supplier_id == supplier_id,
        models.SupplierProduct.company_id == current_user.company_id
    )
    link = (await db.execute(l_stmt)).scalar_one_or_none()
    
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
        
    await db.delete(link)
    await db.commit()
    return {"status": "success"}

# Predictive Reordering Endpoint
class ReorderSuggestion(BaseModel):
    product_id: str
    product_name: str
    supplier_id: str
    supplier_name: str
    current_stock: int
    daily_burn_rate: float
    days_remaining: float
    lead_time_days: int
    moq: int
    recommended_order_quantity: int
    status: str

@router.get("/analytics/reorder-suggestions", response_model=List[ReorderSuggestion])
async def get_reorder_suggestions(current_user: User = Depends(get_current_user), lookback_days: int = Query(30, description="Days to look back for burn rate"), db: AsyncSession = Depends(get_db)):
    stmt = select(models.SupplierProduct, models.Product, models.Supplier).join(
        models.Product, models.SupplierProduct.product_id == models.Product.id
    ).join(
        models.Supplier, models.SupplierProduct.supplier_id == models.Supplier.id
    ).where(
        models.SupplierProduct.company_id == current_user.company_id,
        models.Product.active == True
    )
    result = await db.execute(stmt)
    links_with_products = result.all()
    
    if not links_with_products:
        return []
        
    suggestions = []
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=lookback_days)
    
    for link, product, supplier in links_with_products:
        l_stmt = select(models.InventoryLog).where(
            models.InventoryLog.product_id == product.id,
            models.InventoryLog.created_at >= cutoff_date,
            models.InventoryLog.action.in_(["sale", "pos_checkout"])
        )
        logs = (await db.execute(l_stmt)).scalars().all()
        
        total_sold = sum(abs(log.quantity) for log in logs)
        daily_burn_rate = total_sold / lookback_days if total_sold > 0 else 0.05
        days_remaining = (product.stock_quantity / daily_burn_rate) if daily_burn_rate > 0 else 999
        safety_days = 3
        
        if days_remaining <= (link.lead_time_days + safety_days):
            target_stock = int(math.ceil(daily_burn_rate * (link.lead_time_days + 14)))
            deficit = max(0, target_stock - product.stock_quantity)
            recommended_order = max(deficit, link.moq)
            status = "CRITICAL" if days_remaining <= link.lead_time_days else "WARNING"
            
            suggestions.append(ReorderSuggestion(
                product_id=product.id,
                product_name=product.name,
                supplier_id=supplier.id,
                supplier_name=supplier.name,
                current_stock=product.stock_quantity,
                daily_burn_rate=round(daily_burn_rate, 2),
                days_remaining=round(days_remaining, 1),
                lead_time_days=link.lead_time_days,
                moq=link.moq,
                recommended_order_quantity=recommended_order,
                status=status
            ))
            
    suggestions.sort(key=lambda x: (0 if x.status == "CRITICAL" else 1, x.days_remaining))
    return suggestions
