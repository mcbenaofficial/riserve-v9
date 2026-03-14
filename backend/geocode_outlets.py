import asyncio
import random
from sqlalchemy import select
from database_pg import AsyncSessionLocal
from models_pg import Outlet

def get_random_coords(base_lat, base_lng, spread=0.08):
    lat = base_lat + random.uniform(-spread, spread)
    lng = base_lng + random.uniform(-spread, spread)
    return lat, lng

async def main():
    async with AsyncSessionLocal() as session:
        outlets = (await session.execute(select(Outlet))).scalars().all()
        for outlet in outlets:
            loc_lower = str(outlet.location).lower()
            if "chennai" in loc_lower:
                lat, lng = get_random_coords(13.0827, 80.2707)
            elif "mumbai" in loc_lower:
                lat, lng = get_random_coords(19.0760, 72.8777)
            elif "bengaluru" in loc_lower or "bangalore" in loc_lower:
                lat, lng = get_random_coords(12.9716, 77.5946)
            elif "delhi" in loc_lower:
                lat, lng = get_random_coords(28.7041, 77.1025)
            elif "hyderabad" in loc_lower:
                lat, lng = get_random_coords(17.3850, 78.4867)
            else:
                # Fallback to central India with a massive spread, or just a default
                lat, lng = get_random_coords(20.5937, 78.9629, spread=2.0)
            
            outlet.latitude = round(lat, 5)
            outlet.longitude = round(lng, 5)
            print(f"Geocoded '{outlet.name}' -> {lat:.5f}, {lng:.5f}")
        
        await session.commit()
        print(f"Successfully geocoded {len(outlets)} outlets.")

if __name__ == "__main__":
    asyncio.run(main())
