import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from passlib.context import CryptContext
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

import models_pg
from database_pg import engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def link_admin_account():
    print("Initiating Admin Account Seeder...")
    
    async with AsyncSession(engine) as session:
        # 1. Target the 'Simulated Salon'
        stmt = select(models_pg.Company).where(models_pg.Company.name == "Simulated Salon")
        company = (await session.execute(stmt)).scalar_one_or_none()
        
        if not company:
            print("❌ 'Simulated Salon' not found. Please run simulate_hitl.py first to generate the base environment.")
            return
            
        company_id = company.id
        print(f"✅ Found target company: {company.name} ({company_id})")

        # 2. Check and Create Admin Account
        admin_email = "admin@ridn.com"
        
        # Ensure clean state for this demo
        del_stmt = delete(models_pg.User).where(models_pg.User.email == admin_email)
        await session.execute(del_stmt)
        print(f"🧹 Removed existing {admin_email} to ensure clean mapping.")
            
        admin_id = str(uuid.uuid4())
        admin_user = models_pg.User(
            id=admin_id,
            company_id=company_id,
            email=admin_email,
            name="Ri'Serve Demo Admin",
            password_hash=hash_password("password123"),
            role="Admin",
            phone="+919000000000",
            status="Active"
        )
        session.add(admin_user)
        await session.commit()
        
        print(f"🎉 Successfully created {admin_email} mapped to actual company.")
        print(f"   Role: Admin")
        print(f"   Password: password123")
        
        # Re-open session to count
        async with AsyncSession(engine) as count_session:
            hitl_stmt = select(func.count(models_pg.HITLReport.id)).where(models_pg.HITLReport.company_id == company_id)
            hitl_count = (await count_session.execute(hitl_stmt)).scalar()
            
            booking_stmt = select(func.count(models_pg.Booking.id)).where(models_pg.Booking.company_id == company_id)
            bookings_count = (await count_session.execute(booking_stmt)).scalar()
            
            print(f"📊 The account now has visibility to: {hitl_count} HITL Scenarios | {bookings_count} Bookings / Customers.")
    
if __name__ == "__main__":
    print("Running Link Admin Script...")
    asyncio.run(link_admin_account())
