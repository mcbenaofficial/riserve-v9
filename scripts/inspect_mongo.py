import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "riserve_db")

async def inspect():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    
    print("--- Companies ---")
    companies = await db.companies.find().to_list(None)
    company_ids = set()
    for c in companies:
        cid = c.get('id')
        company_ids.add(cid)
        print(f"ID: {cid} | Name: {c.get('name')}")
    
    print("\n--- User (admin@ridn.com) ---")
    admin = await db.users.find_one({"email": "admin@ridn.com"})
    if admin:
        print(f"ID: {admin.get('id')} | CompanyID: {admin.get('company_id')} | Name: {admin.get('name')}")
    else:
        print("User admin@ridn.com NOT FOUND.")

    print("\n--- Dashboard Configs ---")
    dashboards = await db.dashboard_configs.find().to_list(None)
    for d in dashboards:
        print(f"ID: {d.get('id')} | CompanyID: {d.get('company_id')} | Name: {d.get('name')}")
    
    print("\n--- Products (Orphans) ---")
    products = await db.products.find().to_list(None)
    for p in products:
        cid = p.get('company_id')
        if cid not in company_ids:
            print(f"ORPHAN Product ID: {p.get('id')} | CompanyID: {cid} | Name: {p.get('name')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(inspect())
