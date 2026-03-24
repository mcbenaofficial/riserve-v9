import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend", ".env"))

import models_pg
from database_pg import engine

async def verify():
    async with AsyncSession(engine) as session:
        print("--- PostgreSQL Row Counts ---")
        tables = [
            "companies", "users", "outlets", "services", "customers", 
            "bookings", "transactions", "hitl_reports", "products",
            "dashboard_configs", "company_settings"
        ]
        
        for table in tables:
            res = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = res.scalar()
            print(f"{table.capitalize()}: {count}")
            
        # Check specific company
        res = await session.execute(select(models_pg.Company).filter_by(name="Simulated Salon"))
        comp = res.scalar()
        if comp:
            print(f"\n✅ Simulated Salon found (ID: {comp.id})")
        else:
            print("\n❌ Simulated Salon NOT FOUND in PostgreSQL.")

if __name__ == "__main__":
    asyncio.run(verify())
