from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from .dependencies import db, get_current_user, User

router = APIRouter(prefix="/feedback", tags=["Customer Feedback"])


class FeedbackCreate(BaseModel):
    booking_id: str
    rating: int  # 1-5
    comment: Optional[str] = None
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None


class FeedbackConfigUpdate(BaseModel):
    enabled: bool = True
    auto_send_after_completion: bool = True
    send_via_email: bool = True
    send_via_sms: bool = False
    email_subject: str = "How was your experience?"
    email_message: str = "We'd love to hear your feedback!"
    sms_message: str = "Rate your experience: {link}"
    thank_you_message: str = "Thank you for your feedback!"


# Get feedback configuration
@router.get("/config")
async def get_feedback_config(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    config = await db.feedback_config.find_one(query, {"_id": 0})
    if not config:
        return {
            "id": None,
            "enabled": True,
            "auto_send_after_completion": True,
            "send_via_email": True,
            "send_via_sms": False,
            "email_subject": "How was your experience?",
            "email_message": "We'd love to hear your feedback!",
            "sms_message": "Rate your experience: {link}",
            "thank_you_message": "Thank you for your feedback!",
            "feedback_link_base": f"/feedback/",
            "is_configured": False
        }
    config["is_configured"] = True
    return config


# Update feedback configuration
@router.put("/config")
async def update_feedback_config(config: FeedbackConfigUpdate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can update feedback config")
    
    config_doc = {
        "company_id": current_user.company_id,  # Associate with company
        "enabled": config.enabled,
        "auto_send_after_completion": config.auto_send_after_completion,
        "send_via_email": config.send_via_email,
        "send_via_sms": config.send_via_sms,
        "email_subject": config.email_subject,
        "email_message": config.email_message,
        "sms_message": config.sms_message,
        "thank_you_message": config.thank_you_message,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    query = {}
    if current_user.company_id:
        query["company_id"] = current_user.company_id
    
    existing = await db.feedback_config.find_one(query)
    if existing:
        await db.feedback_config.update_one(query, {"$set": config_doc})
        config_doc["id"] = existing.get("id")
    else:
        config_doc["id"] = str(uuid.uuid4())
        config_doc["created_at"] = datetime.now(timezone.utc).isoformat()
        await db.feedback_config.insert_one(config_doc)
    
    config_doc.pop("_id", None)
    config_doc["is_configured"] = True
    return config_doc


# Submit feedback (public - no auth required)
@router.post("/submit/{booking_id}")
async def submit_feedback(booking_id: str, feedback: FeedbackCreate):
    # Verify booking exists
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if feedback already exists
    existing = await db.feedback.find_one({"booking_id": booking_id})
    if existing:
        raise HTTPException(status_code=400, detail="Feedback already submitted for this booking")
    
    # Validate rating
    if feedback.rating < 1 or feedback.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    feedback_doc = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "company_id": booking.get("company_id"),  # Associate with booking's company
        "outlet_id": booking.get("outlet_id"),
        "service_id": booking.get("service_id"),
        "rating": feedback.rating,
        "comment": feedback.comment,
        "customer_name": feedback.customer_name or booking.get("customer") or booking.get("customer_name"),
        "customer_email": feedback.customer_email or booking.get("customer_email"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.feedback.insert_one(feedback_doc)
    feedback_doc.pop("_id", None)
    
    return {"message": "Thank you for your feedback!", "feedback_id": feedback_doc["id"]}


# Get feedback for a booking (public)
@router.get("/booking/{booking_id}")
async def get_feedback_for_booking(booking_id: str):
    feedback = await db.feedback.find_one({"booking_id": booking_id}, {"_id": 0})
    if not feedback:
        # Check if booking exists
        booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        return {"exists": False, "booking": booking}
    return {"exists": True, "feedback": feedback}


# Get all feedback (authenticated)
@router.get("")
async def get_all_feedback(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    feedback_list = await db.feedback.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return feedback_list


# Get feedback statistics (authenticated)
@router.get("/stats")
async def get_feedback_stats(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    all_feedback = await db.feedback.find(query, {"_id": 0}).to_list(1000)
    
    if not all_feedback:
        return {
            "total_responses": 0,
            "average_rating": 0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            "recent_feedback": [],
            "satisfaction_score": 0
        }
    
    total = len(all_feedback)
    avg_rating = sum(f["rating"] for f in all_feedback) / total
    
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for f in all_feedback:
        distribution[f["rating"]] = distribution.get(f["rating"], 0) + 1
    
    # Satisfaction score = (4 & 5 star ratings) / total * 100
    satisfied = distribution.get(4, 0) + distribution.get(5, 0)
    satisfaction_score = (satisfied / total) * 100 if total > 0 else 0
    
    return {
        "total_responses": total,
        "average_rating": round(avg_rating, 2),
        "rating_distribution": distribution,
        "recent_feedback": all_feedback[:10],
        "satisfaction_score": round(satisfaction_score, 1)
    }


# Generate feedback link for a booking
@router.get("/link/{booking_id}")
async def get_feedback_link(booking_id: str, current_user: User = Depends(get_current_user)):
    # Verify booking belongs to user's company
    query = {"id": booking_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    booking = await db.bookings.find_one(query, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {
        "booking_id": booking_id,
        "feedback_link": f"/rate/{booking_id}",
        "customer": booking.get("customer") or booking.get("customer_name")
    }
