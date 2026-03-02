import asyncio
import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_

# Load environment variables
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

import models_pg
from database_pg import engine

async def seed_bengaluru_bookings():
    print("Initiating Bengaluru Booking Seeder...")
    
    async with AsyncSession(engine) as session:
        # 1. Get an active company
        stmt = select(models_pg.Company).limit(1)
        company = (await session.execute(stmt)).scalar_one_or_none()
        
        if not company:
            print("❌ No companies found in the database. Please run the seed script first.")
            return
            
        company_id = company.id
        
        # 2. Find the Bengaluru outlet
        outlet_stmt = select(models_pg.Outlet).where(
            models_pg.Outlet.company_id == company_id,
            models_pg.Outlet.name.ilike("%Bengaluru%")
        )
        bengaluru_outlet = (await session.execute(outlet_stmt)).scalar_one_or_none()
        
        if not bengaluru_outlet:
            print("❌ Bengaluru outlet not found. Creating a placeholder Bengaluru outlet.")
            bengaluru_outlet_id = str(uuid.uuid4())
            # Create slot config resources
            res_list = [{"id": f"res_{i}", "name": f"Station {i}", "active": True} for i in range(1, 6)]
            
            bengaluru_outlet = models_pg.Outlet(
                id=bengaluru_outlet_id,
                company_id=company_id,
                name="Bengaluru Flagship",
                status="Active",
                location="Indiranagar, Bengaluru",
                capacity=5
            )
            session.add(bengaluru_outlet)
            
            # Create SlotConfig for this outlet
            slot_config = models_pg.SlotConfig(
                id=str(uuid.uuid4()),
                outlet_id=bengaluru_outlet_id,
                company_id=company_id,
                slot_duration_min=30,
                operating_hours_start="09:00",
                operating_hours_end="18:00",
                resources=res_list,
                allow_online_booking=True,
                booking_advance_days=7,
                embed_token=str(uuid.uuid4())
            )
            session.add(slot_config)
            await session.flush()
            print("✅ Created placeholder Bengaluru Priority Outlet.")
        else:
            bengaluru_outlet_id = bengaluru_outlet.id
            # Try to get resources from slot config
            sc_stmt = select(models_pg.SlotConfig).where(models_pg.SlotConfig.outlet_id == bengaluru_outlet_id)
            slot_config = (await session.execute(sc_stmt)).scalar_one_or_none()
            
        print(f"✅ Found Bengaluru Outlet: {bengaluru_outlet.name} ({bengaluru_outlet_id})")

        # Clear existing demo bookings for this outlet to avoid clutter
        del_stmt = delete(models_pg.Booking).where(
            models_pg.Booking.outlet_id == bengaluru_outlet_id,
            models_pg.Booking.notes == "AUTO_SEEDED_BENGALURU"
        )
        await session.execute(del_stmt)

        # 3. Get / Generate Services
        svc_stmt = select(models_pg.Service).where(models_pg.Service.company_id == company_id).limit(10)
        services = (await session.execute(svc_stmt)).scalars().all()
        
        if not services:
            print("Creating placeholder services...")
            # Check if these names already exist to be safe
            services_data = [
                {"name": "Classic Haircut", "price": 800, "duration": 45},
                {"name": "Balayage & Color", "price": 4500, "duration": 120},
                {"name": "Spa Pedicure", "price": 1200, "duration": 60}
            ]
            services = []
            for s_data in services_data:
                exist_stmt = select(models_pg.Service).where(
                    models_pg.Service.company_id == company_id,
                    models_pg.Service.name == s_data["name"]
                )
                existing = (await session.execute(exist_stmt)).scalar_one_or_none()
                if not existing:
                    new_svc = models_pg.Service(
                        id=str(uuid.uuid4()),
                        company_id=company_id,
                        **s_data
                    )
                    session.add(new_svc)
                    services.append(new_svc)
                else:
                    services.append(existing)
            await session.flush()
            
        # 4. Generate Bookings for the current week
        now = datetime.now(timezone.utc)
        monday = now - timedelta(days=now.weekday())
        
        names = ["Aarav Patel", "Priya Sharma", "Rohan Gupta", "Ananya Singh", "Vikram Reddy", "Neha Desai", "Arjun Nair", "Kavya Menon", "Siddharth Rao", "Ishaan Verma"]
        
        resources = slot_config.resources if slot_config else [{"id": None, "name": "None"}]
        
        for day_offset in range(7):  # Monday through Sunday
            current_date = monday + timedelta(days=day_offset)
            current_date_obj = current_date.date()
            
            # 3 to 8 bookings per day
            num_bookings = random.randint(3, 8)
            
            for _ in range(num_bookings):
                service = random.choice(services)
                customer_name = random.choice(names)
                hour = random.randint(9, 18) # 9 AM to 6 PM
                time_str = f"{hour:02d}:00"
                
                # Create Customer (check if exists first optionally, but for seed just create new ones)
                customer_id = str(uuid.uuid4())
                new_customer = models_pg.Customer(
                    id=customer_id,
                    name=customer_name,
                    email=f"{customer_name.replace(' ', '').lower()}@example.com",
                    phone=f"+9198{random.randint(10000000, 99999999)}",
                    notes="Seeded Bengaluru Customer",
                    company_id=company_id,
                    total_revenue=float(service.price),
                    total_bookings=1,
                    last_visit=current_date_obj
                )
                session.add(new_customer)
                
                # Create Booking
                resource = random.choice(resources)
                
                new_booking = models_pg.Booking(
                    id=str(uuid.uuid4()),
                    customer_id=customer_id,
                    customer_name=customer_name,
                    customer_phone=new_customer.phone,
                    customer_email=new_customer.email,
                    time=time_str,
                    date=current_date_obj,
                    service_id=service.id,
                    outlet_id=bengaluru_outlet_id,
                    resource_id=resource.get("id") if isinstance(resource, dict) else None,
                    duration=service.duration,
                    notes="AUTO_SEEDED_BENGALURU",
                    amount=float(service.price),
                    status=random.choice(["Confirmed", "Pending", "Completed"]),
                    source="app",
                    company_id=company_id,
                    created_at=now
                )
                new_booking.services.append(service)
                session.add(new_booking)

        await session.commit()
        print("🎉 Seeding Complete!")

if __name__ == "__main__":
    print("Running Bengaluru Seed Script...")
    asyncio.run(seed_bengaluru_bookings())
