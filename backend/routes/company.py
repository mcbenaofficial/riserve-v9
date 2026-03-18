from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import models_pg

from .dependencies import get_db, get_current_user, User

router = APIRouter(prefix="/company", tags=["Company Settings"])


class CompanySettingsUpdate(BaseModel):
    company_name: str
    business_type: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    tax_id: Optional[str] = None
    currency: str = "INR"
    timezone: str = "Asia/Kolkata"
    operating_hours_start: str = "09:00"
    operating_hours_end: str = "18:00"
    working_days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    logo_url: Optional[str] = None


class BookingFieldConfig(BaseModel):
    field_name: str
    label: str
    field_type: str = "text"  # text, email, phone, select, textarea, number, date
    required: bool = False
    enabled: bool = True
    options: Optional[List[str]] = None  # For select fields
    placeholder: Optional[str] = None
    order: int = 0


class BookingFieldsUpdate(BaseModel):
    fields: List[BookingFieldConfig]


@router.get("")
async def get_company_settings(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    # Get the core company document
    company_id = current_user.company_id
    if not company_id:
        return {
            "id": None, "company_name": "", "business_type": "", "is_configured": False,
            "is_booking_enabled": True, "is_retail_enabled": False, "is_workplace_enabled": False
        }

    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    res = await db_session.execute(stmt)
    core_company = res.scalar_one_or_none()

    if not core_company:
        return {
            "id": None, "company_name": "", "business_type": "", "is_configured": False,
            "is_booking_enabled": True, "is_retail_enabled": False, "is_workplace_enabled": False
        }

    return {
        "id": core_company.id,
        "company_name": core_company.name,
        "business_type": core_company.business_type or "salon",
        "address": core_company.address or "", "city": "", "state": "", "country": "", "postal_code": "",
        "phone": core_company.phone or "", "email": core_company.email or "", "website": "", "tax_id": "", "currency": "INR",
        "timezone": "Asia/Kolkata", "operating_hours_start": "09:00", "operating_hours_end": "18:00",
        "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        "logo_url": "",
        "is_configured": True,
        "is_booking_enabled": core_company.is_booking_enabled,
        "is_retail_enabled": core_company.is_retail_enabled,
        "is_workplace_enabled": core_company.is_workplace_enabled
    }


# Update company settings
@router.put("")
async def update_company_settings(
    settings: CompanySettingsUpdate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can update company settings")
    
    company_id = current_user.company_id
    if company_id:
        stmt = update(models_pg.Company).where(models_pg.Company.id == company_id).values(
            name=settings.company_name
        )
        await db_session.execute(stmt)
        await db_session.commit()
    
    settings_doc = settings.dict()
    settings_doc["id"] = company_id
    settings_doc["is_configured"] = True
    return settings_doc


@router.get("/booking-fields")
async def get_booking_fields(current_user: User = Depends(get_current_user)):
    return {
        "fields": [
            {"field_name": "customer_name", "label": "Full Name", "input_type": "text", "required": True, "enabled": True, "order": 1},
            {"field_name": "customer_phone", "label": "Phone Number", "input_type": "phone", "required": True, "enabled": True, "order": 2},
            {"field_name": "customer_email", "label": "Email Address", "input_type": "email", "required": False, "enabled": True, "order": 3},
            {"field_name": "notes", "label": "Additional Notes", "input_type": "textarea", "required": False, "enabled": True, "order": 4}
        ]
    }


@router.put("/booking-fields")
async def update_booking_fields(config: BookingFieldsUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can update booking fields")
    
    return {"fields": [f.dict() for f in config.fields]}


# Get business types (predefined list)
@router.get("/business-types")
async def get_business_types():
    return {
        "types": [
            {"id": "salon", "name": "Salon & Spa", "icon": "scissors"},
            {"id": "healthcare", "name": "Healthcare & Medical", "icon": "stethoscope"},
            {"id": "fitness", "name": "Fitness & Gym", "icon": "dumbbell"},
            {"id": "automotive", "name": "Automotive Services", "icon": "car"},
            {"id": "consulting", "name": "Consulting & Professional", "icon": "briefcase"},
            {"id": "education", "name": "Education & Tutoring", "icon": "graduation-cap"},
            {"id": "home_services", "name": "Home Services", "icon": "home"},
            {"id": "photography", "name": "Photography & Studio", "icon": "camera"},
            {"id": "pet_services", "name": "Pet Services", "icon": "paw-print"},
            {"id": "events", "name": "Events & Entertainment", "icon": "calendar"},
            {"id": "repair", "name": "Repair & Maintenance", "icon": "wrench"},
            {"id": "beauty", "name": "Beauty & Wellness", "icon": "sparkles"},
            {"id": "legal", "name": "Legal Services", "icon": "scale"},
            {"id": "financial", "name": "Financial Services", "icon": "landmark"},
            {"id": "other", "name": "Other", "icon": "grid"}
        ]
    }



@router.get("/features")
async def get_company_features(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get enabled features for the current company"""
    if not current_user.company_id:
        return {"features": []}
    
    stmt = select(models_pg.Company).where(models_pg.Company.id == current_user.company_id)
    res = await db_session.execute(stmt)
    company = res.scalar_one_or_none()
    
    if not company:
        return {"features": []}
    
    return {
        "features": company.enabled_features or [], 
        "licensed_modules": company.licensed_modules or [],
        "available_features": [
            {"id": "inventory", "name": "Inventory Management", "description": "Track products, stock levels, and add-ons to bookings"},
            {"id": "ai_assistant", "name": "AI Assistant", "description": "AI-powered insights and image generation"},
            {"id": "advanced_reports", "name": "Advanced Reports", "description": "Detailed analytics and custom reporting"},
            {"id": "multi_location", "name": "Multi-Location", "description": "Manage multiple outlets and locations"},
            {"id": "api_access", "name": "API Access", "description": "Access to REST API for integrations"}
        ]
    }
