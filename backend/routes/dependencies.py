from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import jwt
import os
import uuid
import models_pg
from database_pg import get_db

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'ridn-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7

# Security
security = HTTPBearer()


# User model for dependencies
class User(BaseModel):
    email: EmailStr
    name: str
    role: str = "Admin"  # SuperAdmin, Admin, Manager, User
    phone: Optional[str] = None
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = "Active"
    company_id: Optional[str] = None  # Multi-tenant: company this user belongs to
    outlets: List[str] = []  # For Manager/User role - restrict to specific outlets
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    class Config:
        extra = "ignore"


# Company/Tenant model
class Company(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    business_type: str
    email: str
    phone: Optional[str] = None
    address: Optional[str] = None
    plan: str = "trial"  # trial, free, essential, pro, custom
    plan_limits: Dict[str, Any] = Field(default_factory=dict)
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    status: str = "active"  # active, suspended, cancelled
    is_booking_enabled: bool = True
    is_retail_enabled: bool = False
    is_workplace_enabled: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None  # Super admin who created it, or 'self-signup'
    
    class Config:
        extra = "ignore"


# Subscription Plans with limits
SUBSCRIPTION_PLANS = {
    "trial": {
        "name": "Trial",
        "duration_days": 30,
        "limits": {
            "outlets": 3,
            "bookings_per_month": 100
        },
        "features": ["basic_booking", "slot_manager", "reports", "feedback"]
    },
    "free": {
        "name": "Free",
        "duration_days": None,  # Unlimited
        "limits": {
            "outlets": 1,
            "bookings_per_month": 50
        },
        "features": ["basic_booking", "slot_manager"]
    },
    "essential": {
        "name": "Essential",
        "duration_days": None,
        "limits": {
            "outlets": 3,
            "bookings_per_month": 500
        },
        "features": ["basic_booking", "slot_manager", "reports", "feedback", "ai_assistant"]
    },
    "pro": {
        "name": "Pro",
        "duration_days": None,
        "limits": {
            "outlets": -1,  # Unlimited
            "bookings_per_month": -1  # Unlimited
        },
        "features": ["basic_booking", "slot_manager", "reports", "feedback", "ai_assistant", "api_access", "priority_support"]
    },
    "custom": {
        "name": "Custom/Enterprise",
        "duration_days": None,
        "limits": {
            "outlets": -1,
            "bookings_per_month": -1
        },
        "features": ["all"]
    }
}


# Role definitions
USER_ROLES = {
    "SuperAdmin": {
        "name": "Super Admin",
        "description": "Platform owner - manages all companies, users, subscriptions, and system settings",
        "permissions": ["all", "manage_companies", "manage_subscriptions", "view_audit_logs", "impersonate"]
    },
    "Admin": {
        "name": "Admin",
        "description": "Company admin - can manage all settings, users, outlets, and data within their company",
        "permissions": ["all"]
    },
    "Manager": {
        "name": "Manager", 
        "description": "Outlet level access - can manage bookings and operations for assigned outlets",
        "permissions": ["view_bookings", "manage_bookings", "view_reports", "manage_services"]
    },
    "User": {
        "name": "User",
        "description": "Limited access - can only view and manage bookings/orders assigned to them",
        "permissions": ["view_own_bookings", "update_own_bookings"]
    }
}


# get_db is imported directly from database_pg now


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db_session: AsyncSession = Depends(get_db)
) -> User:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except (jwt.InvalidTokenError, jwt.DecodeError, Exception) as e:
        raise HTTPException(status_code=401, detail="Could not validate credentials")
    
    # Query Postgres for User
    stmt = select(models_pg.User).where(models_pg.User.id == user_id)
    result = await db_session.execute(stmt)
    user_db = result.scalar_one_or_none()
    
    if user_db is None:
        raise HTTPException(status_code=401, detail="User not found")
        
    # Query for associated outlets using the many-to-many relationship table (user_outlets)
    outlets_stmt = select(models_pg.user_outlets.c.outlet_id).where(models_pg.user_outlets.c.user_id == user_id)
    outlets_res = await db_session.execute(outlets_stmt)
    outlets_list = [row[0] for row in outlets_res.all()]
    
    return User(
        id=user_db.id,
        email=user_db.email,
        name=user_db.name,
        role=user_db.role,
        phone=user_db.phone,
        status=user_db.status,
        company_id=user_db.company_id,
        outlets=outlets_list,
        created_at=user_db.created_at
    )


# Super Admin check
async def get_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "SuperAdmin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user

# Admin check (Admin or SuperAdmin)
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# Manager or Admin check
async def require_manager_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["Manager", "Admin", "SuperAdmin"]:
        raise HTTPException(status_code=403, detail="Manager or Admin access required")
    return current_user

# Outlet access check
def enforce_outlet_access(user: User, outlet_id: str):
    """
    Check if the user has access to a given outlet.
    Admins/SuperAdmins have access to all outlets.
    Managers/Users only have access if it's in their `outlets` list.
    """
    if user.role in ["Admin", "SuperAdmin"]:
        return True
    
    # If the user has access to this outlet
    if outlet_id in user.outlets:
        return True
        
    raise HTTPException(status_code=403, detail=f"Access denied to outlet {outlet_id}")


# Get company for current user
async def get_current_company(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
) -> Optional[Dict]:
    if current_user.role == "SuperAdmin":
        return None  # Super admins aren't tied to a company
    if not current_user.company_id:
        return None
        
    stmt = select(models_pg.Company).where(models_pg.Company.id == current_user.company_id)
    res = await db_session.execute(stmt)
    company = res.scalar_one_or_none()
    
    if not company:
        return None
        
    return {
        "id": company.id,
        "name": company.name,
        "plan": company.plan,
        "status": company.status
    }


# Audit logging helper
async def log_audit(
    action: str,
    entity_type: str,
    entity_id: str,
    user_id: str,
    user_email: str,
    db_session: AsyncSession,
    company_id: Optional[str] = None,
    details: Optional[Dict] = None,
    ip_address: Optional[str] = None
):
    """Log an action to the audit_logs table"""
    new_log = models_pg.AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        user_email=user_email,
        company_id=company_id,
        details=details or {},
        ip_address=ip_address
    )
    db_session.add(new_log)
    await db_session.commit()
    return new_log


# Check plan limits
async def check_plan_limit(company_id: str, limit_type: str, db_session: AsyncSession, current_count: int = 0) -> bool:
    """Check if company is within their plan limits"""
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not company:
        return False
    
    plan = company.plan or "free"
    plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"])
    limit = plan_config["limits"].get(limit_type, 0)
    
    # -1 means unlimited
    if limit == -1:
        return True
    
    return current_count < limit


# Check if trial has expired
async def check_trial_status(company_id: str, db_session: AsyncSession) -> Dict:
    """Check trial status and auto-downgrade if expired"""
    stmt = select(models_pg.Company).where(models_pg.Company.id == company_id)
    company = (await db_session.execute(stmt)).scalar_one_or_none()
    
    if not company:
        return {"valid": False, "reason": "Company not found"}
    
    if company.plan != "trial":
        return {"valid": True, "plan": company.plan}
    
    trial_end = company.trial_end
    if trial_end:
        # DB returns offset-naive or offset-aware datetime
        if not trial_end.tzinfo:
            trial_end = trial_end.replace(tzinfo=timezone.utc)
            
        if datetime.now(timezone.utc) > trial_end:
            # Auto-downgrade to free
            company.plan = "free"
            company.plan_limits = SUBSCRIPTION_PLANS["free"]["limits"]
            await db_session.commit()
            return {"valid": True, "plan": "free", "downgraded": True}
    
    return {"valid": True, "plan": "trial"}

