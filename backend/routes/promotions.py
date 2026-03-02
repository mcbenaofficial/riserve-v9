from fastapi import APIRouter, Depends, HTTPException, Body
from .dependencies import (
    get_current_user, User, get_db
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone
import uuid
from typing import List, Optional
from pydantic import BaseModel, Field
import models_pg

promotions_bp = APIRouter(prefix="/promotions", tags=["Promotions"])

# Models
class PromotionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    promotion_type: str = "global"
    discount_type: str = "percentage"
    discount_value: float
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None
    package_tier: str = "all"
    is_active: bool = True
    rules: Optional[dict] = None

class PromotionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CouponGenerate(BaseModel):
    count: int = 1
    prefix: str = "PROMO"

@promotions_bp.get("")
async def get_promotions(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Promotion).order_by(desc(models_pg.Promotion.created_at))
    
    if current_user.role != "SuperAdmin" and current_user.company_id:
        stmt = stmt.where(models_pg.Promotion.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    promotions = res.scalars().all()
    
    return [
        {
            "promotion_id": p.id,
            "company_id": p.company_id,
            "title": p.title,
            "description": p.description,
            "promotion_type": p.promotion_type,
            "discount_type": p.discount_type,
            "discount_value": float(p.discount_value) if p.discount_value else 0.0,
            "valid_from": p.valid_from.isoformat() if p.valid_from else None,
            "valid_to": p.valid_to.isoformat() if p.valid_to else None,
            "package_tier": p.package_tier,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat() if p.created_at else None
        } for p in promotions
    ]

@promotions_bp.post("")
async def create_promotion(
    promo: PromotionCreate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    if current_user.role != "SuperAdmin" and not current_user.company_id:
         raise HTTPException(status_code=400, detail="User must belong to a company to create promotions")
         
    promo_id = str(uuid.uuid4())
    company_id = current_user.company_id if current_user.company_id else "global_admin"
    
    new_promo = models_pg.Promotion(
        id=promo_id,
        company_id=company_id,
        title=promo.title,
        description=promo.description,
        promotion_type=promo.promotion_type,
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        valid_from=promo.valid_from,
        valid_to=promo.valid_to,
        package_tier=promo.package_tier,
        is_active=promo.is_active
    )
    
    db_session.add(new_promo)
    await db_session.commit()
    
    return {
        "promotion_id": new_promo.id,
        "company_id": new_promo.company_id,
        "title": new_promo.title,
        "description": new_promo.description,
        "promotion_type": new_promo.promotion_type,
        "discount_type": new_promo.discount_type,
        "discount_value": float(new_promo.discount_value) if new_promo.discount_value else 0.0,
        "valid_from": new_promo.valid_from.isoformat() if new_promo.valid_from else None,
        "valid_to": new_promo.valid_to.isoformat() if new_promo.valid_to else None,
        "package_tier": new_promo.package_tier,
        "is_active": new_promo.is_active,
        "created_at": new_promo.created_at.isoformat() if new_promo.created_at else None
    }

@promotions_bp.put("/{promo_id}")
async def update_promotion(
    promo_id: str, 
    promo_update: PromotionUpdate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Promotion).where(models_pg.Promotion.id == promo_id)
    if current_user.role != "SuperAdmin" and current_user.company_id:
        stmt = stmt.where(models_pg.Promotion.company_id == current_user.company_id)
        
    promo_rec = (await db_session.execute(stmt)).scalar_one_or_none()
    if not promo_rec:
        raise HTTPException(status_code=404, detail="Promotion not found")
        
    update_data = promo_update.dict(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(promo_rec, key, value)
        
    if update_data:
        await db_session.commit()
        
    return {"message": "Promotion updated successfully"}

@promotions_bp.post("/{promo_id}/coupons")
async def generate_coupons(
    promo_id: str, 
    config: CouponGenerate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Promotion).where(models_pg.Promotion.id == promo_id)
    if current_user.role != "SuperAdmin" and current_user.company_id:
        stmt = stmt.where(models_pg.Promotion.company_id == current_user.company_id)
        
    existing_promo = (await db_session.execute(stmt)).scalar_one_or_none()
    if not existing_promo:
        raise HTTPException(status_code=404, detail="Promotion not found")

    coupons = []
    codes = []
    
    for _ in range(config.count):
        code = f"{config.prefix}-{str(uuid.uuid4())[:8].upper()}"
        coupon = models_pg.Coupon(
            id=str(uuid.uuid4()),
            promotion_id=promo_id,
            company_id=current_user.company_id if current_user.company_id else "global_admin",
            code=code,
            is_active=True
        )
        db_session.add(coupon)
        codes.append(code)
        
    if codes:
        await db_session.commit()
        
    return {"message": f"{config.count} coupons generated", "codes": codes}

class PromotionValidate(BaseModel):
    code: str
    amount: float
    service_id: Optional[str] = None
    company_id: Optional[str] = None

async def validate_promo_logic(
    code: str, 
    amount: float, 
    company_id: Optional[str] = None, 
    service_id: Optional[str] = None,
    db_session: AsyncSession = None
):
    # 1. Check Coupon first
    coupon_stmt = select(models_pg.Coupon).where(models_pg.Coupon.code == code)
    coupon = (await db_session.execute(coupon_stmt)).scalar_one_or_none()
    promotion = None
    
    if coupon:
        if not coupon.is_active:
             return {"valid": False, "reason": "Coupon is inactive"}
        # Get associated promotion
        promo_stmt = select(models_pg.Promotion).where(models_pg.Promotion.id == coupon.promotion_id)
        promotion = (await db_session.execute(promo_stmt)).scalar_one_or_none()
    else:
        # Check if code matches a promotion directly via title (case insensitive)
        from sqlalchemy import func
        promo_stmt = select(models_pg.Promotion).where(func.lower(models_pg.Promotion.title) == code.lower())
        if company_id:
            promo_stmt = promo_stmt.where(models_pg.Promotion.company_id == company_id)
            
        promotion = (await db_session.execute(promo_stmt)).scalar_one_or_none()

    if not promotion:
        return {"valid": False, "reason": "Invalid promotion code"}

    if company_id and promotion.company_id != company_id:
         return {"valid": False, "reason": "Invalid promotion code"}

    if not promotion.is_active:
        return {"valid": False, "reason": "Promotion is inactive"}

    now = datetime.now(timezone.utc)
    if promotion.valid_from and promotion.valid_from > now:
        return {"valid": False, "reason": "Promotion not yet active"}
    
    if promotion.valid_to and promotion.valid_to < now:
        return {"valid": False, "reason": "Promotion expired"}

    # Calculate Discount
    discount_amount = 0
    if promotion.discount_type == "percentage":
        discount_amount = amount * (float(promotion.discount_value) / 100)
    else:
        discount_amount = float(promotion.discount_value)
    
    if discount_amount > amount:
        discount_amount = amount

    return {
        "valid": True,
        "promotion_id": promotion.id,
        "discount_amount": round(discount_amount, 2),
        "final_price": round(amount - discount_amount, 2),
        "discount_type": promotion.discount_type,
        "discount_value": float(promotion.discount_value),
        "applied_code": code
    }

@promotions_bp.post("/validate")
async def validate_promotion(
    data: PromotionValidate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    # Verify company context
    if current_user.role != "SuperAdmin" and current_user.company_id:
        if data.company_id and data.company_id != current_user.company_id:
             raise HTTPException(status_code=403, detail="Access denied")
        data.company_id = current_user.company_id
    
    result = await validate_promo_logic(data.code, data.amount, data.company_id, data.service_id, db_session)
    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result["reason"])
        
    return result
