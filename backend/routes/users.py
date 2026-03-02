from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

import models_pg
from .dependencies import hash_password, get_current_user, User, require_manager_or_admin, enforce_outlet_access, get_db

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
async def get_users(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.User)
    
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.User.company_id == current_user.company_id)
        
    # If the user is a manager or staff user, they can only view users assigned to their outlets
    if current_user.role in ["Manager", "User"]:
        if current_user.outlets:
            # Join with user_outlets to filter
            stmt = stmt.join(models_pg.user_outlets).where(models_pg.user_outlets.c.outlet_id.in_(current_user.outlets))
        else:
            return [] # No outlets assigned, can't see any other users
            
    res = await db_session.execute(stmt)
    users = res.scalars().unique().all()
    
    results = []
    for u in users:
        # Fetch outlets
        outlets_stmt = select(models_pg.user_outlets.c.outlet_id).where(models_pg.user_outlets.c.user_id == u.id)
        outlets_res = await db_session.execute(outlets_stmt)
        outlets_list = [row[0] for row in outlets_res.all()]
        
        results.append({
            "id": u.id,
            "company_id": u.company_id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "phone": u.phone,
            "status": u.status,
            "outlets": outlets_list,
            "created_at": u.created_at
        })
        
    return results


@router.post("")
async def create_user(
    user_input: UserCreate, 
    current_user: User = Depends(require_manager_or_admin),
    db_session: AsyncSession = Depends(get_db)
):
    if current_user.role == "Manager":
        if user_input.role in ["Admin", "SuperAdmin", "Manager"]:
            raise HTTPException(status_code=403, detail="Managers can only create User roles")
            
        if user_input.outlets:
            for outlet_id in user_input.outlets:
                enforce_outlet_access(current_user, outlet_id)
        else:
             raise HTTPException(status_code=403, detail="Managers must assign an outlet")

    stmt = select(models_pg.User).where(models_pg.User.email == user_input.email)
    res = await db_session.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    new_user = models_pg.User(
        id=user_id,
        company_id=current_user.company_id,
        email=user_input.email,
        name=user_input.name,
        password_hash=hash_password(user_input.password),
        role=user_input.role,
        phone=user_input.phone,
        status="Active"
    )
    db_session.add(new_user)
    await db_session.commit()
    
    outlets_list = user_input.outlets or []
    for oid in outlets_list:
        ins_stmt = models_pg.user_outlets.insert().values(user_id=user_id, outlet_id=oid)
        await db_session.execute(ins_stmt)
    await db_session.commit()
    
    # Automatic Staff Linkage for Manager and User roles
    if user_input.role in ["Manager", "User"]:
        new_staff = models_pg.Staff(
            id=str(uuid.uuid4()),
            user_id=user_id,
            company_id=current_user.company_id,
            first_name=user_input.name.split(" ")[0],
            last_name=" ".join(user_input.name.split(" ")[1:]) if len(user_input.name.split(" ")) > 1 else "",
            email=user_input.email,
            phone=user_input.phone,
            status="active",
            department="operations" if user_input.role == "Manager" else "service",
            employment_type="full_time",
            outlet_id=outlets_list[0] if outlets_list else None, # Link to primary outlet
            skills=[],
            certifications=[]
        )
        db_session.add(new_staff)
        await db_session.commit()
    
    await db_session.refresh(new_user)
    
    return {
        "id": new_user.id,
        "company_id": new_user.company_id,
        "email": new_user.email,
        "name": new_user.name,
        "role": new_user.role,
        "phone": new_user.phone,
        "status": new_user.status,
        "outlets": outlets_list,
        "created_at": new_user.created_at
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str, 
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.User).where(models_pg.User.id == user_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.User.company_id == current_user.company_id)
    
    res = await db_session.execute(stmt)
    user = res.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    outlets_stmt = select(models_pg.user_outlets.c.outlet_id).where(models_pg.user_outlets.c.user_id == user_id)
    outlets_res = await db_session.execute(outlets_stmt)
    outlets_list = [row[0] for row in outlets_res.all()]
        
    if current_user.role == "Manager":
       has_access = False
       for outlet in current_user.outlets:
           if outlet in outlets_list:
               has_access = True
               break
       if not has_access:
           raise HTTPException(status_code=403, detail="Not authorized to view this user")
           
    return {
        "id": user.id,
        "company_id": user.company_id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
        "phone": user.phone,
        "status": user.status,
        "outlets": outlets_list,
        "created_at": user.created_at
    }


@router.put("/{user_id}")
async def update_user(
    user_id: str, 
    user_input: UserUpdate, 
    current_user: User = Depends(require_manager_or_admin),
    db_session: AsyncSession = Depends(get_db)
):
    stmt = select(models_pg.User).where(models_pg.User.id == user_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.User.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    target_user = res.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    outlets_stmt = select(models_pg.user_outlets.c.outlet_id).where(models_pg.user_outlets.c.user_id == user_id)
    outlets_res = await db_session.execute(outlets_stmt)
    outlets_list = [row[0] for row in outlets_res.all()]
        
    if current_user.role == "Manager":
       has_access = False
       for outlet in current_user.outlets:
           if outlet in outlets_list:
               has_access = True
               break
       if not has_access:
           raise HTTPException(status_code=403, detail="Not authorized to update this user")
           
       if user_input.role in ["Admin", "SuperAdmin"]:
            raise HTTPException(status_code=403, detail="Managers cannot assign Admin roles")
            
       if user_input.outlets is not None:
             for outlet_id in user_input.outlets:
                 enforce_outlet_access(current_user, outlet_id)
                 
    update_fields = {}
    if user_input.name is not None:
        update_fields["name"] = user_input.name
    if user_input.role is not None:
        update_fields["role"] = user_input.role
    if user_input.phone is not None:
        update_fields["phone"] = user_input.phone
    if user_input.status is not None:
        update_fields["status"] = user_input.status
    
    if update_fields:
        upd_stmt = update(models_pg.User).where(models_pg.User.id == user_id).values(**update_fields)
        await db_session.execute(upd_stmt)
        
    if user_input.outlets is not None:
        # Clear existing
        del_stmt = delete(models_pg.user_outlets).where(models_pg.user_outlets.c.user_id == user_id)
        await db_session.execute(del_stmt)
        # Insert new
        for oid in user_input.outlets:
            ins_stmt = models_pg.user_outlets.insert().values(user_id=user_id, outlet_id=oid)
            await db_session.execute(ins_stmt)
            
    await db_session.commit()
        
    # Also update associated staff profile
    staff_update_fields = {}
    if user_input.name is not None:
        staff_update_fields["first_name"] = user_input.name.split(" ")[0]
        staff_update_fields["last_name"] = " ".join(user_input.name.split(" ")[1:]) if len(user_input.name.split(" ")) > 1 else ""
    if user_input.phone is not None:
         staff_update_fields["phone"] = user_input.phone
    if user_input.outlets is not None and len(user_input.outlets) > 0:
         staff_update_fields["outlet_id"] = user_input.outlets[0]
         
    if staff_update_fields:
         s_upd = update(models_pg.Staff).where(models_pg.Staff.user_id == user_id).values(**staff_update_fields)
         await db_session.execute(s_upd)
         await db_session.commit()
    
    # Return fresh user
    fresh_res = await db_session.execute(select(models_pg.User).where(models_pg.User.id == user_id))
    fresh_user = fresh_res.scalar_one()
    
    fresh_outlets_res = await db_session.execute(select(models_pg.user_outlets.c.outlet_id).where(models_pg.user_outlets.c.user_id == user_id))
    fresh_outlets = [row[0] for row in fresh_outlets_res.all()]
    
    return {
        "id": fresh_user.id,
        "company_id": fresh_user.company_id,
        "email": fresh_user.email,
        "name": fresh_user.name,
        "role": fresh_user.role,
        "phone": fresh_user.phone,
        "status": fresh_user.status,
        "outlets": fresh_outlets,
        "created_at": fresh_user.created_at
    }


@router.delete("/{user_id}")
async def delete_user(
    user_id: str, 
    current_user: User = Depends(require_manager_or_admin),
    db_session: AsyncSession = Depends(get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    stmt = select(models_pg.User).where(models_pg.User.id == user_id)
    if current_user.role != "SuperAdmin":
        stmt = stmt.where(models_pg.User.company_id == current_user.company_id)
        
    res = await db_session.execute(stmt)
    target_user = res.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    outlets_stmt = select(models_pg.user_outlets.c.outlet_id).where(models_pg.user_outlets.c.user_id == user_id)
    outlets_res = await db_session.execute(outlets_stmt)
    outlets_list = [row[0] for row in outlets_res.all()]
        
    if current_user.role == "Manager":
       has_access = False
       for outlet in current_user.outlets:
           if outlet in outlets_list:
               has_access = True
               break
       if not has_access:
           raise HTTPException(status_code=403, detail="Not authorized to delete this user")
    
    del_stmt = delete(models_pg.User).where(models_pg.User.id == user_id)
    await db_session.execute(del_stmt)
    await db_session.commit()
    
    return {"message": "User deleted"}
