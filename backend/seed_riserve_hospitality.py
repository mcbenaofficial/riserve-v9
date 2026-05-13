"""
Seed script — Ri'Serve Hospitality (premium multi-outlet restaurant group).

Run:
    cd backend && source venv/bin/activate
    python seed_riserve_hospitality.py

Creates:
    Company    : Ri'Serve Hospitality
    Admin      : admin@riserve.ai / admin123
    Outlets    : Azabu Kadowaki (Japanese), La Palanca (Italian), Benoit Paris (French)
    Menu       : 15–18 items per outlet with images, descriptions, nutritional values
    Customers  : 150 unique customers reused across orders
    Orders     : 100/day × 90 days per outlet  (27 000 total)
    Transactions: one per completed order  (finance module)
    Invoices   : one per customer per outlet (monthly batch)
    Staff      : 4–5 per outlet with attendance, payslips, tips, leave records
    Suppliers  : 3 per outlet linked to inventory products
    Feedback   : ~30 % of completed orders
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from passlib.context import CryptContext
from sqlalchemy import delete

from database_pg import AsyncSessionLocal
import models_pg

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
rng = random.Random(42)          # deterministic so re-runs produce same IDs

# ── Fixed IDs ─────────────────────────────────────────────────────────────────
COMPANY_ID   = "f0e1d2c3-b4a5-4678-9012-abcdef012345"
ADMIN_ID     = "a1b2c3d4-e5f6-4789-0123-bcdef0123456"
OUTLET_JP_ID = "b2c3d4e5-f6a7-4890-1234-cdef01234567"
OUTLET_IT_ID = "c3d4e5f6-a7b8-4901-2345-def012345678"
OUTLET_FR_ID = "d4e5f6a7-b8c9-4012-3456-ef0123456789"

NOW = datetime.now(timezone.utc)

# ── Fluent Emoji fallback icons ───────────────────────────────────────────────
_F = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets"

# ── Unsplash food images ──────────────────────────────────────────────────────
SUSHI     = "https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=600"
RAMEN     = "https://images.unsplash.com/photo-1569050467447-ce54b3bbc37d?w=600"
GYOZA     = "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600"
TERIYAKI  = "https://images.unsplash.com/photo-1562802378-063ec186a863?w=600"
WAGYU     = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600"
MATCHA    = "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600"
SAKE_IMG  = "https://images.unsplash.com/photo-1542658438-c5b543df069b?w=600"
MISO      = "https://images.unsplash.com/photo-1547592180-85f173990554?w=600"

PASTA     = "https://images.unsplash.com/photo-1555244162-803834f70033?w=600"
PIZZA     = "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600"
BRUSCHETTA= "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600"
TIRAMISU  = "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600"
FISH_DISH = "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600"
COCKTAIL  = "https://images.unsplash.com/photo-1527960471264-932f39eb5846?w=600"

SOUP      = "https://images.unsplash.com/photo-1547592180-85f173990554?w=600"
STEAK     = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600"
CREME     = "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600"
WINE_IMG  = "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=600"
DUCK      = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600"

# ── Menu data: (category, name, desc, price_inr, is_veg, nutritional_value, image, tags) ──
MENU_JP = [
    # Starters
    ("Starters", "Edamame",
     "Steamed young soybeans lightly salted with sea salt flakes.",
     450, True,
     "Cal 120 · Protein 11g · Carbs 10g · Fat 5g · Fibre 5g · Sodium 350mg",
     MISO, ["Vegan", "Gluten Free"]),
    ("Starters", "Miso Soup",
     "Traditional dashi broth with silken tofu, wakame seaweed and spring onion.",
     380, True,
     "Cal 40 · Protein 3g · Carbs 5g · Fat 1g · Fibre 1g · Sodium 700mg",
     MISO, ["Vegan Option"]),
    ("Starters", "Gyoza (6 pcs)",
     "Pan-fried pork and cabbage dumplings with yuzu ponzu dipping sauce.",
     750, False,
     "Cal 210 · Protein 12g · Carbs 24g · Fat 8g · Fibre 2g · Sodium 640mg",
     GYOZA, ["Chef's Pick"]),
    ("Starters", "Agedashi Tofu",
     "Silken tofu deep-fried in a light kuzu batter, served in kombu dashi broth.",
     650, True,
     "Cal 190 · Protein 9g · Carbs 18g · Fat 9g · Fibre 1g · Sodium 580mg",
     MISO, ["Vegetarian"]),
    # Sushi & Sashimi
    ("Sushi & Sashimi", "Salmon Sashimi (5 pcs)",
     "Premium Norwegian salmon, hand-sliced to order, with wasabi and pickled ginger.",
     1200, False,
     "Cal 175 · Protein 22g · Carbs 0g · Fat 9g · Omega-3 2.4g · Sodium 280mg",
     SUSHI, ["Gluten Free", "Bestseller"]),
    ("Sushi & Sashimi", "Tuna Sashimi (5 pcs)",
     "Bluefin tuna loin, delicately sliced, with shiso and wasabi.",
     1450, False,
     "Cal 155 · Protein 25g · Carbs 0g · Fat 5g · Omega-3 1.2g · Sodium 210mg",
     SUSHI, ["Gluten Free"]),
    ("Sushi & Sashimi", "Salmon Nigiri (2 pcs)",
     "Hand-pressed sushi rice topped with cured salmon and a touch of wasabi.",
     850, False,
     "Cal 130 · Protein 10g · Carbs 18g · Fat 3g · Sodium 310mg",
     SUSHI, []),
    ("Sushi & Sashimi", "Spicy Tuna Roll (8 pcs)",
     "Sushi rice, spicy tuna, cucumber, togarashi mayo, sesame and nori.",
     1050, False,
     "Cal 290 · Protein 18g · Carbs 34g · Fat 9g · Sodium 520mg",
     SUSHI, ["Spicy", "Bestseller"]),
    ("Sushi & Sashimi", "Dragon Roll (8 pcs)",
     "Tempura prawn, avocado and cucumber topped with thinly sliced salmon and tobiko.",
     1350, False,
     "Cal 360 · Protein 20g · Carbs 38g · Fat 14g · Sodium 610mg",
     SUSHI, ["Chef's Pick"]),
    # Noodles & Rice
    ("Noodles & Rice", "Tonkotsu Ramen",
     "18-hour pork bone broth, chashu pork belly, soft egg, nori and kikurage mushrooms.",
     1100, False,
     "Cal 640 · Protein 32g · Carbs 72g · Fat 22g · Sodium 1200mg",
     RAMEN, ["Bestseller"]),
    ("Noodles & Rice", "Tempura Udon",
     "Thick wheat udon in clear kombu broth with king prawn and vegetable tempura.",
     1150, False,
     "Cal 580 · Protein 22g · Carbs 84g · Fat 14g · Sodium 980mg",
     RAMEN, []),
    # Mains
    ("Mains", "Chicken Teriyaki",
     "Free-range chicken thigh marinated in house teriyaki glaze, served with steamed rice and pickles.",
     1350, False,
     "Cal 480 · Protein 36g · Carbs 42g · Fat 12g · Sodium 760mg",
     TERIYAKI, []),
    ("Mains", "A5 Wagyu Tataki",
     "Seared Japanese A5 Wagyu beef, ponzu gel, crispy shallots and micro-herbs.",
     3800, False,
     "Cal 320 · Protein 28g · Carbs 4g · Fat 22g · Sodium 340mg",
     WAGYU, ["Premium", "Chef's Pick"]),
    # Desserts
    ("Desserts", "Matcha Ice Cream",
     "Ceremonial-grade matcha ice cream with black sesame brittle.",
     550, True,
     "Cal 220 · Protein 4g · Carbs 28g · Fat 10g · Calcium 140mg",
     MATCHA, ["Vegetarian"]),
    ("Desserts", "Mochi Trio",
     "Handmade mochi filled with red bean, matcha and yuzu ice cream.",
     650, True,
     "Cal 270 · Protein 4g · Carbs 46g · Fat 8g · Sodium 60mg",
     MATCHA, ["Vegetarian"]),
    # Drinks
    ("Drinks", "Premium Sake (180ml)",
     "Junmai Daiginjo sake served chilled in traditional ceramic vessel.",
     950, True,
     "Cal 195 · Carbs 7g · Alcohol 15% · Serving 180ml",
     SAKE_IMG, []),
    ("Drinks", "Yuzu Lemonade",
     "Fresh yuzu juice, lemon, honey and sparkling water.",
     480, True,
     "Cal 85 · Carbs 22g · Sugar 18g · Vitamin C 28mg",
     COCKTAIL, ["Non-Alcoholic"]),
]

MENU_IT = [
    # Antipasti
    ("Antipasti", "Bruschetta al Pomodoro",
     "Grilled Pugliese bread rubbed with garlic, topped with San Marzano tomato and fresh basil.",
     550, True,
     "Cal 190 · Protein 5g · Carbs 28g · Fat 6g · Fibre 3g · Sodium 320mg",
     BRUSCHETTA, ["Vegan", "Bestseller"]),
    ("Antipasti", "Burrata Caprese",
     "Creamy Pugliese burrata, heirloom tomatoes, aged balsamic and Ligurian basil oil.",
     950, True,
     "Cal 280 · Protein 12g · Carbs 8g · Fat 22g · Calcium 320mg",
     BRUSCHETTA, ["Vegetarian", "Chef's Pick"]),
    ("Antipasti", "Arancini di Riso (3 pcs)",
     "Saffron risotto balls stuffed with ragù and mozzarella, crispy panko crust.",
     850, False,
     "Cal 340 · Protein 14g · Carbs 42g · Fat 14g · Sodium 580mg",
     BRUSCHETTA, []),
    # Pasta
    ("Pasta", "Pasta Carbonara",
     "Tonnarelli, Guanciale, Pecorino Romano DOP, egg yolk and coarsely ground pepper.",
     1350, False,
     "Cal 620 · Protein 28g · Carbs 70g · Fat 24g · Sodium 760mg",
     PASTA, ["Bestseller"]),
    ("Pasta", "Tagliatelle Bolognese",
     "Hand-rolled egg tagliatelle with 6-hour braised beef and pork ragù, Parmigiano.",
     1450, False,
     "Cal 680 · Protein 34g · Carbs 74g · Fat 22g · Sodium 820mg",
     PASTA, []),
    ("Pasta", "Cacio e Pepe",
     "Spaghetti with aged Pecorino, Parmigiano Reggiano and freshly cracked Tellicherry pepper.",
     1200, True,
     "Cal 540 · Protein 20g · Carbs 72g · Fat 18g · Sodium 680mg",
     PASTA, ["Vegetarian", "Chef's Pick"]),
    # Pizza
    ("Pizza", "Margherita DOP",
     "San Marzano DOP tomato, Fior di Latte mozzarella, fresh basil, extra virgin olive oil. 72hr cold-fermented dough.",
     1100, True,
     "Cal 720 · Protein 26g · Carbs 96g · Fat 22g · Sodium 840mg",
     PIZZA, ["Vegetarian", "Bestseller"]),
    ("Pizza", "Tartufo Nero",
     "White cream base, black truffle shavings, taleggio, wild mushrooms, rocket.",
     1750, True,
     "Cal 810 · Protein 28g · Carbs 90g · Fat 34g · Sodium 920mg",
     PIZZA, ["Vegetarian", "Premium", "Chef's Pick"]),
    # Secondi
    ("Secondi", "Osso Buco alla Milanese",
     "Slow-braised cross-cut veal shank, saffron risotto, gremolata.",
     2800, False,
     "Cal 760 · Protein 56g · Carbs 44g · Fat 28g · Collagen 8g · Sodium 980mg",
     STEAK, ["Premium"]),
    ("Secondi", "Branzino al Forno",
     "Whole roasted sea bass with capers, olives, cherry tomatoes and white wine.",
     2400, False,
     "Cal 420 · Protein 46g · Carbs 6g · Fat 18g · Omega-3 1.8g · Sodium 640mg",
     FISH_DISH, ["Gluten Free"]),
    # Dolci
    ("Dolci", "Tiramisù Classico",
     "Classic tiramisù with Savoiardi, mascarpone and Illy espresso. Served tableside.",
     750, True,
     "Cal 480 · Protein 8g · Carbs 42g · Fat 28g · Caffeine 40mg",
     TIRAMISU, ["Vegetarian", "Bestseller"]),
    ("Dolci", "Panna Cotta al Caramello",
     "Vanilla panna cotta with salted caramel sauce and praline crumb.",
     700, True,
     "Cal 360 · Protein 5g · Carbs 38g · Fat 20g · Calcium 180mg",
     TIRAMISU, ["Vegetarian", "Gluten Free"]),
    ("Dolci", "Cannoli Siciliani (2 pcs)",
     "Fried pastry shells filled with sweetened ricotta, candied orange and dark chocolate chips.",
     650, True,
     "Cal 420 · Protein 10g · Carbs 48g · Fat 20g · Sodium 180mg",
     TIRAMISU, ["Vegetarian"]),
    # Drinks
    ("Drinks", "Negroni",
     "Campari, Tanqueray gin, Martini Rosso. Stirred, rocks, orange twist.",
     850, True,
     "Cal 195 · Carbs 14g · Alcohol 24% · Serving 75ml",
     COCKTAIL, []),
    ("Drinks", "Aperol Spritz",
     "Aperol, Prosecco DOC, splash of soda, orange slice.",
     750, True,
     "Cal 168 · Carbs 18g · Alcohol 11% · Serving 180ml",
     COCKTAIL, ["Bestseller"]),
    ("Drinks", "San Pellegrino (750ml)",
     "Sparkling natural mineral water from the Italian Alps.",
     450, True,
     "Cal 0 · Sodium 33mg · Calcium 174mg · Magnesium 54mg",
     COCKTAIL, ["Non-Alcoholic"]),
]

MENU_FR = [
    # Entrées
    ("Entrées", "Soupe à l'Oignon",
     "Classic French onion soup with caramelised onions, beef consommé, gruyère croûton.",
     850, True,
     "Cal 380 · Protein 14g · Carbs 34g · Fat 18g · Sodium 1100mg",
     SOUP, ["Vegetarian Option"]),
    ("Entrées", "Escargots de Bourgogne (6 pcs)",
     "Burgundy snails baked in parsley-garlic butter and pastis.",
     1200, False,
     "Cal 290 · Protein 16g · Carbs 4g · Fat 24g · Sodium 680mg",
     SOUP, ["Chef's Pick"]),
    ("Entrées", "Foie Gras Poêlé",
     "Pan-seared duck foie gras, Sauternes gel, brioche toast and micro-herbs.",
     2200, False,
     "Cal 520 · Protein 12g · Carbs 18g · Fat 46g · Vitamin A 4500IU",
     DUCK, ["Premium", "Chef's Pick"]),
    ("Entrées", "Steak Tartare",
     "Hand-cut Charolais beef fillet, capers, cornichons, shallots, egg yolk and Dijon.",
     1600, False,
     "Cal 340 · Protein 32g · Carbs 4g · Fat 20g · Iron 4mg · Sodium 560mg",
     STEAK, ["Gluten Free"]),
    # Plats
    ("Plats", "Canard Confit",
     "Slow-confit Challans duck leg, Sarladaise potatoes, orange and green peppercorn jus.",
     2600, False,
     "Cal 780 · Protein 48g · Carbs 34g · Fat 46g · Iron 6mg · Sodium 820mg",
     DUCK, ["Bestseller"]),
    ("Plats", "Sole Meunière",
     "Dover sole, brown butter, lemon, capers and flat-leaf parsley. Served whole.",
     3200, False,
     "Cal 440 · Protein 54g · Carbs 6g · Fat 22g · Omega-3 2.1g · Sodium 580mg",
     FISH_DISH, ["Gluten Free", "Chef's Pick"]),
    ("Plats", "Coq au Vin",
     "Free-range chicken braised in Burgundy, lardons, pearl onions, button mushrooms.",
     2450, False,
     "Cal 620 · Protein 52g · Carbs 18g · Fat 28g · Iron 5mg · Sodium 760mg",
     DUCK, []),
    ("Plats", "Bœuf Bourguignon",
     "72-hour braised Charolais beef cheek, Burgundy wine, lardons, root vegetables.",
     3000, False,
     "Cal 680 · Protein 58g · Carbs 22g · Fat 32g · Collagen 10g · Sodium 840mg",
     STEAK, ["Premium", "Bestseller"]),
    ("Plats", "Soufflé au Fromage",
     "Twice-baked Comté cheese soufflé with walnut and endive salad.",
     1900, True,
     "Cal 440 · Protein 22g · Carbs 18g · Fat 32g · Calcium 480mg · Sodium 720mg",
     CREME, ["Vegetarian", "Chef's Pick"]),
    # Desserts
    ("Desserts", "Crème Brûlée à la Vanille",
     "Classic Bourbon vanilla custard with a caramelised sugar crust. Made to order.",
     750, True,
     "Cal 380 · Protein 6g · Carbs 34g · Fat 24g · Calcium 160mg",
     CREME, ["Vegetarian", "Gluten Free", "Bestseller"]),
    ("Desserts", "Fondant au Chocolat",
     "Warm Valrhona 72% dark chocolate fondant, Tahitian vanilla ice cream.",
     850, True,
     "Cal 480 · Protein 8g · Carbs 52g · Fat 28g · Magnesium 64mg",
     CREME, ["Vegetarian"]),
    ("Desserts", "Tarte Tatin",
     "Caramelised Granny Smith apple tart served warm with crème fraîche.",
     800, True,
     "Cal 420 · Protein 4g · Carbs 58g · Fat 18g · Fibre 3g",
     CREME, ["Vegetarian"]),
    ("Desserts", "Île Flottante",
     "Poached meringue floating on crème anglaise, spun caramel and toasted almonds.",
     700, True,
     "Cal 310 · Protein 8g · Carbs 42g · Fat 12g · Calcium 200mg",
     CREME, ["Vegetarian", "Gluten Free"]),
    # Drinks
    ("Drinks", "Kir Royal",
     "Crème de cassis avec Champagne Billecart-Salmon Brut Réserve.",
     1200, True,
     "Cal 175 · Carbs 16g · Alcohol 12% · Serving 150ml",
     WINE_IMG, []),
    ("Drinks", "Verre de Bourgogne Rouge",
     "Sommelier selection — Pinot Noir from Côte de Nuits, served at 16°C.",
     1000, True,
     "Cal 160 · Carbs 4g · Alcohol 13% · Serving 150ml · Resveratrol 2mg",
     WINE_IMG, []),
    ("Drinks", "Champagne Billecart-Salmon (150ml)",
     "Brut Réserve — brioche, white peach and citrus notes.",
     1800, True,
     "Cal 120 · Carbs 4g · Alcohol 12% · Serving 150ml",
     WINE_IMG, ["Premium"]),
    ("Drinks", "Café Liégeois",
     "Double espresso over vanilla ice cream, topped with chantilly.",
     650, True,
     "Cal 260 · Protein 4g · Carbs 28g · Fat 14g · Caffeine 80mg",
     MATCHA, ["Vegetarian"]),
]

# ── Customer name pool ────────────────────────────────────────────────────────
FIRST_NAMES = [
    "James","Emma","Oliver","Sophia","William","Ava","Benjamin","Isabella","Lucas",
    "Mia","Henry","Charlotte","Alexander","Amelia","Mason","Harper","Ethan","Evelyn",
    "Daniel","Abigail","Matthew","Emily","Aiden","Elizabeth","Jackson","Mila","Sebastian",
    "Ella","Samuel","Sofia","David","Camila","Joseph","Aria","Carter","Scarlett","Owen",
    "Victoria","Wyatt","Madison","John","Luna","Jack","Grace","Luke","Chloe","Jayden",
    "Penelope","Dylan","Riley","Grayson","Zoey","Levi","Nora","Isaac","Lily","Gabriel",
    "Eleanor","Julian","Hannah","Mateo","Lillian","Anthony","Addison","Jaxon","Aubrey",
    "Lincoln","Ellie","Joshua","Stella","Christopher","Natalie","Andrew","Zoe","Theodore",
    "Leah","Caleb","Hazel","Ryan","Violet","Nathan","Aurora","Asher","Savannah","Thomas",
    "Audrey","Isaiah","Brooklyn","Charles","Bella","Josiah","Claire","Hudson","Skylar",
    "Christian","Lucy","Hunter","Paisley","Connor","Everly","Eli","Anna","Ezra","Caroline",
]
LAST_NAMES = [
    "Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez",
    "Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore",
    "Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez",
    "Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen",
    "Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell",
]
PAYMENT_METHODS = ["card", "upi", "cash", "card", "card", "upi", "upi"]  # weighted


def _phone():
    return f"+91-{rng.randint(70000,99999)}{rng.randint(10000,99999)}"


def _email(first, last, idx):
    domains = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "hotmail.com"]
    return f"{first.lower()}.{last.lower()}{idx}@{rng.choice(domains)}"


def _order_time(day_offset: int, outlet_id: str) -> datetime:
    """Random order time during operating hours, shifted back by day_offset days."""
    base = NOW - timedelta(days=day_offset)
    # Operating hours vary by cuisine
    if outlet_id == OUTLET_JP_ID:
        open_h, close_h = 12, 22   # lunch + dinner
    elif outlet_id == OUTLET_IT_ID:
        open_h, close_h = 11, 23
    else:                           # French
        open_h, close_h = 12, 23
    hour   = rng.randint(open_h, close_h - 1)
    minute = rng.randint(0, 59)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


# ── Main seeder ───────────────────────────────────────────────────────────────

async def seed():
    async with AsyncSessionLocal() as db:

        # ── 1. Wipe existing data ────────────────────────────────────────────
        print("  Clearing existing Ri'Serve Hospitality data...")
        await db.execute(delete(models_pg.Company).where(
            models_pg.Company.id == COMPANY_ID))
        await db.execute(delete(models_pg.Company).where(
            models_pg.Company.email == "admin@riserve.ai"))
        await db.commit()

        # ── 2. Company ───────────────────────────────────────────────────────
        print("  Creating company...")
        company = models_pg.Company(
            id=COMPANY_ID,
            name="Ri'Serve Hospitality",
            business_type="restaurant",
            email="admin@riserve.ai",
            phone="+91-80-4600-0100",
            address="No. 1 UB City, Vittal Mallya Road, Bengaluru 560001",
            plan="pro",
            plan_limits={"outlets": -1, "bookings_per_month": -1},
            status="active",
            enabled_features=[
                "basic_booking", "slot_manager", "reports", "feedback", "ai_assistant",
                "api_access", "priority_support", "inventory", "restaurant_orders", "crm",
                "staff_management", "finance", "smart_analytics", "whatsapp", "campaigns",
                "acquisition", "hitl", "hq_intelligence", "portal", "analytics", "invoices",
                "leads", "journeys", "segments", "promotions", "knowledge", "aggregators",
                "omni", "petpooja", "stripe", "razorpay", "training", "mobile_staff",
            ],
            licensed_modules=[
                "booking", "inventory", "restaurant_orders", "customer_360", "finance",
                "smart_analytics", "staff_management", "crm", "whatsapp", "campaigns",
                "unified_campaigns", "acquisition", "hitl", "hq", "portal", "analytics",
                "reports", "invoices", "leads", "journeys", "segments", "promotions",
                "knowledge", "aggregators", "omni", "petpooja", "stripe", "razorpay",
                "training", "mobile_staff",
            ],
            is_booking_enabled=True,
            is_retail_enabled=True,
            is_workplace_enabled=True,
        )
        db.add(company)
        await db.flush()

        # ── 3. Admin user ────────────────────────────────────────────────────
        print("  Creating admin user...")
        admin = models_pg.User(
            id=ADMIN_ID,
            company_id=COMPANY_ID,
            email="admin@riserve.ai",
            name="Alex Riserve",
            password_hash=pwd_context.hash("admin123"),
            role="Admin",
            phone="+91-98400-00101",
            status="Active",
        )
        db.add(admin)
        await db.flush()

        # ── 4. Outlets ───────────────────────────────────────────────────────
        print("  Creating outlets...")
        outlets_data = [
            (OUTLET_JP_ID, "Azabu Kadowaki", "Japanese",
             "12 Lavelle Road, Ashok Nagar, Bengaluru 560001",
             "kadowaki@riserve.ai", "+91-80-4600-0201",
             60, 12.9716, 77.5946),
            (OUTLET_IT_ID, "La Palanca", "Italian",
             "4 Linking Road, Bandra West, Mumbai 400050",
             "lapalanca@riserve.ai", "+91-22-4600-0202",
             70, 19.0544, 72.8405),
            (OUTLET_FR_ID, "Benoit Paris", "French",
             "18 Nungambakkam High Road, Nungambakkam, Chennai 600034",
             "benoit@riserve.ai", "+91-44-4600-0203",
             80, 13.0569, 80.2425),
        ]
        outlet_objects = {}
        for (oid, name, otype, loc, cemail, cphone, cap, lat, lng) in outlets_data:
            o = models_pg.Outlet(
                id=oid,
                company_id=COMPANY_ID,
                name=name,
                type="restaurant",
                location=loc,
                contact_email=cemail,
                contact_phone=cphone,
                capacity=cap,
                status="active",
                latitude=lat,
                longitude=lng,
            )
            db.add(o)
            outlet_objects[oid] = name
        await db.flush()

        # ── 5. InvoiceSettings ───────────────────────────────────────────────
        db.add(models_pg.InvoiceSettings(
            company_id=COMPANY_ID,
            prefix="RH",
            next_number=1,
            default_payment_terms="due_on_receipt",
            tax_name="GST",
            default_tax_rate=Decimal("18.00"),
            currency="INR",
            currency_symbol="₹",
            invoice_company_name="Ri'Serve Hospitality Pvt. Ltd.",
            invoice_company_address="No. 1 UB City, Vittal Mallya Road, Bengaluru 560001",
            invoice_company_email="billing@riserve.ai",
        ))
        await db.flush()

        # ── 6. Menus (categories + items) ────────────────────────────────────
        print("  Creating menus...")
        outlet_menu_map: dict[str, list] = {
            OUTLET_JP_ID: MENU_JP,
            OUTLET_IT_ID: MENU_IT,
            OUTLET_FR_ID: MENU_FR,
        }
        # Prefix for order numbers
        outlet_prefix = {
            OUTLET_JP_ID: "AK",
            OUTLET_IT_ID: "LP",
            OUTLET_FR_ID: "BP",
        }

        all_menu_items: dict[str, list[models_pg.MenuItem]] = {}

        for outlet_id, menu_data in outlet_menu_map.items():
            # Collect unique categories in order
            seen_cats: dict[str, int] = {}
            for (cat, *_rest) in menu_data:
                if cat not in seen_cats:
                    seen_cats[cat] = len(seen_cats)

            for cat_name, cat_order in seen_cats.items():
                db.add(models_pg.MenuCategory(
                    company_id=COMPANY_ID,
                    outlet_id=outlet_id,
                    name=cat_name,
                    display_order=cat_order,
                    active=True,
                ))
            await db.flush()

            items = []
            for i, (cat, name, desc, price, is_veg, nutrition, img, tags) in enumerate(menu_data):
                bestseller = "Bestseller" in tags
                clean_tags = [t for t in tags if t != "Bestseller"]
                mi = models_pg.MenuItem(
                    id=str(uuid.uuid4()),
                    company_id=COMPANY_ID,
                    outlet_id=outlet_id,
                    category=cat,
                    name=name,
                    description=desc,
                    price=Decimal(str(price)),
                    image_url=img,
                    image_urls=[img],
                    inventory_linked=False,
                    available=True,
                    is_veg=is_veg,
                    nutritional_value=nutrition,
                    is_bestseller=bestseller,
                    tags=clean_tags,
                    display_order=i,
                    active=True,
                )
                db.add(mi)
                items.append(mi)
            await db.flush()
            all_menu_items[outlet_id] = items

        # ── 7. Customers ─────────────────────────────────────────────────────
        print("  Creating 150 customers...")
        customers: list[models_pg.Customer] = []
        used_emails: set[str] = set()
        for idx in range(150):
            first = rng.choice(FIRST_NAMES)
            last  = rng.choice(LAST_NAMES)
            email = _email(first, last, idx)
            while email in used_emails:
                email = _email(first, last, idx + 1000)
            used_emails.add(email)
            c = models_pg.Customer(
                id=str(uuid.uuid4()),
                company_id=COMPANY_ID,
                name=f"{first} {last}",
                email=email,
                phone=_phone(),
                total_revenue=Decimal("0"),
                total_bookings=0,
            )
            db.add(c)
            customers.append(c)
        await db.flush()

        # ── 8. Staff ─────────────────────────────────────────────────────────
        print("  Creating staff...")
        staff_roles = [
            ("Head Chef", "kitchen", "full_time", Decimal("5500")),
            ("Sous Chef", "kitchen", "full_time", Decimal("3800")),
            ("Senior Server", "front_of_house", "full_time", Decimal("2800")),
            ("Server", "front_of_house", "part_time", Decimal("1800")),
            ("Host/Hostess", "front_of_house", "full_time", Decimal("2200")),
        ]
        all_staff: dict[str, list] = {}
        staff_users: list[models_pg.User] = []

        for outlet_id in [OUTLET_JP_ID, OUTLET_IT_ID, OUTLET_FR_ID]:
            outlet_staff_list = []
            outlet_short = outlet_prefix[outlet_id].lower()
            for si, (dept_title, dept, emp_type, base_salary) in enumerate(staff_roles):
                first = rng.choice(FIRST_NAMES)
                last  = rng.choice(LAST_NAMES)
                staff_email = f"{outlet_short}.staff{si+1}@riserve.ai"
                # User account
                su = models_pg.User(
                    id=str(uuid.uuid4()),
                    company_id=COMPANY_ID,
                    email=staff_email,
                    name=f"{first} {last}",
                    password_hash=pwd_context.hash("Staff@2026"),
                    role="User",
                    phone=_phone(),
                    status="Active",
                )
                db.add(su)
                staff_users.append(su)
                await db.flush()
                # Staff profile
                st = models_pg.Staff(
                    id=str(uuid.uuid4()),
                    user_id=su.id,
                    company_id=COMPANY_ID,
                    outlet_id=outlet_id,
                    first_name=first,
                    last_name=last,
                    email=staff_email,
                    phone=_phone(),
                    status="active",
                    department=dept,
                    employment_type=emp_type,
                )
                db.add(st)
                await db.flush()
                outlet_staff_list.append((st, base_salary))

                # Attendance — last 90 days
                for day_offset in range(90, 0, -1):
                    work_date = (NOW - timedelta(days=day_offset)).date()
                    # ~85 % attendance
                    if rng.random() < 0.15:
                        status = rng.choice(["absent", "leave"])
                        db.add(models_pg.Attendance(
                            staff_id=st.id,
                            company_id=COMPANY_ID,
                            date=work_date,
                            status=status,
                        ))
                        continue
                    clock_in = datetime.combine(work_date,
                        datetime.min.time()).replace(
                        hour=rng.randint(8, 10), tzinfo=timezone.utc)
                    hours = Decimal(str(round(rng.uniform(7.5, 9.5), 2)))
                    clock_out = clock_in + timedelta(hours=float(hours))
                    db.add(models_pg.Attendance(
                        staff_id=st.id,
                        company_id=COMPANY_ID,
                        date=work_date,
                        clock_in=clock_in,
                        clock_out=clock_out,
                        hours_worked=hours,
                        status="present",
                    ))

                # Tip records — 3 per week on average
                for day_offset in range(90, 0, -7):
                    for _ in range(rng.randint(2, 4)):
                        tip_date = (NOW - timedelta(
                            days=day_offset - rng.randint(0, 6))).date()
                        db.add(models_pg.TipRecord(
                            staff_id=st.id,
                            company_id=COMPANY_ID,
                            date=tip_date,
                            amount=Decimal(str(rng.randint(20, 120))),
                        ))

                # Payslips — last 3 months
                for months_back in range(1, 4):
                    pay_month_date = NOW.date().replace(day=1) - timedelta(
                        days=months_back * 30)
                    m = pay_month_date.month
                    y = pay_month_date.year
                    gross = base_salary + Decimal(str(rng.randint(0, 300)))
                    tax   = (gross * Decimal("0.22")).quantize(Decimal("0.01"))
                    pf    = (gross * Decimal("0.06")).quantize(Decimal("0.01"))
                    net   = gross - tax - pf
                    db.add(models_pg.Payslip(
                        staff_id=st.id,
                        company_id=COMPANY_ID,
                        month=m,
                        year=y,
                        pay_period_label=f"{pay_month_date.strftime('%B')} {y}",
                        basic_salary=base_salary,
                        allowances=Decimal("200"),
                        gross_pay=gross,
                        tax=tax,
                        provident_fund=pf,
                        total_deductions=tax + pf,
                        net_pay=net,
                        hours_worked=Decimal("176"),
                        days_present=22,
                        days_absent=rng.randint(0, 2),
                        status="published",
                    ))

                # Leave request — 1 approved per staff
                leave_start = (NOW - timedelta(days=rng.randint(10, 60))).date()
                db.add(models_pg.LeaveRequest(
                    staff_id=st.id,
                    company_id=COMPANY_ID,
                    leave_type=rng.choice(["sick", "annual"]),
                    start_date=leave_start,
                    end_date=leave_start + timedelta(days=rng.randint(1, 3)),
                    days_requested=rng.randint(1, 3),
                    reason="Personal",
                    status="approved",
                ))

            all_staff[outlet_id] = outlet_staff_list
        await db.flush()

        # ── 9. Suppliers & Inventory ─────────────────────────────────────────
        print("  Creating suppliers and inventory...")
        supplier_defs = {
            OUTLET_JP_ID: [
                ("Tsukiji Seafood Direct", "seafood@tsukiji-nyc.com", "Fresh fish, shellfish, premium sashimi-grade cuts"),
                ("Nippon Foods USA", "orders@nipponfoods.us", "Japanese dry goods, sake, miso, dashi, noodles"),
                ("Sunrise Produce NYC", "fresh@sunriseproduce.com", "Local and Asian vegetables, herbs, yuzu, shiso"),
            ],
            OUTLET_IT_ID: [
                ("Eataly Wholesale", "wholesale@eataly.com", "Italian DOP ingredients, charcuterie, cheeses"),
                ("Buon Italia Imports", "orders@buonitalia.com", "Pasta, olive oil, truffles, San Marzano tomatoes"),
                ("Brooklyn Harvest Farms", "biz@brooklynharvest.com", "Local organic produce, fresh herbs, microgreens"),
            ],
            OUTLET_FR_ID: [
                ("Aux Délices de France", "contact@auxdelices.com", "French cheeses, foie gras, duck confit, Dijon"),
                ("D'Artagnan Inc.", "orders@dartagnan.com", "Game meats, specialty cuts, charcuterie"),
                ("Burgundy Wine Imports", "trade@burgundywine.us", "French wines, Champagne, spirits"),
            ],
        }
        for outlet_id, s_list in supplier_defs.items():
            for s_name, s_email, s_notes in s_list:
                supplier = models_pg.Supplier(
                    id=str(uuid.uuid4()),
                    company_id=COMPANY_ID,
                    name=s_name,
                    email=s_email,
                    phone=_phone(),
                    address="India",
                    contact_person=f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
                    notes=s_notes,
                    active=True,
                )
                db.add(supplier)
        await db.flush()

        # Inventory products per outlet
        products_jp = [
            ("Sashimi-grade Salmon", "SALM-SG", "Seafood", 24, 14, 50),
            ("Bluefin Tuna Loin",    "TUNA-BF", "Seafood", 38, 22, 30),
            ("King Prawn (1kg)",     "PRWN-KG", "Seafood", 28, 16, 40),
            ("Tonkotsu Pork Bones",  "PORK-BN", "Meat",    12,  6, 60),
            ("Wagyu A5 Striploin",   "WGYU-A5", "Meat",    95, 60, 15),
            ("Sushi Rice (5kg)",     "RICE-SU", "Dry Goods",18,  9, 80),
            ("Nori Sheets (100pk)",  "NORI-PK", "Dry Goods", 9,  4, 60),
        ]
        products_it = [
            ("Pasta Durum (5kg)",       "PAST-DU", "Dry Goods", 14,  6, 80),
            ("San Marzano DOP (24 cans)","TOMATO", "Canned",    36, 18, 40),
            ("Guanciale (1kg)",         "GUAN-1K", "Charcuterie",28, 14, 20),
            ("Fresh Mozzarella (1kg)",  "MOZZ-FR", "Dairy",     16,  8, 30),
            ("Black Truffle (100g)",    "TRUF-BK", "Specialty", 68, 45, 10),
            ("Parmigiano Reggiano (1kg)","PARM-RG","Dairy",     42, 24, 20),
            ("Veal Osso Buco (per piece)","VEAL-OB","Meat",     26, 14, 25),
        ]
        products_fr = [
            ("Duck Foie Gras (500g)",    "FOIE-GR", "Specialty", 72, 50, 12),
            ("Duck Legs Confit (4pc)",   "DUCK-LG", "Meat",      28, 14, 20),
            ("Dover Sole (whole)",       "SOLE-DV", "Seafood",   38, 22, 15),
            ("Comté AOP (1kg)",          "COMT-AP", "Dairy",     34, 18, 20),
            ("Charolais Beef Cheek",     "BEEF-CK", "Meat",      22, 11, 30),
            ("Burgundy Wine (case 12)", "BURG-WN", "Beverage",  180, 120, 8),
            ("Butter AOP (500g)",        "BUTR-AP", "Dairy",      8,  3, 60),
        ]
        outlet_products_map = {
            OUTLET_JP_ID: products_jp,
            OUTLET_IT_ID: products_it,
            OUTLET_FR_ID: products_fr,
        }
        for outlet_id, prod_list in outlet_products_map.items():
            for (p_name, sku, cat, price, cost, stock) in prod_list:
                db.add(models_pg.Product(
                    id=str(uuid.uuid4()),
                    company_id=COMPANY_ID,
                    outlet_id=outlet_id,
                    name=p_name,
                    sku=sku,
                    category=cat,
                    price=Decimal(str(price)),
                    cost=Decimal(str(cost)),
                    stock_quantity=stock,
                    reorder_level=10,
                    is_addon=False,
                    active=True,
                ))
        await db.flush()

        # ── 10. Orders, Transactions, Invoices, Feedback ─────────────────────
        print("  Generating 90 days × 100 orders per outlet (27,000 total)...")

        invoice_counter = 1
        total_orders_written = 0
        # Track per-customer revenue for Customer.total_revenue updates
        customer_revenue: dict[str, Decimal] = {c.id: Decimal("0") for c in customers}
        customer_order_count: dict[str, int] = {c.id: 0 for c in customers}

        for outlet_id in [OUTLET_JP_ID, OUTLET_IT_ID, OUTLET_FR_ID]:
            menu_items  = all_menu_items[outlet_id]
            prefix      = outlet_prefix[outlet_id]
            order_num   = 1
            # Per-outlet per-customer invoice accumulator:
            # {customer_id: [invoice_line_dicts]}
            invoice_acc: dict[str, list] = {}

            # Batch by day to keep memory manageable
            for day_offset in range(90, -1, -1):
                day_orders_count = 100 if day_offset > 0 else rng.randint(20, 60)
                batch_orders      = []
                batch_txns        = []
                batch_feedback    = []

                for _ in range(day_orders_count):
                    customer = rng.choice(customers)
                    order_time = _order_time(day_offset, outlet_id)
                    # Pick 1–4 items
                    num_items = rng.choices([1, 2, 3, 4], weights=[15, 40, 30, 15])[0]
                    chosen = rng.choices(menu_items, k=num_items)
                    items_json = []
                    order_total = Decimal("0")
                    for mi in chosen:
                        qty = rng.choices([1, 2, 3], weights=[65, 25, 10])[0]
                        line = Decimal(str(mi.price)) * qty
                        order_total += line
                        items_json.append({
                            "itemId":   mi.id,
                            "name":     mi.name,
                            "quantity": qty,
                            "price":    float(mi.price),
                            "category": mi.category,
                        })

                    is_today_future = (day_offset == 0 and
                                       order_time.hour >= NOW.hour)
                    if is_today_future:
                        status = rng.choice(["New", "Preparing"])
                        pay_status = "pending"
                    elif day_offset <= 1:
                        status = rng.choices(
                            ["Completed", "ReadyToCollect", "Preparing"],
                            weights=[70, 20, 10])[0]
                        pay_status = "paid" if status == "Completed" else "pending"
                    else:
                        status = rng.choices(
                            ["Completed", "Cancelled"],
                            weights=[95, 5])[0]
                        pay_status = "paid" if status == "Completed" else "pending"

                    order = models_pg.RestaurantOrder(
                        id=str(uuid.uuid4()),
                        company_id=COMPANY_ID,
                        outlet_id=outlet_id,
                        order_number=f"{prefix}-{order_num:05d}",
                        customer_name=customer.name,
                        contact_number=customer.phone,
                        order_type=rng.choices(
                            ["dine_in", "takeaway", "delivery"],
                            weights=[55, 30, 15])[0],
                        items=items_json,
                        total_amount=order_total,
                        status=status,
                        payment_status=pay_status,
                        confirmation_token=str(uuid.uuid4()),
                        created_at=order_time,
                        updated_at=order_time,
                    )
                    batch_orders.append(order)
                    order_num += 1

                    # Transaction for every paid order
                    if pay_status == "paid":
                        pay_method = rng.choice(PAYMENT_METHODS)
                        txn = models_pg.Transaction(
                            id=str(uuid.uuid4()),
                            company_id=COMPANY_ID,
                            outlet_id=outlet_id,
                            customer_id=customer.id,
                            type="pos_sale",
                            payment_method=pay_method,
                            total_amount=order_total,
                            gross=order_total,
                            service_revenue=order_total,
                            status="Settled",
                            date=order_time,
                            created_at=order_time,
                        )
                        batch_txns.append(txn)
                        customer_revenue[customer.id] += order_total
                        customer_order_count[customer.id] += 1

                        # Accumulate for invoice
                        if customer.id not in invoice_acc:
                            invoice_acc[customer.id] = []
                        invoice_acc[customer.id].append({
                            "description": f"Order {order.order_number} — " +
                                           ", ".join(i["name"] for i in items_json[:2]),
                            "quantity": 1,
                            "unit_price": float(order_total),
                            "tax_rate": 18.0,
                            "discount": 0,
                            "amount": float(order_total),
                            "order_id": order.id,
                            "order_date": order_time.isoformat(),
                        })

                    # Feedback — 30 % of completed orders
                    if status == "Completed" and rng.random() < 0.30:
                        rating = rng.choices([3, 4, 5, 5, 5], weights=[5, 20, 35, 25, 15])[0]
                        batch_feedback.append(models_pg.Feedback(
                            id=str(uuid.uuid4()),
                            company_id=COMPANY_ID,
                            outlet_id=outlet_id,
                            rating=rating,
                            liked_most=rng.sample(
                                ["Food quality", "Service", "Ambience",
                                 "Value for money", "Presentation"],
                                k=rng.randint(1, 3)),
                            nps_score=rng.randint(6, 10) if rating >= 4 else rng.randint(1, 6),
                            likely_to_visit_again=(
                                "Yes" if rating >= 4 else "Maybe"),
                            customer_name=customer.name,
                            customer_email=customer.email,
                            comment=(
                                rng.choice([
                                    "Amazing experience, will definitely be back!",
                                    "The food was outstanding.",
                                    "Excellent service and atmosphere.",
                                    "Great value, loved every dish.",
                                    "One of the best meals I've had in the city.",
                                    "Perfectly cooked, beautifully presented.",
                                ]) if rating >= 4 else rng.choice([
                                    "Decent but room for improvement.",
                                    "Service was a bit slow.",
                                    "Food was good, not exceptional.",
                                ])
                            ),
                            created_at=order_time + timedelta(hours=rng.randint(1, 24)),
                        ))

                # Commit this day's batch
                db.add_all(batch_orders)
                db.add_all(batch_txns)
                db.add_all(batch_feedback)
                await db.commit()
                total_orders_written += len(batch_orders)

            # Monthly invoices per customer who ordered at this outlet
            print(f"    Building invoices for {outlet_id[:8]}... "
                  f"({len(invoice_acc)} customers)")
            inv_batch = []
            for cust_id, lines in invoice_acc.items():
                # Find the customer
                cust_obj = next((c for c in customers if c.id == cust_id), None)
                if not cust_obj:
                    continue
                subtotal = Decimal(str(sum(l["amount"] for l in lines)))
                tax_amt  = (subtotal * Decimal("0.18")).quantize(Decimal("0.01"))
                total    = subtotal + tax_amt
                issue_dt = NOW.date() - timedelta(days=1)
                inv = models_pg.Invoice(
                    id=str(uuid.uuid4()),
                    company_id=COMPANY_ID,
                    outlet_id=outlet_id,
                    invoice_number=f"RH-{invoice_counter:05d}",
                    status="paid",
                    customer_id=cust_id,
                    customer_name=cust_obj.name,
                    customer_email=cust_obj.email,
                    customer_phone=cust_obj.phone,
                    items=lines[-10:],    # last 10 lines (keep JSON reasonable)
                    subtotal=subtotal,
                    tax_amount=tax_amt,
                    total_amount=total,
                    paid_amount=total,
                    currency="INR",
                    currency_symbol="₹",
                    issue_date=issue_dt,
                    due_date=issue_dt,
                    payment_terms="due_on_receipt",
                    notes="Thank you for dining with Ri'Serve Hospitality.",
                    paid_at=datetime.combine(issue_dt,
                        datetime.min.time()).replace(tzinfo=timezone.utc),
                    created_by=ADMIN_ID,
                )
                inv_batch.append(inv)
                invoice_counter += 1
            db.add_all(inv_batch)
            await db.commit()

        # ── 11. Update customer totals ────────────────────────────────────────
        print("  Updating customer revenue totals...")
        for cust in customers:
            if customer_revenue[cust.id] > 0:
                cust.total_revenue  = customer_revenue[cust.id]
                cust.total_bookings = customer_order_count[cust.id]
                cust.last_visit     = (NOW - timedelta(
                    days=rng.randint(0, 30))).date()
                db.add(cust)
        await db.commit()

        # ── Done ─────────────────────────────────────────────────────────────
        print()
        print("═" * 65)
        print("  Ri'Serve Hospitality seeded successfully!")
        print("═" * 65)
        print(f"  Company ID : {COMPANY_ID}")
        print(f"  Admin      : admin@riserve.ai  /  admin123")
        print()
        print(f"  Outlets:")
        print(f"    Azabu Kadowaki (Japanese)  {OUTLET_JP_ID}")
        print(f"    La Palanca (Italian)        {OUTLET_IT_ID}")
        print(f"    Benoit Paris (French)       {OUTLET_FR_ID}")
        print()
        print(f"  Orders written : {total_orders_written:,}")
        print(f"  Customers      : 150")
        print(f"  Invoices       : {invoice_counter - 1:,}")
        print("═" * 65)


if __name__ == "__main__":
    asyncio.run(seed())
