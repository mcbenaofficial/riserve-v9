from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, date
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_
import models_pg

from .dependencies import (
    get_db,
    get_current_user, User, SUBSCRIPTION_PLANS,
    enforce_outlet_access
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
async def get_bookings(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Booking)
    
    # Filter by company_id for non-SuperAdmin users
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Booking.company_id == current_user.company_id)
        
    if current_user.role in ["Manager", "User"]:
        if current_user.outlets:
            stmt = stmt.where(models_pg.Booking.outlet_id.in_(current_user.outlets))
        else:
            return [] # No outlets assigned, can't see bookings
            
    stmt = stmt.order_by(models_pg.Booking.created_at.desc())
        
    res = await db_session.execute(stmt)
    bookings = res.scalars().all()
    
    # Load relationships conceptually or just return raw dictionary formats
    return_data = []
    for b in bookings:
        # Reconstruct "service_ids" optionally if needed by pulling from the association
        # But for list view we usually just need basic data
        return_data.append({
            "id": b.id,
            "customer_id": b.customer_id,
            "customer": b.customer_name,
            "customer_name": b.customer_name,
            "customer_phone": b.customer_phone,
            "customer_email": b.customer_email,
            "time": b.time,
            "date": b.date.isoformat(),
            "outlet_id": b.outlet_id,
            "resource_id": b.resource_id,
            "duration": b.duration,
            "notes": b.notes,
            "custom_fields": b.custom_fields,
            "amount": b.amount,
            "status": b.status,
            "source": b.source,
            "company_id": b.company_id,
            "created_at": b.created_at.isoformat() if b.created_at else None
        })
        
    return return_data


@router.post("")
async def create_booking(
    booking_input: BookingCreate, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    if current_user.role in ["Manager", "User"]:
        enforce_outlet_access(current_user, booking_input.outlet_id)
        
    # Check plan limits for booking creation (monthly limit)
    if current_user.company_id:
        company_stmt = select(models_pg.Company).where(models_pg.Company.id == current_user.company_id)
        company = (await db_session.execute(company_stmt)).scalar_one_or_none()
        
        if company:
            plan = company.plan or "free"
            plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"])
            booking_limit = plan_config["limits"].get("bookings_per_month", 50)
            
            # -1 means unlimited
            if booking_limit != -1:
                # Count bookings this month
                first_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                
                count_stmt = select(func.count(models_pg.Booking.id)).where(
                    models_pg.Booking.company_id == current_user.company_id,
                    models_pg.Booking.created_at >= first_of_month
                )
                current_month_bookings = (await db_session.execute(count_stmt)).scalar() or 0
                
                if current_month_bookings >= booking_limit:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Monthly booking limit reached. Your {plan.capitalize()} plan allows {booking_limit} bookings/month. Please upgrade your plan."
                    )
    
    booking_id = str(uuid.uuid4())
    
    # Use today's date if not provided
    from datetime import datetime as dt
    booking_date = dt.fromisoformat(booking_input.date).date() if booking_input.date and len(booking_input.date) > 10 else (
        dt.strptime(booking_input.date, "%Y-%m-%d").date() if booking_input.date else datetime.now(timezone.utc).date()
    )
    
    # Handle service_ids array
    service_ids = booking_input.service_ids or ([booking_input.service_id] if booking_input.service_id else [])
    
    # Handle Customer Logic
    customer_id = booking_input.customer_id
    from sqlalchemy.dialects.postgresql import JSONB
    
    # If no customer_id but we have at least a customer name
    if not customer_id and booking_input.customer:
        customer_stmt = select(models_pg.Customer).where(models_pg.Customer.company_id == current_user.company_id)
        
        or_conditions = []
        if booking_input.customer_email:
            or_conditions.append(models_pg.Customer.email == booking_input.customer_email)
        if booking_input.customer_phone:
            or_conditions.append(models_pg.Customer.phone == booking_input.customer_phone)
            
        existing_customer = None
        if or_conditions:
            customer_stmt = customer_stmt.where(or_(*or_conditions))
            existing_customer = (await db_session.execute(customer_stmt)).scalars().first()
            
        if existing_customer:
            customer_id = existing_customer.id
        else:
            # Create new customer. Name is guaranteed as it's required in BookingCreate.
            customer_id = str(uuid.uuid4())
            new_customer = models_pg.Customer(
                id=customer_id,
                name=booking_input.customer,
                email=booking_input.customer_email,
                phone=booking_input.customer_phone,
                notes="",
                custom_fields={},
                company_id=current_user.company_id,
                total_revenue=0.0,
                total_bookings=0
            )
            db_session.add(new_customer)
            await db_session.flush()

    new_booking = models_pg.Booking(
        id=booking_id,
        customer_id=customer_id,
        customer_name=booking_input.customer,
        customer_phone=booking_input.customer_phone,
        customer_email=booking_input.customer_email,
        time=booking_input.time,
        date=booking_date,
        outlet_id=booking_input.outlet_id,
        resource_id=booking_input.resource_id,
        duration=booking_input.duration,
        notes=booking_input.notes,
        custom_fields=booking_input.custom_fields or {},
        amount=float(booking_input.amount),
        status="Pending",
        source="app",
        company_id=current_user.company_id,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(new_booking)
    
    # Associate services
    if service_ids:
        # simple association inserting (requires native executing text or building objects if mapped)
        # assuming basic association object mappings or direct inserts
        # Since we just used simple Table mappings for Many-to-Many
        for s_id in service_ids:
            # You might need to add to the booking.services collection if mapped properly
            svc = (await db_session.execute(select(models_pg.Service).where(models_pg.Service.id == s_id))).scalar_one_or_none()
            if svc:
                new_booking.services.append(svc)
    
    # Create transaction if amount > 0
    if booking_input.amount > 0:
        commission = float(booking_input.amount * 0.15)
        partner_share = float(booking_input.amount) - commission
        
        new_transaction = models_pg.Transaction(
            id=str(uuid.uuid4()),
            booking_id=booking_id,
            outlet_id=booking_input.outlet_id,
            company_id=current_user.company_id,
            gross=float(booking_input.amount),
            commission=commission,
            partner_share=partner_share,
            status="Settled",
            type="sale",
            date=datetime.now(timezone.utc)
        )
        db_session.add(new_transaction)
        
    await db_session.commit()
    
    return {
        "id": new_booking.id,
        "customer_id": new_booking.customer_id,
        "customer": new_booking.customer_name,
        "customer_name": new_booking.customer_name,
        "customer_phone": new_booking.customer_phone,
        "customer_email": new_booking.customer_email,
        "time": new_booking.time,
        "date": new_booking.date.isoformat(),
        "service_ids": service_ids,
        "outlet_id": new_booking.outlet_id,
        "resource_id": new_booking.resource_id,
        "duration": new_booking.duration,
        "notes": new_booking.notes,
        "custom_fields": new_booking.custom_fields,
        "amount": new_booking.amount,
        "status": new_booking.status,
        "source": new_booking.source,
        "company_id": new_booking.company_id,
        "created_at": new_booking.created_at.isoformat() if new_booking.created_at else None
    }


@router.put("/{booking_id}")
async def update_booking(
    booking_id: str, 
    status: str, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Booking).where(models_pg.Booking.id == booking_id)
    booking = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    # Security Check
    if current_user.role in ["Manager", "User"]:
        enforce_outlet_access(current_user, booking.outlet_id)
        
    booking.status = status
    await db_session.commit()
    
    return {
        "id": booking.id,
        "status": booking.status,
        "customer_name": booking.customer_name,
        "time": booking.time,
        "date": booking.date.isoformat(),
        "outlet_id": booking.outlet_id
    }


@router.put("/{booking_id}/reschedule")
async def reschedule_booking(
    booking_id: str, 
    reschedule: BookingReschedule, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    update_fields = {"time": reschedule.time}
    if reschedule.date:
        from datetime import datetime as dt
        update_fields["date"] = dt.strptime(reschedule.date, "%Y-%m-%d").date()
    if reschedule.resource_id:
        update_fields["resource_id"] = reschedule.resource_id
        
    stmt = update(models_pg.Booking).where(models_pg.Booking.id == booking_id).values(**update_fields)
    res = await db_session.execute(stmt)
    
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    await db_session.commit()
    
    # fetch updated
    sel_stmt = select(models_pg.Booking).where(models_pg.Booking.id == booking_id)
    booking = (await db_session.execute(sel_stmt)).scalar_one()
    
    return {
        "id": booking.id,
        "time": booking.time,
        "date": booking.date.isoformat(),
        "resource_id": booking.resource_id
    }


@router.get("/resource-bookings/{outlet_id}")
async def get_resource_bookings(
    outlet_id: str, 
    date: str = None, 
    start_date: str = None,
    end_date: str = None,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get bookings for a specific outlet, optionally filtered by date or date range.
    Used by the Slot Manager calendar view."""
    
    if current_user.role in ["Manager", "User"]:
        enforce_outlet_access(current_user, outlet_id)
        
    stmt = select(models_pg.Booking).where(models_pg.Booking.outlet_id == outlet_id)
    
    from datetime import datetime as dt
    if date:
        # Single date filter (Day View)
        date_obj = dt.strptime(date, "%Y-%m-%d").date()
        stmt = stmt.where(models_pg.Booking.date == date_obj)
    elif start_date and end_date:
        # Date range filter (Week/Month View)
        s_date_obj = dt.strptime(start_date, "%Y-%m-%d").date()
        e_date_obj = dt.strptime(end_date, "%Y-%m-%d").date()
        stmt = stmt.where(models_pg.Booking.date >= s_date_obj, models_pg.Booking.date <= e_date_obj)
    
    # Sort by date and then time
    stmt = stmt.order_by(models_pg.Booking.date, models_pg.Booking.time)
    
    res = await db_session.execute(stmt)
    bookings = res.scalars().all()
    
    return [
        {
            "id": b.id,
            "customer": b.customer_name,
            "customer_name": b.customer_name,
            "time": b.time,
            "date": b.date.isoformat(),
            "outlet_id": b.outlet_id,
            "resource_id": b.resource_id,
            "duration": b.duration,
            "status": b.status
        } for b in bookings
    ]


class BookingItemAdd(BaseModel):
    product_id: str
    quantity: int = 1


class BookingItemsUpdate(BaseModel):
    items: List[BookingItemAdd]


@router.get("/{booking_id}")
async def get_booking(
    booking_id: str, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Get a single booking by ID"""
    stmt = select(models_pg.Booking).where(models_pg.Booking.id == booking_id)
    booking = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
        
    return {
        "id": booking.id,
        "customer_id": booking.customer_id,
        "customer": booking.customer_name,
        "customer_name": booking.customer_name,
        "customer_phone": booking.customer_phone,
        "customer_email": booking.customer_email,
        "time": booking.time,
        "date": booking.date.isoformat(),
        "outlet_id": booking.outlet_id,
        "resource_id": booking.resource_id,
        "duration": booking.duration,
        "notes": booking.notes,
        "custom_fields": booking.custom_fields,
        "amount": booking.amount,
        "status": booking.status,
        "company_id": booking.company_id,
        "created_at": booking.created_at.isoformat() if booking.created_at else None,
        "items": booking.items,
        "items_total": booking.items_total,
        "service_amount": booking.service_amount,
        "total_amount": booking.total_amount
    }


@router.post("/{booking_id}/items")
async def add_items_to_booking(
    booking_id: str, 
    items_data: BookingItemsUpdate,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Add products/inventory items to a booking"""
    
    # Get the booking
    b_stmt = select(models_pg.Booking).where(models_pg.Booking.id == booking_id)
    booking = (await db_session.execute(b_stmt)).scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Get existing items or empty list
    existing_items = booking.items or []
    
    # Process new items
    new_items = []
    items_total = 0.0
    
    for item in items_data.items:
        # Get product details
        p_stmt = select(models_pg.Product).where(
            models_pg.Product.id == item.product_id,
            models_pg.Product.company_id == current_user.company_id
        )
        product = (await db_session.execute(p_stmt)).scalar_one_or_none()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        # Check stock
        if (product.stock_quantity or 0) < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {product.name}. Available: {product.stock_quantity or 0}"
            )
        
        subtotal = float(product.price) * item.quantity
        new_items.append({
            "product_id": item.product_id,
            "name": product.name,
            "sku": product.sku or "",
            "quantity": item.quantity,
            "price": float(product.price),
            "cost": float(product.cost or 0),
            "subtotal": subtotal
        })
        items_total += subtotal
        
        # Deduct stock
        new_quantity = (product.stock_quantity or 0) - item.quantity
        product.stock_quantity = new_quantity
        
        # Log inventory action
        inv_log = models_pg.InventoryLog(
            id=str(uuid.uuid4()),
            product_id=item.product_id,
            action="sale",
            quantity=-item.quantity,
            new_quantity=new_quantity,
            reason="booking",
            reference_id=booking_id,
            user_id=current_user.id,
            company_id=current_user.company_id,
            created_at=datetime.now(timezone.utc)
        )
        db_session.add(inv_log)
        
        # Check for low stock alert
        if new_quantity <= (product.reorder_level or 10):
            al_stmt = select(models_pg.InventoryAlert).where(
                models_pg.InventoryAlert.product_id == item.product_id,
                models_pg.InventoryAlert.resolved == False
            )
            existing_alert = (await db_session.execute(al_stmt)).scalar_one_or_none()
            
            if not existing_alert:
                new_alert = models_pg.InventoryAlert(
                    id=str(uuid.uuid4()),
                    type="low_stock",
                    product_id=item.product_id,
                    product_name=product.name,
                    current_quantity=new_quantity,
                    reorder_level=product.reorder_level or 10,
                    outlet_id=product.outlet_id,
                    company_id=current_user.company_id,
                    resolved=False,
                    created_at=datetime.now(timezone.utc)
                )
                db_session.add(new_alert)
    
    # Merge with existing items
    all_items = existing_items + new_items
    all_items_total = float(sum(item["subtotal"] for item in all_items))
    
    # Calculate new totals
    service_amount = float(booking.service_amount or booking.amount or 0)
    total_amount = service_amount + all_items_total
    
    # Update booking
    booking.items = all_items
    booking.items_total = all_items_total
    booking.service_amount = service_amount
    booking.total_amount = total_amount
    
    # Update transaction
    product_cost = sum(item.get("cost", 0) * item["quantity"] for item in all_items)
    
    t_stmt = select(models_pg.Transaction).where(models_pg.Transaction.booking_id == booking_id)
    transaction = (await db_session.execute(t_stmt)).scalar_one_or_none()
    
    if transaction:
        transaction.gross = float(total_amount)
        transaction.product_revenue = float(all_items_total)
        transaction.product_cost = float(product_cost)
        transaction.service_revenue = float(service_amount)
    
    await db_session.commit()
    
    # return fresh mapping
    await db_session.refresh(booking)
    
    return {
        "id": booking.id,
        "customer_id": booking.customer_id,
        "customer": booking.customer_name,
        "customer_name": booking.customer_name,
        "customer_phone": booking.customer_phone,
        "customer_email": booking.customer_email,
        "time": booking.time,
        "date": booking.date.isoformat(),
        "outlet_id": booking.outlet_id,
        "resource_id": booking.resource_id,
        "duration": booking.duration,
        "notes": booking.notes,
        "custom_fields": booking.custom_fields,
        "amount": booking.amount,
        "status": booking.status,
        "company_id": booking.company_id,
        "created_at": booking.created_at.isoformat() if booking.created_at else None,
        "items": booking.items,
        "items_total": booking.items_total,
        "service_amount": booking.service_amount,
        "total_amount": booking.total_amount
    }


@router.delete("/{booking_id}/items/{product_id}")
async def remove_item_from_booking(
    booking_id: str,
    product_id: str,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Remove a product from a booking and restore stock"""

    # Get the booking
    b_stmt = select(models_pg.Booking).where(models_pg.Booking.id == booking_id)
    booking = (await db_session.execute(b_stmt)).scalar_one_or_none()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    items = booking.items or []
    item_to_remove = None
    
    for item in items:
        if item.get("product_id") == product_id:
            item_to_remove = item
            break
    
    if not item_to_remove:
        raise HTTPException(status_code=404, detail="Item not found in booking")
    
    # Restore stock
    p_stmt = select(models_pg.Product).where(models_pg.Product.id == product_id)
    product = (await db_session.execute(p_stmt)).scalar_one_or_none()
    
    if product:
        new_quantity = (product.stock_quantity or 0) + item_to_remove["quantity"]
        product.stock_quantity = new_quantity
        
        # Log inventory action
        inv_log = models_pg.InventoryLog(
            id=str(uuid.uuid4()),
            product_id=product_id,
            action="return",
            quantity=item_to_remove["quantity"],
            new_quantity=new_quantity,
            reason="booking_item_removed",
            reference_id=booking_id,
            user_id=current_user.id,
            company_id=current_user.company_id,
            created_at=datetime.now(timezone.utc)
        )
        db_session.add(inv_log)
    
    # Remove item from booking
    new_items = [i for i in items if i.get("product_id") != product_id]
    items_total = float(sum(item.get("subtotal", 0) for item in new_items))
    service_amount = float(booking.service_amount or booking.amount or 0)
    total_amount = service_amount + items_total
    
    booking.items = new_items
    booking.items_total = items_total
    booking.total_amount = total_amount
    
    # Update transaction
    product_cost = sum(item.get("cost", 0) * item.get("quantity", 0) for item in new_items)
    
    t_stmt = select(models_pg.Transaction).where(models_pg.Transaction.booking_id == booking_id)
    transaction = (await db_session.execute(t_stmt)).scalar_one_or_none()
    
    if transaction:
        transaction.gross = float(total_amount)
        transaction.product_revenue = float(items_total)
        transaction.product_cost = float(product_cost)
        
    await db_session.commit()
    await db_session.refresh(booking)
    
    return {
        "id": booking.id,
        "items": booking.items,
        "items_total": booking.items_total,
        "service_amount": booking.service_amount,
        "total_amount": booking.total_amount
    }
