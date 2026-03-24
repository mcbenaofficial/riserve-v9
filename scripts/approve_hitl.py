import asyncio
import requests
from motor.motor_asyncio import AsyncIOMotorClient

async def approve_pending():
    # Login
    login_resp = requests.post("http://localhost:8000/api/auth/login", json={"email": "admin@ridn.com", "password": "admin123"})
    if login_resp.status_code != 200:
        print("Login failed:", login_resp.text)
        return
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["ridn_db"]
    reports = await db.hitl_reports.find({"status": "pending"}).to_list(100)
    
    for r in reports:
        resp = requests.post("http://localhost:8000/api/hitl/confirm", headers=headers, json={
            "report_id": r["id"],
            "action": "approved",
            "reason": "Looks good"
        })
        print(f"Approved {r['id']}:", resp.json())

if __name__ == "__main__":
    asyncio.run(approve_pending())
