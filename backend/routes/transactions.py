from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid

from .dependencies import transactions_collection, get_current_user, User, get_db

router = APIRouter(prefix="/transactions", tags=["Transactions"])


@router.get("")
async def get_transactions(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    transactions = await transactions_collection.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return transactions


@router.get("/booking/{booking_id}")
async def get_transaction_by_booking(booking_id: str, current_user: User = Depends(get_current_user)):
    query = {"booking_id": booking_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
        
    transaction = await transactions_collection.find_one(query, {"_id": 0})
    # Return null if not found (not 404, as some bookings might not have transactions)
    return transaction

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
    db = Depends(get_db)
):
    """Process a PoS checkout, deduct stock, and create a transaction"""
    if current_user.role not in ["Admin", "SuperAdmin", "Manager", "Cashier"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    company_id = current_user.company_id
    
    # Calculate totals and verify stock
    total_amount = 0.0
    products_to_update = []
    
    # First pass: verification and total calculation
    for item in request.items:
        product = await db.products.find_one({"id": item.product_id, "company_id": company_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product not found: {item.product_id}")
            
        current_stock = product.get("stock_quantity", 0)
        if current_stock < item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {product.get('name')}. Available: {current_stock}"
            )
            
        total_amount += (item.price * item.quantity)
        products_to_update.append((product, item.quantity))
        
    # Second pass: execute deductions
    for product, qty in products_to_update:
        new_quantity = product.get("stock_quantity", 0) - qty
        await db.products.update_one(
            {"id": product["id"]},
            {
                "$set": {
                    "stock_quantity": new_quantity,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Log inventory action
        log_entry = {
            "id": str(uuid.uuid4()),
            "product_id": product["id"],
            "action": "sale",
            "quantity": -qty,
            "new_quantity": new_quantity,
            "reason": "pos_checkout",
            "user_id": current_user.id,
            "company_id": company_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.inventory_log.insert_one(log_entry)
        
        # Check low stock alerting
        if new_quantity <= product.get("reorder_level", 10):
            existing_alert = await db.inventory_alerts.find_one({
                "product_id": product["id"],
                "resolved": False
            })
            if not existing_alert:
                alert = {
                    "id": str(uuid.uuid4()),
                    "type": "low_stock",
                    "product_id": product["id"],
                    "product_name": product["name"],
                    "current_quantity": new_quantity,
                    "reorder_level": product.get("reorder_level", 10),
                    "outlet_id": product.get("outlet_id"),
                    "company_id": company_id,
                    "resolved": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.inventory_alerts.insert_one(alert)

    # Create master transaction record
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "type": "pos_sale",
        "total_amount": total_amount,
        "gross": total_amount,
        "commission": 0,
        "partner_share": total_amount,
        "payment_method": request.payment_method,
        "items": [item.dict() for item in request.items],
        "outlet_id": request.outlet_id,
        "customer_id": request.customer_id,
        "status": "Completed",  # Assume successful for Cash/Card terminals initially
        "company_id": company_id,
        "created_by": current_user.id,
        "date": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(transaction)
    transaction.pop("_id", None)
    
    return {"message": "Checkout successful", "transaction": transaction}
