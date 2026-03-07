from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
import models_pg

from .dependencies import get_db, get_current_user, require_admin, User

router = APIRouter(prefix="/services", tags=["Services"])


class ServiceBase(BaseModel):
    name: str
    duration_min: int = 30
    price: int = 299
    description: Optional[str] = None
    category_id: Optional[str] = None

class ServiceCreate(ServiceBase):
    pass

class ServiceCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

@router.get("/categories")
async def get_service_categories(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.ServiceCategory)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.ServiceCategory.company_id == current_user.company_id)
    
    res = await db_session.execute(stmt)
    categories = res.scalars().all()
    
    return [
        {
            "id": c.id,
            "company_id": c.company_id,
            "name": c.name,
            "description": c.description,
            "active": c.active,
            "created_at": c.created_at.isoformat() if c.created_at else None
        } for c in categories
    ]

@router.post("/categories")
async def create_service_category(
    cat_input: ServiceCategoryCreate,
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    cat_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    new_cat = models_pg.ServiceCategory(
        id=cat_id,
        company_id=current_user.company_id,
        name=cat_input.name,
        description=cat_input.description,
        active=True,
        created_at=now
    )
    db_session.add(new_cat)
    await db_session.commit()
    
    return {
        "id": cat_id,
        "company_id": current_user.company_id,
        "name": cat_input.name,
        "description": cat_input.description,
        "active": True,
        "created_at": now.isoformat()
    }

@router.put("/categories/{cat_id}")
async def update_service_category(
    cat_id: str,
    cat_input: ServiceCategoryCreate,
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = (
        update(models_pg.ServiceCategory)
        .where(models_pg.ServiceCategory.id == cat_id)
        .values(
            name=cat_input.name,
            description=cat_input.description
        )
    )
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.ServiceCategory.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Category not found")
        
    await db_session.commit()
    
    sel_stmt = select(models_pg.ServiceCategory).where(models_pg.ServiceCategory.id == cat_id)
    cat = (await db_session.execute(sel_stmt)).scalar_one()
    
    return {
        "id": cat.id,
        "company_id": cat.company_id,
        "name": cat.name,
        "description": cat.description,
        "active": cat.active,
        "created_at": cat.created_at.isoformat() if cat.created_at else None
    }

@router.delete("/categories/{cat_id}")
async def delete_service_category(
    cat_id: str,
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = delete(models_pg.ServiceCategory).where(models_pg.ServiceCategory.id == cat_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.ServiceCategory.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Category not found")
        
    await db_session.commit()
    return {"message": "Category deleted"}



@router.get("")
async def get_services(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Service)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Service.company_id == current_user.company_id)
    
    res = await db_session.execute(stmt)
    services = res.scalars().all()
    
    return [
        {
            "id": s.id,
            "company_id": s.company_id,
            "name": s.name,
            "duration_min": s.duration,
            "price": s.price,
            "description": s.description,
            "category_id": s.category_id,
            "active": s.active,
            "created_at": s.created_at.isoformat() if s.created_at else None
        } for s in services
    ]


@router.post("")
async def create_service(
    service_input: ServiceCreate, 
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    service_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    new_service = models_pg.Service(
        id=service_id,
        company_id=current_user.company_id,
        name=service_input.name,
        duration=service_input.duration_min,
        price=service_input.price,
        description=service_input.description,
        category_id=service_input.category_id,
        active=True,
        created_at=now
    )
    db_session.add(new_service)
    await db_session.commit()
    
    return {
        "id": service_id,
        "company_id": current_user.company_id,
        "name": service_input.name,
        "duration_min": service_input.duration_min,
        "price": service_input.price,
        "description": service_input.description,
        "category_id": service_input.category_id,
        "active": True,
        "created_at": now.isoformat()
    }


@router.put("/{service_id}")
async def update_service(
    service_id: str, 
    service_input: ServiceCreate, 
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = (
        update(models_pg.Service)
        .where(models_pg.Service.id == service_id)
        .values(
            name=service_input.name,
            duration=service_input.duration_min,
            price=service_input.price,
            description=service_input.description,
            category_id=service_input.category_id
        )
    )
    
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Service.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Service not found")
        
    await db_session.commit()
    
    # Fetch updated
    sel_stmt = select(models_pg.Service).where(models_pg.Service.id == service_id)
    svc = (await db_session.execute(sel_stmt)).scalar_one()
    
    return {
        "id": svc.id,
        "company_id": svc.company_id,
        "name": svc.name,
        "duration_min": svc.duration,
        "price": svc.price,
        "description": svc.description,
        "category_id": svc.category_id,
        "active": svc.active,
        "created_at": svc.created_at.isoformat() if svc.created_at else None
    }


@router.delete("/{service_id}")
async def delete_service(
    service_id: str, 
    current_user: User = Depends(require_admin),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = delete(models_pg.Service).where(models_pg.Service.id == service_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Service.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Service not found")
        
    await db_session.commit()
    return {"message": "Service deleted"}
