from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from .dependencies import users_collection, hash_password, get_current_user, User

router = APIRouter(prefix="/users", tags=["Users"])


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "User"
    phone: Optional[str] = None
    outlets: Optional[List[str]] = []


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None
    outlets: Optional[List[str]] = None


@router.get("")
async def get_users(current_user: User = Depends(get_current_user)):
    # Filter by company_id for data isolation
    query = {}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    users = await users_collection.find(query, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@router.post("")
async def create_user(user_input: UserCreate, current_user: User = Depends(get_current_user)):
    # Only Admin and SuperAdmin can create users
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can create users")
    
    existing = await users_collection.find_one({"email": user_input.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_doc = {
        "id": str(uuid.uuid4()),
        "company_id": current_user.company_id,  # Associate with company
        "email": user_input.email,
        "name": user_input.name,
        "password_hash": hash_password(user_input.password),
        "role": user_input.role,
        "phone": user_input.phone,
        "status": "Active",
        "outlets": user_input.outlets or [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await users_collection.insert_one(user_doc)
    
    # Return without password hash
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    return user_doc


@router.get("/{user_id}")
async def get_user(user_id: str, current_user: User = Depends(get_current_user)):
    # Verify user belongs to same company
    query = {"id": user_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    user = await users_collection.find_one(query, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}")
async def update_user(user_id: str, user_input: UserUpdate, current_user: User = Depends(get_current_user)):
    # Only Admin and SuperAdmin can update users
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can update users")
    
    # Verify user belongs to same company
    query = {"id": user_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    update_fields = {}
    if user_input.name is not None:
        update_fields["name"] = user_input.name
    if user_input.role is not None:
        update_fields["role"] = user_input.role
    if user_input.phone is not None:
        update_fields["phone"] = user_input.phone
    if user_input.status is not None:
        update_fields["status"] = user_input.status
    if user_input.outlets is not None:
        update_fields["outlets"] = user_input.outlets
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    
    result = await users_collection.update_one(query, {"$set": update_fields})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await users_collection.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: User = Depends(get_current_user)):
    # Only Admin and SuperAdmin can delete users
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    
    # Prevent self-deletion
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    # Verify user belongs to same company
    query = {"id": user_id}
    if current_user.role != "SuperAdmin":
        query["company_id"] = current_user.company_id
    
    result = await users_collection.delete_one(query)
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}
