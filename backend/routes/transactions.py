from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc
import models_pg

from .dependencies import get_current_user, User, get_db

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("")
async def get_transactions(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Transaction)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Transaction.company_id == current_user.company_id)
        
    stmt = stmt.order_by(models_pg.Transaction.date.desc())
    res = await db_session.execute(stmt)
    transactions = res.scalars().all()
    
    return [
        {
            "id": t.id,
            "booking_id": t.booking_id,
            "outlet_id": t.outlet_id,
            "company_id": t.company_id,
            "gross": t.gross,
            "commission": t.commission,
            "partner_share": t.partner_share,
            "status": t.status,
            "type": t.type,
            "date": t.date.isoformat() if t.date else None,
            "payment_method": t.payment_method,
            "items": t.items,
            "customer_id": t.customer_id,
            "created_by": t.created_by,
            "created_at": t.created_at.isoformat() if t.created_at else None
        } for t in transactions
    ]


@router.get("/booking/{booking_id}")
async def get_transaction_by_booking(
    booking_id: str, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.Transaction).where(models_pg.Transaction.booking_id == booking_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.Transaction.company_id == current_user.company_id)
        
    t = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not t:
        return None
        
    return {
        "id": t.id,
        "booking_id": t.booking_id,
        "outlet_id": t.outlet_id,
        "company_id": t.company_id,
        "gross": t.gross,
        "commission": t.commission,
        "partner_share": t.partner_share,
        "status": t.status,
        "type": t.type,
        "date": t.date.isoformat() if t.date else None,
        "payment_method": t.payment_method,
        "items": t.items,
        "customer_id": t.customer_id,
        "created_by": t.created_by,
        "created_at": t.created_at.isoformat() if t.created_at else None
    }

class POSCartItem(BaseModel):
    product_id: str
    quantity: int
    price: float  # Snapshot of price at checkout time

class POSCheckoutRequest(BaseModel):
    items: List[POSCartItem]
    payment_method: str  # "cash", "card"
    outlet_id: Optional[str] = None
    customer_id: Optional[str] = None

@router.post("/pos")
async def process_pos_checkout(
    request: POSCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Process a PoS checkout, deduct stock, and create a transaction"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    company_id = current_user.company_id
    
    # Calculate totals and verify stock
    total_amount = 0.0
    products_to_update = []
    
    # First pass: verification and total calculation
    for item in request.items:
        p_stmt = select(models_pg.Product).where(
            models_pg.Product.id == item.product_id,
            models_pg.Product.company_id == company_id
        )
        product = (await db_session.execute(p_stmt)).scalar_one_or_none()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product not found: {item.product_id}")
            
        current_stock = product.stock_quantity or 0
        if current_stock < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {product.name}. Available: {current_stock}"
            )
            
        total_amount += (item.price * item.quantity)
        products_to_update.append((product, item.quantity))
        
    # Second pass: execute deductions
    for product, qty in products_to_update:
        new_quantity = (product.stock_quantity or 0) - qty
        product.stock_quantity = new_quantity
        
        # Log inventory action
        log_entry = models_pg.InventoryLog(
            id=str(uuid.uuid4()),
            product_id=product.id,
            action="sale",
            quantity=-qty,
            new_quantity=new_quantity,
            reason="pos_checkout",
            user_id=current_user.id,
            company_id=company_id,
            created_at=datetime.now(timezone.utc)
        )
        db_session.add(log_entry)
        
        # Check low stock alerting
        if new_quantity <= (product.reorder_level or 10):
            al_stmt = select(models_pg.InventoryAlert).where(
                models_pg.InventoryAlert.product_id == product.id,
                models_pg.InventoryAlert.resolved == False
            )
            existing_alert = (await db_session.execute(al_stmt)).scalar_one_or_none()
            
            if not existing_alert:
                alert = models_pg.InventoryAlert(
                    id=str(uuid.uuid4()),
                    type="low_stock",
                    product_id=product.id,
                    product_name=product.name,
                    current_quantity=new_quantity,
                    reorder_level=product.reorder_level or 10,
                    outlet_id=product.outlet_id,
                    company_id=company_id,
                    resolved=False,
                    created_at=datetime.now(timezone.utc)
                )
                db_session.add(alert)

    # Create master transaction record
    transaction_id = str(uuid.uuid4())
    transaction = models_pg.Transaction(
        id=transaction_id,
        type="pos_sale",
        total_amount=float(total_amount),
        gross=float(total_amount),
        commission=0.0,
        partner_share=float(total_amount),
        payment_method=request.payment_method,
        items=[item.dict() for item in request.items],
        outlet_id=request.outlet_id,
        customer_id=request.customer_id,
        status="Completed",  # Assume successful for Cash/Card terminals initially
        company_id=company_id,
        created_by=current_user.id,
        date=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc)
    )
    
    db_session.add(transaction)
    await db_session.commit()
    
    return {
        "message": "Checkout successful", 
        "transaction": {
            "id": transaction.id,
            "type": transaction.type,
            "gross": transaction.gross,
            "total_amount": transaction.total_amount,
            "status": transaction.status
        }
    }
