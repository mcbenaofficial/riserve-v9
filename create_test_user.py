import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from passlib.context import CryptContext
import uuid
from datetime import datetime, timezone

# Password hashing context (matching backend/routes/dependencies.py if it uses passlib)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str):
    return pwd_context.hash(password)

async def create_user():
    # Load env from backend/.env
    load_dotenv('backend/.env')
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.getenv('DB_NAME', 'ridn_db')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    email = "test@ridn.com"
    password = "password123"
    
    # 1. Delete existing user if any
    await db.users.delete_one({"email": email})
    print(f"Cleaned up existing user {email}")
    
    # 2. Delete any onboarding progress associated with this user?
    # Since new user has no company_id yet, there's no progress to delete by company_id.
    # But if previous test@ridn.com had a company, we might want to clean that up too?
    # For now, just a fresh user doc is enough to start from scratch.
    
    # 3. Create new user
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": "Test User",
        "password_hash": hash_password(password),
        "role": "Admin",
        "status": "Active",
        "phone": None,
        "company_id": None, # Explicitly no company yet
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    print(f"Created new user:")
    print(f"Email: {email}")
    print(f"Password: {password}")
    print(f"ID: {user_id}")
    
    # Verify
    saved = await db.users.find_one({"email": email})
    if saved:
        print("User successfully saved to DB.")
    else:
        print("Error: User not found in DB after insert.")

if __name__ == "__main__":
    asyncio.run(create_user())
