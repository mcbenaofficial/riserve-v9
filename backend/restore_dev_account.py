import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from passlib.context import CryptContext
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

import models_pg
from database_pg import engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def restore_dev_account():
    print("🚀 Starting Final Canonical Dev Account Restoration...")
    
    async with AsyncSession(engine) as session:
        # 1. Ensure 'Simulated Salon' Company exists
        comp_name = "Simulated Salon"
        stmt = select(models_pg.Company).where(models_pg.Company.name == comp_name)
        company = (await session.execute(stmt)).scalar_one_or_none()
        
        if not company:
            company_id = str(uuid.uuid4())
            company = models_pg.Company(
                id=company_id,
                name=comp_name,
                business_type="salon",
                email="admin@ridn.com",
                phone="+91-9000000000",
                address="Dev Environment, Ri'SERVE HQ",
                plan="pro",
                status="active",
                is_booking_enabled=True,
                is_retail_enabled=True,
                is_workplace_enabled=True,
                enabled_features=["hq_intelligence", "inventory", "ai_flows", "crm"]
            )
            session.add(company)
            await session.flush()
            print(f"✅ Created Company: {comp_name} ({company_id})")
        else:
            company_id = company.id
            print(f"✅ Found Existing Company: {comp_name} ({company_id})")

        # 2. Ensure Admin User exists and is linked correctly
        admin_email = "admin@ridn.com"
        u_stmt = select(models_pg.User).where(models_pg.User.email == admin_email)
        admin_user = (await session.execute(u_stmt)).scalar_one_or_none()
        
        password_hash = pwd_context.hash("admin123")
        
        if not admin_user:
            admin_user = models_pg.User(
                id=str(uuid.uuid4()),
                email=admin_email,
                name="Ri'Serve Demo Admin",
                password_hash=password_hash,
                role="Admin",
                company_id=company_id,
                status="Active"
            )
            session.add(admin_user)
            print(f"✅ Created User: {admin_email}")
        else:
            admin_user.company_id = company_id
            admin_user.password_hash = password_hash
            admin_user.name = "Ri'Serve Demo Admin"
            print(f"✅ Updated User: {admin_email} (Linked to {comp_name})")
        
        await session.flush()

        # 3. Migrate HITL Reports (Workflows) from Urban Style Apparel if they exist
        old_comp_id = "1ecff24e-73de-42e2-b61d-aad9ae4ab28f"
        h_stmt = select(models_pg.HITLReport).where(models_pg.HITLReport.company_id == old_comp_id)
        reports = (await session.execute(h_stmt)).scalars().all()
        
        if reports:
            print(f"📦 Migrating {len(reports)} HITL reports to {comp_name}...")
            for r in reports:
                r.company_id = company_id
            print(f"✅ Migration complete.")
        else:
            print("ℹ️ No reports found in Urban Style Apparel to migrate.")

        # 4. Setup Test Context (Outlet, Service, SlotConfig)
        o_stmt = select(models_pg.Outlet).where(models_pg.Outlet.company_id == company_id)
        outlet = (await session.execute(o_stmt)).scalars().first()
        
        if not outlet:
            outlet_id = str(uuid.uuid4())
            outlet = models_pg.Outlet(
                id=outlet_id,
                company_id=company_id,
                name="Simulated Salon - Main Branch",
                location="Bengaluru",
                status="active"
            )
            session.add(outlet)
            await session.flush()
            print(f"✅ Created Outlet: {outlet.name}")
        else:
            outlet_id = outlet.id
            import sqlalchemy as sa
            await session.execute(sa.update(models_pg.Outlet).where(models_pg.Outlet.id == outlet_id).values(location="Bengaluru"))
            print(f"✅ Found Outlet: {outlet.name} (Updated Location)")

        # Service
        svc_id = "8b779ec6-73da-498d-9001-916df0751002"
        s_stmt = select(models_pg.Service).where(models_pg.Service.id == svc_id)
        service = (await session.execute(s_stmt)).scalar_one_or_none()
        
        if not service:
            service = models_pg.Service(
                id=svc_id,
                company_id=company_id,
                name="Premium Wash",
                price=799,
                duration=45,
                active=True
            )
            session.add(service)
            print(f"✅ Created Canonical Service: Premium Wash ({svc_id})")
        else:
            service.company_id = company_id
            print(f"✅ Found Canonical Service: {service.name}")

        # SlotConfig
        test_token = "6813b8dd-3bfc-4353-a0eb-d3e83c941874"
        sc_stmt = select(models_pg.SlotConfig).where(models_pg.SlotConfig.outlet_id == outlet_id)
        slot_config = (await session.execute(sc_stmt)).scalars().first()
        
        resources = [{"id": str(uuid.uuid4()), "name": "Station 1", "active": True}]
        
        config_data = {
            "id": str(uuid.uuid4()),
            "outlet_id": outlet_id,
            "company_id": company_id,
            "business_type": "salon",
            "embed_token": test_token,
            "slot_duration_min": 30,
            "operating_hours_start": "09:00",
            "operating_hours_end": "21:00",
            "resources": resources,
            "allow_online_booking": True,
            "booking_advance_days": 30,
            "customer_fields": [
                {"field_name": "name", "label": "Full Name", "field_type": "text", "required": True, "enabled": True, "order": 1},
                {"field_name": "phone", "label": "Phone Number", "field_type": "phone", "required": True, "enabled": True, "order": 2},
                {"field_name": "email", "label": "Email Address", "field_type": "email", "required": False, "enabled": True, "order": 3},
                {"field_name": "notes", "label": "Additional Notes", "field_type": "textarea", "required": False, "enabled": True, "order": 4}
            ],
            "plan": "plus",
            "branding": {
                "primary_color": "#FFC107",
                "secondary_color": "#212121",
                "font_family": "Inter"
            }
        }
        
        if not slot_config:
            slot_config = models_pg.SlotConfig(
                id=config_data["id"],
                company_id=company_id,
                outlet_id=outlet_id,
                configuration=config_data
            )
            session.add(slot_config)
            print(f"✅ Created SlotConfig with Test Token: {test_token}")
        else:
            slot_config.configuration = config_data
            print(f"✅ Updated SlotConfig with Test Token: {test_token}")

        await session.commit()
        print("\n🎉 Restoration Success!")

if __name__ == "__main__":
    asyncio.run(restore_dev_account())
