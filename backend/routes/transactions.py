from fastapi import APIRouter, Depends

from .dependencies import transactions_collection, get_current_user, User

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
