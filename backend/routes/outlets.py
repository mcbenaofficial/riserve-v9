from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from .dependencies import (
    outlets_collection, get_current_user, User, 
    companies_collection, check_plan_limit, SUBSCRIPTION_PLANS
)

router = APIRouter(prefix="/outlets", tags=["Outlets"])


class OutletBase(BaseModel):
    name: str
    city: str
    address: str
    capacity: int = 2
    machines: int = 1
    rating: float = 4.5
    solar: bool = False
    water_recycle: bool = False
    services_offered: List[str] = []


class OutletCreate(OutletBase):
    pass


@router.get("")
async def get_outlets(current_user: User = Depends(get_current_user)):
    # Filter by company_id for non-SuperAdmin users
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    outlets = await outlets_collection.find(query, {"_id": 0}).to_list(1000)
    return outlets


@router.post("")
async def create_outlet(outlet_input: OutletCreate, current_user: User = Depends(get_current_user)):
    # Check plan limits for outlet creation
    if current_user.company_id:
        company = await companies_collection.find_one({"id": current_user.company_id}, {"_id": 0})
        if company:
            plan = company.get("plan", "free")
            plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"])
            outlet_limit = plan_config["limits"].get("outlets", 1)
            
            # -1 means unlimited
            if outlet_limit != -1:
                current_outlet_count = await outlets_collection.count_documents({"company_id": current_user.company_id})
                if current_outlet_count >= outlet_limit:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Outlet limit reached. Your {plan.capitalize()} plan allows {outlet_limit} outlet(s). Please upgrade your plan."
                    )
    
    outlet_doc = {
        "id": str(uuid.uuid4()),
        "name": outlet_input.name,
        "city": outlet_input.city,
        "address": outlet_input.address,
        "capacity": outlet_input.capacity,
        "machines": outlet_input.machines,
        "rating": outlet_input.rating,
        "solar": outlet_input.solar,
        "water_recycle": outlet_input.water_recycle,
        "status": "Active",
        "services_offered": outlet_input.services_offered,
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await outlets_collection.insert_one(outlet_doc)
    outlet_doc.pop("_id", None)
    return outlet_doc


@router.put("/{outlet_id}")
async def update_outlet(outlet_id: str, outlet_input: OutletCreate, current_user: User = Depends(get_current_user)):
    result = await outlets_collection.update_one(
        {"id": outlet_id},
        {"$set": {
            "name": outlet_input.name,
            "city": outlet_input.city,
            "address": outlet_input.address,
            "capacity": outlet_input.capacity,
            "machines": outlet_input.machines,
            "rating": outlet_input.rating,
            "solar": outlet_input.solar,
            "water_recycle": outlet_input.water_recycle,
            "services_offered": outlet_input.services_offered
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Outlet not found")
    
    outlet = await outlets_collection.find_one({"id": outlet_id}, {"_id": 0})
    return outlet


@router.delete("/{outlet_id}")
async def delete_outlet(outlet_id: str, current_user: User = Depends(get_current_user)):
    result = await outlets_collection.delete_one({"id": outlet_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Outlet not found")
    return {"message": "Outlet deleted"}
