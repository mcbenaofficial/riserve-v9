from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
import models_pg

from .dependencies import (
    hash_password, verify_password, 
    create_access_token, get_current_user, User, get_db
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
async def register(user_input: UserCreate, db_session: AsyncSession = Depends(get_db)):
    # Check if email exists
    stmt = select(models_pg.User).where(models_pg.User.email == user_input.email)
    res = await db_session.execute(stmt)
    existing = res.scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    new_user = models_pg.User(
        id=user_id,
        email=user_input.email,
        name=user_input.name,
        password_hash=hash_password(user_input.password),
        role=user_input.role,
        phone=user_input.phone,
        status="Active",
        company_id=None
    )
    db_session.add(new_user)
    await db_session.commit()
    await db_session.refresh(new_user)
    
    user = User(
        id=user_id,
        email=user_input.email,
        name=user_input.name,
        role=user_input.role,
        phone=user_input.phone,
        status="Active",
        outlets=[],
        company_id=None
    )
    
    access_token = create_access_token({"sub": user.id})
    return Token(access_token=access_token, token_type="bearer", user=user)


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db_session: AsyncSession = Depends(get_db)):
    stmt = select(models_pg.User).where(models_pg.User.email == credentials.email)
    res = await db_session.execute(stmt)
    user_db = res.scalar_one_or_none()
    
    if not user_db:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not verify_password(credentials.password, user_db.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Get outlets mapping
    outlets_stmt = select(models_pg.user_outlets.c.outlet_id).where(models_pg.user_outlets.c.user_id == user_db.id)
    outlets_res = await db_session.execute(outlets_stmt)
    outlets_list = [row[0] for row in outlets_res.all()]
    
    user = User(
        id=user_db.id,
        email=user_db.email,
        name=user_db.name,
        role=user_db.role,
        status=user_db.status,
        outlets=outlets_list,
        company_id=user_db.company_id
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
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Update current user's profile"""
    update_doc = {}
    
    if profile_data.name:
        update_doc["name"] = profile_data.name
    if profile_data.phone is not None:
        update_doc["phone"] = profile_data.phone
    
    if update_doc:
        stmt = (
            update(models_pg.User)
            .where(models_pg.User.id == current_user.id)
            .values(**update_doc)
        )
        await db_session.execute(stmt)
        await db_session.commit()
    
    return {"message": "Profile updated successfully"}


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Change current user's password"""
    # Get current user's password hash
    stmt = select(models_pg.User).where(models_pg.User.id == current_user.id)
    res = await db_session.execute(stmt)
    user_db = res.scalar_one_or_none()
    
    if not user_db:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not verify_password(password_data.current_password, user_db.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    # Update password
    user_db.password_hash = hash_password(password_data.new_password)
    await db_session.commit()
    
    return {"message": "Password changed successfully"}
