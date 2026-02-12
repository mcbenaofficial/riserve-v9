import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def clean_orphans():
    load_dotenv('backend/.env')
    MONGO_URL = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    DB_NAME = os.getenv('DB_NAME', 'ridn_db')
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check for onboarding_progress with company_id: None
    orphans = await db.onboarding_progress.find({"company_id": None}).to_list(100)
    print(f"Found {len(orphans)} orphaned onboarding_progress records.")
    
    for o in orphans:
        # Avoid printing heavy object if needed, but for now ID is enough
        print(f"Orphan ID: {o.get('_id')}, Pending: {o.get('pending_steps')}")
    
    if orphans:
        print("Deleting orphaned records...")
        result = await db.onboarding_progress.delete_many({"company_id": None})
        print(f"Deleted {result.deleted_count} records.")
    else:
        print("No orphaned records found.")

if __name__ == "__main__":
    asyncio.run(clean_orphans())
