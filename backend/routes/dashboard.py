from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from datetime import datetime, timezone
import uuid
import models_pg
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from .dependencies import get_current_user, get_db, User

router = APIRouter(prefix="/dashboard-configs", tags=["Dashboard"])


DEFAULT_WIDGETS = [
    # Stats Row
    {"id": str(uuid.uuid4()), "type": "stat", "title": "Total Bookings", "size": "small", "position": 0, "config": {"metric": "bookings", "color": "blue", "icon": "Calendar"}},
    {"id": str(uuid.uuid4()), "type": "stat", "title": "Total Revenue", "size": "small", "position": 1, "config": {"metric": "revenue", "color": "green", "icon": "DollarSign"}},
    {"id": str(uuid.uuid4()), "type": "stat", "title": "Active Outlets", "size": "small", "position": 2, "config": {"metric": "outlets", "color": "purple", "icon": "Store"}},
    {"id": str(uuid.uuid4()), "type": "stat", "title": "Avg Rating", "size": "small", "position": 3, "config": {"metric": "rating", "color": "amber", "icon": "Star"}},
    {"id": str(uuid.uuid4()), "type": "stat", "title": "Weekly Bookings", "size": "small", "position": 4, "config": {"metric": "weekly_bookings", "color": "cyan", "icon": "TrendingUp"}},
    {"id": str(uuid.uuid4()), "type": "stat", "title": "Customers", "size": "small", "position": 5, "config": {"metric": "customers", "color": "pink", "icon": "Users"}},
    
    # Row 1
    {"id": str(uuid.uuid4()), "type": "chart", "subtype": "bookingTrend", "title": "Booking Trend", "size": "large", "position": 6, "config": {}},
    {"id": str(uuid.uuid4()), "type": "card", "subtype": "totalCollected", "title": "Total Collected", "size": "medium", "position": 7, "config": {}},
    {"id": str(uuid.uuid4()), "type": "card", "subtype": "customerRating", "title": "Customer Rating", "size": "medium", "position": 8, "config": {}},
    
    # Row 2
    {"id": str(uuid.uuid4()), "type": "chart", "subtype": "paymentTrend", "title": "Payments Overview", "size": "medium", "position": 9, "config": {}},
    {"id": str(uuid.uuid4()), "type": "chart", "subtype": "revenueByOutlet", "title": "Revenue by Outlet", "size": "medium", "position": 10, "config": {}},
    
    # Row 3
    {"id": str(uuid.uuid4()), "type": "chart", "subtype": "revenueTrend", "title": "Revenue Trend", "size": "full", "position": 11, "config": {}},
    
    # Row 4
    {"id": str(uuid.uuid4()), "type": "card", "subtype": "quickActions", "title": "Quick Actions", "size": "medium", "position": 12, "config": {}},
    {"id": str(uuid.uuid4()), "type": "list", "subtype": "recentBookings", "title": "Recent Bookings", "size": "large", "position": 13, "config": {}},
]


class DashboardConfigSchema(BaseModel):
    name: str = "Main Dashboard"
    is_default: bool = False
    widgets: List[dict] = []


@router.get("")
async def get_dashboard_configs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.DashboardConfig).where(models_pg.DashboardConfig.user_id == current_user.id)
    result = await db.execute(stmt)
    configs = result.scalars().all()
    
    if not configs:
        return [{
            "id": str(uuid.uuid4()),
            "user_id": current_user.id,
            "name": "Main Dashboard",
            "is_default": True,
            "widgets": DEFAULT_WIDGETS,
            "created_at": datetime.now(timezone.utc).isoformat()
        }]
        
    return [
        {
            "id": c.id,
            "user_id": c.user_id,
            "company_id": c.company_id,
            "name": c.name,
            "is_default": c.is_default,
            "widgets": c.widgets,
            "created_at": c.created_at.isoformat() if c.created_at else None
        } for c in configs
    ]


@router.post("")
async def create_dashboard_config(
    config_input: DashboardConfigSchema, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    config_id = str(uuid.uuid4())
    new_config = models_pg.DashboardConfig(
        id=config_id,
        user_id=current_user.id,
        company_id=current_user.company_id,
        name=config_input.name,
        is_default=config_input.is_default,
        widgets=config_input.widgets if config_input.widgets else DEFAULT_WIDGETS
    )
    db.add(new_config)
    await db.commit()
    
    return {
        "id": config_id,
        "user_id": current_user.id,
        "name": config_input.name,
        "is_default": config_input.is_default,
        "widgets": new_config.widgets,
        "created_at": datetime.now(timezone.utc).isoformat()
    }


@router.put("/{config_id}")
async def update_dashboard_config(
    config_id: str, 
    config_input: DashboardConfigSchema, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.DashboardConfig).where(
        models_pg.DashboardConfig.id == config_id, 
        models_pg.DashboardConfig.user_id == current_user.id
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Dashboard configuration not found")
    
    config.name = config_input.name
    config.is_default = config_input.is_default
    config.widgets = config_input.widgets
    
    await db.commit()
    
    return {
        "id": config.id,
        "user_id": config.user_id,
        "name": config.name,
        "is_default": config.is_default,
        "widgets": config.widgets
    }


@router.delete("/{config_id}")
async def delete_dashboard_config(
    config_id: str, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.DashboardConfig).where(
        models_pg.DashboardConfig.id == config_id, 
        models_pg.DashboardConfig.user_id == current_user.id
    )
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Dashboard configuration not found")
        
    await db.delete(config)
    await db.commit()
    
    return {"message": "Dashboard configuration deleted"}
