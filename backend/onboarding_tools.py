"""
Onboarding Tools — Specialized LangChain tools for the conversational onboarding swarm.

These tools create MongoDB documents for companies, outlets, services, slot configs,
and track onboarding progress. Each tool enforces company_id isolation.
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


# ─── Industry Defaults ────────────────────────────────────────────

INDUSTRY_CONFIG = {
    "salon": {
        "display_name": "Salon & Spa",
        "outlet_term": "salon",
        "resource_term": "station",
        "resource_plural": "stations",
        "default_hours": ("09:00", "21:00"),
        "default_slot_duration": 30,
        "suggested_services": [
            {"name": "Haircut", "price": 500, "duration_min": 30, "type": "styling"},
            {"name": "Hair Color", "price": 1500, "duration_min": 90, "type": "color"},
            {"name": "Facial", "price": 800, "duration_min": 45, "type": "skincare"},
            {"name": "Manicure", "price": 400, "duration_min": 30, "type": "nails"},
            {"name": "Pedicure", "price": 500, "duration_min": 40, "type": "nails"},
            {"name": "Head Massage", "price": 300, "duration_min": 20, "type": "massage"},
        ],
        "setup_questions": [
            "How many styling stations or chairs do you have?",
            "Do you offer separate treatment rooms for facials or massages?",
            "What are your peak hours?",
        ],
    },
    "healthcare": {
        "display_name": "Healthcare & Medical",
        "outlet_term": "clinic",
        "resource_term": "consultation room",
        "resource_plural": "consultation rooms",
        "default_hours": ("08:00", "20:00"),
        "default_slot_duration": 15,
        "suggested_services": [
            {"name": "General Consultation", "price": 500, "duration_min": 15, "type": "consultation"},
            {"name": "Follow-up Visit", "price": 300, "duration_min": 10, "type": "consultation"},
            {"name": "Health Checkup", "price": 2000, "duration_min": 60, "type": "checkup"},
            {"name": "Lab Test", "price": 800, "duration_min": 15, "type": "lab"},
            {"name": "Vaccination", "price": 500, "duration_min": 10, "type": "procedure"},
        ],
        "setup_questions": [
            "How many consultation rooms do you have?",
            "How many doctors are on staff?",
            "Do you have separate procedure or lab rooms?",
        ],
    },
    "fitness": {
        "display_name": "Fitness & Gym",
        "outlet_term": "gym",
        "resource_term": "zone",
        "resource_plural": "zones",
        "default_hours": ("05:00", "22:00"),
        "default_slot_duration": 60,
        "suggested_services": [
            {"name": "Personal Training", "price": 1000, "duration_min": 60, "type": "training"},
            {"name": "Group Class", "price": 300, "duration_min": 45, "type": "class"},
            {"name": "Yoga Session", "price": 400, "duration_min": 60, "type": "class"},
            {"name": "CrossFit", "price": 500, "duration_min": 45, "type": "class"},
            {"name": "Nutrition Consultation", "price": 800, "duration_min": 30, "type": "consultation"},
        ],
        "setup_questions": [
            "Do you offer personal training, group classes, or both?",
            "How many workout zones or studios do you have?",
            "Do you have equipment that needs to be booked (e.g., squash courts)?",
        ],
    },
    "automotive": {
        "display_name": "Automotive Services",
        "outlet_term": "center",
        "resource_term": "bay",
        "resource_plural": "bays",
        "default_hours": ("08:00", "20:00"),
        "default_slot_duration": 30,
        "suggested_services": [
            {"name": "Basic Wash", "price": 299, "duration_min": 20, "type": "exterior"},
            {"name": "Premium Wash", "price": 499, "duration_min": 30, "type": "full"},
            {"name": "Full Detail", "price": 999, "duration_min": 60, "type": "full"},
            {"name": "Interior Clean", "price": 399, "duration_min": 30, "type": "interior"},
            {"name": "Ceramic Coating", "price": 5000, "duration_min": 180, "type": "premium"},
        ],
        "setup_questions": [
            "How many service bays do you have?",
            "Do bays specialize in different services?",
            "Do you offer mobile/doorstep services?",
        ],
    },
    "consulting": {
        "display_name": "Consulting & Professional",
        "outlet_term": "office",
        "resource_term": "meeting room",
        "resource_plural": "meeting rooms",
        "default_hours": ("09:00", "18:00"),
        "default_slot_duration": 60,
        "suggested_services": [
            {"name": "Initial Consultation", "price": 2000, "duration_min": 60, "type": "consultation"},
            {"name": "Strategy Session", "price": 5000, "duration_min": 90, "type": "session"},
            {"name": "Review Meeting", "price": 1500, "duration_min": 30, "type": "meeting"},
        ],
        "setup_questions": [
            "How many meeting rooms or consultation spaces do you have?",
            "Do you meet clients in-person, online, or both?",
        ],
    },
    "education": {
        "display_name": "Education & Tutoring",
        "outlet_term": "center",
        "resource_term": "classroom",
        "resource_plural": "classrooms",
        "default_hours": ("08:00", "20:00"),
        "default_slot_duration": 60,
        "suggested_services": [
            {"name": "1-on-1 Tutoring", "price": 800, "duration_min": 60, "type": "tutoring"},
            {"name": "Group Class", "price": 400, "duration_min": 60, "type": "class"},
            {"name": "Assessment Test", "price": 500, "duration_min": 90, "type": "assessment"},
        ],
        "setup_questions": [
            "How many classrooms or teaching spaces?",
            "Do you offer online or in-person classes?",
        ],
    },
    "pet_services": {
        "display_name": "Pet Services",
        "outlet_term": "center",
        "resource_term": "grooming station",
        "resource_plural": "grooming stations",
        "default_hours": ("09:00", "19:00"),
        "default_slot_duration": 45,
        "suggested_services": [
            {"name": "Dog Grooming", "price": 800, "duration_min": 60, "type": "grooming"},
            {"name": "Cat Grooming", "price": 600, "duration_min": 45, "type": "grooming"},
            {"name": "Pet Boarding (Day)", "price": 500, "duration_min": 480, "type": "boarding"},
            {"name": "Vet Consultation", "price": 400, "duration_min": 20, "type": "consultation"},
        ],
        "setup_questions": [
            "How many grooming stations do you have?",
            "Do you offer boarding or daycare?",
        ],
    },
    "other": {
        "display_name": "Service Business",
        "outlet_term": "location",
        "resource_term": "resource",
        "resource_plural": "resources",
        "default_hours": ("09:00", "18:00"),
        "default_slot_duration": 30,
        "suggested_services": [
            {"name": "Standard Service", "price": 500, "duration_min": 30, "type": "general"},
            {"name": "Premium Service", "price": 1000, "duration_min": 60, "type": "general"},
        ],
        "setup_questions": [
            "How many service points or resources do you have?",
            "What are your typical operating hours?",
        ],
    },
}

# Map common business type strings to our keys
BUSINESS_TYPE_MAP = {
    "salon & spa": "salon",
    "salon / spa": "salon",
    "salon": "salon",
    "spa": "salon",
    "healthcare & medical": "healthcare",
    "clinic / healthcare": "healthcare",
    "clinic": "healthcare",
    "healthcare": "healthcare",
    "medical": "healthcare",
    "fitness & gym": "fitness",
    "gym / fitness": "fitness",
    "gym": "fitness",
    "fitness": "fitness",
    "automotive services": "automotive",
    "automotive": "automotive",
    "car wash": "automotive",
    "car wash / auto care": "automotive",
    "auto care": "automotive",
    "consulting & professional": "consulting",
    "consulting": "consulting",
    "professional": "consulting",
    "education & tutoring": "education",
    "education": "education",
    "tutoring": "education",
    "pet services": "pet_services",
    "pet": "pet_services",
    "restaurant / cafe": "other",
    "restaurant": "other",
    "cafe": "other",
    "home services": "other",
    "photography": "other",
    "events": "other",
    "repair": "other",
    "repair shop": "other",
    "repair & maintenance": "other",
    "beauty": "salon",
    "beauty & wellness": "salon",
    "legal": "consulting",
    "legal services": "consulting",
    "financial": "consulting",
    "financial services": "consulting",
    "other": "other",
}


def _normalize_business_type(raw: str) -> str:
    """Normalize a business type string to our internal key."""
    return BUSINESS_TYPE_MAP.get(raw.strip().lower(), "other")


# ─── Tool Implementations ─────────────────────────────────────────

@tool
async def get_industry_suggestions(
    business_type: str = "other",
    user_context: Dict[str, Any] = None,
) -> str:
    """
    Get industry-specific suggestions including resource terminology,
    suggested services, setup questions, and default operating hours
    for a given business type. Use this when starting onboarding to
    tailor questions to the user's industry.
    """
    key = _normalize_business_type(business_type)
    config = INDUSTRY_CONFIG.get(key, INDUSTRY_CONFIG["other"])
    
    services_text = "\n".join(
        f"  - {s['name']}: ₹{s['price']} ({s['duration_min']} min)"
        for s in config["suggested_services"]
    )
    questions_text = "\n".join(f"  - {q}" for q in config["setup_questions"])
    
    return (
        f"Industry: {config['display_name']}\n"
        f"Outlet term: {config['outlet_term']}\n"
        f"Resource term: {config['resource_term']} (plural: {config['resource_plural']})\n"
        f"Default hours: {config['default_hours'][0]} – {config['default_hours'][1]}\n"
        f"Default slot duration: {config['default_slot_duration']} min\n\n"
        f"Suggested services:\n{services_text}\n\n"
        f"Setup questions to ask:\n{questions_text}"
    )


@tool
async def update_company_profile(
    timezone_str: str = "Asia/Kolkata",
    currency: str = "INR",
    operating_hours_start: str = "09:00",
    operating_hours_end: str = "18:00",
    working_days: str = "Monday,Tuesday,Wednesday,Thursday,Friday,Saturday",
    address: str = "",
    city: str = "",
    state: str = "",
    country: str = "",
    phone: str = "",
    user_context: Dict[str, Any] = None,
) -> str:
    """
    Update the company profile/settings for the current user's company.
    Call this after collecting company details like timezone, currency,
    operating hours, working days, and address from the user.
    """
    from routes.dependencies import db, companies_collection
    
    company_id = user_context.get("company_id") if user_context else None
    if not company_id:
        return "Error: No company_id found for this user."
    
    # Get company name for settings
    company = await companies_collection.find_one({"id": company_id}, {"_id": 0})
    if not company:
        return "Error: Company not found."
    
    working_days_list = [d.strip() for d in working_days.split(",")]
    
    settings_doc = {
        "company_id": company_id,
        "company_name": company.get("name", ""),
        "business_type": company.get("business_type", ""),
        "timezone": timezone_str,
        "currency": currency,
        "operating_hours_start": operating_hours_start,
        "operating_hours_end": operating_hours_end,
        "working_days": working_days_list,
        "address": address,
        "city": city,
        "state": state,
        "country": country,
        "phone": phone or company.get("phone", ""),
        "email": company.get("email", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    existing = await db.company_settings.find_one({"company_id": company_id})
    if existing:
        await db.company_settings.update_one(
            {"company_id": company_id}, {"$set": settings_doc}
        )
    else:
        settings_doc["id"] = str(uuid.uuid4())
        settings_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.company_settings.insert_one(settings_doc)
    
    # Mark step complete
    await _mark_step_complete(company_id, "company_profile")
    
    return (
        f"Company profile updated successfully!\n"
        f"  Timezone: {timezone_str}\n"
        f"  Currency: {currency}\n"
        f"  Hours: {operating_hours_start} – {operating_hours_end}\n"
        f"  Working days: {', '.join(working_days_list)}"
    )


@tool
async def create_outlet(
    name: str,
    city: str,
    address: str = "",
    resource_names: str = "",
    operating_hours_start: str = "09:00",
    operating_hours_end: str = "18:00",
    slot_duration_min: int = 30,
    user_context: Dict[str, Any] = None,
) -> str:
    """
    Create a new outlet/location for the company. Also creates a slot
    configuration with resources if resource_names are provided.
    resource_names should be comma-separated (e.g. "Bay 1,Bay 2,Bay 3").
    """
    from routes.dependencies import (
        outlets_collection, slot_configs_collection
    )
    
    company_id = user_context.get("company_id") if user_context else None
    if not company_id:
        return "Error: No company_id found."
    
    outlet_id = str(uuid.uuid4())
    outlet_doc = {
        "id": outlet_id,
        "name": name,
        "city": city,
        "address": address,
        "capacity": 0,
        "status": "Active",
        "services_offered": [],
        "company_id": company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await outlets_collection.insert_one(outlet_doc)
    
    # Create resources from comma-separated names
    resources = []
    if resource_names.strip():
        for rname in resource_names.split(","):
            rname = rname.strip()
            if rname:
                resources.append({
                    "id": str(uuid.uuid4()),
                    "name": rname,
                    "active": True,
                })
    
    # Create slot config
    slot_config = {
        "id": str(uuid.uuid4()),
        "outlet_id": outlet_id,
        "company_id": company_id,
        "slot_duration_min": slot_duration_min,
        "operating_hours_start": operating_hours_start,
        "operating_hours_end": operating_hours_end,
        "resources": resources,
        "allow_online_booking": True,
        "booking_advance_days": 7,
        "embed_token": str(uuid.uuid4()),
        "customer_fields": [
            {"field_name": "name", "label": "Full Name", "required": True, "enabled": True},
            {"field_name": "phone", "label": "Phone Number", "required": True, "enabled": True},
            {"field_name": "email", "label": "Email Address", "required": False, "enabled": True},
            {"field_name": "notes", "label": "Additional Notes", "required": False, "enabled": True},
        ],
        "allow_multiple_services": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await slot_configs_collection.insert_one(slot_config)
    
    # Update outlet capacity
    await outlets_collection.update_one(
        {"id": outlet_id}, {"$set": {"capacity": len(resources) or 1}}
    )
    
    await _mark_step_complete(company_id, "first_outlet")
    
    resource_summary = (
        f" with {len(resources)} resources: {', '.join(r['name'] for r in resources)}"
        if resources else ""
    )
    return (
        f"Outlet created successfully!\n"
        f"  Name: {name}\n"
        f"  Location: {city}\n"
        f"  Hours: {operating_hours_start} – {operating_hours_end}\n"
        f"  Slot duration: {slot_duration_min} min{resource_summary}\n"
        f"  Online booking: Enabled (embed token generated)"
    )


@tool
async def create_services_batch(
    services_json: str,
    user_context: Dict[str, Any] = None,
) -> str:
    """
    Create multiple services at once. services_json should be a JSON array string
    where each item has: name, price, duration_min, type.
    Example: [{"name":"Haircut","price":500,"duration_min":30,"type":"styling"}]
    """
    import json
    from routes.dependencies import services_collection
    
    company_id = user_context.get("company_id") if user_context else None
    if not company_id:
        return "Error: No company_id found."
    
    try:
        services_list = json.loads(services_json)
    except json.JSONDecodeError:
        return "Error: Invalid JSON. Please provide a valid JSON array of services."
    
    if not isinstance(services_list, list) or len(services_list) == 0:
        return "Error: Please provide at least one service."
    
    created = []
    for svc in services_list:
        service_doc = {
            "id": str(uuid.uuid4()),
            "name": svc.get("name", "Service"),
            "price": svc.get("price", 0),
            "duration_min": svc.get("duration_min", 30),
            "type": svc.get("type", "general"),
            "active": True,
            "company_id": company_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await services_collection.insert_one(service_doc)
        created.append(service_doc["name"])
    
    await _mark_step_complete(company_id, "services")
    
    return (
        f"Created {len(created)} services successfully!\n"
        + "\n".join(f"  ✓ {name}" for name in created)
    )


@tool
async def get_onboarding_progress(
    user_context: Dict[str, Any] = None,
) -> str:
    """
    Get the current onboarding progress for the user's company.
    Returns the completion percentage and status of each step.
    """
    company_id = user_context.get("company_id") if user_context else None
    if not company_id:
        return "Error: No company_id found."
    
    progress = await _get_progress(company_id)
    
    all_steps = ["company_profile", "first_outlet", "services"]
    completed = progress.get("completed_steps", [])
    percentage = progress.get("percentage", 0)
    
    lines = [f"Onboarding Progress: {percentage}%"]
    for step in all_steps:
        status = "✓" if step in completed else "○"
        lines.append(f"  {status} {step.replace('_', ' ').title()}")
    
    return "\n".join(lines)


# ─── Internal Helpers ─────────────────────────────────────────────

ALL_STEPS = ["company_profile", "first_outlet", "services"]


async def _get_progress(company_id: str) -> dict:
    """Get or create the onboarding progress document."""
    from routes.dependencies import db
    
    progress = await db.onboarding_progress.find_one(
        {"company_id": company_id}, {"_id": 0}
    )
    if not progress:
        progress = {
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "percentage": 0,
            "completed_steps": [],
            "pending_steps": list(ALL_STEPS),
            "conversation_id": None,
            "skipped": False,
            "completed_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.onboarding_progress.insert_one(progress)
    return progress


async def _mark_step_complete(company_id: str, step: str):
    """Mark an onboarding step as complete and update percentage."""
    from routes.dependencies import db
    
    progress = await _get_progress(company_id)
    completed = progress.get("completed_steps", [])
    
    if step not in completed:
        completed.append(step)
    
    pending = [s for s in ALL_STEPS if s not in completed]
    percentage = int((len(completed) / len(ALL_STEPS)) * 100)
    completed_at = datetime.now(timezone.utc).isoformat() if percentage >= 100 else None
    
    await db.onboarding_progress.update_one(
        {"company_id": company_id},
        {"$set": {
            "completed_steps": completed,
            "pending_steps": pending,
            "percentage": percentage,
            "completed_at": completed_at,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )


# All onboarding tools for the swarm
all_onboarding_tools = [
    get_industry_suggestions,
    update_company_profile,
    create_outlet,
    create_services_batch,
    get_onboarding_progress,
]
