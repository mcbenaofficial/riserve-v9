from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from .dependencies import (
    slot_configs_collection, bookings_collection, outlets_collection,
    get_current_user, User
)

router = APIRouter(prefix="/slot-configs", tags=["Slot Configuration"])


class SlotConfigCreate(BaseModel):
    outlet_id: str
    business_type: str = "service"
    slot_duration_min: int = 30
    operating_hours_start: str = "09:00"
    operating_hours_end: str = "18:00"
    resources: List[dict] = []
    allow_online_booking: bool = True
    booking_advance_days: int = 7
    customer_fields: Optional[List[dict]] = None
    plan: str = "free"
    branding: Optional[dict] = None
    allow_multiple_services: bool = False
    breaks: Optional[List[dict]] = None
    # NEW FIELDS for Advanced Scheduling
    weekly_schedule: Optional[dict] = None  # {"monday": [{"start": "09:00", "end": "12:00"}]}
    exceptions: Optional[List[dict]] = None  # [{"date": "2024-12-25", "is_closed": True}]
    capacity_type: str = "appointment"  # appointment, shared, private
    max_capacity: int = 1


@router.get("")
async def get_slot_configs(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        # Get outlets belonging to this company first
        company_outlets = await outlets_collection.find(
            {"company_id": current_user.company_id}, {"id": 1}
        ).to_list(1000)
        outlet_ids = [o["id"] for o in company_outlets]
        query["outlet_id"] = {"$in": outlet_ids}
    
    configs = await slot_configs_collection.find(query, {"_id": 0}).to_list(1000)
    return configs


@router.get("/{outlet_id}")
async def get_slot_config_by_outlet(outlet_id: str, current_user: User = Depends(get_current_user)):
    # Verify outlet belongs to user's company
    if current_user.role != "SuperAdmin":
        outlet = await outlets_collection.find_one({
            "id": outlet_id, 
            "company_id": current_user.company_id
        })
        if not outlet:
            raise HTTPException(status_code=404, detail="Outlet not found")
    
    config = await slot_configs_collection.find_one({"outlet_id": outlet_id}, {"_id": 0})
    return config


@router.post("")
async def create_slot_config(config_input: SlotConfigCreate, current_user: User = Depends(get_current_user)):
    # Verify outlet belongs to user's company
    if current_user.role != "SuperAdmin":
        outlet = await outlets_collection.find_one({
            "id": config_input.outlet_id,
            "company_id": current_user.company_id
        })
        if not outlet:
            raise HTTPException(status_code=404, detail="Outlet not found or access denied")
    
    existing = await slot_configs_collection.find_one({"outlet_id": config_input.outlet_id})
    if existing:
        raise HTTPException(status_code=400, detail="Slot configuration already exists for this outlet")
    
    # Prepare resources with IDs
    resources = []
    for r in config_input.resources:
        if 'id' not in r:
            r['id'] = str(uuid.uuid4())
        resources.append(r)
    
    # Prepare customer fields with defaults (generic service fields)
    customer_fields = config_input.customer_fields or [
        {"field_name": "name", "label": "Full Name", "field_type": "text", "required": True, "enabled": True, "order": 1},
        {"field_name": "phone", "label": "Phone Number", "field_type": "phone", "required": True, "enabled": True, "order": 2},
        {"field_name": "email", "label": "Email Address", "field_type": "email", "required": False, "enabled": True, "order": 3},
        {"field_name": "notes", "label": "Additional Notes", "field_type": "textarea", "required": False, "enabled": True, "order": 4}
    ]
    
    config_doc = {
        "id": str(uuid.uuid4()),
        "outlet_id": config_input.outlet_id,
        "company_id": current_user.company_id,  # Associate with company
        "business_type": config_input.business_type,
        "slot_duration_min": config_input.slot_duration_min,
        "operating_hours_start": config_input.operating_hours_start,
        "operating_hours_end": config_input.operating_hours_end,
        "resources": resources,
        "allow_online_booking": config_input.allow_online_booking,
        "booking_advance_days": config_input.booking_advance_days,
        "embed_token": str(uuid.uuid4()),
        "customer_fields": customer_fields,
        "plan": config_input.plan,
        "branding": config_input.branding or {},
        "allow_multiple_services": config_input.allow_multiple_services,
        "breaks": config_input.breaks or [],
        # New advanced scheduling fields
        "weekly_schedule": config_input.weekly_schedule or {},
        "exceptions": config_input.exceptions or [],
        "capacity_type": config_input.capacity_type,
        "max_capacity": config_input.max_capacity,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await slot_configs_collection.insert_one(config_doc)
    config_doc.pop("_id", None)
    return config_doc


@router.put("/{config_id}")
async def update_slot_config(config_id: str, config_input: SlotConfigCreate, current_user: User = Depends(get_current_user)):
    # Verify config belongs to user's company
    query = {"id": config_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    existing = await slot_configs_collection.find_one(query)
    if not existing:
        raise HTTPException(status_code=404, detail="Slot configuration not found")
    
    # Prepare resources with IDs
    resources = []
    for r in config_input.resources:
        if 'id' not in r:
            r['id'] = str(uuid.uuid4())
        resources.append(r)
    
    result = await slot_configs_collection.update_one(
        query,
        {"$set": {
            "business_type": config_input.business_type,
            "slot_duration_min": config_input.slot_duration_min,
            "operating_hours_start": config_input.operating_hours_start,
            "operating_hours_end": config_input.operating_hours_end,
            "resources": resources,
            "allow_online_booking": config_input.allow_online_booking,
            "booking_advance_days": config_input.booking_advance_days,
            "customer_fields": config_input.customer_fields,
            "plan": config_input.plan,
            "branding": config_input.branding,
            "allow_multiple_services": config_input.allow_multiple_services,
            "breaks": config_input.breaks,
            # New advanced scheduling fields
            "weekly_schedule": config_input.weekly_schedule,
            "exceptions": config_input.exceptions,
            "capacity_type": config_input.capacity_type,
            "max_capacity": config_input.max_capacity
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Slot configuration not found")
    
    config = await slot_configs_collection.find_one({"id": config_id}, {"_id": 0})
    return config


@router.delete("/{config_id}")
async def delete_slot_config(config_id: str, current_user: User = Depends(get_current_user)):
    # Verify config belongs to user's company
    query = {"id": config_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    result = await slot_configs_collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Slot configuration not found")
    return {"message": "Slot configuration deleted"}
