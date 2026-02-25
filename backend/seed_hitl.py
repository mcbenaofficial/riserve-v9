import asyncio
import os
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'ridn_db')

async def seed_hitl_report():
    print("Connecting to MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Get the first company and user
    company = await db.companies.find_one()
    if not company:
        print("No company found. Run the main seed first.")
        return
        
    user = await db.users.find_one({"company_id": company["id"]})
    if not user:
        # Fallback to any user
        user = await db.users.find_one()
        if not user:
            print("No user found.")
            return

    print(f"Using Company: {company['name']} ({company['id']})")
    print(f"Using User: {user['email']} ({user['id']})")
    
    report_id = str(uuid.uuid4())
    report_data = {
        "id": report_id,
        "company_id": company["id"],
        "user_id": user["id"],
        "created_by_agent": True,
        "flow_type": "dynamic_pricing",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": None,
        "report_json": {
            "what_this_is": "Vorta Revenue Agent suggests increasing weekend Premium Wash prices by 15% to capitalize on predicted high demand.",
            "why_recommended": "Historical data shows a 45% surge in weekend bookings when local weather is clear. Current utilization for the upcoming weekend is tracking 20% faster than average.",
            "who_it_affects": ["Outlet Managers", "Customers booking weekend slots"],
            "how_it_works": ["Identify high-demand periods", "Temporarily adjust base price in slot configs", "Revert to standard pricing on Monday morning"],
            "chart_data": [
                {"name": "Mon", "value": 400},
                {"name": "Tue", "value": 300},
                {"name": "Wed", "value": 350},
                {"name": "Thu", "value": 500},
                {"name": "Fri", "value": 800},
                {"name": "Sat", "value": 1150},
                {"name": "Sun", "value": 1200}
            ],
            "cost_credits": 15,
            "recommended_action": "Enable Dynamic Surge Pricing (+15%)"
        }
    }
    
    await db.hitl_reports.insert_one(report_data)
    print(f"Successfully inserted pending HITL report: {report_id}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_hitl_report())
