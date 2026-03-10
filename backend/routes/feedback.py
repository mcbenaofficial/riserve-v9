from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update

import models_pg
from .dependencies import get_current_user, User, get_db

router = APIRouter(prefix="/feedback", tags=["Customer Feedback"])


class FeedbackCreate(BaseModel):
    booking_id: str
    rating: int  # 1-5
    
    # Section A
    compared_to_previous: Optional[str] = None
    
    # Section B
    liked_most: Optional[List[str]] = None
    staff_shoutout: Optional[str] = None
    
    # Section C
    areas_fell_short: Optional[List[str]] = None
    shortcomings_details: Optional[dict] = None
    
    # Section D
    escalation_notes: Optional[str] = None
    escalation_contact_opt_in: Optional[bool] = False
    escalation_contact_number: Optional[str] = None
    escalation_contact_time: Optional[str] = None
    
    # Section E
    likely_to_visit_again: Optional[str] = None
    nps_score: Optional[int] = None
    return_incentive: Optional[str] = None
    
    # Other
    comment: Optional[str] = None
    suggestions: Optional[str] = None
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
async def get_feedback_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.FeedbackConfig)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.FeedbackConfig.company_id == current_user.company_id)
    
    config = (await db.execute(stmt)).scalar_one_or_none()
    
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
    
    return {
        "id": config.id,
        "company_id": config.company_id,
        "enabled": config.enabled,
        "auto_send_after_completion": config.auto_send_after_completion,
        "send_via_email": config.send_via_email,
        "send_via_sms": config.send_via_sms,
        "email_subject": config.email_subject,
        "email_message": config.email_message,
        "sms_message": config.sms_message,
        "thank_you_message": config.thank_you_message,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        "is_configured": True
    }


# Update feedback configuration
@router.put("/config")
async def update_feedback_config(
    config_input: FeedbackConfigUpdate, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can update feedback config")
    
    stmt = select(models_pg.FeedbackConfig).where(models_pg.FeedbackConfig.company_id == current_user.company_id)
    config = (await db.execute(stmt)).scalar_one_or_none()
    
    if config:
        config.enabled = config_input.enabled
        config.auto_send_after_completion = config_input.auto_send_after_completion
        config.send_via_email = config_input.send_via_email
        config.send_via_sms = config_input.send_via_sms
        config.email_subject = config_input.email_subject
        config.email_message = config_input.email_message
        config.sms_message = config_input.sms_message
        config.thank_you_message = config_input.thank_you_message
        config.updated_at = datetime.now(timezone.utc)
    else:
        config = models_pg.FeedbackConfig(
            id=str(uuid.uuid4()),
            company_id=current_user.company_id,
            enabled=config_input.enabled,
            auto_send_after_completion=config_input.auto_send_after_completion,
            send_via_email=config_input.send_via_email,
            send_via_sms=config_input.send_via_sms,
            email_subject=config_input.email_subject,
            email_message=config_input.email_message,
            sms_message=config_input.sms_message,
            thank_you_message=config_input.thank_you_message
        )
        db.add(config)
    
    await db.commit()
    
    return {
        "id": config.id,
        "company_id": config.company_id,
        "enabled": config.enabled,
        "is_configured": True
    }


# Submit feedback (public - no auth required)
@router.post("/submit/{booking_id}")
async def submit_feedback(
    booking_id: str, 
    feedback_input: FeedbackCreate,
    db: AsyncSession = Depends(get_db)
):
    # Verify booking exists
    stmt = select(models_pg.Booking).where(models_pg.Booking.id == booking_id)
    booking = (await db.execute(stmt)).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if feedback already exists
    existing_stmt = select(models_pg.Feedback).where(models_pg.Feedback.booking_id == booking_id)
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Feedback already submitted for this booking")
    
    # Validate rating
    if feedback_input.rating < 1 or feedback_input.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    new_feedback = models_pg.Feedback(
        id=str(uuid.uuid4()),
        booking_id=booking_id,
        company_id=booking.company_id,
        outlet_id=booking.outlet_id,
        # service_id logic: Booking often has many services now
        # We'll just take the first one if it exists or leave NULL
        rating=feedback_input.rating,
        
        compared_to_previous=feedback_input.compared_to_previous,
        liked_most=feedback_input.liked_most or [],
        staff_shoutout=feedback_input.staff_shoutout,
        areas_fell_short=feedback_input.areas_fell_short or [],
        shortcomings_details=feedback_input.shortcomings_details or {},
        escalation_notes=feedback_input.escalation_notes,
        escalation_contact_opt_in=feedback_input.escalation_contact_opt_in,
        escalation_contact_number=feedback_input.escalation_contact_number,
        escalation_contact_time=feedback_input.escalation_contact_time,
        likely_to_visit_again=feedback_input.likely_to_visit_again,
        nps_score=feedback_input.nps_score,
        return_incentive=feedback_input.return_incentive,
        
        comment=feedback_input.comment,
        suggestions=feedback_input.suggestions,
        customer_name=feedback_input.customer_name or booking.customer_name,
        customer_email=feedback_input.customer_email or booking.customer_email
    )
    
    db.add(new_feedback)
    await db.commit()
    
    return {"message": "Thank you for your feedback!", "feedback_id": new_feedback.id}


# Get feedback for a booking (public)
@router.get("/booking/{booking_id}")
async def get_feedback_for_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Feedback).where(models_pg.Feedback.booking_id == booking_id)
    feedback = (await db.execute(stmt)).scalar_one_or_none()
    
    if not feedback:
        # Check if booking exists
        booking_stmt = select(models_pg.Booking).where(models_pg.Booking.id == booking_id)
        booking = (await db.execute(booking_stmt)).scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        return {
            "exists": False, 
            "booking": {
                "id": booking.id,
                "customer_name": booking.customer_name,
                "status": booking.status
            }
        }
    
    return {
        "exists": True, 
        "feedback": {
            "id": feedback.id,
            "rating": feedback.rating,
            "comment": feedback.comment,
            "created_at": feedback.created_at.isoformat() if feedback.created_at else None
        }
    }


# Get all feedback (authenticated)
@router.get("")
async def get_all_feedback(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Feedback)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Feedback.company_id == current_user.company_id)
    
    stmt = stmt.order_by(desc(models_pg.Feedback.created_at))
    feedback_res = (await db.execute(stmt)).scalars().all()
    
    return [
        {
            "id": f.id,
            "booking_id": f.booking_id,
            "rating": f.rating,
            "comment": f.comment,
            "customer_name": f.customer_name,
            "created_at": f.created_at.isoformat() if f.created_at else None
        } for f in feedback_res
    ]


# Get feedback statistics (authenticated)
@router.get("/stats")
async def get_feedback_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Feedback)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Feedback.company_id == current_user.company_id)
    
    feedback_res = (await db.execute(stmt)).scalars().all()
    
    if not feedback_res:
        return {
            "total_responses": 0,
            "average_rating": 0,
            "rating_distribution": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            "recent_feedback": [],
            "satisfaction_score": 0
        }
    
    total = len(feedback_res)
    avg_rating = sum(f.rating for f in feedback_res) / total
    
    distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    for f in feedback_res:
        distribution[f.rating] = distribution.get(f.rating, 0) + 1
    
    # Satisfaction score = (4 & 5 star ratings) / total * 100
    satisfied = distribution.get(4, 0) + distribution.get(5, 0)
    satisfaction_score = (satisfied / total) * 100 if total > 0 else 0
    
    return {
        "total_responses": total,
        "average_rating": round(avg_rating, 2),
        "rating_distribution": distribution,
        "recent_feedback": [
            {"id": f.id, "rating": f.rating, "comment": f.comment} for f in feedback_res[:10]
        ],
        "satisfaction_score": round(satisfaction_score, 1)
    }


# Generate feedback link for a booking
@router.get("/link/{booking_id}")
async def get_feedback_link(
    booking_id: str, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Booking).where(models_pg.Booking.id == booking_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Booking.company_id == current_user.company_id)
    
    booking = (await db.execute(stmt)).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    return {
        "booking_id": booking_id,
        "feedback_link": f"/rate/{booking_id}",
        "customer": booking.customer_name
    }
