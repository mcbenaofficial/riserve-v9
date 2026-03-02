from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from .dependencies import (
    get_current_user, User, get_db
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import models_pg

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
async def get_slot_configs(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.SlotConfig)
    
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.SlotConfig.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    configs = res.scalars().all()
    
    return [c.configuration for c in configs if c.configuration]


@router.get("/{outlet_id}")
async def get_slot_config_by_outlet(
    outlet_id: str, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.SlotConfig).where(models_pg.SlotConfig.outlet_id == outlet_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.SlotConfig.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    config = res.scalar_one_or_none()
    
    if not config and current_user.role != "SuperAdmin":
        # Additional check to see if outlet exists and belongs to user
        out_stmt = select(models_pg.Outlet).where(
            models_pg.Outlet.id == outlet_id,
            models_pg.Outlet.company_id == current_user.company_id
        )
        if not (await db_session.execute(out_stmt)).scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Outlet not found")
            
    return config.configuration if config else None


@router.post("")
async def create_slot_config(
    config_input: SlotConfigCreate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    if current_user.role != "SuperAdmin":
        out_stmt = select(models_pg.Outlet).where(
            models_pg.Outlet.id == config_input.outlet_id,
            models_pg.Outlet.company_id == current_user.company_id
        )
        if not (await db_session.execute(out_stmt)).scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Outlet not found or access denied")
            
    existing_stmt = select(models_pg.SlotConfig).where(models_pg.SlotConfig.outlet_id == config_input.outlet_id)
    if (await db_session.execute(existing_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slot configuration already exists for this outlet")
    
    # Prepare resources with IDs
    resources = []
    for r in config_input.resources:
        if 'id' not in r:
            r['id'] = str(uuid.uuid4())
        resources.append(r)
    
    # Prepare customer fields with defaults
    customer_fields = config_input.customer_fields or [
        {"field_name": "name", "label": "Full Name", "field_type": "text", "required": True, "enabled": True, "order": 1},
        {"field_name": "phone", "label": "Phone Number", "field_type": "phone", "required": True, "enabled": True, "order": 2},
        {"field_name": "email", "label": "Email Address", "field_type": "email", "required": False, "enabled": True, "order": 3},
        {"field_name": "notes", "label": "Additional Notes", "field_type": "textarea", "required": False, "enabled": True, "order": 4}
    ]
    
    config_id = str(uuid.uuid4())
    config_doc = {
        "id": config_id,
        "outlet_id": config_input.outlet_id,
        "company_id": current_user.company_id,
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
        "weekly_schedule": config_input.weekly_schedule or {},
        "exceptions": config_input.exceptions or [],
        "capacity_type": config_input.capacity_type,
        "max_capacity": config_input.max_capacity,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    new_config = models_pg.SlotConfig(
        id=config_id,
        company_id=current_user.company_id,
        outlet_id=config_input.outlet_id,
        configuration=config_doc
    )
    
    db_session.add(new_config)
    await db_session.commit()
    return config_doc


@router.put("/{config_id}")
async def update_slot_config(
    config_id: str, 
    config_input: SlotConfigCreate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.SlotConfig).where(models_pg.SlotConfig.id == config_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.SlotConfig.company_id == current_user.company_id)
        
    config_rec = (await db_session.execute(stmt)).scalar_one_or_none()
    if not config_rec:
        raise HTTPException(status_code=404, detail="Slot configuration not found")
        
    # Prepare resources with IDs
    resources = []
    for r in config_input.resources:
        if 'id' not in r:
            r['id'] = str(uuid.uuid4())
        resources.append(r)
        
    current_conf = config_rec.configuration or {}
    
    # Update dict manually within configuration JSONB
    current_conf.update({
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
        "weekly_schedule": config_input.weekly_schedule,
        "exceptions": config_input.exceptions,
        "capacity_type": config_input.capacity_type,
        "max_capacity": config_input.max_capacity
    })
    
    import copy
    config_rec.configuration = copy.deepcopy(current_conf)
    await db_session.commit()
    
    return current_conf


@router.delete("/{config_id}")
async def delete_slot_config(
    config_id: str, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.SlotConfig).where(models_pg.SlotConfig.id == config_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.SlotConfig.company_id == current_user.company_id)
        
    config_rec = (await db_session.execute(stmt)).scalar_one_or_none()
    if not config_rec:
        raise HTTPException(status_code=404, detail="Slot configuration not found")
        
    await db_session.delete(config_rec)
    await db_session.commit()
    
    return {"message": "Slot configuration deleted"}
