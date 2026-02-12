from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict
from datetime import datetime, timezone
import uuid

from .dependencies import (
    customers_collection, bookings_collection, transactions_collection,
    get_current_user, User
)

router = APIRouter(prefix="/customers", tags=["Customers"])

class CustomerCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: Optional[Dict] = None

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: Optional[Dict] = None

@router.get("")
async def get_customers(
    search: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    current_user: User = Depends(get_current_user)
):
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
        
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
        
    customers = await customers_collection.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return customers

@router.post("")
async def create_customer(customer_input: CustomerCreate, current_user: User = Depends(get_current_user)):
    if not customer_input.email and not customer_input.phone:
        raise HTTPException(status_code=400, detail="Either email or phone is required")

    # Check for existing customer
    query = {"company_id": current_user.company_id}
    or_conditions = []
    if customer_input.email:
        or_conditions.append({"email": customer_input.email})
    if customer_input.phone:
        or_conditions.append({"phone": customer_input.phone})
    
    if or_conditions:
        query["$or"] = or_conditions
        existing = await customers_collection.find_one(query)
        if existing:
            raise HTTPException(status_code=400, detail="Customer with this email or phone already exists")

    customer_id = str(uuid.uuid4())
    customer_doc = {
        "id": customer_id,
        "name": customer_input.name,
        "email": customer_input.email,
        "phone": customer_input.phone,
        "notes": customer_input.notes,
        "custom_fields": customer_input.custom_fields or {},
        "company_id": current_user.company_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "total_revenue": 0,
        "total_bookings": 0,
        "last_visit": None
    }
    
    await customers_collection.insert_one(customer_doc)
    customer_doc.pop("_id", None)
    return customer_doc

@router.get("/{customer_id}")
async def get_customer(customer_id: str, current_user: User = Depends(get_current_user)):
    query = {"id": customer_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
        
    customer = await customers_collection.find_one(query, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    # Aggegrate stats dynamically to ensure accuracy
    bookings = await bookings_collection.find({"customer_id": customer_id}, {"_id": 0}).to_list(1000)
    
    total_revenue = sum(b.get("total_amount", b.get("amount", 0)) for b in bookings)
    total_bookings = len(bookings)
    last_visit = bookings[0]["date"] if bookings else None # Sorted by created_at desc roughly usually, but better to sort
    
    # Simple services breakdown
    services_count = {}
    for b in bookings:
        # Check both service_id (single) and service_ids (list)
        s_ids = b.get("service_ids") or ([b.get("service_id")] if b.get("service_id") else [])
        for sid in s_ids:
            if sid:
                services_count[sid] = services_count.get(sid, 0) + 1
    
    most_used_service = max(services_count, key=services_count.get) if services_count else None

    # Update stats in background (optional, but good for caching)
    # For now just return computed stats joined with customer data
    customer["total_revenue"] = total_revenue
    customer["total_bookings"] = total_bookings
    customer["last_visit"] = last_visit
    customer["most_used_service_id"] = most_used_service
    
    return customer

@router.put("/{customer_id}")
async def update_customer(
    customer_id: str, 
    customer_update: CustomerUpdate, 
    current_user: User = Depends(get_current_user)
):
    query = {"id": customer_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id

    customer = await customers_collection.find_one(query)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    update_data = {k: v for k, v in customer_update.dict(exclude_unset=True).items()}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await customers_collection.update_one({"id": customer_id}, {"$set": update_data})
    
    return await customers_collection.find_one({"id": customer_id}, {"_id": 0})

@router.get("/{customer_id}/bookings")
async def get_customer_bookings(customer_id: str, current_user: User = Depends(get_current_user)):
    # Verify access
    query = {"id": customer_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    if not await customers_collection.find_one(query):
        raise HTTPException(status_code=404, detail="Customer not found")

    bookings = await bookings_collection.find(
        {"customer_id": customer_id}, 
        {"_id": 0}
    ).sort("date", -1).to_list(100)
    
    return bookings
