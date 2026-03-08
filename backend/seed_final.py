import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from passlib.context import CryptContext
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

import models_pg
from database_pg import engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def seed_retail():
    print("Seeding Retail Outlet via SQLAlchemy/PostgreSQL...")

    async with AsyncSession(engine) as session:
        # Clear old data to prevent collisions
        del_user_stmt = delete(models_pg.User).where(models_pg.User.email == "admin@urbanstyle.com")
        await session.execute(del_user_stmt)
        
        del_company_stmt = delete(models_pg.Company).where(models_pg.Company.email == "hello@urbanstyle.com")
        await session.execute(del_company_stmt)
        
        # 1. Inject Company
        company_id = str(uuid.uuid4())
        
        company = models_pg.Company(
            id=company_id,
            name="Urban Style Apparel",
            business_type="Retail Clothing Outlet",
            email="hello@urbanstyle.com",
            phone="+1 (555) 123-4567",
            address="123 Fashion Blvd, NY",
            plan="pro",
            status="active",
            is_booking_enabled=False,
            is_retail_enabled=True,
            is_workplace_enabled=True
        )
        session.add(company)
        await session.flush()
        print(f"✅ Created Retail Company (ID: {company_id})")
        
        # 2. Create Settings explicitly for this company_id
        settings = models_pg.CompanySetting(
            id=str(uuid.uuid4()),
            company_id=company_id,
            general_settings={
                "company_name": "Urban Style Apparel",
                "business_type": "Retail Clothing Outlet",
                "currency": "USD",
                "timezone": "America/New_York",
                "email": "hello@urbanstyle.com",
                "phone": "+1 (555) 123-4567",
                "address": "123 Fashion Blvd, NY"
            }
        )
        session.add(settings)
        print("✅ Created Company Settings")

        user_id = str(uuid.uuid4())
        
        # 3. Create User
        admin_user = models_pg.User(
            id=user_id,
            email="admin@urbanstyle.com",
            name="Alex Admin",
            password_hash=hash_password("admin123"),
            role="Admin",
            phone="+1 (555) 123-4567",
            status="Active",
            company_id=company_id
        )
        session.add(admin_user)
        print(f"✅ Linked Admin to Company (User ID: {user_id})")

        # 4. Inject Outlet
        outlet_id = str(uuid.uuid4())
        outlet = models_pg.Outlet(
            id=outlet_id,
            company_id=company_id,
            name="Downtown Store",
            status="active",
            location="123 Fashion Blvd, New York, NY 10001"
        )
        session.add(outlet)
        print("✅ Created Retail Outlet")

        await session.commit()

    print("\n-----------------------------------------")
    print("🎉 Retail Seed Complete!")
    print(f"Login URL: http://localhost:3000/login")
    print(f"Email: admin@urbanstyle.com")
    print(f"Password: admin123")
    print("-----------------------------------------")

if __name__ == "__main__":
    asyncio.run(seed_retail())
