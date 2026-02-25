import asyncio
import json
import uuid
from datetime import datetime
from pymongo import MongoClient
import bcrypt

# MongoDB setup
client = MongoClient("mongodb://localhost:27017/")
db = client["riserve_db"]

def _hash_password(password: str) -> str:
    # A simplified password hash since we are injecting directly
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    return pwd_context.hash(password)

async def seed_retail():
    print("Seeding Retail Outlet...")

    # Unique identifiers
    company_id = str(uuid.uuid4())
    admin_user_id = str(uuid.uuid4())
    outlet_id = str(uuid.uuid4())
    
    # 1. Create Company
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
        "created_at": datetime.utcnow().isoformat(),
        "created_by": "seed_script"
    }
    
    db.companies.insert_one(company)
    print(f"✅ Created Retail Company: {company['name']}")
    
    # 2. Add Settings
    settings = {
        "company_id": company_id,
        "currency": "USD",
        "timezone": "America/New_York",
        "updated_at": datetime.utcnow().isoformat()
    }
    db.company_settings.insert_one(settings)
    print("✅ Created Company Settings")

    # 3. Create Admin User
    admin = {
        "id": admin_user_id,
        "company_id": company_id,
        "name": "Alex Admin",
        "email": "admin@urbanstyle.com",
        "password_hash": _hash_password("admin123"),
        "role": "Admin",
        "status": "Active",
        "outlets": [],
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Avoid duplicate emails if the user runs this multiple times
    db.users.delete_many({"email": "admin@urbanstyle.com"})
    db.users.insert_one(admin)
    print(f"✅ Created/Updated Admin User: {admin['email']} (Password: admin123)")

    # 4. Create Retail Outlet
    outlet = {
        "id": outlet_id,
        "company_id": company_id,
        "name": "Downtown Store",
        "email": "downtown@urbanstyle.com",
        "phone": "+1 (555) 987-6543",
        "address": "123 Fashion Blvd, New York, NY 10001",
        "status": "active",
        "created_at": datetime.utcnow().isoformat()
    }
    
    db.outlets.insert_one(outlet)
    print(f"✅ Created Retail Outlet: {outlet['name']}")

    print("\n-----------------------------------------")
    print("🎉 Retail Seed Complete!")
    print(f"Login URL: http://localhost:3000/login")
    print(f"Email: admin@urbanstyle.com")
    print(f"Password: admin123")
    print("-----------------------------------------")

if __name__ == "__main__":
    asyncio.run(seed_retail())
