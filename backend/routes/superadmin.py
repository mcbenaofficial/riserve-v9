from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_, update, delete
from sqlalchemy.orm import selectinload

import models_pg
from .dependencies import (
    get_super_admin, User, hash_password, create_access_token,
    log_audit, SUBSCRIPTION_PLANS, get_db
)

router = APIRouter(prefix="/super-admin", tags=["Super Admin"])


# ============ Models ============

class CompanyCreate(BaseModel):
    name: str
    business_type: str
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    plan: str = "trial"
    admin_name: str
    admin_email: EmailStr
    admin_password: str
    is_booking_enabled: bool = True
    is_retail_enabled: bool = False
    is_workplace_enabled: bool = False


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    plan: Optional[str] = None
    status: Optional[str] = None
    enabled_features: Optional[List[str]] = None
    is_booking_enabled: Optional[bool] = None
    is_retail_enabled: Optional[bool] = None
    is_workplace_enabled: Optional[bool] = None


class PlanChange(BaseModel):
    plan: str
    custom_limits: Optional[dict] = None


# ============ Dashboard ============

@router.get("/dashboard")
async def get_super_admin_dashboard(
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get overview statistics for super admin dashboard"""
    
    # Get counts
    total_companies = (await db.execute(select(func.count(models_pg.Company.id)))).scalar() or 0
    active_companies = (await db.execute(select(func.count(models_pg.Company.id)).where(models_pg.Company.status == "active"))).scalar() or 0
    trial_companies = (await db.execute(select(func.count(models_pg.Company.id)).where(models_pg.Company.plan == "trial"))).scalar() or 0
    
    total_users = (await db.execute(select(func.count(models_pg.User.id)).where(models_pg.User.role != "SuperAdmin"))).scalar() or 0
    total_bookings = (await db.execute(select(func.count(models_pg.Booking.id)))).scalar() or 0
    
    # Get companies by plan
    plan_distribution = {}
    for plan in SUBSCRIPTION_PLANS.keys():
        count = (await db.execute(select(func.count(models_pg.Company.id)).where(models_pg.Company.plan == plan))).scalar() or 0
        plan_distribution[plan] = count
    
    # Recent signups (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_signups = (await db.execute(
        select(func.count(models_pg.Company.id)).where(models_pg.Company.created_at >= thirty_days_ago)
    )).scalar() or 0
    
    # Recent activity
    recent_logs_stmt = select(models_pg.AuditLog).order_by(desc(models_pg.AuditLog.timestamp)).limit(10)
    recent_logs_res = (await db.execute(recent_logs_stmt)).scalars().all()
    
    recent_logs = [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "company_id": log.company_id,
            "details": log.details,
            "ip_address": log.ip_address
        } for log in recent_logs_res
    ]
    
    return {
        "companies": {
            "total": total_companies,
            "active": active_companies,
            "trial": trial_companies
        },
        "users": {
            "total": total_users
        },
        "bookings": {
            "total": total_bookings
        },
        "plan_distribution": plan_distribution,
        "recent_signups": recent_signups,
        "recent_activity": recent_logs
    }


# ============ Company Management ============

@router.get("/companies")
async def list_companies(
    status: Optional[str] = None,
    plan: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all companies with optional filters"""
    stmt = select(models_pg.Company)
    
    if status:
        stmt = stmt.where(models_pg.Company.status == status)
    if plan:
        stmt = stmt.where(models_pg.Company.plan == plan)
    if search:
        stmt = stmt.where(or_(
            models_pg.Company.name.ilike(f"%{search}%"),
            models_pg.Company.email.ilike(f"%{search}%")
        ))
    
    stmt = stmt.order_by(desc(models_pg.Company.created_at))
    companies_res = (await db.execute(stmt)).scalars().all()
    
    result = []
    for company in companies_res:
        user_count = (await db.execute(select(func.count(models_pg.User.id)).where(models_pg.User.company_id == company.id))).scalar() or 0
        booking_count = (await db.execute(select(func.count(models_pg.Booking.id)).where(models_pg.Booking.company_id == company.id))).scalar() or 0
        
        result.append({
            "id": company.id,
            "name": company.name,
            "email": company.email,
            "plan": company.plan,
            "status": company.status,
            "created_at": company.created_at.isoformat() if company.created_at else None,
            "user_count": user_count,
            "booking_count": booking_count
        })
    
    return result


@router.get("/companies/{company_id}")
async def get_company(
    company_id: str, 
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get detailed company information"""
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get additional stats
    users_count = (await db.execute(select(func.count(models_pg.User.id)).where(models_pg.User.company_id == company_id))).scalar() or 0
    outlets_count = (await db_session.execute(select(func.count(models_pg.Outlet.id)).where(models_pg.Outlet.company_id == company_id))).scalar() or 0
    bookings_count = (await db_session.execute(select(func.count(models_pg.Booking.id)).where(models_pg.Booking.company_id == company_id))).scalar() or 0
    
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month_bookings = (await db_session.execute(
        select(func.count(models_pg.Booking.id)).where(
            models_pg.Booking.company_id == company_id,
            models_pg.Booking.created_at >= month_start
        )
    )).scalar() or 0
    
    # Get users
    users_stmt = select(models_pg.User).where(models_pg.User.company_id == company_id)
    users_res = (await db.execute(users_stmt)).scalars().all()
    
    return {
        "id": company.id,
        "name": company.name,
        "business_type": company.business_type,
        "email": company.email,
        "phone": company.phone,
        "address": company.address,
        "plan": company.plan,
        "status": company.status,
        "created_at": company.created_at.isoformat() if company.created_at else None,
        "stats": {
            "users": users_count,
            "outlets": outlets_count,
            "bookings": bookings_count,
            "bookings_this_month": month_bookings
        },
        "plan_info": SUBSCRIPTION_PLANS.get(company.plan or "free", SUBSCRIPTION_PLANS["free"]),
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "name": u.name,
                "role": u.role,
                "status": u.status,
                "created_at": u.created_at.isoformat() if u.created_at else None
            } for u in users_res
        ]
    }


@router.post("/companies")
async def create_company(
    company_data: CompanyCreate,
    request: Request,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new company with admin user"""
    
    # Check if company email already exists
    existing_company = (await db.execute(select(models_pg.Company).where(models_pg.Company.email == company_data.email))).scalar_one_or_none()
    if existing_company:
        raise HTTPException(status_code=400, detail="Company with this email already exists")
    
    # Check if admin email already exists
    existing_user = (await db.execute(select(models_pg.User).where(models_pg.User.email == company_data.admin_email))).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    company_id = str(uuid.uuid4())
    plan = company_data.plan
    plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["trial"])
    
    # Calculate trial end if applicable
    trial_start = None
    trial_end = None
    if plan == "trial":
        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=plan_config.get("duration_days", 30))
    
    new_company = models_pg.Company(
        id=company_id,
        name=company_data.name,
        business_type=company_data.business_type,
        email=company_data.email,
        phone=company_data.phone,
        address=company_data.address,
        plan=plan,
        plan_limits=plan_config.get("limits", {}),
        trial_start=trial_start,
        trial_end=trial_end,
        status="active",
        is_booking_enabled=company_data.is_booking_enabled,
        is_retail_enabled=company_data.is_retail_enabled,
        is_workplace_enabled=company_data.is_workplace_enabled,
        created_by=current_user.id
    )
    db.add(new_company)
    
    # Create admin user for this company
    admin_user = models_pg.User(
        id=str(uuid.uuid4()),
        email=company_data.admin_email,
        name=company_data.admin_name,
        password_hash=hash_password(company_data.admin_password),
        role="Admin",
        company_id=company_id,
        status="Active"
    )
    db.add(admin_user)
    
    await db.commit()
    
    # Log audit
    await log_audit(
        action="create",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        db_session=db,
        details={"company_name": company_data.name, "plan": plan},
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Company created successfully",
        "company_id": company_id,
        "admin_email": company_data.admin_email
    }


@router.put("/companies/{company_id}")
async def update_company(
    company_id: str,
    update_data: CompanyUpdate,
    request: Request,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update company details"""
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    update_fields = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if update_fields:
        for key, value in update_fields.items():
            setattr(company, key, value)
        
        await db.commit()
        
        await log_audit(
            action="update",
            entity_type="company",
            entity_id=company_id,
            user_id=current_user.id,
            user_email=current_user.email,
            db_session=db,
            details=update_fields,
            ip_address=request.client.host if request.client else None
        )
    
    return {"message": "Company updated successfully"}


@router.put("/companies/{company_id}/plan")
async def change_company_plan(
    company_id: str,
    plan_data: PlanChange,
    request: Request,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Change company subscription plan"""
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if plan_data.plan not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan_config = SUBSCRIPTION_PLANS[plan_data.plan]
    limits = plan_data.custom_limits or plan_config["limits"]
    
    old_plan = company.plan
    company.plan = plan_data.plan
    company.plan_limits = limits
    
    # If changing to trial, set trial dates
    if plan_data.plan == "trial":
        company.trial_start = datetime.now(timezone.utc)
        company.trial_end = datetime.now(timezone.utc) + timedelta(days=30)
    
    await db.commit()
    
    await log_audit(
        action="plan_change",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        db_session=db,
        details={"old_plan": old_plan, "new_plan": plan_data.plan},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Plan changed to {plan_data.plan}"}


@router.post("/companies/{company_id}/suspend")
async def suspend_company(
    company_id: str,
    request: Request,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Suspend a company account"""
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company.status = "suspended"
    await db.commit()
    
    await log_audit(
        action="suspend",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        db_session=db,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Company suspended"}


@router.post("/companies/{company_id}/activate")
async def activate_company(
    company_id: str,
    request: Request,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Reactivate a suspended company"""
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    company.status = "active"
    await db.commit()
    
    await log_audit(
        action="activate",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        db_session=db,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Company activated"}


class DeactivateReason(BaseModel):
    reason: Optional[str] = None


@router.post("/companies/{company_id}/deactivate")
async def deactivate_company(
    company_id: str,
    reason_data: DeactivateReason,
    request: Request,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Deactivate a company account with 60-day data retention.
    After 60 days, the company data will be permanently deleted.
    """
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company.status == "deactivated":
        raise HTTPException(status_code=400, detail="Company is already deactivated")
    
    deactivated_at = datetime.now(timezone.utc)
    scheduled_deletion = deactivated_at + timedelta(days=60)
    
    company.status = "deactivated"
    company.deactivated_at = deactivated_at
    company.scheduled_deletion_date = scheduled_deletion
    company.deactivation_reason = reason_data.reason
    
    # Also deactivate all users in this company
    await db.execute(
        update(models_pg.User)
        .where(models_pg.User.company_id == company_id)
        .values(status="Inactive")
    )
    
    await db.commit()
    
    await log_audit(
        action="deactivate",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        db_session=db,
        details={
            "reason": reason_data.reason,
            "scheduled_deletion": scheduled_deletion.isoformat()
        },
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "message": "Company deactivated successfully",
        "deactivated_at": deactivated_at.isoformat(),
        "scheduled_deletion_date": scheduled_deletion.isoformat(),
        "data_retention_days": 60
    }


@router.post("/companies/{company_id}/reactivate")
async def reactivate_company(
    company_id: str,
    request: Request,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Reactivate a deactivated company (within 60-day retention period).
    This cancels the scheduled deletion.
    """
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company.status != "deactivated":
        raise HTTPException(status_code=400, detail="Company is not deactivated")
    
    # Check if still within retention period
    if company.scheduled_deletion_date:
        if datetime.now(timezone.utc) > company.scheduled_deletion_date:
            raise HTTPException(
                status_code=400, 
                detail="Retention period expired. Company data may have been deleted."
            )
    
    # Reactivate company
    company.status = "active"
    company.deactivated_at = None
    company.scheduled_deletion_date = None
    company.deactivation_reason = None
    
    # Reactivate all users
    await db.execute(
        update(models_pg.User)
        .where(models_pg.User.company_id == company_id)
        .values(status="Active")
    )
    
    await db.commit()
    
    await log_audit(
        action="reactivate",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        db_session=db,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Company reactivated successfully"}


# ============ Impersonation ============

@router.post("/impersonate/{company_id}")
async def impersonate_company(
    company_id: str,
    request: Request,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get a token to access a company as their admin (for support)"""
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db.execute(stmt)).scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Find the company's admin user
    admin_stmt = select(models_pg.User).where(models_pg.User.company_id == company_id, models_pg.User.role == "Admin")
    admin_user = (await db.execute(admin_stmt)).scalar_one_or_none()
    
    if not admin_user:
        raise HTTPException(status_code=404, detail="No admin user found for this company")
    
    # Create impersonation token with metadata
    token = create_access_token({
        "sub": admin_user.id,
        "impersonated_by": current_user.id,
        "impersonation": True
    })
    
    await log_audit(
        action="impersonate",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        db_session=db,
        details={"impersonated_user": admin_user.email},
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "token": token,
        "company": {
            "id": company.id,
            "name": company.name,
            "status": company.status
        },
        "user": {
            "id": admin_user.id,
            "email": admin_user.email,
            "name": admin_user.name
        }
    }


# ============ Audit Logs ============

@router.get("/audit-logs")
async def get_audit_logs(
    company_id: Optional[str] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get audit logs with filters"""
    stmt = select(models_pg.AuditLog)
    
    if company_id:
        stmt = stmt.where(models_pg.AuditLog.company_id == company_id)
    if user_id:
        stmt = stmt.where(models_pg.AuditLog.user_id == user_id)
    if action:
        stmt = stmt.where(models_pg.AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(models_pg.AuditLog.entity_type == entity_type)
    
    # Get total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    
    # Get paginated logs
    stmt = stmt.order_by(desc(models_pg.AuditLog.timestamp)).offset(offset).limit(limit)
    logs_res = (await db.execute(stmt)).scalars().all()
    
    logs = [
        {
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "user_id": log.user_id,
            "user_email": log.user_email,
            "company_id": log.company_id,
            "details": log.details,
            "ip_address": log.ip_address
        } for log in logs_res
    ]
    
    return {
        "total": total,
        "logs": logs,
        "limit": limit,
        "offset": offset
    }


# ============ User Management (All Users) ============

@router.get("/users")
async def list_all_users(
    company_id: Optional[str] = None,
    role: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_super_admin),
    db: AsyncSession = Depends(get_db)
):
    """List all users across companies"""
    stmt = select(models_pg.User).where(models_pg.User.role != "SuperAdmin")
    
    if company_id:
        stmt = stmt.where(models_pg.User.company_id == company_id)
    if role:
        stmt = stmt.where(models_pg.User.role == role)
    if search:
        stmt = stmt.where(or_(
            models_pg.User.name.ilike(f"%{search}%"),
            models_pg.User.email.ilike(f"%{search}%")
        ))
    
    # Eager load company for each user
    stmt = stmt.options(selectinload(models_pg.User.company)).order_by(desc(models_pg.User.created_at))
    users_res = (await db.execute(stmt)).scalars().all()
    
    users = [
        {
            "id": u.id,
            "email": u.email,
            "name": u.name,
            "role": u.role,
            "status": u.status,
            "company_id": u.company_id,
            "company_name": u.company.name if u.company else "Unknown",
            "created_at": u.created_at.isoformat() if u.created_at else None
        } for u in users_res
    ]
    
    return users


# ============ Plans Info ============

@router.get("/plans")
async def get_subscription_plans(current_user: User = Depends(get_super_admin)):
    """Get all available subscription plans"""
    return SUBSCRIPTION_PLANS
