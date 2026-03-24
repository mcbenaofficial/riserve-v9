import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env")
load_dotenv(ENV_PATH)

import models_pg

DATABASE_URL = os.getenv("POSTGRES_URL", "postgresql+asyncpg://localhost:5432/riserve_db")

async def recreate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Dropping all tables...")
        # We need to drop with CASCADE because of multiple schemas or constraints
        # But for now let's just drop everything we know
        await conn.execute(text("DROP TABLE IF EXISTS hitl_preferences CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS company_settings CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS dashboard_configs CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS audit_logs CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS ai_conversations CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS onboarding_conversations CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS onboarding_progress CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS leave_balances CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS feedback CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS feedback_configs CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS slot_configs CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS inventory_alerts CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS inventory_logs CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS coupons CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS promotions CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS products CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS hitl_reports CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS transactions CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS booking_services CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS bookings CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS customers CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS staff CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS user_outlets CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS resources CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS outlets CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS companies CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
        
        print("Creating all tables from models...")
        await conn.run_sync(models_pg.Base.metadata.create_all)
        print("Done!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(recreate())
