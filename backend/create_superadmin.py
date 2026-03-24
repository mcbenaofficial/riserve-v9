import asyncio
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from passlib.context import CryptContext

import models_pg
from database_pg import engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def run():
    async with AsyncSession(engine) as session:
        # Check if already exists
        stmt = select(models_pg.User).where(models_pg.User.email == "superadmin@riserve.com")
        existing_user = (await session.execute(stmt)).scalar_one_or_none()
        
        if existing_user:
            # force reset password just in case
            existing_user.password_hash = pwd_context.hash("password123")
            existing_user.role = "SuperAdmin"
            await session.commit()
            print("Reset existing SuperAdmin password to password123.")
            return

        new_user = models_pg.User(
            id=str(uuid.uuid4()),
            company_id=None,
            email="superadmin@riserve.com",
            name="Super System Admin",
            password_hash=pwd_context.hash("password123"),
            role="SuperAdmin",
            phone="+919000000000",
            status="Active"
        )
        session.add(new_user)
        await session.commit()
        print("SuperAdmin created explicitly: superadmin@riserve.com / password123")

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    loop.run_until_complete(run())
