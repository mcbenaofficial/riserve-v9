from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models_pg

from .dependencies import (
    hash_password, create_access_token, SUBSCRIPTION_PLANS, log_audit,
    get_db
)

router = APIRouter(prefix="/public", tags=["Public Booking"])


# ============ Trial Signup ============

class TrialSignupRequest(BaseModel):
    company_name: str
    business_type: str
    admin_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str


@router.post("/signup")
async def trial_signup(
    signup_data: TrialSignupRequest, 
    request: Request,
    db_session: AsyncSession = Depends(get_db)
):
    """Public signup for 30-day trial"""
    from sqlalchemy import or_
    
    # Check if email already exists
    stmt = select(models_pg.User).where(models_pg.User.email == signup_data.email)
    existing_user = (await db_session.execute(stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    # Get trial plan config
    plan_config = SUBSCRIPTION_PLANS["trial"]
    
    # Calculate trial dates
    trial_start = datetime.now(timezone.utc)
    trial_end = trial_start + timedelta(days=plan_config["duration_days"])
    
    # Create company
    company_id = str(uuid.uuid4())
    company = models_pg.Company(
        id=company_id,
        name=signup_data.company_name,
        plan="trial",
        status="active"
    )
    db_session.add(company)
    
    # Note: `plan_limits`, `trial_start`, etc. don't exist on models_pg.Company explicitly, 
    # but could be added or mocked. Standard models_pg maps what's available.
    
    # Create admin user
    user_id = str(uuid.uuid4())
    admin_user = models_pg.User(
        id=user_id,
        email=signup_data.email,
        name=signup_data.admin_name,
        password_hash=hash_password(signup_data.password),
        role="Admin",
        company_id=company_id,
        phone=signup_data.phone,
        status="Active"
    )
    db_session.add(admin_user)
    
    await db_session.commit()
    
    # Log the signup
    await log_audit(
        action="signup",
        entity_type="company",
        entity_id=company_id,
        user_id=user_id,
        user_email=signup_data.email,
        company_id=company_id,
        details={
            "company_name": signup_data.company_name,
            "business_type": signup_data.business_type,
            "plan": "trial"
        },
        ip_address=request.client.host if request.client else None,
        db_session=db_session
    )
    
    # Generate access token for auto-login
    token = create_access_token({"sub": user_id})
    
    return {
        "message": "Account created successfully! Your 30-day trial has started.",
        "token": token,
        "user": {
            "id": user_id,
            "email": signup_data.email,
            "name": signup_data.admin_name,
            "role": "Admin",
            "company_id": company_id
        },
        "company": {
            "id": company_id,
            "name": signup_data.company_name,
            "plan": "trial",
            "trial_end": trial_end.isoformat()
        }
    }


# ============ Public Booking ============


class PublicBookingCreate(BaseModel):
    outlet_id: str
    resource_id: Optional[str] = None
    date: str
    time: str
    service_id: Optional[str] = None
    service_ids: Optional[List[str]] = None
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    vehicle: Optional[str] = None
    notes: Optional[str] = None
    total_duration: Optional[int] = None
    total_amount: Optional[int] = None


@router.get("/slot-config/{embed_token}")
async def get_public_slot_config(embed_token: str, db_session: AsyncSession = Depends(get_db)):
    # Look for exact or partial token in configuration -> 'embed_token'
    from sqlalchemy.dialects.postgresql import JSONB
    from sqlalchemy import text
    
    stmt = select(models_pg.SlotConfig).where(
        models_pg.SlotConfig.configuration["embed_token"].astext == embed_token
    )
    config_rec = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not config_rec:
        # Fallback to python iteration matching startswith (slow, but ok for public links usually cached or strict)
        all_stmt = select(models_pg.SlotConfig)
        all_res = await db_session.execute(all_stmt)
        for c in all_res.scalars().all():
            tok = c.configuration.get("embed_token", "") if c.configuration else ""
            if tok.startswith(embed_token):
                config_rec = c
                break
                
    if not config_rec:
        raise HTTPException(status_code=404, detail="Configuration not found")
        
    config_dict = config_rec.configuration
    
    out_stmt = select(models_pg.Outlet).where(models_pg.Outlet.id == config_dict.get("outlet_id"))
    outlet_rec = (await db_session.execute(out_stmt)).scalar_one_or_none()
    
    srv_stmt = select(models_pg.Service).where(models_pg.Service.company_id == config_dict.get("company_id"))
    services_res = await db_session.execute(srv_stmt)
    services = services_res.scalars().all()
    
    return {
        "config": config_dict,
        "outlet": {"id": outlet_rec.id, "name": outlet_rec.name} if outlet_rec else None,
        "services": [{"id": s.id, "name": s.name, "price": float(s.price), "duration_min": s.duration} for s in services]
    }


@router.get("/outlet/{outlet_id}")
async def get_public_outlet(outlet_id: str, db_session: AsyncSession = Depends(get_db)):
    stmt = select(models_pg.Outlet).where(models_pg.Outlet.id == outlet_id)
    outlet = (await db_session.execute(stmt)).scalar_one_or_none()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet not found")
        
    return {
        "id": outlet.id,
        "name": outlet.name,
        "portal_logo_url": getattr(outlet, "portal_logo_url", None),
        "portal_color_scheme": getattr(outlet, "portal_color_scheme", None),
        "portal_custom_colors": getattr(outlet, "portal_custom_colors", False),
    }


@router.post("/book")
async def create_public_booking(booking: PublicBookingCreate, db_session: AsyncSession = Depends(get_db)):
    stmt = select(models_pg.SlotConfig).where(models_pg.SlotConfig.outlet_id == booking.outlet_id)
    config_rec = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not config_rec or not config_rec.configuration or not config_rec.configuration.get("allow_online_booking", True):
        raise HTTPException(status_code=400, detail="Online booking not available for this outlet")
    
    # Create or Find a guest customer
    cust_stmt = select(models_pg.Customer).where(
        models_pg.Customer.email == (booking.customer_email or f"guest_{uuid.uuid4().hex[:8]}@guest.ridn.com"),
        models_pg.Customer.company_id == config_rec.company_id
    )
    customer = (await db_session.execute(cust_stmt)).scalar_one_or_none()
    if not customer:
        customer_id = str(uuid.uuid4())
        customer = models_pg.Customer(
            id=customer_id,
            company_id=config_rec.company_id,
            name=booking.customer_name,
            email=booking.customer_email or f"guest_{uuid.uuid4().hex[:8]}@guest.ridn.com",
            phone=booking.customer_phone
        )
        db_session.add(customer)
        # flush() to persist customer without committing, so everything stays in one transaction
        await db_session.flush()
    else:
        customer_id = customer.id
    
    # Calculate total amount & duration from services if not provided
    total_amount = booking.total_amount or 0
    total_duration = booking.total_duration or 30
    service_ids = booking.service_ids or ([booking.service_id] if booking.service_id else [])
    
    if (not total_amount or total_duration == 30) and service_ids:
        calculated_amount = 0
        calculated_duration = 0
        for sid in service_ids:
            srv_stmt = select(models_pg.Service).where(models_pg.Service.id == sid)
            service = (await db_session.execute(srv_stmt)).scalar_one_or_none()
            if service:
                calculated_amount += float(service.price or 0)
                calculated_duration += (service.duration_min or 30)
        
        total_amount = total_amount or calculated_amount
        total_duration = booking.total_duration or calculated_duration
        
    # Convert date string to python date if valid
    from datetime import date
    try:
        book_date = date.fromisoformat(booking.date.split("T")[0])
    except:
        book_date = date.today()
        
    # --- Booking Rules Enforcement ---
    rules = config_rec.configuration or {}
    allow_overlap = rules.get("allow_overlap", False)
    auto_schedule = rules.get("auto_schedule_next", True)
    buffer_time = rules.get("buffer_time_minutes", 0)
    
    if not allow_overlap and booking.time:
        overlap_stmt = select(models_pg.Booking).where(
            models_pg.Booking.outlet_id == booking.outlet_id,
            models_pg.Booking.date == book_date,
            models_pg.Booking.status.not_in(["Cancelled", "Declined"])
        )
        if booking.resource_id:
            overlap_stmt = overlap_stmt.where(models_pg.Booking.resource_id == booking.resource_id)
            
        existing_bookings = (await db_session.execute(overlap_stmt)).scalars().all()
        
        def mins_since_midnight(t_str: str) -> int:
            try:
                h, m = map(int, t_str.split(':'))
                return h * 60 + m
            except:
                return 0
                
        def format_mins(m: int) -> str:
            return f"{m//60:02d}:{m%60:02d}"
            
        req_start = mins_since_midnight(booking.time)
        req_end = req_start + total_duration + buffer_time
        
        def is_overlap(s, e):
            for eb in existing_bookings:
                if not eb.time: continue
                eb_s = mins_since_midnight(eb.time)
                eb_e = eb_s + (eb.duration or rules.get("slot_duration_min", 30)) + buffer_time
                if s < eb_e and e > eb_s:
                    return True
            return False
            
        if is_overlap(req_start, req_end):
            if not auto_schedule:
                raise HTTPException(status_code=400, detail="The requested time slot is already booked.")
                
            op_end_str = rules.get("operating_hours_end", "20:00")
            op_end = mins_since_midnight(op_end_str)
            step = rules.get("slot_duration_min", 30)
            if step <= 0: step = 30
            
            while is_overlap(req_start, req_end):
                req_start += step
                req_end = req_start + total_duration + buffer_time
                
            if req_start + total_duration > op_end:
                raise HTTPException(status_code=400, detail="No available slots found for today within operating hours.")
                
            booking.time = format_mins(req_start)
    # --- End Booking Rules Enforcement ---
    
    # Create booking
    booking_id = str(uuid.uuid4())
    
    # Convert date string to python date if valid
    from datetime import date
    try:
        book_date = date.fromisoformat(booking.date.split("T")[0])
    except:
        book_date = date.today()
        
    booking_doc = models_pg.Booking(
        id=booking_id,
        company_id=config_rec.company_id,
        outlet_id=booking.outlet_id,
        customer_id=customer_id,
        customer_name=booking.customer_name,
        customer_phone=booking.customer_phone,
        customer_email=booking.customer_email,
        resource_id=booking.resource_id,
        service_id=service_ids[0] if service_ids else None,
        date=book_date,
        time=booking.time,
        duration=total_duration,
        notes=booking.notes,
        amount=total_amount,
        status="Pending",
        source="online"
    )
    db_session.add(booking_doc)
    # flush() so the booking row exists in DB before booking_services FK insert
    await db_session.flush()
    
    # Link services in mapping table (booking must be flushed first to satisfy FK constraint)
    for sid in service_ids:
        from sqlalchemy import insert
        ins = models_pg.booking_services.insert().values(booking_id=booking_id, service_id=sid)
        await db_session.execute(ins)
    
    # Create transaction if amount > 0
    if total_amount > 0:
        commission = total_amount * 0.15
        partner_share = total_amount - commission
        transaction_doc = models_pg.Transaction(
            id=str(uuid.uuid4()),
            company_id=config_rec.company_id,
            booking_id=booking_id,
            outlet_id=booking.outlet_id,
            customer_id=customer_id,
            gross=total_amount,
            total_amount=total_amount,
            commission=commission,
            partner_share=partner_share,
            status="Pending"
        )
        db_session.add(transaction_doc)
    
    await db_session.commit()
    
    return {"message": "Booking created successfully", "booking_id": booking_id}
