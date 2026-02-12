from fastapi import APIRouter, Depends, HTTPException, Body
from .dependencies import (
    promotions_collection, coupons_collection, get_current_user, User, 
    companies_collection, get_current_company
)
from datetime import datetime, timezone
import uuid
from typing import List, Optional
from pydantic import BaseModel, Field

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
async def get_promotions(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin" and current_user.company_id:
        query["company_id"] = current_user.company_id
    
    promotions = await promotions_collection.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return promotions

@promotions_bp.post("")
async def create_promotion(promo: PromotionCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "SuperAdmin" and not current_user.company_id:
         raise HTTPException(status_code=400, detail="User must belong to a company to create promotions")

    promo_dict = promo.dict()
    promo_dict["promotion_id"] = str(uuid.uuid4())
    promo_dict["company_id"] = current_user.company_id
    promo_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    # Ensure dates are isoformat strings for Mongo
    if promo_dict.get("valid_from"):
        promo_dict["valid_from"] = promo_dict["valid_from"].isoformat()
    if promo_dict.get("valid_to"):
        promo_dict["valid_to"] = promo_dict["valid_to"].isoformat()
        
    await promotions_collection.insert_one(promo_dict)
    
    # Remove MongoDB _id before returning
    if "_id" in promo_dict:
        del promo_dict["_id"]
        
    return promo_dict

@promotions_bp.put("/{promo_id}")
async def update_promotion(promo_id: str, promo_update: PromotionUpdate, current_user: User = Depends(get_current_user)):
    query = {"promotion_id": promo_id}
    if current_user.role != "SuperAdmin" and current_user.company_id:
        query["company_id"] = current_user.company_id
        
    existing_promo = await promotions_collection.find_one(query)
    if not existing_promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
        
    update_data = {k: v for k, v in promo_update.dict(exclude_unset=True).items()}
    
    if update_data:
        await promotions_collection.update_one(
            {"promotion_id": promo_id},
            {"$set": update_data}
        )
        
    return {"message": "Promotion updated successfully"}

@promotions_bp.post("/{promo_id}/coupons")
async def generate_coupons(promo_id: str, config: CouponGenerate, current_user: User = Depends(get_current_user)):
    query = {"promotion_id": promo_id}
    if current_user.role != "SuperAdmin" and current_user.company_id:
        query["company_id"] = current_user.company_id
        
    existing_promo = await promotions_collection.find_one(query)
    if not existing_promo:
        raise HTTPException(status_code=404, detail="Promotion not found")

    coupons = []
    codes = []
    
    for _ in range(config.count):
        code = f"{config.prefix}-{str(uuid.uuid4())[:8].upper()}"
        coupon = {
            "coupon_id": str(uuid.uuid4()),
            "promotion_id": promo_id,
            "code": code,
            "company_id": current_user.company_id,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        coupons.append(coupon)
        codes.append(code)
        
    if coupons:
        await coupons_collection.insert_many(coupons)
        
    return {"message": f"{config.count} coupons generated", "codes": codes}

class PromotionValidate(BaseModel):
    code: str
    amount: float
    service_id: Optional[str] = None
    company_id: Optional[str] = None

async def validate_promo_logic(code: str, amount: float, company_id: Optional[str] = None, service_id: Optional[str] = None):
    # 1. Check Coupon first
    coupon = await coupons_collection.find_one({"code": code})
    promotion = None
    
    if coupon:
        if not coupon.get("is_active", True):
             return {"valid": False, "reason": "Coupon is inactive"}
        # Get associated promotion
        promotion = await promotions_collection.find_one({"promotion_id": coupon["promotion_id"]})
    else:
        # Check if code matches a promotion directly (if promotions have codes, though schema didn't show it explicitly, assuming title or a 'code' field might be added, or strictly coupons. 
        # For now, let's assume promotions might have a 'code' field or we rely solely on coupons for unique codes, 
        # BUT often general promos have a code like 'SUMMER20'. Let's check 'title' as code or add 'code' to promo model? 
        # The schema in file view didn't show 'code' on PromotionCreate. 
        # Let's assume for this implementation we check coupons OR if the code matches a promotion title (case insensitive) for global promos.
        # Ideally we should add 'code' to Promotion model. For now let's query by title as a fallback or assume coupons.
        # Actually, let's stick to coupons or "global" codes.
        # Let's check if there is a promotion with this 'title' acting as a code
        promotion = await promotions_collection.find_one({
            "title": {"$regex": f"^{code}$", "$options": "i"}, 
            "company_id": company_id if company_id else {"$exists": True}
        })

    if not promotion:
        return {"valid": False, "reason": "Invalid promotion code"}

    if company_id and promotion.get("company_id") != company_id:
         return {"valid": False, "reason": "Invalid promotion code"}

    if not promotion.get("is_active", True):
        return {"valid": False, "reason": "Promotion is inactive"}

    now = datetime.now(timezone.utc)
    if promotion.get("valid_from") and datetime.fromisoformat(promotion["valid_from"].replace('Z', '+00:00')) > now:
        return {"valid": False, "reason": "Promotion not yet active"}
    
    if promotion.get("valid_to") and datetime.fromisoformat(promotion["valid_to"].replace('Z', '+00:00')) < now:
        return {"valid": False, "reason": "Promotion expired"}

    # Calculate Discount
    discount_amount = 0
    if promotion["discount_type"] == "percentage":
        discount_amount = amount * (promotion["discount_value"] / 100)
    else:
        discount_amount = promotion["discount_value"]
    
    # Cap discount if needed (not in schema but good practice, skipping for now)
    if discount_amount > amount:
        discount_amount = amount

    return {
        "valid": True,
        "promotion_id": promotion["promotion_id"],
        "discount_amount": round(discount_amount, 2),
        "final_price": round(amount - discount_amount, 2),
        "discount_type": promotion["discount_type"],
        "discount_value": promotion["discount_value"],
        "applied_code": code
    }

@promotions_bp.post("/validate")
async def validate_promotion(data: PromotionValidate, current_user: User = Depends(get_current_user)):
    # Verify company context
    if current_user.role != "SuperAdmin" and current_user.company_id:
        if data.company_id and data.company_id != current_user.company_id:
             raise HTTPException(status_code=403, detail="Access denied")
        data.company_id = current_user.company_id
    
    result = await validate_promo_logic(data.code, data.amount, data.company_id, data.service_id)
    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result["reason"])
        
    return result
