"""
One-time migration: sync all SlotConfig JSONB resources -> resources DB table.
Run from backend dir: python migrate_sync_resources.py
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import models_pg

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/ridn_db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def migrate():
    async with AsyncSessionLocal() as session:
        # Load all slot configs
        result = await session.execute(select(models_pg.SlotConfig))
        configs = result.scalars().all()
        print(f"Found {len(configs)} slot configs to process")

        synced = 0
        for config in configs:
            conf = config.configuration or {}
            resources = conf.get("resources", [])
            outlet_id = config.outlet_id

            for r in resources:
                r_id = r.get("id")
                if not r_id:
                    continue

                existing = (await session.execute(
                    select(models_pg.Resource).where(models_pg.Resource.id == r_id)
                )).scalar_one_or_none()

                if existing:
                    existing.name = r.get("name", existing.name)
                else:
                    session.add(models_pg.Resource(
                        id=r_id,
                        outlet_id=outlet_id,
                        name=r.get("name", "Resource"),
                        capacity=r.get("capacity", 1),
                        active=r.get("active", True)
                    ))
                    synced += 1
                    print(f"  Synced resource: {r_id} ({r.get('name', 'Resource')}) for outlet {outlet_id}")

        await session.commit()
        print(f"Done. Synced {synced} new resources into DB.")


if __name__ == "__main__":
    asyncio.run(migrate())
