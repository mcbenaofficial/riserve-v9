import sys
import os
import asyncio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database_pg import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("Checking if is_veg exists...")
        res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='menu_items' AND column_name='is_veg';"))
        rows = res.fetchall()
        if not rows:
            await conn.execute(text("ALTER TABLE menu_items ADD COLUMN is_veg BOOLEAN DEFAULT TRUE;"))
            print("Added is_veg column to menu_items.")

            # Let's seed some items to non-veg randomly for demonstration purposes
            await conn.execute(text("UPDATE menu_items SET is_veg = FALSE WHERE name ILIKE '%chicken%' OR name ILIKE '%shrimp%' OR name ILIKE '%meat%' OR name ILIKE '%beef%' OR name ILIKE '%souvlaki%';"))
            print("Set some items to non-veg based on name.")
        else:
            print("is_veg already exists.")

if __name__ == "__main__":
    asyncio.run(main())
