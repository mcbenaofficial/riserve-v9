from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid

from .dependencies import (
    companies_collection, users_collection, bookings_collection,
    outlets_collection, audit_logs_collection,
    get_super_admin, User, hash_password, create_access_token,
    log_audit, SUBSCRIPTION_PLANS, Company
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


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    business_type: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    plan: Optional[str] = None
    status: Optional[str] = None
    enabled_features: Optional[List[str]] = None


class PlanChange(BaseModel):
    plan: str
    custom_limits: Optional[dict] = None


# ============ Dashboard ============

@router.get("/dashboard")
async def get_super_admin_dashboard(current_user: User = Depends(get_super_admin)):
    """Get overview statistics for super admin dashboard"""
    
    # Get counts
    total_companies = await companies_collection.count_documents({})
    active_companies = await companies_collection.count_documents({"status": "active"})
    trial_companies = await companies_collection.count_documents({"plan": "trial"})
    
    total_users = await users_collection.count_documents({"role": {"$ne": "SuperAdmin"}})
    total_bookings = await bookings_collection.count_documents({})
    
    # Get companies by plan
    plan_distribution = {}
    for plan in SUBSCRIPTION_PLANS.keys():
        count = await companies_collection.count_documents({"plan": plan})
        plan_distribution[plan] = count
    
    # Recent signups (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    recent_signups = await companies_collection.count_documents({
        "created_at": {"$gte": thirty_days_ago.isoformat()}
    })
    
    # Recent activity
    recent_logs = await audit_logs_collection.find(
        {}, {"_id": 0}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
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
    current_user: User = Depends(get_super_admin)
):
    """List all companies with optional filters"""
    query = {}
    
    if status:
        query["status"] = status
    if plan:
        query["plan"] = plan
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    companies = await companies_collection.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Add user count and booking count for each company
    for company in companies:
        company["user_count"] = await users_collection.count_documents({"company_id": company["id"]})
        company["booking_count"] = await bookings_collection.count_documents({"company_id": company["id"]})
    
    return companies


@router.get("/companies/{company_id}")
async def get_company(company_id: str, current_user: User = Depends(get_super_admin)):
    """Get detailed company information"""
    company = await companies_collection.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get additional stats
    company["stats"] = {
        "users": await users_collection.count_documents({"company_id": company_id}),
        "outlets": await outlets_collection.count_documents({"company_id": company_id}),
        "bookings": await bookings_collection.count_documents({"company_id": company_id}),
        "bookings_this_month": await bookings_collection.count_documents({
            "company_id": company_id,
            "created_at": {"$gte": datetime.now(timezone.utc).replace(day=1).isoformat()}
        })
    }
    
    # Get plan info
    company["plan_info"] = SUBSCRIPTION_PLANS.get(company.get("plan", "free"), SUBSCRIPTION_PLANS["free"])
    
    # Get users
    company["users"] = await users_collection.find(
        {"company_id": company_id}, {"_id": 0, "hashed_password": 0}
    ).to_list(100)
    
    return company


@router.post("/companies")
async def create_company(
    company_data: CompanyCreate,
    request: Request,
    current_user: User = Depends(get_super_admin)
):
    """Create a new company with admin user"""
    
    # Check if company email already exists
    existing = await companies_collection.find_one({"email": company_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Company with this email already exists")
    
    # Check if admin email already exists
    existing_user = await users_collection.find_one({"email": company_data.admin_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    company_id = str(uuid.uuid4())
    plan = company_data.plan
    plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["trial"])
    
    # Calculate trial end if applicable
    trial_end = None
    trial_start = None
    if plan == "trial":
        trial_start = datetime.now(timezone.utc)
        trial_end = trial_start + timedelta(days=plan_config["duration_days"])
    
    # Create company with default enabled features
    company = {
        "id": company_id,
        "name": company_data.name,
        "business_type": company_data.business_type,
        "email": company_data.email,
        "phone": company_data.phone,
        "address": company_data.address,
        "plan": plan,
        "plan_limits": plan_config["limits"],
        "trial_start": trial_start.isoformat() if trial_start else None,
        "trial_end": trial_end.isoformat() if trial_end else None,
        "status": "active",
        "enabled_features": [],  # Features that can be enabled: ["inventory", "ai_assistant", etc.]
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.id
    }
    
    await companies_collection.insert_one(company)
    
    # Create admin user for this company
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": company_data.admin_email,
        "name": company_data.admin_name,
        "password_hash": hash_password(company_data.admin_password),
        "role": "Admin",
        "company_id": company_id,
        "status": "Active",
        "outlets": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await users_collection.insert_one(admin_user)
    
    # Log audit
    await log_audit(
        action="create",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
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
    current_user: User = Depends(get_super_admin)
):
    """Update company details"""
    company = await companies_collection.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    update_fields = {k: v for k, v in update_data.dict().items() if v is not None}
    
    if update_fields:
        await companies_collection.update_one(
            {"id": company_id},
            {"$set": update_fields}
        )
        
        await log_audit(
            action="update",
            entity_type="company",
            entity_id=company_id,
            user_id=current_user.id,
            user_email=current_user.email,
            details=update_fields,
            ip_address=request.client.host if request.client else None
        )
    
    return {"message": "Company updated successfully"}


@router.put("/companies/{company_id}/plan")
async def change_company_plan(
    company_id: str,
    plan_data: PlanChange,
    request: Request,
    current_user: User = Depends(get_super_admin)
):
    """Change company subscription plan"""
    company = await companies_collection.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if plan_data.plan not in SUBSCRIPTION_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    plan_config = SUBSCRIPTION_PLANS[plan_data.plan]
    limits = plan_data.custom_limits or plan_config["limits"]
    
    update_fields = {
        "plan": plan_data.plan,
        "plan_limits": limits
    }
    
    # If changing to trial, set trial dates
    if plan_data.plan == "trial":
        update_fields["trial_start"] = datetime.now(timezone.utc).isoformat()
        update_fields["trial_end"] = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    
    await companies_collection.update_one(
        {"id": company_id},
        {"$set": update_fields}
    )
    
    await log_audit(
        action="plan_change",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        details={"old_plan": company.get("plan"), "new_plan": plan_data.plan},
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": f"Plan changed to {plan_data.plan}"}


@router.post("/companies/{company_id}/suspend")
async def suspend_company(
    company_id: str,
    request: Request,
    current_user: User = Depends(get_super_admin)
):
    """Suspend a company account"""
    result = await companies_collection.update_one(
        {"id": company_id},
        {"$set": {"status": "suspended"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    await log_audit(
        action="suspend",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Company suspended"}


@router.post("/companies/{company_id}/activate")
async def activate_company(
    company_id: str,
    request: Request,
    current_user: User = Depends(get_super_admin)
):
    """Reactivate a suspended company"""
    result = await companies_collection.update_one(
        {"id": company_id},
        {"$set": {"status": "active"}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Company not found")
    
    await log_audit(
        action="activate",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
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
    current_user: User = Depends(get_super_admin)
):
    """
    Deactivate a company account with 60-day data retention.
    After 60 days, the company data will be permanently deleted.
    """
    company = await companies_collection.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company.get("status") == "deactivated":
        raise HTTPException(status_code=400, detail="Company is already deactivated")
    
    # Set deactivation date and scheduled deletion date (60 days from now)
    deactivated_at = datetime.now(timezone.utc)
    scheduled_deletion = deactivated_at + timedelta(days=60)
    
    update_fields = {
        "status": "deactivated",
        "deactivated_at": deactivated_at.isoformat(),
        "scheduled_deletion_date": scheduled_deletion.isoformat(),
        "deactivation_reason": reason_data.reason
    }
    
    await companies_collection.update_one(
        {"id": company_id},
        {"$set": update_fields}
    )
    
    # Also deactivate all users in this company
    await users_collection.update_many(
        {"company_id": company_id},
        {"$set": {"status": "Inactive"}}
    )
    
    await log_audit(
        action="deactivate",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
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
    current_user: User = Depends(get_super_admin)
):
    """
    Reactivate a deactivated company (within 60-day retention period).
    This cancels the scheduled deletion.
    """
    company = await companies_collection.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company.get("status") != "deactivated":
        raise HTTPException(status_code=400, detail="Company is not deactivated")
    
    # Check if still within retention period
    scheduled_deletion = company.get("scheduled_deletion_date")
    if scheduled_deletion:
        deletion_date = datetime.fromisoformat(scheduled_deletion.replace('Z', '+00:00'))
        if datetime.now(timezone.utc) > deletion_date:
            raise HTTPException(
                status_code=400, 
                detail="Retention period expired. Company data may have been deleted."
            )
    
    # Reactivate company
    await companies_collection.update_one(
        {"id": company_id},
        {
            "$set": {"status": "active"},
            "$unset": {
                "deactivated_at": "",
                "scheduled_deletion_date": "",
                "deactivation_reason": ""
            }
        }
    )
    
    # Reactivate all users
    await users_collection.update_many(
        {"company_id": company_id},
        {"$set": {"status": "Active"}}
    )
    
    await log_audit(
        action="reactivate",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=request.client.host if request.client else None
    )
    
    return {"message": "Company reactivated successfully"}


# ============ Impersonation ============

@router.post("/impersonate/{company_id}")
async def impersonate_company(
    company_id: str,
    request: Request,
    current_user: User = Depends(get_super_admin)
):
    """Get a token to access a company as their admin (for support)"""
    company = await companies_collection.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Find the company's admin user
    admin_user = await users_collection.find_one(
        {"company_id": company_id, "role": "Admin"},
        {"_id": 0}
    )
    
    if not admin_user:
        raise HTTPException(status_code=404, detail="No admin user found for this company")
    
    # Create impersonation token with metadata
    token = create_access_token({
        "sub": admin_user["id"],
        "impersonated_by": current_user.id,
        "impersonation": True
    })
    
    await log_audit(
        action="impersonate",
        entity_type="company",
        entity_id=company_id,
        user_id=current_user.id,
        user_email=current_user.email,
        details={"impersonated_user": admin_user["email"]},
        ip_address=request.client.host if request.client else None
    )
    
    return {
        "token": token,
        "company": company,
        "user": {
            "id": admin_user["id"],
            "email": admin_user["email"],
            "name": admin_user["name"]
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
    current_user: User = Depends(get_super_admin)
):
    """Get audit logs with filters"""
    query = {}
    
    if company_id:
        query["company_id"] = company_id
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    if entity_type:
        query["entity_type"] = entity_type
    
    total = await audit_logs_collection.count_documents(query)
    logs = await audit_logs_collection.find(
        query, {"_id": 0}
    ).sort("timestamp", -1).skip(offset).limit(limit).to_list(limit)
    
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
    current_user: User = Depends(get_super_admin)
):
    """List all users across companies"""
    query = {"role": {"$ne": "SuperAdmin"}}
    
    if company_id:
        query["company_id"] = company_id
    if role:
        query["role"] = role
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    users = await users_collection.find(
        query, {"_id": 0, "hashed_password": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Add company name to each user
    for user in users:
        if user.get("company_id"):
            company = await companies_collection.find_one(
                {"id": user["company_id"]}, {"name": 1}
            )
            user["company_name"] = company.get("name") if company else "Unknown"
    
    return users


# ============ Plans Info ============

@router.get("/plans")
async def get_subscription_plans(current_user: User = Depends(get_super_admin)):
    """Get all available subscription plans"""
    return SUBSCRIPTION_PLANS
