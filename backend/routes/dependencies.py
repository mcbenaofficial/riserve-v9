from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
import jwt
import os
import uuid

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'ridn_db')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections
users_collection = db.users
outlets_collection = db.outlets
services_collection = db.services
bookings_collection = db.bookings
transactions_collection = db.transactions
slot_configs_collection = db.slot_configs
dashboard_configs_collection = db.dashboard_configs
ai_conversations_collection = db.ai_conversations
ai_conversations_collection = db.ai_conversations
products_collection = db.products
customers_collection = db.customers
promotions_collection = db.promotions
coupons_collection = db.coupons

# New Multi-Tenant Collections
companies_collection = db.companies
audit_logs_collection = db.audit_logs
subscription_plans_collection = db.subscription_plans
onboarding_progress_collection = db.onboarding_progress
onboarding_conversations_collection = db.onboarding_conversations

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


def get_db():
    return db


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


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
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
    
    user_doc = await users_collection.find_one({"id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)


# Super Admin check
async def get_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "SuperAdmin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
    return current_user


# Get company for current user
async def get_current_company(current_user: User = Depends(get_current_user)) -> Optional[Dict]:
    if current_user.role == "SuperAdmin":
        return None  # Super admins aren't tied to a company
    if not current_user.company_id:
        return None
    company = await companies_collection.find_one({"id": current_user.company_id}, {"_id": 0})
    return company


# Audit logging helper
async def log_audit(
    action: str,
    entity_type: str,
    entity_id: str,
    user_id: str,
    user_email: str,
    company_id: Optional[str] = None,
    details: Optional[Dict] = None,
    ip_address: Optional[str] = None
):
    log_entry = {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,  # create, update, delete, login, logout, impersonate, etc.
        "entity_type": entity_type,  # user, company, booking, outlet, etc.
        "entity_id": entity_id,
        "user_id": user_id,
        "user_email": user_email,
        "company_id": company_id,
        "details": details or {},
        "ip_address": ip_address
    }
    await audit_logs_collection.insert_one(log_entry)
    return log_entry


# Check plan limits
async def check_plan_limit(company_id: str, limit_type: str, current_count: int = 0) -> bool:
    """Check if company is within their plan limits"""
    company = await companies_collection.find_one({"id": company_id}, {"_id": 0})
    if not company:
        return False
    
    plan = company.get("plan", "free")
    plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS["free"])
    limit = plan_config["limits"].get(limit_type, 0)
    
    # -1 means unlimited
    if limit == -1:
        return True
    
    return current_count < limit


# Check if trial has expired
async def check_trial_status(company_id: str) -> Dict:
    """Check trial status and auto-downgrade if expired"""
    company = await companies_collection.find_one({"id": company_id}, {"_id": 0})
    if not company:
        return {"valid": False, "reason": "Company not found"}
    
    if company.get("plan") != "trial":
        return {"valid": True, "plan": company.get("plan")}
    
    trial_end = company.get("trial_end")
    if trial_end:
        if isinstance(trial_end, str):
            trial_end = datetime.fromisoformat(trial_end.replace('Z', '+00:00'))
        
        if datetime.now(timezone.utc) > trial_end:
            # Auto-downgrade to free
            await companies_collection.update_one(
                {"id": company_id},
                {"$set": {
                    "plan": "free",
                    "plan_limits": SUBSCRIPTION_PLANS["free"]["limits"]
                }}
            )
            return {"valid": True, "plan": "free", "downgraded": True}
    
    return {"valid": True, "plan": "trial"}

