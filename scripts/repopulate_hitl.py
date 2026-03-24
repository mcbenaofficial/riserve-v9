import asyncio
import requests
from motor.motor_asyncio import AsyncIOMotorClient

async def clear_reports():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["ridn_db"]
    await db.hitl_reports.delete_many({})
    print("Cleared all HITL reports.")

def regenerate_reports():
    # Login
    login_resp = requests.post("http://localhost:8000/api/auth/login", json={"email": "admin@ridn.com", "password": "admin123"})
    if login_resp.status_code != 200:
        print("Login failed:", login_resp.text)
        return
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Analyze Schedule
    resp = requests.post("http://localhost:8000/api/hitl/analyze-schedule", headers=headers, json={})
    print("Analyze Schedule:", resp.json())

    # Analyze Inventory
    resp = requests.post("http://localhost:8000/api/hitl/analyze-inventory", headers=headers, json={})
    print("Analyze Inventory:", resp.json())

    # Generate Dynamic Pricing Report
    pricing_data = {
        "flow_type": "dynamic_pricing",
        "insight_data": {
            "description": "Predicted high demand for upcoming weekend.",
            "reasoning": "Historical surge during sunny weekends.",
            "affected_roles": ["Managers"],
            "steps": ["Monitor weather", "Adjust base price"],
            "chart_data": [
                {"name": "Fri", "value": 80, "goal": 100}, 
                {"name": "Sat", "value": 150, "goal": 100}, 
                {"name": "Sun", "value": 140, "goal": 100}
            ],
            "chart_type": "currency"
        },
        "recommended_action": "Enable Surge Pricing (+10%)",
        "cost_credits": 5
    }
    resp = requests.post("http://localhost:8000/api/hitl/generate-report", headers=headers, json=pricing_data)
    print("Generate Pricing Report:", resp.json())

if __name__ == "__main__":
    asyncio.run(clear_reports())
    regenerate_reports()
