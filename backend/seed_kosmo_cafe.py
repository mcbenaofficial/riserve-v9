"""
Seed script for Kosmo Cafe — a test restaurant account.

Run:
    cd backend && source venv/bin/activate
    python seed_kosmo_cafe.py

Creates:
    - Company: Kosmo Cafe
    - Admin:   admin@kosmocafe.com / Kosmo@2026
    - Outlet:  Kosmo Cafe – Indiranagar
    - Menu:    15+ items across 6 categories
    - Orders:  5 sample orders in various statuses
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database_pg import engine, AsyncSessionLocal
import models_pg

# Fluent Emoji 3D icon URLs
_F = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets'

# (name, icon_url, display_order)
V1_CATEGORIES = [
    ("Coffee",    f"{_F}/Hot%20beverage/3D/hot_beverage_3d.png",                   0),
    ("Tea",       f"{_F}/Teacup%20without%20handle/3D/teacup_without_handle_3d.png", 1),
    ("Smoothies", f"{_F}/Tropical%20drink/3D/tropical_drink_3d.png",               2),
    ("Snacks",    f"{_F}/French%20fries/3D/french_fries_3d.png",                   3),
    ("Mains",     f"{_F}/Hamburger/3D/hamburger_3d.png",                           4),
    ("Desserts",  f"{_F}/Shortcake/3D/shortcake_3d.png",                           5),
]

# Per-item icon overrides
V1_ITEM_ICONS = {
    "Espresso":             f"{_F}/Hot%20beverage/3D/hot_beverage_3d.png",
    "Cappuccino":           f"{_F}/Hot%20beverage/3D/hot_beverage_3d.png",
    "Café Latte":           f"{_F}/Hot%20beverage/3D/hot_beverage_3d.png",
    "Cold Brew":            f"{_F}/Cup%20with%20straw/3D/cup_with_straw_3d.png",
    "Masala Chai":          f"{_F}/Teacup%20without%20handle/3D/teacup_without_handle_3d.png",
    "Matcha Latte":         f"{_F}/Teacup%20without%20handle/3D/teacup_without_handle_3d.png",
    "Berry Blast":          f"{_F}/Strawberry/3D/strawberry_3d.png",
    "Mango Tango":          f"{_F}/Mango/3D/mango_3d.png",
    "Avocado Toast":        f"{_F}/Avocado/3D/avocado_3d.png",
    "Truffle Fries":        f"{_F}/French%20fries/3D/french_fries_3d.png",
    "Smoked Chicken Burger":f"{_F}/Hamburger/3D/hamburger_3d.png",
    "Margherita Flatbread": f"{_F}/Pizza/3D/pizza_3d.png",
    "Pesto Pasta":          f"{_F}/Spaghetti/3D/spaghetti_3d.png",
    "Tiramisu":             f"{_F}/Shortcake/3D/shortcake_3d.png",
    "Chocolate Lava Cake":  f"{_F}/Chocolate%20bar/3D/chocolate_bar_3d.png",
}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

COMPANY_ID = '3821aa11-8386-452d-b6be-174ef77d1970'
OUTLET_ID = '36e8bc27-f972-4859-9f99-459ecece81fc'
ADMIN_ID = str(uuid.uuid4())


async def seed():
    async with AsyncSessionLocal() as db:
        # ── Clear existing ───────────────────────────────────────────
        await db.execute(
            delete(models_pg.Company).where(models_pg.Company.id == COMPANY_ID)
        )
        await db.execute(
            delete(models_pg.Company).where(models_pg.Company.email == "info@kosmocafe.com")
        )
        await db.commit()

        # ── Company ───────────────────────────────────────────────────
        company = models_pg.Company(
            id=COMPANY_ID,
            name="Kosmo Cafe",
            business_type="restaurant",
            email="info@kosmocafe.com",
            phone="+91-80-4000-1234",
            address="100ft Road, Indiranagar, Bengaluru 560038",
            plan="pro",
            plan_limits={"outlets": -1, "bookings_per_month": -1},
            status="active",
            enabled_features=["inventory", "restaurant_orders", "crm", "staff_management"],
            licensed_modules=[
                "booking", "inventory", "restaurant_orders", "customer_360",
                "finance", "smart_analytics"
            ],
            is_booking_enabled=False,
            is_retail_enabled=True,
            is_workplace_enabled=False,
        )
        db.add(company)
        await db.flush()  # company must exist before user/outlet

        # ── Admin User ────────────────────────────────────────────────
        admin = models_pg.User(
            id=ADMIN_ID,
            company_id=COMPANY_ID,
            email="admin@kosmocafe.com",
            name="Arjun Kapoor",
            password_hash=pwd_context.hash("Kosmo@2026"),
            role="Admin",
            phone="+91-98765-43210",
            status="Active",
        )
        db.add(admin)
        await db.flush()  # user must exist before outlet FK

        # ── Outlet ────────────────────────────────────────────────────
        outlet = models_pg.Outlet(
            id=OUTLET_ID,
            company_id=COMPANY_ID,
            name="Kosmo Cafe – Indiranagar",
            type="restaurant",
            location="100ft Road, Indiranagar, Bengaluru",
            contact_email="indiranagar@kosmocafe.com",
            contact_phone="+91-80-4000-1234",
            capacity=40,
            status="active",
            latitude=12.9784,
            longitude=77.6408,
        )
        db.add(outlet)
        await db.flush()  # outlet must exist before menu items

        # ── Menu Categories with Icons ────────────────────────────────
        for cat_name, cat_icon, cat_order in V1_CATEGORIES:
            db.add(models_pg.MenuCategory(
                company_id=COMPANY_ID,
                outlet_id=OUTLET_ID,
                name=cat_name,
                icon=cat_icon,
                display_order=cat_order,
                active=True,
            ))
        await db.flush()

        # ── Menu Items ────────────────────────────────────────────────
        menu_data = [
            # Coffee
            ("Coffee", "Espresso", "Rich double shot of espresso", 149),
            ("Coffee", "Cappuccino", "Classic Italian cappuccino with velvety foam", 199),
            ("Coffee", "Café Latte", "Smooth espresso with steamed milk", 219),
            ("Coffee", "Cold Brew", "18-hour slow steeped cold brew", 249),
            # Tea
            ("Tea", "Masala Chai", "Traditional Indian spiced tea", 99),
            ("Tea", "Matcha Latte", "Japanese ceremonial grade matcha", 269),
            # Smoothies
            ("Smoothies", "Berry Blast", "Mixed berries, banana, yogurt & honey", 299),
            ("Smoothies", "Mango Tango", "Alphonso mango, coconut milk & lime", 279),
            # Snacks
            ("Snacks", "Avocado Toast", "Sourdough, smashed avocado, poached egg, chilli flakes", 349),
            ("Snacks", "Chicken Club Sandwich", "Grilled chicken, bacon, lettuce & aioli", 399),
            ("Snacks", "Truffle Fries", "Hand-cut fries with truffle oil & parmesan", 299),
            # Mains
            ("Mains", "Smoked Chicken Burger", "Brioche bun, smoked chicken, caramelized onions", 449),
            ("Mains", "Margherita Flatbread", "San Marzano tomato, fresh mozzarella, basil", 379),
            ("Mains", "Pesto Pasta", "Fusilli with house-made basil pesto & pine nuts", 429),
            # Desserts
            ("Desserts", "Tiramisu", "Classic Italian tiramisu with mascarpone", 329),
            ("Desserts", "Chocolate Lava Cake", "Warm molten chocolate center", 349),
        ]

        menu_items = []
        for i, (cat, name, desc, price) in enumerate(menu_data):
            item = models_pg.MenuItem(
                id=str(uuid.uuid4()),
                company_id=COMPANY_ID,
                outlet_id=OUTLET_ID,
                category=cat,
                name=name,
                description=desc,
                price=Decimal(str(price)),
                icon=V1_ITEM_ICONS.get(name),
                inventory_linked=False,
                available=True,
                display_order=i,
                active=True,
            )
            db.add(item)
            menu_items.append(item)

        # ── Sample Orders ─────────────────────────────────────────────
        now = datetime.now(timezone.utc)
        sample_orders = [
            {
                "customer_name": "Priya Sharma",
                "contact_number": "+91-99001-12345",
                "order_type": "dine_in",
                "status": "New",
                "items": [
                    {"itemId": menu_items[1].id, "name": "Cappuccino", "quantity": 2, "price": 199},
                    {"itemId": menu_items[8].id, "name": "Avocado Toast", "quantity": 1, "price": 349},
                ],
                "total": 747,
            },
            {
                "customer_name": "Rahul Mehta",
                "contact_number": "+91-98765-54321",
                "order_type": "takeaway",
                "status": "Preparing",
                "items": [
                    {"itemId": menu_items[11].id, "name": "Smoked Chicken Burger", "quantity": 1, "price": 449},
                    {"itemId": menu_items[10].id, "name": "Truffle Fries", "quantity": 1, "price": 299},
                    {"itemId": menu_items[3].id, "name": "Cold Brew", "quantity": 1, "price": 249},
                ],
                "total": 997,
            },
            {
                "customer_name": "Ananya Iyer",
                "contact_number": "+91-87654-32100",
                "order_type": "dine_in",
                "status": "Preparing",
                "items": [
                    {"itemId": menu_items[13].id, "name": "Pesto Pasta", "quantity": 1, "price": 429},
                    {"itemId": menu_items[5].id, "name": "Matcha Latte", "quantity": 1, "price": 269},
                ],
                "total": 698,
            },
            {
                "customer_name": "Vikram Singh",
                "contact_number": "+91-77001-98765",
                "order_type": "takeaway",
                "status": "ReadyToCollect",
                "items": [
                    {"itemId": menu_items[6].id, "name": "Berry Blast", "quantity": 2, "price": 299},
                    {"itemId": menu_items[14].id, "name": "Tiramisu", "quantity": 1, "price": 329},
                ],
                "total": 927,
            },
            {
                "customer_name": "Deepa Nair",
                "contact_number": "+91-66001-11111",
                "order_type": "delivery",
                "status": "Completed",
                "items": [
                    {"itemId": menu_items[12].id, "name": "Margherita Flatbread", "quantity": 1, "price": 379},
                    {"itemId": menu_items[2].id, "name": "Café Latte", "quantity": 2, "price": 219},
                    {"itemId": menu_items[15].id, "name": "Chocolate Lava Cake", "quantity": 1, "price": 349},
                ],
                "total": 1166,
            },
        ]

        for i, so in enumerate(sample_orders):
            order = models_pg.RestaurantOrder(
                id=str(uuid.uuid4()),
                company_id=COMPANY_ID,
                outlet_id=OUTLET_ID,
                order_number=f"KC-{i+1:04d}",
                customer_name=so["customer_name"],
                contact_number=so["contact_number"],
                order_type=so["order_type"],
                items=so["items"],
                total_amount=Decimal(str(so["total"])),
                status=so["status"],
                payment_status="paid",
                confirmation_token=str(uuid.uuid4()),
                otp="1234" if so["order_type"] == "delivery" else None,
                created_at=now - timedelta(minutes=30 - i * 5),
            )
            db.add(order)

        await db.commit()

        print("═" * 60)
        print("  ✅  Kosmo Cafe seeded successfully!")
        print("═" * 60)
        print(f"  Company ID : {COMPANY_ID}")
        print(f"  Outlet ID  : {OUTLET_ID}")
        print(f"  Admin Login: admin@kosmocafe.com / Kosmo@2026")
        print(f"  Menu Items : {len(menu_data)}")
        print(f"  Orders     : {len(sample_orders)}")
        print("═" * 60)


if __name__ == "__main__":
    asyncio.run(seed())
