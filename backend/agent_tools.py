from langchain_core.tools import tool
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import logging
# Imports moved inside functions to avoid circular reference
# from routes.dependencies import (
#     bookings_collection, services_collection, outlets_collection,
#     users_collection, ai_conversations_collection, products_collection
# )
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# --- RBAC Helper ---
def verify_company_access(user_context: Dict[str, Any], target_company_id: Optional[str] = None) -> bool:
    """
    Verify if the user has access to the target company data.
    """
    if not user_context:
        return False
    
    user_role = user_context.get("role")
    user_company_id = user_context.get("company_id")

    if user_role == "SuperAdmin":
        return True
    
    if target_company_id and user_company_id != target_company_id:
        return False
        
    return True

# --- Tool Schemas ---

class DateRangeSchema(BaseModel):
    start_date: Optional[str] = Field(None, description="Start date in YYYY-MM-DD format")
    end_date: Optional[str] = Field(None, description="End date in YYYY-MM-DD format")
    limit: int = Field(5, description="Number of records to return")

class BookingCreateSchema(BaseModel):
    customer_name: str = Field(..., description="Name of the customer")
    service_name: str = Field(..., description="Name of the service to book")
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    time: str = Field(..., description="Time in HH:MM format")
    outlet_name: Optional[str] = Field(None, description="Name of the outlet (optional if only one exists)")

class InventoryCheckSchema(BaseModel):
    product_name: Optional[str] = Field(None, description="Name of the product to check")
    low_stock_only: bool = Field(False, description="If true, only return low stock items")

class RecentBookingsSchema(BaseModel):
    limit: int = Field(5, description="Number of records to return")

class RevenueStatsSchema(BaseModel):
    period: str = Field("month", description="Period for stats: today, week, month, or all")

# --- Tools ---

@tool(args_schema=RecentBookingsSchema)
async def get_recent_bookings(limit: int = 5, user_context: Dict[str, Any] = None) -> str:
    """
    Get a list of the most recent bookings for the user's company.
    Accessible by Admin, Manager, and Staff.
    """
    from routes.dependencies import bookings_collection
    if not user_context:
        return "Error: No user context provided."

    company_id = user_context.get("company_id")
    
    query = {"company_id": company_id} if company_id else {}
    
    bookings = await bookings_collection.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    if not bookings:
        return "No recent bookings found."
        
    result = "Recent Bookings:\n"
    for b in bookings:
        result += f"- {b.get('customer_name')} ({b.get('date')} {b.get('time')}): {b.get('status')} - {b.get('amount')}\n"
        
    return result

@tool(args_schema=BookingCreateSchema)
async def create_booking_tool(customer_name: str, service_name: str, date: str, time: str, outlet_name: Optional[str] = None, user_context: Dict[str, Any] = None) -> str:
    """
    Create a new booking. Requires finding the service and outlet first.
    Accessible by Admin, Manager, and Staff.
    """
    from routes.dependencies import bookings_collection, services_collection, outlets_collection
    if not user_context:
        return "Error: No user context provided."
        
    company_id = user_context.get("company_id")
    
    # 1. Find Service
    service_query = {"name": {"$regex": service_name, "$options": "i"}, "company_id": company_id} if company_id else {"name": {"$regex": service_name, "$options": "i"}}
    service = await services_collection.find_one(service_query)
    
    if not service:
        return f"Error: Service '{service_name}' not found."
        
    # 2. Find Outlet
    outlet_query = {"company_id": company_id} if company_id else {}
    if outlet_name:
        outlet_query["name"] = {"$regex": outlet_name, "$options": "i"}
        
    outlet = await outlets_collection.find_one(outlet_query)
    # If not specified and multiple exist, pick first (simplified logic)
    if not outlet and not outlet_name:
        outlet = await outlets_collection.find_one({"company_id": company_id} if company_id else {})
        
    if not outlet:
        return f"Error: Outlet not found. Please specify a valid outlet."

    # 3. Create Booking Object
    booking_id = str(uuid.uuid4())
    booking = {
        "id": booking_id,
        "customer_name": customer_name,
        "customer": customer_name, # Legacy field
        "service_id": service["id"],
        "service_ids": [service["id"]],
        "outlet_id": outlet["id"],
        "date": date,
        "time": time,
        "amount": service["price"],
        "status": "Pending",
        "company_id": company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "ai_agent"
    }
    
    try:
        await bookings_collection.insert_one(booking)
        return f"Booking created successfully for {customer_name} on {date} at {time}."
    except Exception as e:
        logger.error(f"Failed to create booking: {e}")
        return f"Error creating booking: {str(e)}"

@tool(args_schema=RevenueStatsSchema)
async def get_revenue_stats(period: str = "month", user_context: Dict[str, Any] = None) -> str:
    """
    Get revenue statistics. Period can be 'today', 'week', 'month', or 'all'.
    Accessible by Admin and Owner only.
    """
    from routes.dependencies import bookings_collection
    if not user_context:
        return "Error: No user context provided."
        
    role = user_context.get("role")
    if role not in ["SuperAdmin", "Admin", "Owner"]:
        return "Error: You do not have permission to view revenue statistics."
        
    company_id = user_context.get("company_id")
    now = datetime.now(timezone.utc)
    
    date_query = {}
    if period == "today":
        date_query = {"$gte": now.strftime("%Y-%m-%d")}
    elif period == "week":
        start_date = now - timedelta(days=7)
        date_query = {"$gte": start_date.strftime("%Y-%m-%d")}
    elif period == "month":
        start_date = now - timedelta(days=30)
        date_query = {"$gte": start_date.strftime("%Y-%m-%d")}
        
    match_stage = {"company_id": company_id} if company_id else {}
    if date_query:
        match_stage["date"] = date_query
        
    pipeline = [
        {"$match": match_stage},
        {"$group": {"_id": None, "total_revenue": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    
    result = await bookings_collection.aggregate(pipeline).to_list(1)
    
    if not result:
        return f"No revenue data found for period: {period}."
        
    data = result[0]
    return f"Revenue Stats ({period}): Total Revenue = {data['total_revenue']}, Total Bookings = {data['count']}"

@tool(args_schema=InventoryCheckSchema)
async def check_inventory_tool(product_name: Optional[str] = None, low_stock_only: bool = False, user_context: Dict[str, Any] = None) -> str:
    """
    Check inventory levels. Can search by product name or list low stock items.
    """
    from routes.dependencies import products_collection
    if not user_context:
        return "Error: No user context provided."
        
    company_id = user_context.get("company_id")
    query = {"company_id": company_id} if company_id else {}
    
    if product_name:
        query["name"] = {"$regex": product_name, "$options": "i"}
        
    if low_stock_only:
        # Assuming we have a field or logic for 'reorder_level' comparison
        # Since MongoDB $expr with fields is complex in find(), we'll filter in python for simplicity if needed
        # Or better: use simple $where or $expr
         query["$expr"] = {"$lte": ["$stock_quantity", "$reorder_level"]}

    products = await products_collection.find(query).limit(10).to_list(10)
    
    if not products:
        return "No products found matching criteria."
        
    result = "Inventory Status:\n"
    for p in products:
        status = "LOW STOCK" if p.get('stock_quantity', 0) <= p.get('reorder_level', 0) else "OK"
        result += f"- {p.get('name')}: {p.get('stock_quantity')} units (Reorder at {p.get('reorder_level')}) [{status}]\n"
        
    return result

# List of all available tools
all_tools = [get_recent_bookings, create_booking_tool, get_revenue_stats, check_inventory_tool]
