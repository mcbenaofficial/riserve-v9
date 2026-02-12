from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, date
import uuid

from .dependencies import (
    bookings_collection, transactions_collection, 
    get_current_user, User, companies_collection, SUBSCRIPTION_PLANS,
    customers_collection
)

router = APIRouter(prefix="/bookings", tags=["Bookings"])


class BookingCreate(BaseModel):
    customer: str
    time: str
    date: Optional[str] = None
    service_id: Optional[str] = None
    service_ids: Optional[List[str]] = None
    outlet_id: str
    resource_id: Optional[str] = None
    amount: int = 0
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    notes: Optional[str] = None
    customer_id: Optional[str] = None
    duration: Optional[int] = None # Duration in minutes
    custom_fields: Optional[dict] = None  # For dynamic custom fields


class BookingReschedule(BaseModel):
    time: str
    date: Optional[str] = None
    resource_id: Optional[str] = None


@router.get("")
async def get_bookings(current_user: User = Depends(get_current_user)):
    # Filter by company_id for non-SuperAdmin users
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
        
    bookings = await bookings_collection.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return bookings


@router.post("")
async def create_booking(booking_input: BookingCreate, current_user: User = Depends(get_current_user)):
    # Check plan limits for booking creation (monthly limit)
    if current_user.company_id:
        company = await companies_collection.find_one({"id": current_user.company_id}, {"_id": 0})
        if company:
            plan = company.get("plan", "free")
            plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"])
            booking_limit = plan_config["limits"].get("bookings_per_month", 50)
            
            # -1 means unlimited
            if booking_limit != -1:
                # Count bookings this month
                first_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                current_month_bookings = await bookings_collection.count_documents({
                    "company_id": current_user.company_id,
                    "created_at": {"$gte": first_of_month.isoformat()}
                })
                if current_month_bookings >= booking_limit:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Monthly booking limit reached. Your {plan.capitalize()} plan allows {booking_limit} bookings/month. Please upgrade your plan."
                    )
    
    booking_id = str(uuid.uuid4())
    
    # Use today's date if not provided
    booking_date = booking_input.date or datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    # Handle service_ids array
    service_ids = booking_input.service_ids or ([booking_input.service_id] if booking_input.service_id else [])
    
    # Handle Customer Logic
    customer_id = booking_input.customer_id
    
    # If no customer_id but details provided, try to find or create
    if not customer_id and (booking_input.customer or booking_input.customer_phone or booking_input.customer_email):
        # Build query to find existing customer
        query = {"company_id": current_user.company_id}
        or_conditions = []
        if booking_input.customer_email:
            or_conditions.append({"email": booking_input.customer_email})
        if booking_input.customer_phone:
            or_conditions.append({"phone": booking_input.customer_phone})
        # If we only have name, we can't reliably dedup, so we skip unless email/phone is there
            
        if or_conditions:
            query["$or"] = or_conditions
            existing_customer = await customers_collection.find_one(query)
            if existing_customer:
                customer_id = existing_customer["id"]
            else:
                # Create new customer
                customer_id = str(uuid.uuid4())
                new_customer = {
                    "id": customer_id,
                    "name": booking_input.customer,
                    "email": booking_input.customer_email,
                    "phone": booking_input.customer_phone,
                    "notes": "",
                    "custom_fields": {},
                    "company_id": current_user.company_id,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "total_revenue": 0,
                    "total_bookings": 0,
                    "last_visit": None
                }
                await customers_collection.insert_one(new_customer)

    booking_doc = {
        "id": booking_id,
        "customer_id": customer_id,
        "customer": booking_input.customer,
        "customer_name": booking_input.customer,  # For compatibility with slot manager
        "customer_phone": booking_input.customer_phone,
        "customer_email": booking_input.customer_email,
        "time": booking_input.time,
        "date": booking_date,
        "service_id": service_ids[0] if service_ids else None,
        "service_ids": service_ids,
        "outlet_id": booking_input.outlet_id,
        "resource_id": booking_input.resource_id,
        "duration": booking_input.duration,
        "notes": booking_input.notes,
        "custom_fields": booking_input.custom_fields or {},
        "amount": booking_input.amount,
        "status": "Pending",
        "source": "app",
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await bookings_collection.insert_one(booking_doc)
    
    # Create transaction if amount > 0
    if booking_input.amount > 0:
        commission = int(booking_input.amount * 0.15)
        partner_share = booking_input.amount - commission
        transaction_doc = {
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "outlet_id": booking_input.outlet_id,
            "gross": booking_input.amount,
            "commission": commission,
            "partner_share": partner_share,
            "company_id": current_user.company_id,
            "status": "Settled",
            "date": datetime.now(timezone.utc).isoformat()
        }
        await transactions_collection.insert_one(transaction_doc)
    
    booking_doc.pop("_id", None)
    return booking_doc


@router.put("/{booking_id}")
async def update_booking(booking_id: str, status: str, current_user: User = Depends(get_current_user)):
    result = await bookings_collection.update_one(
        {"id": booking_id},
        {"$set": {"status": status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = await bookings_collection.find_one({"id": booking_id}, {"_id": 0})
    return booking


@router.put("/{booking_id}/reschedule")
async def reschedule_booking(booking_id: str, reschedule: BookingReschedule, current_user: User = Depends(get_current_user)):
    update_fields = {"time": reschedule.time}
    if reschedule.date:
        update_fields["date"] = reschedule.date
    if reschedule.resource_id:
        update_fields["resource_id"] = reschedule.resource_id
        
    result = await bookings_collection.update_one(
        {"id": booking_id},
        {"$set": update_fields}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = await bookings_collection.find_one({"id": booking_id}, {"_id": 0})
    return booking


@router.get("/resource-bookings/{outlet_id}")
async def get_resource_bookings(
    outlet_id: str, 
    date: str = None, 
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user)
):
    """Get bookings for a specific outlet, optionally filtered by date or date range.
    Used by the Slot Manager calendar view."""
    query = {"outlet_id": outlet_id}
    
    if date:
        # Single date filter (Day View)
        query["date"] = date
    elif start_date and end_date:
        # Date range filter (Week/Month View)
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    # Sort by date and then time
    bookings = await bookings_collection.find(query, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(1000)
    return bookings


class BookingItemAdd(BaseModel):
    product_id: str
    quantity: int = 1


class BookingItemsUpdate(BaseModel):
    items: List[BookingItemAdd]


@router.get("/{booking_id}")
async def get_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    """Get a single booking by ID"""
    booking = await bookings_collection.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking


@router.post("/{booking_id}/items")
async def add_items_to_booking(
    booking_id: str, 
    items_data: BookingItemsUpdate,
    current_user: User = Depends(get_current_user)
):
    """Add products/inventory items to a booking"""
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    
    MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME = os.environ.get('DB_NAME', 'ridn_db')
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get the booking
    booking = await bookings_collection.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get existing items or empty list
    existing_items = booking.get("items", [])
    
    # Process new items
    new_items = []
    items_total = 0
    
    for item in items_data.items:
        # Get product details
        product = await db.products.find_one(
            {"id": item.product_id, "company_id": current_user.company_id},
            {"_id": 0}
        )
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        # Check stock
        if product.get("stock_quantity", 0) < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {product['name']}. Available: {product.get('stock_quantity', 0)}"
            )
        
        subtotal = product["price"] * item.quantity
        new_items.append({
            "product_id": item.product_id,
            "name": product["name"],
            "sku": product.get("sku", ""),
            "quantity": item.quantity,
            "price": product["price"],
            "cost": product.get("cost", 0),
            "subtotal": subtotal
        })
        items_total += subtotal
        
        # Deduct stock
        new_quantity = product.get("stock_quantity", 0) - item.quantity
        await db.products.update_one(
            {"id": item.product_id},
            {"$set": {"stock_quantity": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Log inventory action
        await db.inventory_log.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": item.product_id,
            "action": "sale",
            "quantity": -item.quantity,
            "new_quantity": new_quantity,
            "reason": "booking",
            "booking_id": booking_id,
            "user_id": current_user.id,
            "company_id": current_user.company_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Check for low stock alert
        if new_quantity <= product.get("reorder_level", 10):
            existing_alert = await db.inventory_alerts.find_one({
                "product_id": item.product_id,
                "resolved": False
            })
            if not existing_alert:
                await db.inventory_alerts.insert_one({
                    "id": str(uuid.uuid4()),
                    "type": "low_stock",
                    "product_id": item.product_id,
                    "product_name": product["name"],
                    "current_quantity": new_quantity,
                    "reorder_level": product.get("reorder_level", 10),
                    "outlet_id": product.get("outlet_id"),
                    "company_id": current_user.company_id,
                    "resolved": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
    
    # Merge with existing items
    all_items = existing_items + new_items
    all_items_total = sum(item["subtotal"] for item in all_items)
    
    # Calculate new totals
    service_amount = booking.get("amount", 0)
    total_amount = service_amount + all_items_total
    
    # Update booking
    await bookings_collection.update_one(
        {"id": booking_id},
        {
            "$set": {
                "items": all_items,
                "items_total": all_items_total,
                "service_amount": service_amount,
                "total_amount": total_amount,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update transaction
    product_cost = sum(item["cost"] * item["quantity"] for item in all_items)
    await transactions_collection.update_one(
        {"booking_id": booking_id},
        {
            "$set": {
                "gross": total_amount,
                "service_revenue": service_amount,
                "product_revenue": all_items_total,
                "product_cost": product_cost,
                "total_amount": total_amount,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    updated_booking = await bookings_collection.find_one({"id": booking_id}, {"_id": 0})
    return updated_booking


@router.delete("/{booking_id}/items/{product_id}")
async def remove_item_from_booking(
    booking_id: str,
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a product from a booking and restore stock"""
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    
    MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME = os.environ.get('DB_NAME', 'ridn_db')
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get the booking
    booking = await bookings_collection.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    items = booking.get("items", [])
    item_to_remove = None
    
    for item in items:
        if item["product_id"] == product_id:
            item_to_remove = item
            break
    
    if not item_to_remove:
        raise HTTPException(status_code=404, detail="Item not found in booking")
    
    # Restore stock
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if product:
        new_quantity = product.get("stock_quantity", 0) + item_to_remove["quantity"]
        await db.products.update_one(
            {"id": product_id},
            {"$set": {"stock_quantity": new_quantity, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Log inventory action
        await db.inventory_log.insert_one({
            "id": str(uuid.uuid4()),
            "product_id": product_id,
            "action": "return",
            "quantity": item_to_remove["quantity"],
            "new_quantity": new_quantity,
            "reason": "booking_item_removed",
            "booking_id": booking_id,
            "user_id": current_user.id,
            "company_id": current_user.company_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Remove item from booking
    new_items = [i for i in items if i["product_id"] != product_id]
    items_total = sum(item["subtotal"] for item in new_items)
    service_amount = booking.get("service_amount", booking.get("amount", 0))
    total_amount = service_amount + items_total
    
    await bookings_collection.update_one(
        {"id": booking_id},
        {
            "$set": {
                "items": new_items,
                "items_total": items_total,
                "total_amount": total_amount,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update transaction
    product_cost = sum(item.get("cost", 0) * item["quantity"] for item in new_items)
    await transactions_collection.update_one(
        {"booking_id": booking_id},
        {
            "$set": {
                "gross": total_amount,
                "product_revenue": items_total,
                "product_cost": product_cost,
                "total_amount": total_amount,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    updated_booking = await bookings_collection.find_one({"id": booking_id}, {"_id": 0})
    return updated_booking
