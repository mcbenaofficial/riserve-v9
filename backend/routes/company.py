from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from .dependencies import db, get_current_user, User

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


# Get company settings
@router.get("")
async def get_company_settings(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    settings = await db.company_settings.find_one(query, {"_id": 0})
    if not settings:
        # Return default settings
        return {
            "id": None,
            "company_name": "",
            "business_type": "",
            "address": "",
            "city": "",
            "state": "",
            "country": "",
            "postal_code": "",
            "phone": "",
            "email": "",
            "website": "",
            "tax_id": "",
            "currency": "INR",
            "timezone": "Asia/Kolkata",
            "operating_hours_start": "09:00",
            "operating_hours_end": "18:00",
            "working_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            "logo_url": "",
            "is_configured": False
        }
    settings["is_configured"] = True
    return settings


# Update company settings
@router.put("")
async def update_company_settings(settings: CompanySettingsUpdate, current_user: User = Depends(get_current_user)):
    # Check if user is admin
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can update company settings")
    
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    existing = await db.company_settings.find_one(query)
    
    settings_doc = {
        "company_id": current_user.company_id,  # Associate with company
        "company_name": settings.company_name,
        "business_type": settings.business_type,
        "address": settings.address,
        "city": settings.city,
        "state": settings.state,
        "country": settings.country,
        "postal_code": settings.postal_code,
        "phone": settings.phone,
        "email": settings.email,
        "website": settings.website,
        "tax_id": settings.tax_id,
        "currency": settings.currency,
        "timezone": settings.timezone,
        "operating_hours_start": settings.operating_hours_start,
        "operating_hours_end": settings.operating_hours_end,
        "working_days": settings.working_days,
        "logo_url": settings.logo_url,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if existing:
        await db.company_settings.update_one(query, {"$set": settings_doc})
        settings_doc["id"] = existing.get("id")
    else:
        settings_doc["id"] = str(uuid.uuid4())
        settings_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.company_settings.insert_one(settings_doc)
    
    settings_doc.pop("_id", None)
    settings_doc["is_configured"] = True
    return settings_doc


# Get default booking fields configuration
@router.get("/booking-fields")
async def get_booking_fields(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    config = await db.booking_fields_config.find_one(query, {"_id": 0})
    if not config:
        # Return default fields
        return {
            "fields": [
                {"field_name": "customer_name", "label": "Full Name", "input_type": "text", "required": True, "enabled": True, "order": 1},
                {"field_name": "customer_phone", "label": "Phone Number", "input_type": "phone", "required": True, "enabled": True, "order": 2},
                {"field_name": "customer_email", "label": "Email Address", "input_type": "email", "required": False, "enabled": True, "order": 3},
                {"field_name": "notes", "label": "Additional Notes", "input_type": "textarea", "required": False, "enabled": True, "order": 4}
            ]
        }
    return config


# Update booking fields configuration
@router.put("/booking-fields")
async def update_booking_fields(config: BookingFieldsUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can update booking fields")
    
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    fields_doc = {
        "company_id": current_user.company_id,  # Associate with company
        "fields": [f.dict() for f in config.fields],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    existing = await db.booking_fields_config.find_one(query)
    if existing:
        await db.booking_fields_config.update_one(query, {"$set": fields_doc})
    else:
        fields_doc["id"] = str(uuid.uuid4())
        fields_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.booking_fields_config.insert_one(fields_doc)
    
    fields_doc.pop("_id", None)
    return fields_doc


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



# Get company features (enabled modules)
@router.get("/features")
async def get_company_features(current_user: User = Depends(get_current_user)):
    """Get enabled features for the current company"""
    if not current_user.company_id:
        return {"features": []}
    
    # Import companies_collection
    from .dependencies import companies_collection
    
    company = await companies_collection.find_one(
        {"id": current_user.company_id},
        {"_id": 0, "enabled_features": 1}
    )
    
    if not company:
        return {"features": []}
    
    return {
        "features": company.get("enabled_features", []),
        "available_features": [
            {"id": "inventory", "name": "Inventory Management", "description": "Track products, stock levels, and add-ons to bookings"},
            {"id": "ai_assistant", "name": "AI Assistant", "description": "AI-powered insights and image generation"},
            {"id": "advanced_reports", "name": "Advanced Reports", "description": "Detailed analytics and custom reporting"},
            {"id": "multi_location", "name": "Multi-Location", "description": "Manage multiple outlets and locations"},
            {"id": "api_access", "name": "API Access", "description": "Access to REST API for integrations"}
        ]
    }
