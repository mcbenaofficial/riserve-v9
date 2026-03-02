from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, cast, Float

from .dependencies import (
    get_current_user, User, get_db
)
import models_pg

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("")
async def get_reports(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    # Filter by company_id for data isolation
    outlets_stmt = select(func.count()).select_from(models_pg.Outlet)
    bookings_stmt = select(func.count()).select_from(models_pg.Booking)
    revenue_stmt = select(func.sum(models_pg.Booking.amount))
    rating_stmt = select(func.avg(models_pg.Feedback.rating))
    
    if current_user.role != "SuperAdmin":
        outlets_stmt = outlets_stmt.where(models_pg.Outlet.company_id == current_user.company_id)
        bookings_stmt = bookings_stmt.where(models_pg.Booking.company_id == current_user.company_id)
        revenue_stmt = revenue_stmt.where(models_pg.Booking.company_id == current_user.company_id)
        rating_stmt = rating_stmt.where(models_pg.Feedback.company_id == current_user.company_id)
    
    outlets_count = (await db_session.execute(outlets_stmt)).scalar() or 0
    bookings_count = (await db_session.execute(bookings_stmt)).scalar() or 0
    total_revenue = (await db_session.execute(revenue_stmt)).scalar() or 0
    avg_rating = (await db_session.execute(rating_stmt)).scalar() or 0
    
    return {
        "totalOutlets": outlets_count,
        "totalBookings": bookings_count,
        "totalRevenue": int(total_revenue),
        "avgRating": round(float(avg_rating), 1) if avg_rating else 0
    }


@router.get("/detailed")
async def get_detailed_reports(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    # Bookings by status
    status_stmt = select(
        models_pg.Booking.status, 
        func.count(models_pg.Booking.id).label("count")
    ).group_by(models_pg.Booking.status)
    
    recent_stmt = select(models_pg.Booking).order_by(desc(models_pg.Booking.created_at)).limit(10)
    
    # Top services (since services is a many-to-many relationship now)
    services_stmt = select(
        models_pg.booking_services.c.service_id, 
        func.count(models_pg.booking_services.c.booking_id).label("count")
    ).group_by(models_pg.booking_services.c.service_id).order_by(desc("count")).limit(5)
    
    if current_user.role != "SuperAdmin":
        status_stmt = status_stmt.where(models_pg.Booking.company_id == current_user.company_id)
        recent_stmt = recent_stmt.where(models_pg.Booking.company_id == current_user.company_id)
        
        # for services stmt, we join booking to filter by company_id
        services_stmt = select(
            models_pg.booking_services.c.service_id, 
            func.count(models_pg.booking_services.c.booking_id).label("count")
        ).join(
            models_pg.Booking, models_pg.Booking.id == models_pg.booking_services.c.booking_id
        ).where(
            models_pg.Booking.company_id == current_user.company_id
        ).group_by(models_pg.booking_services.c.service_id).order_by(desc("count")).limit(5)
        
    status_result = (await db_session.execute(status_stmt)).all()
    bookings_by_status = {row.status: row.count for row in status_result if row.status}
    
    recent_result = (await db_session.execute(recent_stmt)).scalars().all()
    recent_bookings = [
        {
            "id": r.id,
            "company_id": r.company_id,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "customer_name": r.customer_name,
            "amount": float(r.amount or 0)
        } for r in recent_result
    ]
    
    services_result = (await db_session.execute(services_stmt)).all()
    top_services = [{"_id": row.service_id, "count": row.count} for row in services_result]
    
    return {
        "bookings_by_status": bookings_by_status,
        "recent_bookings": recent_bookings,
        "top_services": top_services
    }
