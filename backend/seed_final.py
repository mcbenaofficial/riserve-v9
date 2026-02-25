import asyncio
import uuid
from datetime import datetime, timezone
import httpx
from pymongo import MongoClient
import motor.motor_asyncio
from passlib.context import CryptContext

# Use the exact MongoDB connection from the backend
client = MongoClient("mongodb://127.0.0.1:27017")
db = client.riserve_db

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def seed_retail():
    print("Seeding Retail Outlet via direct Python Motor...")

    # Clear old data to prevent collisions
    db.users.delete_many({"email": "admin@urbanstyle.com"})
    db.companies.delete_many({"email": "hello@urbanstyle.com"})
    db.outlets.delete_many({"email": "downtown@urbanstyle.com"})
    
    # 1. Inject Company manually
    company_id = str(uuid.uuid4())
    
    company = {
        "id": company_id,
        "name": "Urban Style Apparel",
        "business_type": "Retail Clothing Outlet",
        "email": "hello@urbanstyle.com",
        "phone": "+1 (555) 123-4567",
        "address": "123 Fashion Blvd, NY",
        "plan": "pro",
        "plan_limits": {},
        "status": "active",
        "is_booking_enabled": False,
        "is_retail_enabled": True,
        "is_workplace_enabled": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "seed_script"
    }
    db.companies.insert_one(company)
    print(f"✅ Created Retail Company (ID: {company_id})")
    
    # 2. Create Settings explicitly for this company_id
    settings = {
        "company_id": company_id,
        "currency": "USD",
        "timezone": "America/New_York",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    db.company_settings.delete_many({"company_id": company_id}) # clean up
    db.company_settings.insert_one(settings)
    print("✅ Created Company Settings")

    user_id = str(uuid.uuid4())
    
    # 3. Create User explicitly via PyMongo matching exact FastAPI structure
    admin_user = {
        "id": user_id,
        "email": "admin@urbanstyle.com",
        "name": "Alex Admin",
        "password_hash": hash_password("admin123"),
        "role": "Admin",
        "phone": "+1 (555) 123-4567",
        "status": "Active",
        "outlets": [],
        "company_id": company_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    db.users.insert_one(admin_user)
    print(f"✅ Linked Admin to Company (User ID: {user_id})")

    # 4. Inject Outlet
    outlet_id = str(uuid.uuid4())
    outlet = {
        "id": outlet_id,
        "company_id": company_id,
        "name": "Downtown Store",
        "email": "downtown@urbanstyle.com",
        "phone": "+1 (555) 987-6543",
        "address": "123 Fashion Blvd, New York, NY 10001",
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    db.outlets.insert_one(outlet)
    print("✅ Created Retail Outlet")

    print("\n-----------------------------------------")
    print("🎉 Retail Seed Complete!")
    print(f"Login URL: http://localhost:3000/login")
    print(f"Email: admin@urbanstyle.com")
    print(f"Password: admin123")
    print("-----------------------------------------")

if __name__ == "__main__":
    asyncio.run(seed_retail())
