import sys
import os
import asyncio
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database_pg import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("Checking companies for restaurant_orders feature...")
        await conn.execute(text("UPDATE companies "
                                "SET enabled_features = COALESCE(enabled_features, '[]'::jsonb) || '[\"restaurant_orders\"]'::jsonb "
                                "WHERE enabled_features IS NULL OR NOT enabled_features @> '[\"restaurant_orders\"]'::jsonb;"))
        print("Enabled restaurant_orders for companies.")

if __name__ == "__main__":
    asyncio.run(main())
