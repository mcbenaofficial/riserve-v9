import asyncio
import os
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from passlib.context import CryptContext

import models_pg
from database_pg import engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

async def seed_rbac():
    print("Seeding RBAC roles and users...")
    
    async with AsyncSession(engine) as session:
        # 1. Ensure we have a company and a couple of outlets
        stmt = select(models_pg.Company).where(models_pg.Company.name == "Ri'Serve Demo")
        company = (await session.execute(stmt)).scalar_one_or_none()
        
        if not company:
            print("Demo company not found. Please run the main seed script first.")
            return
            
        company_id = company.id
        
        outlet_stmt = select(models_pg.Outlet).where(models_pg.Outlet.company_id == company_id).limit(2)
        outlets = (await session.execute(outlet_stmt)).scalars().all()
        
        if len(outlets) < 2:
            print("Need at least 2 outlets to test RBAC. Please run main seed.")
            return
            
        outlet_1_id = outlets[0].id
        outlet_2_id = outlets[1].id
        print(f"Using outlets: {outlets[0].name} and {outlets[1].name}")

        # 2. Users to Create
        users_to_create = [
            {
                "email": "superadmin@riserve.com",
                "name": "Super System Admin",
                "password": "password123",
                "role": "SuperAdmin",
                "outlets": [],
                "company_id": None
            },
            {
                "email": "admin2@riserve.com",
                "name": "Company Admin 2",
                "password": "password123",
                "role": "Admin",
                "outlets": [],
                "company_id": company_id
            },
            {
                "email": "manager1@riserve.com",
                "name": "Outlet 1 Manager",
                "password": "password123",
                "role": "Manager",
                "outlets": [outlet_1_id],
                "company_id": company_id
            },
            {
                "email": "manager2@riserve.com",
                "name": "Outlet 2 Manager",
                "password": "password123",
                "role": "Manager",
                "outlets": [outlet_2_id],
                "company_id": company_id
            },
            {
                "email": "user1@riserve.com",
                "name": "Outlet 1 Staff",
                "password": "password123",
                "role": "User",
                "outlets": [outlet_1_id],
                "company_id": company_id
            },
            {
                "email": "user2@riserve.com",
                "name": "Outlet 2 Staff",
                "password": "password123",
                "role": "User",
                "outlets": [outlet_2_id],
                "company_id": company_id
            }
        ]

        for u in users_to_create:
            # Delete if exists to ensure clean state
            # Delete staff first due to foreign key constraints
            del_staff_stmt = delete(models_pg.Staff).where(models_pg.Staff.email == u["email"])
            await session.execute(del_staff_stmt)
            
            del_user_stmt = delete(models_pg.User).where(models_pg.User.email == u["email"])
            await session.execute(del_user_stmt)
            
            user_id = str(uuid.uuid4())
            new_user = models_pg.User(
                id=user_id,
                company_id=u["company_id"],
                email=u["email"],
                name=u["name"],
                password_hash=hash_password(u["password"]),
                role=u["role"],
                phone="+91900000000" + str(len(u["name"])),
                status="Active"
            )
            session.add(new_user)
            await session.flush()
            
            # Map outlets
            if u["outlets"]:
                for oid in u["outlets"]:
                    # Find the outlet object
                    o_stmt = select(models_pg.Outlet).where(models_pg.Outlet.id == oid)
                    outlet_obj = (await session.execute(o_stmt)).scalar_one_or_none()
                    if outlet_obj:
                        new_user.outlets_mapping.append(outlet_obj)
            
            print(f"Created {u['role']}: {u['email']}")
            
            # Create corresponding Staff profile if Manager or User
            if u["role"] in ["Manager", "User"]:
                new_staff = models_pg.Staff(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    company_id=u["company_id"],
                    first_name=u["name"].split(" ")[0],
                    last_name=" ".join(u["name"].split(" ")[1:]),
                    email=u["email"],
                    phone="+91900000000" + str(len(u["name"])),
                    status="active",
                    department="operations" if u["role"] == "Manager" else "service",
                    employment_type="full_time",
                    outlet_id=u["outlets"][0] if u.get("outlets") else None
                )
                session.add(new_staff)
                print(f"  -> Created Staff profile for {u['name']}")

        await session.commit()
    print("RBAC Seeding complete!")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(seed_rbac())
