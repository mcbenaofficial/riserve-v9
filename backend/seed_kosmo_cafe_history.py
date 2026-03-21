import asyncio
import os
import sys
import uuid
import random
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database_pg import engine
from models_pg import MenuItem, Product, RestaurantOrder

# Kosmo Cafe IDs
COMPANY_ID = '3821aa11-8386-452d-b6be-174ef77d1970'
OUTLET_ID = '36e8bc27-f972-4859-9f99-459ecece81fc'
SNACKS_IMG = "/uploads/kosmo_snacks.png"

PASTRIES = [
    {"name": "Butter Croissant", "price": 120, "cost": 40},
    {"name": "Chocolate Croissant", "price": 150, "cost": 50},
    {"name": "Blueberry Muffin", "price": 130, "cost": 45},
    {"name": "Red Velvet Cupcake", "price": 140, "cost": 50},
    {"name": "Almond Biscotti (2 pcs)", "price": 90, "cost": 30},
    {"name": "Lemon Tart", "price": 160, "cost": 60},
]

def generate_random_orders(menu_items, days=30):
    orders_to_create = []
    now = datetime.now(timezone.utc)
    
    order_count = 1
    
    for day_offset in range(days, -1, -1):
        # 5 to 15 orders a day
        num_orders = random.randint(5, 15)
        current_day = now - timedelta(days=day_offset)
        
        # Distribute orders throughout the day (8 AM to 8 PM)
        for _ in range(num_orders):
            hour = random.randint(8, 20)
            minute = random.randint(0, 59)
            order_time = current_day.replace(hour=hour, minute=minute, second=0, microsecond=0)
            
            # Pick 1 to 4 items
            num_items = random.randint(1, 4)
            chosen_items = random.choices(menu_items, k=num_items)
            
            items_json = []
            total_amount = 0
            for item in chosen_items:
                quantity = random.randint(1, 2)
                price = item.price
                amount = float(price) * quantity
                total_amount += amount
                
                items_json.append({
                    "itemId": item.id,
                    "name": item.name,
                    "quantity": quantity,
                    "price": float(price),
                    "inventoryLinked": item.inventory_linked,
                    "inventoryProductId": item.inventory_product_id
                })
                
            status = "Completed"
            if day_offset == 0 and hour >= now.hour:
                status = random.choice(["New", "Preparing", "ReadyToCollect"])
                order_time = now # recent
                
            order = RestaurantOrder(
                id=str(uuid.uuid4()),
                company_id=COMPANY_ID,
                outlet_id=OUTLET_ID,
                order_number=f"KC-{order_count:04d}",
                customer_name=f"Guest {random.randint(100,999)}",
                contact_number=f"98765{random.randint(10000,99999)}",
                order_type=random.choice(["dine_in", "takeaway"]),
                items=items_json,
                total_amount=total_amount,
                status=status,
                payment_status="paid" if status == "Completed" else "pending",
                confirmation_token=str(uuid.uuid4()),
                created_at=order_time,
                updated_at=order_time,
            )
            orders_to_create.append(order)
            order_count += 1
            
    return orders_to_create

async def seed_kosmo():
    print("🚀 Seeding Pastries, Inventory and Order History for Kosmo Cafe...")
    
    async with AsyncSession(engine) as session:
        # 1. Create Pastries in Inventory
        # Check if they exist first, if not create
        print("🍞 Seeding Inventory Products...")
        products = []
        for p_data in PASTRIES:
            # Check existing
            stmt = select(Product).where(Product.company_id == COMPANY_ID, Product.name == p_data["name"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                prod = Product(
                    id=str(uuid.uuid4()),
                    company_id=COMPANY_ID,
                    outlet_id=OUTLET_ID,
                    name=p_data["name"],
                    sku=p_data["name"].upper().replace(" ", "_")[:10],
                    category="Bakery",
                    price=Decimal(p_data["price"]),
                    cost=Decimal(p_data["cost"]),
                    stock_quantity=100,
                    active=True
                )
                session.add(prod)
                products.append(prod)
            else:
                existing.stock_quantity = 100
                session.add(existing)
                products.append(existing)
                
        await session.commit()
        print(f"✅ Created/Updated {len(products)} products in inventory.")
        
        # 2. Add them to Menu
        print("🧁 Adding Pastries to Menu...")
        menu_items_pastries = []
        for idx, p_data in enumerate(PASTRIES):
            # Find the corresponding product from the DB by name (new query)
            stmt = select(Product).where(Product.company_id == COMPANY_ID, Product.name == p_data["name"])
            prod = (await session.execute(stmt)).scalar_one_or_none()
            
            # Check if it's already in the menu
            stmt = select(MenuItem).where(MenuItem.company_id == COMPANY_ID, MenuItem.outlet_id == OUTLET_ID, MenuItem.name == p_data["name"])
            existing_menu = (await session.execute(stmt)).scalar_one_or_none()
            
            if not existing_menu:
                menu_item = MenuItem(
                    id=str(uuid.uuid4()),
                    company_id=COMPANY_ID,
                    outlet_id=OUTLET_ID,
                    category="Pastries & Bakery",
                    name=p_data["name"],
                    description=f"Freshly baked {p_data['name'].lower()}",
                    price=Decimal(p_data["price"]),
                    image_url=SNACKS_IMG,
                    image_urls=[SNACKS_IMG],
                    inventory_product_id=prod.id if prod else None,
                    inventory_linked=True if prod else False,
                    available=True,
                    active=True,
                    display_order=50 + idx
                )
                session.add(menu_item)
                menu_items_pastries.append(menu_item)
            else:
                existing_menu.inventory_product_id = prod.id if prod else None
                existing_menu.inventory_linked = True if prod else False
                session.add(existing_menu)
                menu_items_pastries.append(existing_menu)
                
        await session.commit()
        print(f"✅ Pastries linked to Menu.")
        
        # 3. Generate Orders
        # Clear existing orders for Kosmo Cafe to avoid duplications running the script multiple times
        print("🧹 Clearing existing orders for Kosmo Cafe...")
        await session.execute(delete(RestaurantOrder).where(RestaurantOrder.outlet_id == OUTLET_ID))
        await session.commit()
        
        # Now query all menu items for the outlet to form realistic orders
        stmt = select(MenuItem).where(MenuItem.outlet_id == OUTLET_ID)
        all_menu_items = (await session.execute(stmt)).scalars().all()
        
        print(f"📋 Found {len(all_menu_items)} total menu items. Generating 30 days of orders...")
        
        orders = generate_random_orders(all_menu_items, days=30)
        
        # Bulk add orders (might be around 300)
        session.add_all(orders)
        await session.commit()
        
        print(f"✅ Populated {len(orders)} historical orders.")
        print("🎉 Seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_kosmo())
