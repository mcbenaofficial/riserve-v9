from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from .dependencies import (
    slot_configs_collection, outlets_collection, services_collection,
    bookings_collection, users_collection, transactions_collection, 
    companies_collection, audit_logs_collection,
    hash_password, create_access_token, SUBSCRIPTION_PLANS, log_audit
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
async def trial_signup(signup_data: TrialSignupRequest, request: Request):
    """Public signup for 30-day trial"""
    
    # Check if email already exists (for company or user)
    existing_company = await companies_collection.find_one({"email": signup_data.email})
    if existing_company:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    existing_user = await users_collection.find_one({"email": signup_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    # Get trial plan config
    plan_config = SUBSCRIPTION_PLANS["trial"]
    
    # Calculate trial dates
    trial_start = datetime.now(timezone.utc)
    trial_end = trial_start + timedelta(days=plan_config["duration_days"])
    
    # Create company
    company_id = str(uuid.uuid4())
    company = {
        "id": company_id,
        "name": signup_data.company_name,
        "business_type": signup_data.business_type,
        "email": signup_data.email,
        "phone": signup_data.phone,
        "address": None,
        "plan": "trial",
        "plan_limits": plan_config["limits"],
        "trial_start": trial_start.isoformat(),
        "trial_end": trial_end.isoformat(),
        "status": "active",
        "created_at": trial_start.isoformat(),
        "created_by": "self-signup"
    }
    
    await companies_collection.insert_one(company)
    
    # Create admin user
    user_id = str(uuid.uuid4())
    admin_user = {
        "id": user_id,
        "email": signup_data.email,
        "name": signup_data.admin_name,
        "password_hash": hash_password(signup_data.password),
        "role": "Admin",
        "company_id": company_id,
        "phone": signup_data.phone,
        "status": "Active",
        "outlets": [],
        "created_at": trial_start.isoformat()
    }
    
    await users_collection.insert_one(admin_user)
    
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
        ip_address=request.client.host if request.client else None
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
async def get_public_slot_config(embed_token: str):
    # Support both full tokens and short tokens (first 8 chars)
    config = await slot_configs_collection.find_one({"embed_token": embed_token}, {"_id": 0})
    
    # If not found, try matching by short token (first 8 chars)
    if not config:
        all_configs = await slot_configs_collection.find({}, {"_id": 0}).to_list(100)
        for c in all_configs:
            if c.get("embed_token", "").startswith(embed_token) or c.get("embed_token", "")[:8] == embed_token:
                config = c
                break
    
    if not config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    
    outlet = await outlets_collection.find_one({"id": config["outlet_id"]}, {"_id": 0})
    services = await services_collection.find({"active": {"$ne": False}}, {"_id": 0}).to_list(100)
    
    return {
        "config": config,
        "outlet": outlet,
        "services": services
    }


@router.post("/book")
async def create_public_booking(booking: PublicBookingCreate):
    config = await slot_configs_collection.find_one({"outlet_id": booking.outlet_id})
    if not config or not config.get("allow_online_booking", True):
        raise HTTPException(status_code=400, detail="Online booking not available for this outlet")
    
    # Create a guest user
    guest_user = {
        "id": str(uuid.uuid4()),
        "email": booking.customer_email or f"guest_{uuid.uuid4().hex[:8]}@guest.ridn.com",
        "name": booking.customer_name,
        "password_hash": hash_password(uuid.uuid4().hex),
        "phone": booking.customer_phone,
        "status": "Guest",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await users_collection.insert_one(guest_user)
    
    # Calculate total amount from services if not provided
    total_amount = booking.total_amount or 0
    service_ids = booking.service_ids or ([booking.service_id] if booking.service_id else [])
    
    if not total_amount and service_ids:
        for sid in service_ids:
            service = await services_collection.find_one({"id": sid}, {"_id": 0})
            if service:
                total_amount += service.get("price", 0)
    
    # Create booking
    booking_id = str(uuid.uuid4())
    booking_doc = {
        "id": booking_id,
        "customer": booking.customer_name,
        "customer_phone": booking.customer_phone,
        "customer_email": booking.customer_email,
        "vehicle": booking.vehicle,
        "date": booking.date,
        "time": booking.time,
        "service_id": service_ids[0] if service_ids else None,
        "service_ids": service_ids,
        "outlet_id": booking.outlet_id,
        "resource_id": booking.resource_id,
        "notes": booking.notes,
        "amount": total_amount,
        "status": "Pending",
        "source": "online",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await bookings_collection.insert_one(booking_doc)
    
    # Create transaction if amount > 0
    if total_amount > 0:
        commission = int(total_amount * 0.15)
        partner_share = total_amount - commission
        transaction_doc = {
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "outlet_id": booking.outlet_id,
            "gross": total_amount,
            "commission": commission,
            "partner_share": partner_share,
            "status": "Pending",
            "date": datetime.now(timezone.utc).isoformat()
        }
        await transactions_collection.insert_one(transaction_doc)
    
    return {"message": "Booking created successfully", "booking_id": booking_id}
