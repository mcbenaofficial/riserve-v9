from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from .dependencies import (
    users_collection, hash_password, verify_password, 
    create_access_token, get_current_user, User
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: str = "Admin"
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    user: User


@router.post("/register", response_model=Token)
async def register(user_input: UserCreate):
    existing = await users_collection.find_one({"email": user_input.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_input.email,
        "name": user_input.name,
        "password_hash": hash_password(user_input.password),
        "role": user_input.role,
        "phone": user_input.phone,
        "status": "Active",
        "outlets": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await users_collection.insert_one(user_doc)
    
    user = User(
        id=user_id,
        email=user_input.email,
        name=user_input.name,
        role=user_input.role,
        phone=user_input.phone,
        status="Active",
        company_id=None # Newly registered users won't have it yet unless explicitly passed, but better to structure it uniformly
    )
    
    access_token = create_access_token({"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await users_collection.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    user = User(
        id=user_doc["id"],
        email=user_doc["email"],
        name=user_doc.get("name", user_doc["email"].split('@')[0]),
        role=user_doc.get("role", "Admin"),
        status=user_doc.get("status", "Active"),
        company_id=user_doc.get("company_id")
    )
    
    # Update last login
    await users_collection.update_one(
        {"id": user_doc["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    access_token = create_access_token({"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)


@router.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.put("/profile")
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update current user's profile"""
    update_doc = {}
    
    if profile_data.name:
        update_doc["name"] = profile_data.name
    if profile_data.phone is not None:
        update_doc["phone"] = profile_data.phone
    
    if update_doc:
        update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()
        await users_collection.update_one(
            {"id": current_user.id},
            {"$set": update_doc}
        )
    
    return {"message": "Profile updated successfully"}


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user)
):
    """Change current user's password"""
    # Get current user's password hash
    user_doc = await users_collection.find_one({"id": current_user.id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(password_data.current_password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    await users_collection.update_one(
        {"id": current_user.id},
        {"$set": {
            "password_hash": hash_password(password_data.new_password),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Password changed successfully"}
