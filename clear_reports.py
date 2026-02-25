import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["ridn_db"]
    await db.hitl_reports.delete_many({})
    print("Cleared all reports")

if __name__ == "__main__":
    asyncio.run(main())
