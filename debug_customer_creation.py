import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, ValidationError
from typing import Optional, Dict
from datetime import datetime, timezone
import uuid

# Mock models
class CustomerCreate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: Optional[Dict] = None

class User(BaseModel):
    id: str
    company_id: Optional[str] = None
    role: str

async def test_create():
    load_dotenv('backend/.env')
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.getenv('DB_NAME', 'ridn_db')]
    customers_collection = db.customers
    
    # Input data from user
    data = {
        "name": "Joshua Lawrence",
        "email": "mcbenaofficial@gmail.com",
        "phone": "09176582404",
        "notes": ""
    }
    
    print("----- 1. Validating Input with Pydantic -----")
    try:
        customer_input = CustomerCreate(**data)
        print("✅ Input is valid")
    except ValidationError as e:
        print(f"❌ Input validation failed: {e}")
        return

    # Mock user
    current_user = User(id="test_user", company_id="test_company", role="Admin")

    print(f"\n----- 2. Checking for existing customer (Company: {current_user.company_id}) -----")
    
    try:
        query = {"company_id": current_user.company_id}
        or_conditions = []
        if customer_input.email:
            or_conditions.append({"email": customer_input.email})
        if customer_input.phone:
            or_conditions.append({"phone": customer_input.phone})
        
        if or_conditions:
            query["$or"] = or_conditions
            print(f"Query: {query}")
            existing = await customers_collection.find_one(query)
            if existing:
                print(f"❌ Customer already exists: {existing.get('_id')}")
                return
            else:
                print("✅ No existing customer found")
                
        # Create
        customer_id = str(uuid.uuid4())
        customer_doc = {
            "id": customer_id,
            "name": customer_input.name,
            "email": customer_input.email,
            "phone": customer_input.phone,
            "notes": customer_input.notes,
            "custom_fields": customer_input.custom_fields or {},
            "company_id": current_user.company_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "total_revenue": 0,
            "total_bookings": 0,
            "last_visit": None
        }
        
        print("\n----- 3. Inserting into DB -----")
        try:
             await customers_collection.insert_one(customer_doc)
             print(f"✅ Successfully inserted customer {customer_id}")
             
             # Cleanup
             await customers_collection.delete_one({"id": customer_id})
             print("✅ Cleanup successful")
             
        except Exception as e:
            print(f"❌ Insert failed: {e}")

    except Exception as e:
        print(f"❌ Logic failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_create())
