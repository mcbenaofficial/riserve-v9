from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_, desc

import models_pg
from .dependencies import get_current_user, User, get_db, require_feature

router = APIRouter(
    prefix="/customers", 
    tags=["Customers"],
    dependencies=[Depends(require_feature("crm"))]
)

class CustomerCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: Optional[Dict] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: Optional[Dict] = None

@router.get("")
async def get_customers(
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Customer)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Customer.company_id == current_user.company_id)
        
    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                models_pg.Customer.name.ilike(search_term),
                models_pg.Customer.email.ilike(search_term),
                models_pg.Customer.phone.ilike(search_term)
            )
        )
        
    stmt = stmt.order_by(desc(models_pg.Customer.created_at)).offset(skip).limit(limit)
    res = await db_session.execute(stmt)
    customers = res.scalars().all()
    
    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "notes": c.notes,
            "custom_fields": c.custom_fields,
            "company_id": c.company_id,
            "total_revenue": c.total_revenue,
            "total_bookings": c.total_bookings,
            "last_visit": c.last_visit,
            "created_at": c.created_at,
            "updated_at": c.updated_at
        } for c in customers
    ]

@router.post("")
async def create_customer(
    customer_input: CustomerCreate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    if not customer_input.email and not customer_input.phone:
        raise HTTPException(status_code=400, detail="Either email or phone is required")

    # Check for existing customer
    stmt = select(models_pg.Customer).where(models_pg.Customer.company_id == current_user.company_id)
    
    or_conditions = []
    if customer_input.email:
        or_conditions.append(models_pg.Customer.email == customer_input.email)
    if customer_input.phone:
        or_conditions.append(models_pg.Customer.phone == customer_input.phone)
        
    if or_conditions:
        stmt = stmt.where(or_(*or_conditions))
        res = await db_session.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=400, detail="Customer with this email or phone already exists")

    new_customer = models_pg.Customer(
        id=str(uuid.uuid4()),
        name=customer_input.name,
        email=customer_input.email,
        phone=customer_input.phone,
        notes=customer_input.notes,
        custom_fields=customer_input.custom_fields or {},
        company_id=current_user.company_id,
        total_revenue=0,
        total_bookings=0,
        last_visit=None
    )
    
    db_session.add(new_customer)
    await db_session.commit()
    await db_session.refresh(new_customer)
    
    return {
        "id": new_customer.id,
        "name": new_customer.name,
        "email": new_customer.email,
        "phone": new_customer.phone,
        "notes": new_customer.notes,
        "custom_fields": new_customer.custom_fields,
        "company_id": new_customer.company_id,
        "total_revenue": new_customer.total_revenue,
        "total_bookings": new_customer.total_bookings,
        "last_visit": new_customer.last_visit,
        "created_at": new_customer.created_at,
        "updated_at": new_customer.updated_at
    }

@router.get("/{customer_id}")
async def get_customer(
    customer_id: str, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Customer).where(models_pg.Customer.id == customer_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Customer.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    customer = res.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    # Aggegrate stats dynamically to ensure accuracy
    b_stmt = select(models_pg.Booking).where(models_pg.Booking.customer_id == customer_id).order_by(desc(models_pg.Booking.created_at))
    b_res = await db_session.execute(b_stmt)
    bookings = b_res.scalars().all()
    
    total_revenue = sum(b.amount or 0 for b in bookings)
    total_bookings = len(bookings)
    last_visit = bookings[0].date if bookings else None
    
    # Simple services breakdown
    services_count = {}
    for b in bookings:
        # We need to query the association table for services
        bs_stmt = select(models_pg.booking_services.c.service_id).where(models_pg.booking_services.c.booking_id == b.id)
        bs_res = await db_session.execute(bs_stmt)
        s_ids = [row[0] for row in bs_res.all()]
        
        for sid in s_ids:
            if sid:
                services_count[sid] = services_count.get(sid, 0) + 1
    
    most_used_service = max(services_count, key=services_count.get) if services_count else None

    # For now just return computed stats joined with customer data
    return {
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "notes": customer.notes,
        "custom_fields": customer.custom_fields,
        "company_id": customer.company_id,
        "total_revenue": total_revenue,
        "total_bookings": total_bookings,
        "last_visit": last_visit,
        "most_used_service_id": most_used_service,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at
    }

@router.put("/{customer_id}")
async def update_customer(
    customer_id: str, 
    customer_update: CustomerUpdate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Customer).where(models_pg.Customer.id == customer_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Customer.company_id == current_user.company_id)

    res = await db_session.execute(stmt)
    customer = res.scalar_one_or_none()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = {k: v for k, v in customer_update.dict(exclude_unset=True).items()}
    
    if update_data:
        upd_stmt = (
            update(models_pg.Customer)
            .where(models_pg.Customer.id == customer_id)
            .values(**update_data)
        )
        await db_session.execute(upd_stmt)
        await db_session.commit()
    
    # Fetch fresh
    fresh_res = await db_session.execute(select(models_pg.Customer).where(models_pg.Customer.id == customer_id))
    fresh_c = fresh_res.scalar_one()
    
    return {
        "id": fresh_c.id,
        "name": fresh_c.name,
        "email": fresh_c.email,
        "phone": fresh_c.phone,
        "notes": fresh_c.notes,
        "custom_fields": fresh_c.custom_fields,
        "company_id": fresh_c.company_id,
        "total_revenue": fresh_c.total_revenue,
        "total_bookings": fresh_c.total_bookings,
        "last_visit": fresh_c.last_visit,
        "created_at": fresh_c.created_at,
        "updated_at": fresh_c.updated_at
    }

@router.get("/{customer_id}/bookings")
async def get_customer_bookings(
    customer_id: str, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    # Verify access
    stmt = select(models_pg.Customer.id).where(models_pg.Customer.id == customer_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Customer.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    if not res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")

    b_stmt = select(models_pg.Booking).where(models_pg.Booking.customer_id == customer_id).order_by(desc(models_pg.Booking.date))
    b_res = await db_session.execute(b_stmt)
    bookings = b_res.scalars().all()
    
    results = []
    for b in bookings:
        bs_stmt = select(models_pg.booking_services.c.service_id).where(models_pg.booking_services.c.booking_id == b.id)
        bs_res = await db_session.execute(bs_stmt)
        s_ids = [row[0] for row in bs_res.all()]
        
        results.append({
            "id": b.id,
            "company_id": b.company_id,
            "outlet_id": b.outlet_id,
            "customer_id": b.customer_id,
            "resource_id": b.resource_id,
            "service_ids": s_ids,
            "customer_name": b.customer_name,
            "customer_phone": b.customer_phone,
            "customer_email": b.customer_email,
            "time": b.time,
            "date": b.date,
            "duration": b.duration,
            "notes": b.notes,
            "custom_fields": b.custom_fields,
            "amount": b.amount,
            "status": b.status,
            "source": b.source,
            "created_at": b.created_at,
            "updated_at": b.updated_at
        })
        
    return results
