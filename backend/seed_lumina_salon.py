import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database_pg import engine, AsyncSessionLocal
import models_pg

COMPANY_ID = "c71d6f4d-11aa-4aba-9f5e-1ebf8a964a32"

async def seed_lumina():
    async with AsyncSessionLocal() as db:
        # Check if exists
        existing = await db.execute(select(models_pg.Company).where(models_pg.Company.id == COMPANY_ID))
        if existing.scalar_one_or_none():
            print("Lumina Salon already exists.")
            return
            
        company = models_pg.Company(
            id=COMPANY_ID,
            name="Lumina Salon Chennai",
            business_type="salon",
            email="hello@luminasalon.com",
            phone="+91-98765-11111",
            address="Anna Nagar, Chennai 600040",
            plan="pro",
            status="active",
            enabled_features=["booking", "crm", "staff_management"],
            licensed_modules=["booking", "customer_360", "finance"],
            is_booking_enabled=True,
            is_retail_enabled=False,
            is_workplace_enabled=False,
        )
        db.add(company)
        await db.flush()
        
        # Add primary settings for branding
        settings = models_pg.CompanySetting(
            id=str(uuid.uuid4()),
            company_id=COMPANY_ID,
            general_settings={
                "branding": {
                    "primary_color": "#D4AF37", # Gold
                    "font_family": "Inter",
                    "logo_url": "https://pub-e7d66d628d094ebfa20ab7670acb45bb.r2.dev/lumina-logo.png",
                    "hero_image": "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=1200",
                    "hero_tagline": "Book your glow-up at Lumina Salon Chennai",
                    "custom_domain": "luminasalon.com"
                }
            }
        )
        db.add(settings)
        await db.commit()
        print("Lumina Salon Chennai successfully seeded!")

if __name__ == "__main__":
    asyncio.run(seed_lumina())
