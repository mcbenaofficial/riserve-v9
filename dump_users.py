import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def dump_users():
    load_dotenv('backend/.env')
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.getenv('DB_NAME', 'ridn_db')]
    
    users = await db.users.find({}, {"password_hash": 0}).to_list(100)
    print(f"Found {len(users)} users:")
    for u in users:
        print(u)

if __name__ == "__main__":
    asyncio.run(dump_users())
