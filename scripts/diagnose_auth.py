import asyncio
import os
import sys
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from passlib.context import CryptContext

# Setup Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(BASE_DIR, "backend"))

import models_pg
from database_pg import engine

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def test_auth():
    async with AsyncSession(engine) as session:
        email = "admin@ridn.com"
        password = "password123"
        print(f"Testing login for {email}...")
        
        stmt = select(models_pg.User).where(models_pg.User.email == email)
        res = await session.execute(stmt)
        user = res.scalar_one_or_none()
        
        if not user:
            print("❌ User NOT found in PostgreSQL!")
            return
            
        print(f"✅ User found: {user.name} (Role: {user.role})")
        print(f"Stored Hash: {user.password_hash}")
        
        match = pwd_context.verify(password, user.password_hash)
        if match:
            print("✅ Password VERIFIED successfully!")
        else:
            print("❌ Password verification FAILED!")
            
        # Also check current session state if possible
        # Check if the server is using the same POSTGRES_URL
        print(f"Engine URL: {engine.url}")

if __name__ == "__main__":
    asyncio.run(test_auth())
