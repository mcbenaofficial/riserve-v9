from fastapi import APIRouter, Depends

from .dependencies import (
    outlets_collection, bookings_collection, db,
    get_current_user, User
)

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("")
async def get_reports(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    outlets_count = await outlets_collection.count_documents(query)
    bookings_count = await bookings_collection.count_documents(query)
    
    # Calculate total revenue for this company
    revenue_pipeline = [
        {"$match": query} if query else {"$match": {}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await bookings_collection.aggregate(revenue_pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Calculate average rating from feedback for this company
    feedback_query = query.copy() if query else {}
    rating_pipeline = [
        {"$match": feedback_query} if feedback_query else {"$match": {}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}}}
    ]
    rating_result = await db.feedback.aggregate(rating_pipeline).to_list(1)
    avg_rating = round(rating_result[0]["avg"], 2) if rating_result and rating_result[0].get("avg") else 0
    
    return {
        "totalOutlets": outlets_count,
        "totalBookings": bookings_count,
        "totalRevenue": int(total_revenue),
        "avgRating": avg_rating
    }


@router.get("/detailed")
async def get_detailed_reports(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    # Bookings by status
    status_pipeline = [
        {"$match": query} if query else {"$match": {}},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_result = await bookings_collection.aggregate(status_pipeline).to_list(100)
    bookings_by_status = {item["_id"]: item["count"] for item in status_result if item["_id"]}
    
    # Recent bookings
    recent_bookings = await bookings_collection.find(query, {"_id": 0}).sort("created_at", -1).to_list(10)
    
    # Top services
    services_pipeline = [
        {"$match": query} if query else {"$match": {}},
        {"$unwind": "$service_ids"},
        {"$group": {"_id": "$service_ids", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5}
    ]
    top_services = await bookings_collection.aggregate(services_pipeline).to_list(5)
    
    return {
        "bookings_by_status": bookings_by_status,
        "recent_bookings": recent_bookings,
        "top_services": top_services
    }
