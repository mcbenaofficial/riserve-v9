from langchain_core.tools import tool
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_
from pydantic import BaseModel, Field

import models_pg
from database_pg import engine

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

class InventoryReorderSchema(BaseModel):
    pass

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
    if not user_context:
        return "Error: No user context provided."

    company_id = user_context.get("company_id")
    
    async with AsyncSession(engine) as session:
        stmt = select(models_pg.Booking)
        if company_id:
            stmt = stmt.where(models_pg.Booking.company_id == company_id)
        
        stmt = stmt.order_by(desc(models_pg.Booking.created_at)).limit(limit)
        result = await session.execute(stmt)
        bookings = result.scalars().all()
    
    if not bookings:
        return "No recent bookings found."
        
    res_text = "Recent Bookings:\n"
    for b in bookings:
        res_text += f"- {b.customer_name} ({b.date} {b.time}): {b.status} - {b.amount}\n"
        
    return res_text

@tool(args_schema=BookingCreateSchema)
async def create_booking_tool(customer_name: str, service_name: str, date: str, time: str, outlet_name: Optional[str] = None, user_context: Dict[str, Any] = None) -> str:
    """
    Create a new booking. Requires finding the service and outlet first.
    Accessible by Admin, Manager, and Staff.
    """
    if not user_context:
        return "Error: No user context provided."
        
    company_id = user_context.get("company_id")
    
    async with AsyncSession(engine) as session:
        # 1. Find Service
        service_stmt = select(models_pg.Service).where(
            models_pg.Service.name.ilike(f"%{service_name}%")
        )
        if company_id:
            service_stmt = service_stmt.where(models_pg.Service.company_id == company_id)
        
        service = (await session.execute(service_stmt)).scalar_one_or_none()
        
        if not service:
            return f"Error: Service '{service_name}' not found."
            
        # 2. Find Outlet
        outlet_stmt = select(models_pg.Outlet)
        if company_id:
            outlet_stmt = outlet_stmt.where(models_pg.Outlet.company_id == company_id)
        
        if outlet_name:
            outlet_stmt = outlet_stmt.where(models_pg.Outlet.name.ilike(f"%{outlet_name}%"))
            
        outlet = (await session.execute(outlet_stmt)).scalar_one_or_none()
        
        if not outlet:
            return f"Error: Outlet not found. Please specify a valid outlet."

        # 3. Create Booking Object
        new_booking = models_pg.Booking(
            id=str(uuid.uuid4()),
            customer_name=customer_name,
            outlet_id=outlet.id,
            date=date, # Hopefully string date works or needs parsing
            time=time,
            amount=service.price,
            status="Pending",
            company_id=company_id,
            source="ai_agent"
        )
        # Note: Booking model has a list of services in SQLAlchemy now
        new_booking.services.append(service)
        
        try:
            session.add(new_booking)
            await session.commit()
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
    if not user_context:
        return "Error: No user context provided."
        
    role = user_context.get("role")
    if role not in ["SuperAdmin", "Admin", "Owner"]:
        return "Error: You do not have permission to view revenue statistics."
        
    company_id = user_context.get("company_id")
    now = datetime.now(timezone.utc)
    
    async with AsyncSession(engine) as session:
        stmt = select(
            func.sum(models_pg.Booking.amount).label("total_revenue"),
            func.count(models_pg.Booking.id).label("count")
        )
        
        if company_id:
            stmt = stmt.where(models_pg.Booking.company_id == company_id)
            
        if period == "today":
            today_str = now.strftime("%Y-%m-%d")
            stmt = stmt.where(models_pg.Booking.date == today_str)
        elif period == "week":
            start_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")
            stmt = stmt.where(models_pg.Booking.date >= start_date)
        elif period == "month":
            start_date = (now - timedelta(days=30)).strftime("%Y-%m-%d")
            stmt = stmt.where(models_pg.Booking.date >= start_date)
            
        result = await session.execute(stmt)
        data = result.one_or_none()
    
    if not data or data.count == 0:
        return f"No revenue data found for period: {period}."
        
    return f"Revenue Stats ({period}): Total Revenue = {data.total_revenue or 0}, Total Bookings = {data.count}"

@tool(args_schema=InventoryCheckSchema)
async def check_inventory_tool(product_name: Optional[str] = None, low_stock_only: bool = False, user_context: Dict[str, Any] = None) -> str:
    """
    Check inventory levels. Can search by product name or list low stock items.
    """
    if not user_context:
        return "Error: No user context provided."
        
    company_id = user_context.get("company_id")
    
    async with AsyncSession(engine) as session:
        stmt = select(models_pg.Product)
        if company_id:
            stmt = stmt.where(models_pg.Product.company_id == company_id)
        
        if product_name:
            stmt = stmt.where(models_pg.Product.name.ilike(f"%{product_name}%"))
            
        if low_stock_only:
            stmt = stmt.where(models_pg.Product.stock_quantity <= models_pg.Product.reorder_level)

        stmt = stmt.limit(10)
        result = await session.execute(stmt)
        products = result.scalars().all()
    
    if not products:
        return "No products found matching criteria."
        
    res_text = "Inventory Status:\n"
    for p in products:
        status = "LOW STOCK" if p.stock_quantity <= p.reorder_level else "OK"
        res_text += f"- {p.name}: {p.stock_quantity} units (Reorder at {p.reorder_level}) [{status}]\n"
        
    return res_text

@tool(args_schema=InventoryReorderSchema)
async def trigger_inventory_reorder(user_context: Dict[str, Any] = None) -> str:
    """
    Analyzes low stock inventory and generates a Human-in-the-Loop report to reorder items.
    Call this when the user wants to replenish stock or automatically reorder items.
    """
    from routes.hitl import analyze_inventory
    from pydantic import BaseModel
    
    # Mocking a User object for the inner function call
    class MockUser(BaseModel):
        company_id: Optional[str] = None
        id: str = "system_agent"
        role: str = "Staff"
    
    if not user_context:
        return "Error: No user context provided."
        
    company_id = user_context.get("company_id")
    current_user = MockUser(company_id=company_id)
    
    async with AsyncSession(engine) as session:
        try:
            res = await analyze_inventory(current_user=current_user, db=session)
            if res.get("status") == "success" and res.get("report_generated"):
                return f"Successfully generated an inventory reorder report for {res.get('items_count')} items. The operations team can review and approve it on the dashboard."
            return f"Inventory analysis complete: {res.get('reason', 'No action needed')}."
        except Exception as e:
            logger.error(f"Error triggering inventory reorder: {e}")
            return f"Error triggering inventory reorder: {str(e)}"

# List of all available tools
all_tools = [get_recent_bookings, create_booking_tool, get_revenue_stats, check_inventory_tool, trigger_inventory_reorder]
