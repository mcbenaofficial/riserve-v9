from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from contextlib import asynccontextmanager
import os
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'ridn_db')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Trial expiry check function
async def check_and_downgrade_expired_trials():
    """Check for expired trials and downgrade to free plan"""
    try:
        from routes.dependencies import SUBSCRIPTION_PLANS
        
        now = datetime.now(timezone.utc)
        
        # Find all companies with expired trials
        expired_trials = await db.companies.find({
            "plan": "trial",
            "trial_end": {"$lte": now.isoformat()}
        }, {"_id": 0}).to_list(1000)
        
        if expired_trials:
            logger.info(f"Found {len(expired_trials)} expired trials to downgrade")
            
            for company in expired_trials:
                await db.companies.update_one(
                    {"id": company["id"]},
                    {"$set": {
                        "plan": "free",
                        "plan_limits": SUBSCRIPTION_PLANS["free"]["limits"]
                    }}
                )
                
                # Log the downgrade
                await db.audit_logs.insert_one({
                    "id": str(uuid.uuid4()),
                    "timestamp": now.isoformat(),
                    "action": "trial_expired",
                    "entity_type": "company",
                    "entity_id": company["id"],
                    "user_id": "system",
                    "user_email": "system@riserve.com",
                    "company_id": company["id"],
                    "details": {"old_plan": "trial", "new_plan": "free"},
                    "ip_address": None
                })
                
                logger.info(f"Downgraded company {company['name']} ({company['id']}) from trial to free")
        else:
            logger.info("No expired trials found")
            
    except Exception as e:
        logger.error(f"Error checking expired trials: {e}")


# Background task to check trials periodically
async def trial_check_background_task():
    """Run trial check every hour"""
    while True:
        await check_and_downgrade_expired_trials()
        await asyncio.sleep(3600)  # Check every hour


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Ri'Serve API...")
    
    # Run initial trial check
    await check_and_downgrade_expired_trials()
    
    # Start background task for periodic checks
    task = asyncio.create_task(trial_check_background_task())
    
    yield
    
    # Shutdown
    task.cancel()
    logger.info("Shutting down Ri'Serve API...")


# Create the main app with lifespan
app = FastAPI(title="Ri'Serve Partner API", lifespan=lifespan)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import all routers
from routes import (
    auth, public, dashboard, bookings, services, outlets, 
    staff, reports, feedback, assistant, onboarding,
    users, company, inventory, customers, slots, transactions, promotions, hitl
)
from routes.superadmin import router as superadmin

# Include Routers
app.include_router(auth.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(outlets.router, prefix="/api")
app.include_router(staff.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(feedback.router, prefix="/api")
app.include_router(assistant.router, prefix="/api")
app.include_router(superadmin, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(company.router, prefix="/api")
app.include_router(inventory.router, prefix="/api")
app.include_router(customers.router, prefix="/api")
app.include_router(slots.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(promotions.promotions_bp, prefix="/api")
app.include_router(onboarding.router, prefix="/api")
app.include_router(hitl.router, prefix="/api")


# Additional route for resource-bookings
from routes.dependencies import get_current_user, User, bookings_collection
from fastapi import Depends

@app.get("/api/resource-bookings/{outlet_id}")
async def get_resource_bookings(outlet_id: str, date: str = None, current_user: User = Depends(get_current_user)):
    query = {"outlet_id": outlet_id}
    if date:
        query["date"] = date
    bookings = await bookings_collection.find(query, {"_id": 0}).to_list(1000)
    return bookings

# Password hashing for seed
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# ==================== SEED DATA ====================
@app.post("/api/seed")
async def seed_data():
    # Clear existing data
    await db.transactions.delete_many({})
    await db.bookings.delete_many({})
    await db.slot_configs.delete_many({})
    await db.services.delete_many({})
    await db.outlets.delete_many({})
    await db.users.delete_many({})
    await db.companies.delete_many({})
    await db.audit_logs.delete_many({})
    
    # Create Super Admin user (platform owner)
    super_admin_id = str(uuid.uuid4())
    super_admin = {
        "id": super_admin_id,
        "email": "superadmin@riserve.com",
        "name": "Super Admin",
        "password_hash": hash_password("superadmin123"),
        "role": "SuperAdmin",
        "company_id": None,  # Super admins don't belong to a company
        "status": "Active",
        "outlets": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(super_admin)
    
    # Create Demo Company
    demo_company_id = str(uuid.uuid4())
    demo_company = {
        "id": demo_company_id,
        "name": "Ri'Serve Demo",
        "business_type": "Car Care",
        "email": "demo@riserve.com",
        "phone": "+91 9876543210",
        "address": "123 Demo Street, Chennai",
        "plan": "pro",  # Demo gets pro features
        "plan_limits": {"outlets": -1, "bookings_per_month": -1},
        "trial_start": None,
        "trial_end": None,
        "status": "active",
        "enabled_features": ["inventory", "ai_assistant", "advanced_reports"],  # Enable features for demo
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "system-seed"
    }
    await db.companies.insert_one(demo_company)
    
    # Create Demo Company Admin
    demo_admin_id = str(uuid.uuid4())
    demo_admin = {
        "id": demo_admin_id,
        "email": "admin@ridn.com",
        "name": "Demo Admin",
        "password_hash": hash_password("admin123"),
        "role": "Admin",
        "company_id": demo_company_id,
        "status": "Active",
        "outlets": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(demo_admin)
    
    cities = ['Chennai', 'Bengaluru', 'Hyderabad', 'Mumbai', 'Delhi']
    base_services = ['Basic Wash', 'Premium Wash', 'Full Detail', 'Interior Clean', 'Wax & Polish']
    service_types = ['exterior', 'full', 'full', 'interior', 'exterior']
    service_prices = [299, 399, 499, 799, 999]
    service_durations = [20, 30, 45, 60, 90]
    
    # Create services (scoped to demo company)
    services = []
    for i in range(10):
        service = {
            "id": str(uuid.uuid4()),
            "name": base_services[i % len(base_services)] + (f" {i+1}" if i >= len(base_services) else ""),
            "type": service_types[i % len(service_types)],
            "duration_min": service_durations[i % len(service_durations)],
            "price": service_prices[i % len(service_prices)],
            "active": (i % 7 != 0),
            "company_id": demo_company_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        services.append(service)
    await db.services.insert_many(services)
    
    # Create outlets (scoped to demo company)
    outlets = []
    for i in range(30):
        city = cities[i % len(cities)]
        outlet = {
            "id": str(uuid.uuid4()),
            "name": f"Ri'Serve {city} #{i+1}",
            "city": city,
            "address": f"{100 + i}, Main St, {city}",
            "capacity": 2 + (i % 4),
            "machines": 1 + (i % 3),
            "rating": round(3.5 + (i % 15) * 0.1, 1),
            "solar": (i % 2 == 0),
            "water_recycle": (i % 3 == 0),
            "status": "Offline" if (i % 10 == 0) else "Active",
            "services_offered": [],
            "company_id": demo_company_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        outlets.append(outlet)
    await db.outlets.insert_many(outlets)
    
    # Create slot configs for first outlet  
    first_outlet = outlets[0]
    resource_id_1 = str(uuid.uuid4())
    resource_id_2 = str(uuid.uuid4())
    slot_config = {
        "id": str(uuid.uuid4()),
        "outlet_id": first_outlet["id"],
        "company_id": demo_company_id,
        "business_type": "car_wash",
        "slot_duration_min": 30,
        "operating_hours_start": "08:00",
        "operating_hours_end": "20:00",
        "resources": [
            {"id": resource_id_1, "name": "Bay 1", "active": True},
            {"id": resource_id_2, "name": "Bay 2", "active": True}
        ],
        "allow_online_booking": True,
        "booking_advance_days": 7,
        "embed_token": str(uuid.uuid4()),
        "customer_fields": [
            {"field_name": "name", "label": "Full Name", "required": True, "enabled": True},
            {"field_name": "phone", "label": "Phone Number", "required": True, "enabled": True},
            {"field_name": "email", "label": "Email Address", "required": False, "enabled": True},
            {"field_name": "vehicle", "label": "Vehicle Number", "required": False, "enabled": True},
            {"field_name": "notes", "label": "Additional Notes", "required": False, "enabled": True}
        ],
        "plan": "free",
        "branding": {},
        "allow_multiple_services": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.slot_configs.insert_one(slot_config)
    
    # Create bookings with proper date distribution
    statuses = ['Pending', 'In Progress', 'Completed', 'Cancelled']
    bookings = []
    transactions = []
    today = datetime.now(timezone.utc)
    
    for i in range(120):
        outlet = outlets[i % len(outlets)]
        service = services[i % len(services)]
        time_hour = 8 + (i % 10)
        status = statuses[i % len(statuses)]
        
        # Distribute bookings across last 14 days with more recent ones
        days_ago = i % 14
        booking_datetime = today - timedelta(days=days_ago, hours=i % 8)
        booking_date = booking_datetime.strftime('%Y-%m-%d')
        
        # Assign resource_id for bookings in the first outlet
        resource_id = None
        if outlet["id"] == first_outlet["id"]:
            resource_id = resource_id_1 if i % 2 == 0 else resource_id_2
        
        booking_id = str(uuid.uuid4())
        booking = {
            "id": booking_id,
            "customer": f"Customer {i + 1}",
            "customer_name": f"Customer {i + 1}",
            "customer_phone": f"+91 98765{str(i).zfill(5)[:5]}",
            "vehicle": f"TN{str(10 + (i % 90)).zfill(2)}{str(1000 + i)[-4:]}",
            "time": f"{time_hour:02d}:00",
            "date": booking_date,
            "service_id": service["id"],
            "service_ids": [service["id"]],
            "outlet_id": outlet["id"],
            "resource_id": resource_id,
            "amount": service["price"],
            "status": status,
            "source": "app" if i % 3 != 0 else "online",
            "company_id": demo_company_id,
            "created_at": booking_datetime.isoformat()
        }
        bookings.append(booking)
        
        commission = int(service["price"] * 0.15)
        partner_share = service["price"] - commission
        transaction = {
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "outlet_id": outlet["id"],
            "gross": service["price"],
            "total_amount": service["price"],
            "commission": commission,
            "partner_share": partner_share,
            "status": "Held" if (i % 5 == 0) else "Settled",
            "company_id": demo_company_id,
            "date": booking_datetime.isoformat(),
            "created_at": booking_datetime.isoformat()
        }
        transactions.append(transaction)
    
    await db.bookings.insert_many(bookings)
    await db.transactions.insert_many(transactions)
    
    # Create customer feedback/ratings linked to bookings
    await db.feedback.delete_many({})
    feedback_list = []
    ratings = [5, 5, 4, 5, 4, 3, 5, 4, 5, 5, 4, 5, 3, 4, 5, 5, 4, 5, 4, 5]
    feedback_comments = [
        "Excellent service! My car looks brand new.",
        "Very professional staff and quick turnaround.",
        "Good service but took a bit longer than expected.",
        "Amazing attention to detail. Highly recommend!",
        "Great value for money. Will come back again.",
        "Service was okay, could improve on interior cleaning.",
        "Best car wash experience I've had!",
        "Friendly staff and spotless results.",
        "Very satisfied with the premium wash service.",
        "Convenient location and excellent service quality."
    ]
    
    # Create feedback for completed bookings
    completed_bookings = [b for b in bookings if b["status"] == "Completed"]
    for i, booking in enumerate(completed_bookings[:40]):  # Feedback for 40 completed bookings
        feedback = {
            "id": str(uuid.uuid4()),
            "booking_id": booking["id"],
            "customer_name": booking["customer_name"],
            "customer_email": f"customer{i+1}@email.com",
            "outlet_id": booking["outlet_id"],
            "service_id": booking["service_id"],
            "rating": ratings[i % len(ratings)],
            "comment": feedback_comments[i % len(feedback_comments)] if i % 3 != 2 else None,
            "company_id": demo_company_id,
            "created_at": booking["created_at"]
        }
        feedback_list.append(feedback)
    
    await db.feedback.insert_many(feedback_list)
    
    # Create inventory products
    await db.products.delete_many({})
    await db.inventory_log.delete_many({})
    await db.inventory_alerts.delete_many({})
    
    product_data = [
        {"name": "Premium Car Freshener", "sku": "CF-001", "category": "accessories", "price": 299, "cost": 120, "stock": 50, "reorder": 10},
        {"name": "Dashboard Polish Spray", "sku": "DP-001", "category": "consumables", "price": 199, "cost": 80, "stock": 35, "reorder": 8},
        {"name": "Microfiber Cloth Set", "sku": "MC-001", "category": "accessories", "price": 149, "cost": 60, "stock": 100, "reorder": 20},
        {"name": "Tire Shine Gel", "sku": "TS-001", "category": "consumables", "price": 249, "cost": 100, "stock": 40, "reorder": 10},
        {"name": "Interior Vacuum Bag", "sku": "IVB-001", "category": "consumables", "price": 99, "cost": 30, "stock": 200, "reorder": 50},
        {"name": "Glass Cleaner Pro", "sku": "GC-001", "category": "consumables", "price": 179, "cost": 70, "stock": 45, "reorder": 12},
        {"name": "Leather Conditioner", "sku": "LC-001", "category": "consumables", "price": 349, "cost": 150, "stock": 25, "reorder": 8},
        {"name": "Alloy Wheel Cleaner", "sku": "AWC-001", "category": "consumables", "price": 229, "cost": 90, "stock": 30, "reorder": 10},
        {"name": "Car Perfume - Ocean", "sku": "CPO-001", "category": "accessories", "price": 399, "cost": 180, "stock": 20, "reorder": 5},
        {"name": "Car Perfume - Forest", "sku": "CPF-001", "category": "accessories", "price": 399, "cost": 180, "stock": 18, "reorder": 5},
        {"name": "Scratch Remover Kit", "sku": "SRK-001", "category": "parts", "price": 599, "cost": 250, "stock": 15, "reorder": 5},
        {"name": "Headlight Restoration Kit", "sku": "HRK-001", "category": "parts", "price": 799, "cost": 350, "stock": 10, "reorder": 3},
        {"name": "Wax Polish Premium", "sku": "WPP-001", "category": "consumables", "price": 449, "cost": 200, "stock": 22, "reorder": 8},
        {"name": "Air Filter - Universal", "sku": "AFU-001", "category": "parts", "price": 299, "cost": 120, "stock": 8, "reorder": 5},
        {"name": "Phone Holder Mount", "sku": "PHM-001", "category": "accessories", "price": 499, "cost": 200, "stock": 12, "reorder": 4},
    ]
    
    products = []
    for i, p in enumerate(product_data):
        # Assign some products to specific outlets
        outlet_id = outlets[i % 3]["id"] if i % 4 == 0 else None  # Some products are outlet-specific
        
        product = {
            "id": str(uuid.uuid4()),
            "name": p["name"],
            "sku": p["sku"],
            "category": p["category"],
            "description": f"High quality {p['name'].lower()} for your vehicle",
            "price": p["price"],
            "cost": p["cost"],
            "outlet_id": outlet_id,
            "stock_quantity": p["stock"],
            "reorder_level": p["reorder"],
            "is_addon": True,
            "active": True,
            "company_id": demo_company_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        products.append(product)
    
    await db.products.insert_many(products)
    
    # Set inventory settings
    await db.company_settings.update_one(
        {"company_id": demo_company_id},
        {
            "$set": {
                "inventory_settings": {
                    "inventory_mode": "centralized",
                    "low_stock_alerts": True,
                    "allow_customer_addons": False,
                    "default_reorder_level": 10
                }
            }
        },
        upsert=True
    )
    
    return {
        "message": "Data seeded successfully", 
        "outlets": 30, 
        "services": 10, 
        "bookings": 120,
        "feedback": len(feedback_list),
        "products": len(products),
        "demo_company": {
            "id": demo_company_id,
            "name": "Ri'Serve Demo"
        },
        "credentials": {
            "super_admin": {"email": "superadmin@riserve.com", "password": "superadmin123"},
            "demo_admin": {"email": "admin@ridn.com", "password": "admin123"}
        }
    }


# ==================== RESET DATA (For Fresh Start) ====================
@app.post("/api/reset-data")
async def reset_data():
    """Clear all data for a fresh first-time user experience"""
    await db.transactions.delete_many({})
    await db.bookings.delete_many({})
    await db.slot_configs.delete_many({})
    await db.dashboard_configs.delete_many({})
    await db.ai_conversations.delete_many({})
    await db.services.delete_many({})
    await db.outlets.delete_many({})
    await db.company_settings.delete_many({})
    await db.booking_fields_config.delete_many({})
    # Keep users - just clean data
    
    return {
        "message": "All data cleared successfully. Ready for fresh start.",
        "cleared": ["transactions", "bookings", "slot_configs", "services", "outlets", "company_settings"]
    }


# ==================== FRESH START (Complete Reset including Users) ====================
@app.post("/api/fresh-start")
async def fresh_start():
    """Complete reset - clear ALL data including users for a brand new setup"""
    # Clear all collections
    await db.transactions.delete_many({})
    await db.bookings.delete_many({})
    await db.slot_configs.delete_many({})
    await db.dashboard_configs.delete_many({})
    await db.ai_conversations.delete_many({})
    await db.services.delete_many({})
    await db.outlets.delete_many({})
    await db.company_settings.delete_many({})
    await db.booking_fields_config.delete_many({})
    await db.users.delete_many({})
    
    # Create a single admin user for setup
    admin_user = {
        "id": str(uuid.uuid4()),
        "email": "admin@riserve.com",
        "name": "Admin",
        "password_hash": hash_password("admin123"),
        "role": "Admin",
        "phone": "",
        "status": "Active",
        "outlets": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_user)
    
    return {
        "message": "Fresh start complete. Please login and configure your business.",
        "admin_credentials": {"email": "admin@riserve.com", "password": "admin123"},
        "next_steps": [
            "1. Login with admin credentials",
            "2. Go to Admin Console > Company Settings",
            "3. Configure your business details",
            "4. Add services and outlets",
            "5. Set up slot booking configuration"
        ]
    }


# Include router


# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db():
    client.close()
