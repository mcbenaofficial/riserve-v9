import asyncio
import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy import text, select, delete, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from passlib.context import CryptContext

# Setup Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, "backend"))
ENV_PATH = os.path.join(BASE_DIR, "backend", ".env")
load_dotenv(ENV_PATH)

import models_pg
from database_pg import engine as global_engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "riserve_db")
DATABASE_URL = os.getenv("POSTGRES_URL", "postgresql+asyncpg://localhost:5432/riserve_db")

async def restore():
    print("🚀 Starting Final Workspace Restoration...")
    
    # 1. Reset Database
    print("Resetting PostgreSQL Schema...")
    async with global_engine.begin() as conn:
        tables = [
            "hitl_preferences", "company_settings", "dashboard_configs", "audit_logs",
            "ai_conversations", "onboarding_conversations", "onboarding_progress",
            "leave_balances", "feedback", "feedback_configs", "slot_configs",
            "inventory_alerts", "inventory_logs", "coupons", "promotions",
            "products", "hitl_reports", "transactions", "booking_services",
            "bookings", "customers", "staff", "user_outlets", "users",
            "resources", "outlets", "companies", "alembic_version"
        ]
        for t in tables:
            await conn.execute(text(f"DROP TABLE IF EXISTS {t} CASCADE"))
        await conn.run_sync(models_pg.Base.metadata.create_all)
    
    # 2. Re-populate everything
    mongo_client = AsyncIOMotorClient(MONGO_URI)
    db = mongo_client[DB_NAME]
    
    async with AsyncSession(global_engine, expire_on_commit=False) as session:
        from mongo_to_postgres import parse_dt, parse_date
        
        # Identity maps
        ids = {"cos": set(), "us": set(), "svs": set(), "ts": set(), "cs": set()}

        # A. Companies
        print("Migrating Companies...")
        m_cos = await db.companies.find().to_list(None)
        for c in m_cos:
            cid = c.get("id")
            if cid:
                await session.merge(models_pg.Company(id=cid, name=c.get("name"), plan=c.get("plan"), status=c.get("status", "active"), created_at=parse_dt(c.get("created_at"))))
                ids["cos"].add(cid)
        await session.flush()

        # B. Services
        print("Migrating Services...")
        m_svs = await db.services.find().to_list(None)
        for s in m_svs:
            sid, cid = s.get("id"), s.get("company_id")
            if sid and cid in ids["cos"]:
                await session.merge(models_pg.Service(id=sid, company_id=cid, name=s.get("name"), price=s.get("price", 0), duration=s.get("duration", 30)))
                ids["svs"].add(sid)
        await session.flush()

        # C. Users
        print("Migrating Users...")
        m_u = await db.users.find().to_list(None)
        for u in m_u:
            uid, cid = u.get("id"), u.get("company_id")
            if uid and (not cid or cid in ids["cos"]):
                await session.merge(models_pg.User(id=uid, company_id=cid, email=u.get("email"), name=u.get("name"), password_hash=u.get("password_hash"), role=u.get("role", "User")))
                ids["us"].add(uid)
        await session.flush()

        # D. Outlets & Resources
        print("Migrating Outlets...")
        m_ot = await db.outlets.find().to_list(None)
        for ot in m_ot:
            oid, cid = ot.get("id"), ot.get("company_id")
            if oid and cid in ids["cos"]:
                await session.merge(models_pg.Outlet(id=oid, company_id=cid, name=ot.get("name"), location=ot.get("location") or ot.get("address")))
                for res in ot.get("resources", []):
                    rid = res.get("id")
                    if rid:
                        await session.merge(models_pg.Resource(id=rid, outlet_id=oid, name=res.get("name"), capacity=res.get("capacity", 1)))
        await session.flush()

        # E. Customers
        print("Migrating Customers...")
        m_c = await db.customers.find().to_list(None)
        for c in m_c:
            pid, cid = c.get("id"), c.get("company_id")
            if pid and cid in ids["cos"]:
                await session.merge(models_pg.Customer(id=pid, company_id=cid, name=c.get("name"), email=c.get("email")))
                ids["cs"].add(pid)
        await session.flush()

        # F. Bookings
        print("Migrating Bookings...")
        m_b = await db.bookings.find().to_list(None)
        for b in m_b:
            bid, cid, cust_id = b.get("id"), b.get("company_id"), b.get("customer_id")
            if bid and cid in ids["cos"] and cust_id in ids["cs"]:
                await session.merge(models_pg.Booking(
                    id=bid, company_id=cid, outlet_id=b.get("outlet_id"), customer_id=cust_id,
                    date=parse_date(b.get("date")), time=b.get("time"), amount=b.get("amount", 0), status=b.get("status", "Confirmed")
                ))
        await session.flush()

        # G. HITL Reports
        print("Migrating HITL...")
        m_h = await db.hitl_reports.find().to_list(None)
        for h in m_h:
            hid, cid = h.get("id"), h.get("company_id")
            if hid and cid in ids["cos"]:
                await session.merge(models_pg.HITLReport(id=hid, company_id=cid, flow_type=h.get("flow_type"), report_json=h.get("report_json", {}), status=h.get("status", "pending")))

        # H. Settings & Dashboards
        print("Migrating Settings...")
        m_st = await db.company_settings.find().to_list(None)
        attached_cos_with_settings = set()
        for s in m_st:
            cid = s.get("company_id")
            if cid in ids["cos"]:
                await session.merge(models_pg.CompanySetting(id=s.get("id") or str(uuid.uuid4()), company_id=cid, general_settings=s.get("general_settings", {})))
                attached_cos_with_settings.add(cid)

        # I. SEEDING EXTRA DATA (DEMO WORKSPACE)
        print("\nInjecting Premium Workspace Data...")
        
        # 1. Admin link
        ss_cid = "c4c35eb4-565d-4fc7-89be-0562ff79e8a4"
        if ss_cid in ids["cos"]:
            # Ensure admin@ridn.com
            res_admin = await session.execute(select(models_pg.User).where(models_pg.User.email == "admin@ridn.com"))
            admin_u = res_admin.scalar_one_or_none()
            if not admin_u:
                admin_id = str(uuid.uuid4())
                await session.merge(models_pg.User(id=admin_id, company_id=ss_cid, email="admin@ridn.com", name="Main Admin", password_hash=hash_password("password123"), role="Admin"))
            else:
                admin_u.company_id = ss_cid
                admin_id = admin_u.id
            
            # 2. Premium Dashboard Config
            widgets = [
                {"id": "w1", "type": "RevenueChart", "title": "Real-time Revenue", "grid": {"x": 0, "y": 0, "w": 6, "h": 4}},
                {"id": "w2", "type": "BookingList", "title": "Upcoming Bookings", "grid": {"x": 6, "y": 0, "w": 6, "h": 4}},
                {"id": "w3", "type": "AIPredictions", "title": "AI Growth Insights", "grid": {"x": 0, "y": 4, "w": 12, "h": 3}}
            ]
            await session.merge(models_pg.DashboardConfig(id=str(uuid.uuid4()), user_id=admin_id, company_id=ss_cid, name="Executive Workspace", widgets=widgets, is_default=True))
            print("✅ Premium Dashboard Injected for Simulated Salon.")

        await session.commit()
    
    print("\n🎉 DONE! Full workspace restoration and enhancement complete.")

if __name__ == "__main__":
    asyncio.run(restore())
