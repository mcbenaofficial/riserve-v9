from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
import models_pg

from .dependencies import (
    get_db, get_current_user, require_admin, User, 
    check_plan_limit, SUBSCRIPTION_PLANS
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
    portal_logo_url: Optional[str] = None
    portal_color_scheme: Optional[dict] = None
    portal_custom_colors: bool = False


class OutletCreate(OutletBase):
    pass


@router.get("")
async def get_outlets(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Outlet)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Outlet.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    outlets = res.scalars().all()
    
    return [
        {
            "id": o.id,
            "company_id": o.company_id,
            "name": o.name,
            "city": o.location.split(", ")[0] if o.location else "",
            "address": o.location,
            "capacity": o.capacity,
            "status": o.status,
            "portal_logo_url": o.portal_logo_url,
            "portal_color_scheme": o.portal_color_scheme,
            "portal_custom_colors": o.portal_custom_colors,
            "created_at": o.created_at
        } for o in outlets
    ]


@router.post("")
async def create_outlet(
    outlet_input: OutletCreate, 
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    # Check plan limits for outlet creation
    if current_user.company_id:
        company_stmt = select(models_pg.Company).where(models_pg.Company.id == current_user.company_id)
        res = await db_session.execute(company_stmt)
        company = res.scalar_one_or_none()
        
        if company:
            plan = company.plan or "free"
            plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"])
            outlet_limit = plan_config["limits"].get("outlets", 1)
            
            # -1 means unlimited
            if outlet_limit != -1:
                count_stmt = select(func.count(models_pg.Outlet.id)).where(models_pg.Outlet.company_id == current_user.company_id)
                count_res = await db_session.execute(count_stmt)
                current_outlet_count = count_res.scalar_one()
                
                if current_outlet_count >= outlet_limit:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Outlet limit reached. Your {plan.capitalize()} plan allows {outlet_limit} outlet(s). Please upgrade your plan."
                    )
    
    new_outlet = models_pg.Outlet(
        id=str(uuid.uuid4()),
        name=outlet_input.name,
        company_id=current_user.company_id,
        location=f"{outlet_input.city}, {outlet_input.address}",
        capacity=outlet_input.capacity,
        status="active",
        portal_logo_url=outlet_input.portal_logo_url,
        portal_color_scheme=outlet_input.portal_color_scheme,
        portal_custom_colors=outlet_input.portal_custom_colors
    )
    db_session.add(new_outlet)
    await db_session.commit()
    await db_session.refresh(new_outlet)
    
    return {
        "id": new_outlet.id,
        "name": new_outlet.name,
        "city": outlet_input.city,
        "address": outlet_input.address,
        "capacity": new_outlet.capacity,
        "status": new_outlet.status,
        "company_id": new_outlet.company_id,
        "portal_logo_url": new_outlet.portal_logo_url,
        "portal_color_scheme": new_outlet.portal_color_scheme,
        "portal_custom_colors": new_outlet.portal_custom_colors,
        "created_at": new_outlet.created_at
    }


@router.put("/{outlet_id}")
async def update_outlet(
    outlet_id: str, 
    outlet_input: OutletCreate, 
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = (
        update(models_pg.Outlet)
        .where(models_pg.Outlet.id == outlet_id)
        .values(
            name=outlet_input.name,
            location=f"{outlet_input.city}, {outlet_input.address}",
            capacity=outlet_input.capacity,
            portal_logo_url=outlet_input.portal_logo_url,
            portal_color_scheme=outlet_input.portal_color_scheme,
            portal_custom_colors=outlet_input.portal_custom_colors
        )
    )
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Outlet.company_id == current_user.company_id)

    res = await db_session.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Outlet not found")
        
    await db_session.commit()
    
    get_stmt = select(models_pg.Outlet).where(models_pg.Outlet.id == outlet_id)
    get_res = await db_session.execute(get_stmt)
    outlet = get_res.scalar_one()
    
    return {
        "id": outlet.id,
        "name": outlet.name,
        "location": outlet.location,
        "capacity": outlet.capacity,
        "status": outlet.status,
        "portal_logo_url": outlet.portal_logo_url,
        "portal_color_scheme": outlet.portal_color_scheme,
        "portal_custom_colors": outlet.portal_custom_colors
    }


@router.delete("/{outlet_id}")
async def delete_outlet(
    outlet_id: str, 
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = delete(models_pg.Outlet).where(models_pg.Outlet.id == outlet_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Outlet.company_id == current_user.company_id)

    res = await db_session.execute(stmt)
    
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Outlet not found")
        
    await db_session.commit()
    return {"message": "Outlet deleted"}
