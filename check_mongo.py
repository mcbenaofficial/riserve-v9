import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check():
    c = AsyncIOMotorClient('mongodb://localhost:27017')
    db = c.riserve_db
    print("Collections:", await db.list_collection_names())
    cp = await db.companies.find_one({'name': 'Simulated Salon'})
    if cp:
        print(f"Company ID: {cp['id']}")
        services = await db.services.find({'company_id': cp['id']}).to_list(None)
        print(f"Services count: {len(services)}")
        for s in services:
            print(f"  Service: {s['name']} (ID: {s['id']})")
    else:
        print("No Simulated Salon found")

if __name__ == "__main__":
    asyncio.run(check())
