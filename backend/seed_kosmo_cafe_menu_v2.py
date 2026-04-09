import asyncio
import os
import sys
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database_pg import engine
from models_pg import MenuItem, MenuCategory

# Verified IDs
COMPANY_ID = '3821aa11-8386-452d-b6be-174ef77d1970'
OUTLET_ID = '36e8bc27-f972-4859-9f99-459ecece81fc'

# Fluent Emoji 3D icon URLs
F = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets'

# Category definitions: (name, icon_url, display_order)
CATEGORIES = [
    ("Beverages - Cold",        f"{F}/Cup%20with%20straw/3D/cup_with_straw_3d.png",                     0),
    ("Beverages - Hot",         f"{F}/Hot%20beverage/3D/hot_beverage_3d.png",                           1),
    ("Veg Snacks",              f"{F}/French%20fries/3D/french_fries_3d.png",                           2),
    ("Veg Sandwich & Burger",   f"{F}/Sandwich/3D/sandwich_3d.png",                                     3),
    ("Souvlaki Pita",           f"{F}/Burrito/3D/burrito_3d.png",                                       4),
    ("Veg Pasta",               f"{F}/Spaghetti/3D/spaghetti_3d.png",                                   5),
    ("Chicken Snacks",          f"{F}/Poultry%20leg/3D/poultry_leg_3d.png",                             6),
    ("Shrimp Snacks",           f"{F}/Shrimp/3D/shrimp_3d.png",                                         7),
    ("Omelette",                f"{F}/Cooking/3D/cooking_3d.png",                                       8),
    ("Chicken Sandwich & Burger", f"{F}/Hamburger/3D/hamburger_3d.png",                                 9),
    ("Chicken Pasta",           f"{F}/Spaghetti/3D/spaghetti_3d.png",                                  10),
]

# Per-item icon overrides — items distinctive enough to get their own icon
ITEM_ICONS = {
    "Cold Coffee":                      f"{F}/Hot%20beverage/3D/hot_beverage_3d.png",
    "Tender Coconut Milkshake":         f"{F}/Coconut/3D/coconut_3d.png",
    "Blueberry Cheesecake Thickshake":  f"{F}/Blueberries/3D/blueberries_3d.png",
    "Peach Iced Tea":                   f"{F}/Peach/3D/peach_3d.png",
    "Filter Coffee":                    f"{F}/Hot%20beverage/3D/hot_beverage_3d.png",
    "Broccoli Cheese Bites":            f"{F}/Broccoli/3D/broccoli_3d.png",
    "Cheese Garlic Bread":              f"{F}/Baguette%20bread/3D/baguette_bread_3d.png",
    "Mushroom Sandwich":                f"{F}/Mushroom/3D/mushroom_3d.png",
    "Pesto Mushroom Sandwich":          f"{F}/Mushroom/3D/mushroom_3d.png",
    "Alfredo Penne Pasta":              f"{F}/Spaghetti/3D/spaghetti_3d.png",
    "Baked Mac & Cheese":               f"{F}/Cheese%20wedge/3D/cheese_wedge_3d.png",
    "Smoked BBQ Wings":                 f"{F}/Poultry%20leg/3D/poultry_leg_3d.png",
    "Crispy Fried Finger Prawn":        f"{F}/Shrimp/3D/shrimp_3d.png",
    "Butter Garlic Prawn":              f"{F}/Shrimp/3D/shrimp_3d.png",
    "Crispy Dynamite Shrimp":           f"{F}/Shrimp/3D/shrimp_3d.png",
    "Mushroom Cheese Omelette":         f"{F}/Mushroom/3D/mushroom_3d.png",
    "Egg White Omelette":               f"{F}/Egg/3D/egg_3d.png",
}

MENU_DATA = [
    # --- BEVERAGES: COLD ---
    {"category": "Beverages - Cold", "name": "Cold Coffee", "price": 130, "description": "Classic chilled coffee"},
    {"category": "Beverages - Cold", "name": "Hazelnut Cold Coffee", "price": 160, "description": "Hazelnut flavored chilled coffee"},
    {"category": "Beverages - Cold", "name": "Tender Coconut Milkshake", "price": 170, "description": "Refreshing coconut shake"},
    {"category": "Beverages - Cold", "name": "Cold Milo", "price": 200, "description": "Iced Milo chocolate malt drink"},
    {"category": "Beverages - Cold", "name": "Biscoff Milkshake", "price": 240, "description": "Decadent Lotus Biscoff shake"},
    {"category": "Beverages - Cold", "name": "Nutella Milkshake", "price": 230, "description": "Rich Nutella chocolate shake"},
    {"category": "Beverages - Cold", "name": "Ovaltine Thickshake", "price": 230, "description": "Creamy Ovaltine malt shake"},
    {"category": "Beverages - Cold", "name": "Blueberry Cheesecake Thickshake", "price": 250, "description": "Indulgent cheesecake flavored shake"},
    {"category": "Beverages - Cold", "name": "Kesar Dry Fruit Milkshake", "price": 210, "description": "Traditional saffron and dry fruit shake"},
    {"category": "Beverages - Cold", "name": "Peach Iced Tea", "price": 120, "description": "Sweet peach flavored tea"},
    {"category": "Beverages - Cold", "name": "Very Berry Iced Tea", "price": 120, "description": "Mixed berry flavored tea"},
    {"category": "Beverages - Cold", "name": "Lemongrass Iced Tea", "price": 120, "description": "Zesty lemongrass flavored tea"},
    {"category": "Beverages - Cold", "name": "Earl Grey Lemonade", "price": 130, "description": "Floral Earl Grey with citrus twist"},
    {"category": "Beverages - Cold", "name": "Blackberry Lemonade", "price": 130, "description": "Sweet and tangy blackberry lemonade"},

    # --- BEVERAGES: HOT ---
    {"category": "Beverages - Hot", "name": "Hot Milo", "price": 90, "description": "Warm Milo chocolate malt"},
    {"category": "Beverages - Hot", "name": "Hot Badam Milk", "price": 60, "description": "Traditional hot almond milk"},
    {"category": "Beverages - Hot", "name": "Filter Coffee", "price": 50, "description": "Authentic South Indian Filter Coffee"},

    # --- VEGETARIAN SNACKS ---
    {"category": "Veg Snacks", "name": "Classic Fries", "price": 150, "description": "Golden salted French fries"},
    {"category": "Veg Snacks", "name": "Peri Peri Fries", "price": 170, "description": "Spicy peri-peri seasoned fries"},
    {"category": "Veg Snacks", "name": "Chili Garlic Fries", "price": 190, "description": "Fries tossed in chili garlic sauce"},
    {"category": "Veg Snacks", "name": "Mexican Cheese Fries", "price": 210, "description": "Fries topped with Mexican cheese sauce"},
    {"category": "Veg Snacks", "name": "Broccoli Cheese Bites", "price": 220, "description": "Crispy bites with broccoli and cheese"},
    {"category": "Veg Snacks", "name": "Cottage Cheese Basil Tomato", "price": 210, "description": "Paneer skewers with basil and tomato"},
    {"category": "Veg Snacks", "name": "Chili Paneer", "price": 240, "description": "Spicy Indo-Chinese paneer cubes"},
    {"category": "Veg Snacks", "name": "Gobi Manchurian", "price": 230, "description": "Crispy cauliflower in Manchurian sauce"},
    {"category": "Veg Snacks", "name": "Cheese Garlic Bread", "price": 170, "description": "Buttery garlic bread with melted cheese"},
    {"category": "Veg Snacks", "name": "Spicy Garlic Bread", "price": 140, "description": "Garlic bread with a spicy kick"},

    # --- VEG SANDWICH & BURGER ---
    {"category": "Veg Sandwich & Burger", "name": "Classic Veg Sandwich", "price": 150, "description": "Traditional vegetable sandwich"},
    {"category": "Veg Sandwich & Burger", "name": "Chili Cheese Sandwich", "price": 120, "description": "Zesty chili and cheese filling"},
    {"category": "Veg Sandwich & Burger", "name": "Mushroom Sandwich", "price": 170, "description": "Sautéed mushrooms and cheese"},
    {"category": "Veg Sandwich & Burger", "name": "Pesto Mushroom Sandwich", "price": 190, "description": "Mushrooms with aromatic pesto sauce"},
    {"category": "Veg Sandwich & Burger", "name": "Grilled Vegetable Sandwich", "price": 200, "description": "Herbed grilled garden vegetables"},
    {"category": "Veg Sandwich & Burger", "name": "Peri Peri Paneer Sandwich", "price": 180, "description": "Spicy peri-peri paneer filling"},
    {"category": "Veg Sandwich & Burger", "name": "Paneer Tikka Sandwich", "price": 170, "description": "Smoky paneer tikka chunks"},
    {"category": "Veg Sandwich & Burger", "name": "Peri Peri Grilled Paneer Burger", "price": 180, "description": "Spicy paneer patty with peri-peri"},
    {"category": "Veg Sandwich & Burger", "name": "Classic Veg Burger", "price": 160, "description": "Hearty vegetable patty burger"},
    {"category": "Veg Sandwich & Burger", "name": "BBQ Paneer Burger", "price": 180, "description": "Paneer burger with smoky BBQ sauce"},

    # --- SOUVLAKI PITA ---
    {"category": "Souvlaki Pita", "name": "Tandoori Paneer Pita Pockets", "price": 200, "description": "Paneer tikka in soft pita bread"},
    {"category": "Souvlaki Pita", "name": "Fresh Mushroom Pita Pockets", "price": 200, "description": "Fresh mushrooms in pita bread"},
    {"category": "Souvlaki Pita", "name": "Peri Peri Grilled Paneer Wrap", "price": 190, "description": "Spicy paneer wrap"},
    {"category": "Souvlaki Pita", "name": "Pesto Grilled Veg Wrap", "price": 200, "description": "Grilled vegetables with pesto wrap"},

    # --- VEG PASTA ---
    {"category": "Veg Pasta", "name": "Alfredo Penne Pasta", "price": 250, "description": "Creamy white sauce penne"},
    {"category": "Veg Pasta", "name": "Arrabbiata Penne Pasta", "price": 230, "description": "Spicy red sauce penne"},
    {"category": "Veg Pasta", "name": "Pesto Penne Pasta", "price": 300, "description": "Aromatic basil pesto penne"},
    {"category": "Veg Pasta", "name": "Tandoori Penne Pasta", "price": 300, "description": "Fusion tandoori flavored penne"},
    {"category": "Veg Pasta", "name": "Baked Mac & Cheese", "price": 280, "description": "Classic gooey baked mac and cheese"},

    # --- NON-VEG SNACKS (CHICKEN) ---
    {"category": "Chicken Snacks", "name": "Crispy Chicken Popcorn", "price": 220, "description": "Bite-sized crispy chicken"},
    {"category": "Chicken Snacks", "name": "Peri Peri Grilled Chicken", "price": 250, "description": "Zesty peri-peri seasoned chicken"},
    {"category": "Chicken Snacks", "name": "Chicken Cheese Finger Roll", "price": 220, "description": "Cheesy chicken in a crispy roll"},
    {"category": "Chicken Snacks", "name": "Spicy Korean Chili Chicken", "price": 230, "description": "Chicken in sweet and spicy Korean glaze"},
    {"category": "Chicken Snacks", "name": "Red Dragon Chicken with Cashew", "price": 250, "description": "Fiery dragon glaze with crunchy cashews"},
    {"category": "Chicken Snacks", "name": "Masala Fried Chicken", "price": 250, "description": "Traditional spicy deep-fried chicken"},
    {"category": "Chicken Snacks", "name": "Smoked BBQ Wings", "price": 250, "description": "Smoky and succulent chicken wings"},
    {"category": "Chicken Snacks", "name": "Peri Peri Chicken Strips Sauce", "price": 230, "description": "Spicy chicken strips with dipping sauce"},
    {"category": "Chicken Snacks", "name": "Buffalo Chicken Wings with Sauce", "price": 250, "description": "Classic tangy Buffalo style wings"},
    {"category": "Chicken Snacks", "name": "Butter Garlic Chicken", "price": 250, "description": "Chicken tossed in rich garlic butter"},
    {"category": "Chicken Snacks", "name": "Guntur Chili Chicken", "price": 260, "description": "Extra spicy Andhra style chicken"},
    {"category": "Chicken Snacks", "name": "Tawa Chicken", "price": 280, "description": "Griddle seared spiced chicken"},

    # --- SHRIMP SNACKS ---
    {"category": "Shrimp Snacks", "name": "Crispy Fried Finger Prawn", "price": 280, "description": "Golden fried prawn fingers"},
    {"category": "Shrimp Snacks", "name": "Butter Garlic Prawn", "price": 290, "description": "Succulent prawns in garlic butter"},
    {"category": "Shrimp Snacks", "name": "Crispy Dynamite Shrimp", "price": 290, "description": "Shrimp in fiery dynamite sauce"},
    {"category": "Shrimp Snacks", "name": "Chili and Grilled Shrimp with French Loaf", "price": 290, "description": "Grilled shrimp served with crusty bread"},

    # --- OMELETTE ---
    {"category": "Omelette", "name": "Mushroom Cheese Omelette", "price": 200, "description": "Fluffy omelette with mushrooms and cheese"},
    {"category": "Omelette", "name": "Chicken Cheese Omelette", "price": 200, "description": "Hearty chicken and cheese omelette"},
    {"category": "Omelette", "name": "Masala Cheese Omelette", "price": 160, "description": "Indian spiced cheese omelette"},
    {"category": "Omelette", "name": "Egg White Omelette", "price": 150, "description": "Healthy egg white protein omelette"},

    # --- CHICKEN SANDWICH & BURGER ---
    {"category": "Chicken Sandwich & Burger", "name": "Grilled Chicken Sandwich", "price": 170, "description": "Herb marinated grilled chicken sandwich"},
    {"category": "Chicken Sandwich & Burger", "name": "Tandoori Chicken Sandwich", "price": 190, "description": "Spicy tandoori chicken filling"},
    {"category": "Chicken Sandwich & Burger", "name": "Peri Peri Chicken Sandwich", "price": 200, "description": "Zesty peri-peri chicken chunks"},
    {"category": "Chicken Sandwich & Burger", "name": "Pesto Chicken Sandwich", "price": 210, "description": "Chicken with fresh basil pesto"},
    {"category": "Chicken Sandwich & Burger", "name": "Crispy Chicken Sandwich", "price": 200, "description": "Golden fried chicken fillet sandwich"},
    {"category": "Chicken Sandwich & Burger", "name": "Katsu Chicken Burger", "price": 220, "description": "Panko crusted Japanese style burger"},
    {"category": "Chicken Sandwich & Burger", "name": "BBQ Chicken Burger", "price": 210, "description": "Gourmet burger with smoky BBQ glaze"},
    {"category": "Chicken Sandwich & Burger", "name": "Peri Peri Grilled Chicken Burger", "price": 240, "description": "Spicy grilled chicken breast burger"},

    # --- SOUVLAKI PITA (NON-VEG) ---
    {"category": "Souvlaki Pita", "name": "Crispy Chicken Wheat Pita Wrap", "price": 200, "description": "Healthy wheat pita with crispy chicken"},
    {"category": "Souvlaki Pita", "name": "Chipotle Chicken Pita Wrap", "price": 200, "description": "Chicken wrap with smoky chipotle"},
    {"category": "Souvlaki Pita", "name": "Peri Peri Chicken Wrap", "price": 210, "description": "Spicy peri-peri chicken wrap"},
    {"category": "Souvlaki Pita", "name": "Tandoori Chicken Wrap", "price": 200, "description": "Classic tandoori chicken pita wrap"},
    {"category": "Souvlaki Pita", "name": "Tandoori Chicken Pita Pockets", "price": 200, "description": "Zesty tandoori pockets"},

    # --- CHICKEN PASTA ---
    {"category": "Chicken Pasta", "name": "Alfredo Penne Pasta", "price": 340, "description": "Creamy chicken Alfredo penne"},
    {"category": "Chicken Pasta", "name": "Arrabbiata Penne Pasta", "price": 300, "description": "Spicy red sauce chicken penne"},
    {"category": "Chicken Pasta", "name": "Pesto Penne Pasta", "price": 320, "description": "Chicken penne in rich pesto sauce"},
    {"category": "Chicken Pasta", "name": "Tandoori Penne Pasta", "price": 360, "description": "Tandoori spiced chicken penne"},
    {"category": "Chicken Pasta", "name": "Baked Mac & Cheese", "price": 350, "description": "Hearty baked mac and cheese with chicken chunks"},
]

async def seed_menu():
    print(f"🚀 Starting menu seeding for {COMPANY_ID}...")

    async with AsyncSession(engine) as session:
        # 1. Clear existing menu items and categories for this outlet
        await session.execute(delete(MenuItem).where(MenuItem.outlet_id == OUTLET_ID))
        await session.execute(
            delete(MenuCategory).where(
                MenuCategory.company_id == COMPANY_ID,
                MenuCategory.outlet_id == OUTLET_ID,
            )
        )
        await session.commit()
        print(f"🧹 Cleared existing menu items and categories for outlet {OUTLET_ID}")

        # 2. Seed menu categories with icons
        for name, icon_url, order in CATEGORIES:
            session.add(MenuCategory(
                company_id=COMPANY_ID,
                outlet_id=OUTLET_ID,
                name=name,
                icon=icon_url,
                display_order=order,
                active=True,
            ))
        await session.commit()
        print(f"✅ Seeded {len(CATEGORIES)} menu categories with icons")

        # 3. Seed menu items
        # Build category name → icon URL lookup for fallback
        cat_icon_map = {name: icon_url for name, icon_url, _ in CATEGORIES}

        NON_VEG_KEYWORDS = ["Chicken", "Shrimp", "Omelette"]
        items_to_add = []
        for i, data in enumerate(MENU_DATA):
            # Resolve icon: item-specific override > category icon
            item_icon = ITEM_ICONS.get(data["name"]) or cat_icon_map.get(data["category"])

            is_veg = not any(kw in data["category"] for kw in NON_VEG_KEYWORDS)

            item = MenuItem(
                company_id=COMPANY_ID,
                outlet_id=OUTLET_ID,
                category=data["category"],
                name=data["name"],
                description=data["description"],
                price=Decimal(str(data["price"])),
                image_url=item_icon,
                image_urls=[item_icon] if item_icon else [],
                icon=item_icon,
                available=True,
                active=True,
                is_veg=is_veg,
                display_order=i,
            )
            items_to_add.append(item)

        session.add_all(items_to_add)
        await session.commit()
        print(f"✅ Successfully seeded {len(items_to_add)} menu items!")

if __name__ == "__main__":
    asyncio.run(seed_menu())
