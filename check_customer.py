import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_customer():
    load_dotenv('backend/.env')
    mongo_url = os.getenv('MONGO_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.getenv('DB_NAME', 'ridn_db')]
    
    email = "mcbenaofficial@gmail.com"
    phone = "09176582404"
    
    print(f"Checking for customer with email: {email} or phone: {phone}")
    
    customer = await db.customers.find_one({
        "$or": [
            {"email": email},
            {"phone": phone}
        ]
    })
    
    if customer:
        print("✅ Customer FOUND in database:")
        print(f"ID: {customer.get('id')}")
        print(f"Name: {customer.get('name')}")
        print(f"Email: {customer.get('email')}")
        print(f"Phone: {customer.get('phone')}")
        print(f"Created At: {customer.get('created_at')}")
    else:
        print("❌ Customer NOT found in database.")

if __name__ == "__main__":
    asyncio.run(check_customer())
