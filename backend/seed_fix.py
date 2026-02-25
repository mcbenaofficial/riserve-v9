import asyncio
import uuid
from datetime import datetime, timezone
import httpx
from pymongo import MongoClient

# MongoDB setup
client = MongoClient("mongodb://localhost:27017/")
db = client["riserve_db"]

async def seed_retail():
    print("Seeding Retail Outlet via API logic...")

    # Clear old data to prevent collisions
    db.users.delete_many({"email": "admin@urbanstyle.com"})
    db.companies.delete_many({"email": "hello@urbanstyle.com"})
    db.outlets.delete_many({"email": "downtown@urbanstyle.com"})
    
    # 1. Register the admin user using the FastAPI route to ensure valid pass hash
    async with httpx.AsyncClient() as http_client:
        res = await http_client.post("http://localhost:8000/api/auth/register", json={
            "email": "admin@urbanstyle.com",
            "name": "Alex Admin",
            "password": "admin123",
            "role": "Admin",
            "phone": "+1 (555) 123-4567"
        })
        
        if res.status_code != 200:
            print(f"Failed to register Admin User: {res.text}")
            return
            
        auth_data = res.json()
        print("✅ Registered Admin User: admin@urbanstyle.com")
        
        user_id = auth_data["user"]["id"]
        
        # 2. Inject Company manually
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
            "created_by": user_id
        }
        db.companies.insert_one(company)
        print(f"✅ Created Retail Company (ID: {company_id})")
        
        # 3. Create Settings explicitly for this company_id
        settings = {
            "company_id": company_id,
            "currency": "USD",
            "timezone": "America/New_York",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        db.company_settings.delete_many({"company_id": company_id}) # clean up
        db.company_settings.insert_one(settings)
        print("✅ Created Company Settings")

        # 4. Update User with Company ID
        db.users.update_one({"id": user_id}, {"$set": {"company_id": company_id}})
        print(f"✅ Linked Admin to Company (User ID: {user_id})")

        # 5. Inject Outlet
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
