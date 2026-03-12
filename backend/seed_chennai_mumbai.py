"""
HQ Intelligence Seed Script — Chennai + Mumbai
Creates 20 outlets (10 Chennai, 10 Mumbai) with full end-to-end data:
staff, services, slot configs, inventory, suppliers, 60 days of bookings,
transactions, and service feedback.
"""
import asyncio
import random
import uuid
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

from database_pg import DATABASE_URL
import models_pg

# ─── CONFIG ──────────────────────────────────────────────────────────
COMPANY_ID = "c4c35eb4-565d-4fc7-89be-0562ff79e8a4"

OUTLET_DEFS = [
    # ── Chennai (10) ──
    {"name": "T. Nagar Flagship",      "location": "Usman Road, T. Nagar, Chennai",           "phone": "+91 44 4200 0001", "region": "Chennai"},
    {"name": "Anna Nagar Premium",     "location": "2nd Avenue, Anna Nagar, Chennai",          "phone": "+91 44 4200 0002", "region": "Chennai"},
    {"name": "Velachery Studio",       "location": "100 Feet Road, Velachery, Chennai",        "phone": "+91 44 4200 0003", "region": "Chennai"},
    {"name": "Adyar Classic",          "location": "LB Road, Adyar, Chennai",                  "phone": "+91 44 4200 0004", "region": "Chennai"},
    {"name": "OMR IT Park",            "location": "Perungudi IT Park, OMR, Chennai",          "phone": "+91 44 4200 0005", "region": "Chennai"},
    {"name": "Mylapore Heritage",      "location": "Luz Corner, Mylapore, Chennai",            "phone": "+91 44 4200 0006", "region": "Chennai"},
    {"name": "Nungambakkam Hub",       "location": "Nungambakkam High Road, Chennai",          "phone": "+91 44 4200 0007", "region": "Chennai"},
    {"name": "Porur Gateway",          "location": "Mount Poonamallee Road, Porur, Chennai",   "phone": "+91 44 4200 0008", "region": "Chennai"},
    {"name": "ECR Coastal",            "location": "ECR Neelankarai, Chennai",                 "phone": "+91 44 4200 0009", "region": "Chennai"},
    {"name": "Thiruvanmiyur Express",  "location": "South Avenue, Thiruvanmiyur, Chennai",     "phone": "+91 44 4200 0010", "region": "Chennai"},
    # ── Mumbai (10) ──
    {"name": "Bandra West Flagship",   "location": "Linking Road, Bandra West, Mumbai",        "phone": "+91 22 6800 0001", "region": "Mumbai"},
    {"name": "Andheri Premium",        "location": "Lokhandwala, Andheri West, Mumbai",        "phone": "+91 22 6800 0002", "region": "Mumbai"},
    {"name": "Juhu Beach Studio",      "location": "Juhu Tara Road, Juhu, Mumbai",             "phone": "+91 22 6800 0003", "region": "Mumbai"},
    {"name": "Powai Lake View",        "location": "Hiranandani Gardens, Powai, Mumbai",       "phone": "+91 22 6800 0004", "region": "Mumbai"},
    {"name": "Lower Parel Mall",       "location": "Phoenix Palladium, Lower Parel, Mumbai",   "phone": "+91 22 6800 0005", "region": "Mumbai"},
    {"name": "Borivali Classic",       "location": "IC Colony, Borivali West, Mumbai",         "phone": "+91 22 6800 0006", "region": "Mumbai"},
    {"name": "Colaba Heritage",        "location": "Shahid Bhagat Singh Road, Colaba, Mumbai", "phone": "+91 22 6800 0007", "region": "Mumbai"},
    {"name": "Thane Hub",              "location": "Viviana Mall, Thane, Mumbai",              "phone": "+91 22 6800 0008", "region": "Mumbai"},
    {"name": "Malad Gateway",          "location": "SV Road, Malad West, Mumbai",              "phone": "+91 22 6800 0009", "region": "Mumbai"},
    {"name": "Worli Seaface",          "location": "Dr Annie Besant Road, Worli, Mumbai",      "phone": "+91 22 6800 0010", "region": "Mumbai"},
]

SERVICE_CATEGORIES = [
    {"name": "Hair Services",     "description": "Haircuts, styling, and treatments"},
    {"name": "Colour & Chemical", "description": "Hair colour, highlights, and chemical treatments"},
    {"name": "Skin & Facial",     "description": "Facials, clean-ups, and skin treatments"},
    {"name": "Nail Services",     "description": "Manicure, pedicure, and nail art"},
    {"name": "Bridal & Occasion", "description": "Bridal packages and special occasion styling"},
]

SERVICES = {
    "Hair Services": [
        {"name": "Classic Haircut",        "duration": 30,  "price": 499},
        {"name": "Premium Haircut & Wash", "duration": 45,  "price": 799},
        {"name": "Hair Spa Treatment",     "duration": 60,  "price": 1499},
        {"name": "Blow Dry & Styling",     "duration": 30,  "price": 599},
        {"name": "Keratin Treatment",      "duration": 90,  "price": 3999},
    ],
    "Colour & Chemical": [
        {"name": "Root Touch-Up",          "duration": 45,  "price": 1299},
        {"name": "Global Hair Colour",     "duration": 90,  "price": 2999},
        {"name": "Highlights / Balayage",  "duration": 120, "price": 4999},
        {"name": "Smoothening",            "duration": 120, "price": 5499},
    ],
    "Skin & Facial": [
        {"name": "Classic Facial",         "duration": 45,  "price": 999},
        {"name": "Gold Facial",            "duration": 60,  "price": 1999},
        {"name": "Hydra Facial",           "duration": 60,  "price": 2999},
        {"name": "Clean-Up",              "duration": 30,  "price": 699},
    ],
    "Nail Services": [
        {"name": "Classic Manicure",       "duration": 30,  "price": 499},
        {"name": "Classic Pedicure",       "duration": 45,  "price": 699},
        {"name": "Gel Nail Art",           "duration": 60,  "price": 1299},
    ],
    "Bridal & Occasion": [
        {"name": "Bridal Makeup",          "duration": 120, "price": 14999},
        {"name": "Party Makeup",           "duration": 60,  "price": 3999},
        {"name": "Pre-Bridal Package",     "duration": 180, "price": 9999},
    ],
}

STAFF_NAMES = [
    "Priya Sharma", "Ananya Reddy", "Kavya Nair", "Sneha Gupta", "Deepika Rao",
    "Meera Iyer", "Riya Patel", "Tanvi Kulkarni", "Isha Mehta", "Aisha Khan",
    "Divya Menon", "Neha Joshi", "Pooja Shetty", "Swati Verma", "Lakshmi Bhat",
    "Simran Kaur", "Anjali Das", "Ritika Singh", "Shruti Hegde", "Nandini Rao",
    "Pallavi Gowda", "Aditi Prasad", "Manisha Pillai", "Harini Suresh", "Gayatri Mishra",
    "Preeti Bansal", "Varsha Naik", "Kiran Desai", "Archana Raju", "Shalini Mohan",
    "Bhavna Saxena", "Trisha Krishnan", "Keerthi Suresh", "Samantha Ruth", "Nithya Menen",
    "Radhika Apte", "Sonali Bendre", "Kajal Aggarwal", "Tamannaah Bhatia", "Rashmika Mandanna",
    "Aparna Balamurali", "Nazriya Nazim", "Sai Pallavi Senthamarai", "Jyothika Saravanan", "Revathi Kumar",
    "Manju Warrier", "Parvathy Thiruvothu", "Aishwarya Lekshmi", "Kalyani Priyadarshan", "Durga Murthy",
    "Fatima Sana", "Zaira Wasim", "Sobhita Dhulipala", "Mrunal Thakur", "Bhumi Pednekar",
    "Sanya Malhotra", "Tripti Dimri", "Sharvari Wagh", "Nora Fatehi", "Kriti Sanon",
]

CUSTOMER_FIRST = [
    "Aarav","Vivaan","Aditya","Sai","Arjun","Rohan","Karthik","Rahul","Vikram","Neel",
    "Ananya","Priya","Diya","Saanvi","Isha","Riya","Kavya","Nisha","Pooja","Meera",
    "Surya","Vijay","Rajesh","Manoj","Govind","Lakshmi","Janani","Divya","Bharath","Pradeep",
]
CUSTOMER_LAST = [
    "Sharma","Patel","Reddy","Kumar","Singh","Gupta","Iyer","Nair","Rao","Joshi",
    "Desai","Menon","Das","Pillai","Hegde","Kulkarni","Shetty","Verma","Bhat","Gowda",
    "Mukherjee","Banerjee","Chatterjee","Bose","Ghosh","Kapoor","Malhotra","Khanna","Wadhwa","Mehta",
]

PRODUCT_DEFS = [
    {"name": "L'Oréal Hair Serum",       "sku": "LOR-HS-001", "category": "Hair Care",  "price": 799,  "cost": 450, "stock": 45},
    {"name": "Matrix Shampoo 500ml",      "sku": "MTX-SH-002", "category": "Hair Care",  "price": 649,  "cost": 350, "stock": 60},
    {"name": "Schwarzkopf Conditioner",   "sku": "SCH-CD-003", "category": "Hair Care",  "price": 549,  "cost": 300, "stock": 38},
    {"name": "Wella Hair Colour Kit",     "sku": "WEL-HC-004", "category": "Colour",     "price": 1299, "cost": 700, "stock": 25},
    {"name": "VLCC Facial Kit",           "sku": "VLC-FK-005", "category": "Skin Care",  "price": 999,  "cost": 500, "stock": 30},
    {"name": "Kérastase Hair Oil",        "sku": "KER-HO-006", "category": "Hair Care",  "price": 2499, "cost": 1400,"stock": 15},
    {"name": "OPI Nail Polish Set",       "sku": "OPI-NP-007", "category": "Nail Care",  "price": 1199, "cost": 650, "stock": 20},
    {"name": "Moroccanoil Treatment",     "sku": "MOR-OT-008", "category": "Hair Care",  "price": 3499, "cost": 2000,"stock": 12},
    {"name": "Biotique Face Wash",        "sku": "BIO-FW-009", "category": "Skin Care",  "price": 349,  "cost": 180, "stock": 55},
    {"name": "Neutrogena Sunscreen",      "sku": "NEU-SS-010", "category": "Skin Care",  "price": 599,  "cost": 320, "stock": 40},
    {"name": "Lakme Absolute Foundation", "sku": "LAK-AF-011", "category": "Makeup",     "price": 899,  "cost": 480, "stock": 35},
    {"name": "Maybelline Mascara",        "sku": "MAY-MC-012", "category": "Makeup",     "price": 499,  "cost": 250, "stock": 50},
]

SUPPLIER_DEFS = [
    {"name": "Cosmo Beauty Supplies",   "contact_name": "Rajesh Mehta",   "email": "orders@cosmobeauty.in",  "phone": "+91 98450 11001"},
    {"name": "Salon Pro Distributors",  "contact_name": "Sunita Reddy",   "email": "supply@salonpro.co.in",  "phone": "+91 98450 11002"},
    {"name": "GlamSource India",        "contact_name": "Amit Sharma",    "email": "sales@glamsource.in",    "phone": "+91 98450 11003"},
    {"name": "ProStyle Solutions",      "contact_name": "Kavitha Menon",  "email": "info@prostyle.in",       "phone": "+91 98450 11004"},
]

LIKED_OPTIONS = [
    "Stylist's skill & expertise", "Friendliness & warmth", "Final result / look",
    "Cleanliness & hygiene", "Short wait / punctuality", "Value for money"
]
SHORTCOMING_OPTIONS = [
    "Wait time", "Staff behaviour / empathy", "Service result / consistency",
    "Cleanliness", "Pricing / billing"
]

rng = random.Random(99)

def uid():
    return str(uuid.uuid4())


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # ── Discover admin user ──
        admin = (await db.execute(
            select(models_pg.User).where(
                models_pg.User.company_id == COMPANY_ID,
                models_pg.User.role == "Admin"
            )
        )).scalars().first()
        admin_user_id = admin.id if admin else "system"
        print(f"Using admin: {admin.email if admin else 'system'}")

        # ── Ensure all features are enabled for the test company ──
        from sqlalchemy import update
        await db.execute(
            update(models_pg.Company)
            .where(models_pg.Company.id == COMPANY_ID)
            .values(enabled_features=[
                "hq_intelligence", "inventory", "ai_flows", 
                "crm", "staff_management", "reputation_management"
            ])
        )
        await db.commit()
        print("✓ Enabled all Omni-Channel modules for the test company")

        # ── Clean existing non-Bengaluru seed data ──
        print("Cleaning existing Chennai/Mumbai data (if any)...")
        # We don't delete existing Bengaluru outlets — only clean outlets
        # whose names match our new definitions
        new_names = [o["name"] for o in OUTLET_DEFS]

        existing = (await db.execute(
            select(models_pg.Outlet).where(
                models_pg.Outlet.company_id == COMPANY_ID,
                models_pg.Outlet.name.in_(new_names),
            )
        )).scalars().all()

        if existing:
            existing_ids = [o.id for o in existing]
            print(f"  Found {len(existing_ids)} existing outlets to clean...")
            # Get staff user_ids before deleting staff
            staff_rows = (await db.execute(
                select(models_pg.Staff.user_id).where(models_pg.Staff.outlet_id.in_(existing_ids))
            )).scalars().all()
            await db.execute(delete(models_pg.Feedback).where(models_pg.Feedback.outlet_id.in_(existing_ids)))
            await db.execute(delete(models_pg.Transaction).where(models_pg.Transaction.outlet_id.in_(existing_ids)))
            await db.execute(delete(models_pg.Booking).where(models_pg.Booking.outlet_id.in_(existing_ids)))
            await db.execute(delete(models_pg.SlotConfig).where(models_pg.SlotConfig.outlet_id.in_(existing_ids)))
            await db.execute(delete(models_pg.Resource).where(models_pg.Resource.outlet_id.in_(existing_ids)))
            await db.execute(delete(models_pg.Staff).where(models_pg.Staff.outlet_id.in_(existing_ids)))
            await db.execute(delete(models_pg.Outlet).where(models_pg.Outlet.id.in_(existing_ids)))
            if staff_rows:
                await db.execute(delete(models_pg.User).where(models_pg.User.id.in_(staff_rows)))
            await db.commit()
            print("  ✓ Cleaned existing data")
        else:
            print("  ✓ No existing data to clean")

        # Check if service categories already exist
        existing_cats = (await db.execute(
            select(models_pg.ServiceCategory).where(
                models_pg.ServiceCategory.company_id == COMPANY_ID
            )
        )).scalars().all()

        # ═══════════════════════════════════════════════
        # 1. Service Categories & Services (reuse if existing)
        # ═══════════════════════════════════════════════
        cat_map = {}
        all_services = []

        if existing_cats:
            print("Reusing existing service categories & services...")
            for cat in existing_cats:
                cat_map[cat.name] = cat.id

            existing_svcs = (await db.execute(
                select(models_pg.Service).where(
                    models_pg.Service.company_id == COMPANY_ID, models_pg.Service.active == True
                )
            )).scalars().all()
            for svc in existing_svcs:
                all_services.append((svc, float(svc.price)))
            print(f"  ✓ Reusing {len(existing_cats)} categories, {len(all_services)} services")
        else:
            print("Creating service categories & services...")
            for cat_def in SERVICE_CATEGORIES:
                cat_id = uid()
                db.add(models_pg.ServiceCategory(
                    id=cat_id, company_id=COMPANY_ID,
                    name=cat_def["name"], description=cat_def["description"]
                ))
                cat_map[cat_def["name"]] = cat_id

            for cat_name, svc_list in SERVICES.items():
                for svc in svc_list:
                    svc_id = uid()
                    svc_obj = models_pg.Service(
                        id=svc_id, company_id=COMPANY_ID,
                        category_id=cat_map[cat_name],
                        name=svc["name"], duration=svc["duration"],
                        price=Decimal(str(svc["price"])), active=True
                    )
                    db.add(svc_obj)
                    all_services.append((svc_obj, svc["price"]))
            await db.flush()
            print(f"  ✓ {len(SERVICE_CATEGORIES)} categories, {len(all_services)} services")

        # ═══════════════════════════════════════════════
        # 2. Outlets, Resources, Staff, Slot Configs
        # ═══════════════════════════════════════════════
        print("Creating 20 outlets (10 Chennai + 10 Mumbai)...")
        outlets = []
        all_resources = {}
        all_staff_ids = {}
        staff_name_idx = 0

        # Create outlets
        for i, odef in enumerate(OUTLET_DEFS):
            outlet_id = uid()
            # Vary capacity by "tier" — flagships get more
            is_flagship = any(w in odef["name"].lower() for w in ["flagship", "premium", "mall"])
            capacity = rng.randint(6, 10) if is_flagship else rng.randint(4, 7)

            db.add(models_pg.Outlet(
                id=outlet_id, company_id=COMPANY_ID,
                name=odef["name"], location=odef["location"],
                contact_phone=odef["phone"], status="active",
                capacity=capacity
            ))
            outlets.append((outlet_id, odef["name"], odef["region"]))

        await db.flush()
        print(f"  ✓ {len(outlets)} outlets created")

        # Resources, staff, slot configs
        for i, (outlet_id, outlet_name, region) in enumerate(outlets):
            is_flagship = any(w in outlet_name.lower() for w in ["flagship", "premium", "mall"])
            num_resources = rng.randint(5, 8) if is_flagship else rng.randint(3, 6)
            resource_ids = []
            resource_configs = []

            for r in range(num_resources):
                r_id = uid()
                r_name = f"Station {r+1}"
                db.add(models_pg.Resource(
                    id=r_id, outlet_id=outlet_id,
                    name=r_name, capacity=1, active=True
                ))
                resource_ids.append(r_id)
                resource_configs.append({"id": r_id, "name": r_name, "capacity": 1, "active": True})
            all_resources[outlet_id] = resource_ids

            # Staff: 3-6 per outlet
            num_staff = rng.randint(4, 6) if is_flagship else rng.randint(3, 5)
            staff_ids = []
            for s in range(num_staff):
                name = STAFF_NAMES[staff_name_idx % len(STAFF_NAMES)]
                staff_name_idx += 1
                user_id = uid()
                slug = region.lower()[:3]
                email = f"{name.lower().replace(' ', '.')}.{slug}{i}{s}@riserve.in"
                db.add(models_pg.User(
                    id=user_id, company_id=COMPANY_ID,
                    email=email, name=name,
                    password_hash="$2b$12$placeholder", role="User"
                ))
                first, last = name.split(" ", 1)
                staff_id = uid()
                db.add(models_pg.Staff(
                    id=staff_id, user_id=user_id, company_id=COMPANY_ID, outlet_id=outlet_id,
                    first_name=first, last_name=last,
                    email=email,
                    department=rng.choice(["Hair", "Skin", "Nails", "Bridal"]),
                    employment_type="full-time",
                    phone=f"+91 98{rng.randint(100,999)}0{rng.randint(1000,9999)}",
                    status="active",
                    skills=[rng.choice(["Haircut", "Colour", "Facial", "Nail Art", "Bridal Makeup"])],
                ))
                staff_ids.append(staff_id)
            all_staff_ids[outlet_id] = staff_ids

            # Slot Config
            db.add(models_pg.SlotConfig(
                id=uid(), company_id=COMPANY_ID, outlet_id=outlet_id,
                configuration={
                    "slotDuration": 30,
                    "operatingHours": {"start": "09:00", "end": "21:00"},
                    "resources": resource_configs,
                    "bookingRules": {
                        "allowOverlap": False,
                        "autoNextSlot": True,
                        "maxAdvanceBookingDays": 30
                    }
                }
            ))

        await db.flush()
        print(f"  ✓ Resources, staff & slot configs added")

        # ═══════════════════════════════════════════════
        # 3. Customers (400 across both cities)
        # ═══════════════════════════════════════════════
        print("Creating customers...")
        customers = []
        # Reuse existing customers if available
        existing_custs = (await db.execute(
            select(models_pg.Customer).where(
                models_pg.Customer.company_id == COMPANY_ID
            ).limit(200)
        )).scalars().all()

        if len(existing_custs) >= 100:
            customers = [(c.id, c.name) for c in existing_custs]
            print(f"  ✓ Reusing {len(customers)} existing customers")
        else:
            pass  # If no existing, create later

        # Create 200 new customers for Chennai/Mumbai
        for c in range(200):
            first = rng.choice(CUSTOMER_FIRST)
            last = rng.choice(CUSTOMER_LAST)
            name = f"{first} {last}"
            cust_id = uid()
            db.add(models_pg.Customer(
                id=cust_id, company_id=COMPANY_ID,
                name=name,
                email=f"{first.lower()}.{last.lower()}{rng.randint(100,999)}@gmail.com",
                phone=f"+91 9{rng.randint(100000000, 999999999)}",
                total_bookings=0, total_revenue=Decimal("0"),
            ))
            customers.append((cust_id, name))
        await db.flush()
        print(f"  ✓ {len(customers)} customers total")

        # ═══════════════════════════════════════════════
        # 4. Products & Suppliers (reuse or create)
        # ═══════════════════════════════════════════════
        existing_prods = (await db.execute(
            select(models_pg.Product).where(models_pg.Product.company_id == COMPANY_ID)
        )).scalars().all()

        if existing_prods:
            product_ids = [p.id for p in existing_prods]
            print(f"  ✓ Reusing {len(product_ids)} existing products")
        else:
            print("Creating products & suppliers...")
            product_ids = []
            for pdef in PRODUCT_DEFS:
                pid = uid()
                db.add(models_pg.Product(
                    id=pid, company_id=COMPANY_ID,
                    name=pdef["name"], sku=pdef["sku"],
                    category=pdef["category"],
                    price=Decimal(str(pdef["price"])),
                    cost=Decimal(str(pdef["cost"])),
                    stock_quantity=pdef["stock"],
                    reorder_level=rng.randint(5, 15),
                    active=True
                ))
                product_ids.append(pid)

            supplier_ids = []
            for sdef in SUPPLIER_DEFS:
                sid = uid()
                db.add(models_pg.Supplier(
                    id=sid, company_id=COMPANY_ID,
                    name=sdef["name"], contact_person=sdef["contact_name"],
                    email=sdef["email"], phone=sdef["phone"],
                    active=True
                ))
                supplier_ids.append(sid)

            await db.flush()

            for pidx, pid in enumerate(product_ids):
                supplier = supplier_ids[pidx % len(supplier_ids)]
                db.add(models_pg.SupplierProduct(
                    id=uid(), company_id=COMPANY_ID,
                    supplier_id=supplier, product_id=pid,
                    unit_cost=Decimal(str(PRODUCT_DEFS[pidx]["cost"])),
                    lead_time_days=rng.randint(2, 7),
                ))
            await db.flush()
            print(f"  ✓ {len(product_ids)} products, {len(supplier_ids)} suppliers")

        # ═══════════════════════════════════════════════
        # 5. Bookings (60 days) + Transactions + Feedback
        # ═══════════════════════════════════════════════
        print("Creating 60 days of bookings, transactions & feedback...")
        today = date.today()
        booking_count = 0
        feedback_count = 0
        txn_count = 0

        time_slots = [f"{h:02d}:{m:02d}" for h in range(9, 21) for m in (0, 30)]

        # Build outlet performance profiles — some outlets perform better than others
        outlet_profiles = {}
        for idx, (oid, oname, oregion) in enumerate(outlets):
            # Flagship/premium outlets get higher booking volumes + ratings
            is_flagship = any(w in oname.lower() for w in ["flagship", "premium", "mall"])
            is_express = any(w in oname.lower() for w in ["express", "hub", "gateway"])

            if is_flagship:
                profile = {"booking_mult": 1.4, "rating_bias": 0.5, "cancel_rate": 0.03}
            elif is_express:
                profile = {"booking_mult": 1.1, "rating_bias": 0.1, "cancel_rate": 0.08}
            else:
                # Vary performance — some outlets intentionally underperform
                perf = rng.choice(["good", "good", "average", "average", "struggling"])
                if perf == "good":
                    profile = {"booking_mult": 1.2, "rating_bias": 0.3, "cancel_rate": 0.04}
                elif perf == "average":
                    profile = {"booking_mult": 1.0, "rating_bias": 0.0, "cancel_rate": 0.06}
                else:
                    profile = {"booking_mult": 0.7, "rating_bias": -0.3, "cancel_rate": 0.12}

            if oregion == "Mumbai":
                profile["booking_mult"] *= 0.8  # 20% fewer bookings
                profile["rating_bias"] -= 0.2   # Lower ratings
                profile["cancel_rate"] *= 1.25  # 25% higher cancellation rate

            outlet_profiles[oid] = profile

        for day_offset in range(60, -1, -1):
            booking_date = today - timedelta(days=day_offset)
            is_weekend = booking_date.weekday() >= 5

            for outlet_id, outlet_name, region in outlets:
                resources = all_resources[outlet_id]
                profile = outlet_profiles[outlet_id]

                base_bookings = rng.randint(8, 20) if is_weekend else rng.randint(4, 14)
                num_bookings = int(base_bookings * profile["booking_mult"])

                used_slots = set()

                for _ in range(num_bookings):
                    svc, svc_price = rng.choice(all_services)
                    cust_id, cust_name = rng.choice(customers)
                    resource_id = rng.choice(resources)
                    slot = rng.choice(time_slots)

                    slot_key = (resource_id, slot)
                    if slot_key in used_slots:
                        continue
                    used_slots.add(slot_key)

                    amount = Decimal(str(svc_price))
                    if rng.random() < 0.15:
                        amount = amount * Decimal("0.85")
                    amount = amount.quantize(Decimal("0.01"))

                    # Status based on outlet profile
                    cancel_rate = profile["cancel_rate"]
                    if rng.random() < cancel_rate:
                        status = rng.choice(["Cancelled", "No-Show"])
                    else:
                        status = "Completed"

                    booking_id = uid()
                    booking_dt = datetime(
                        booking_date.year, booking_date.month, booking_date.day,
                        hour=int(slot[:2]), minute=int(slot[3:]),
                        tzinfo=timezone.utc
                    )

                    db.add(models_pg.Booking(
                        id=booking_id, company_id=COMPANY_ID,
                        outlet_id=outlet_id, customer_id=cust_id,
                        resource_id=resource_id, service_id=svc.id,
                        customer=cust_name, customer_name=cust_name,
                        customer_phone=f"+91 9{rng.randint(100000000,999999999)}",
                        time=slot, date=booking_date,
                        duration=svc.duration, amount=amount,
                        service_amount=amount, total_amount=amount,
                        status=status, source=rng.choice(["app", "walk-in", "phone", "online"]),
                        created_at=booking_dt
                    ))
                    booking_count += 1

                    # Transaction for completed bookings
                    if status == "Completed":
                        db.add(models_pg.Transaction(
                            id=uid(), company_id=COMPANY_ID,
                            booking_id=booking_id, outlet_id=outlet_id,
                            customer_id=cust_id,
                            type="sale",
                            payment_method=rng.choice(["UPI", "Card", "Cash", "UPI", "UPI"]),
                            total_amount=amount, gross=amount,
                            service_revenue=amount,
                            status="Settled",
                            date=booking_dt, created_at=booking_dt
                        ))
                        txn_count += 1

                    # Feedback for ~35% of completed bookings
                    if status == "Completed" and rng.random() < 0.35:
                        # Rating influenced by outlet profile
                        base_weights = [2, 5, 10, 35, 48]
                        bias = profile["rating_bias"]
                        # Shift weights based on bias
                        if bias > 0:
                            base_weights = [1, 3, 8, 35, 53]
                        elif bias < 0:
                            base_weights = [5, 10, 18, 35, 32]

                        rating = rng.choices([1, 2, 3, 4, 5], weights=base_weights)[0]
                        nps = None
                        liked = []
                        shortcomings = []
                        comment = None
                        compared = None
                        escalation_notes = None

                        if rating >= 4:
                            liked = rng.sample(LIKED_OPTIONS, k=rng.randint(1, 3))
                            nps = rng.randint(7, 10)
                            compared = rng.choice(["Much better", "Same", None])
                            comment = rng.choice([
                                "Amazing service! Will come back.",
                                "Loved the experience.",
                                "Great stylist, very professional.",
                                "Excellent service and ambiance.",
                                "Best salon in the city!",
                                "Very relaxing experience.",
                                None, None
                            ])
                        elif rating == 3:
                            liked = rng.sample(LIKED_OPTIONS, k=rng.randint(0, 2))
                            shortcomings = rng.sample(SHORTCOMING_OPTIONS, k=rng.randint(1, 2))
                            nps = rng.randint(5, 7)
                            compared = rng.choice(["Same", "Slightly worse", None])
                        else:
                            shortcomings = rng.sample(SHORTCOMING_OPTIONS, k=rng.randint(2, 4))
                            nps = rng.randint(1, 4)
                            compared = rng.choice(["Slightly worse", "Much worse"])
                            escalation_notes = rng.choice([
                                "Had to wait 40 minutes despite having an appointment.",
                                "The stylist was rude and dismissive.",
                                "Result was nothing like what I asked for.",
                                "Overcharged for the service.",
                                "Very unhygienic environment.",
                                "Staff seemed untrained for the service.",
                                "AC was not working, terrible experience.",
                            ])

                        db.add(models_pg.Feedback(
                            id=uid(), company_id=COMPANY_ID,
                            booking_id=booking_id, outlet_id=outlet_id,
                            service_id=svc.id, rating=rating,
                            compared_to_previous=compared,
                            liked_most=liked,
                            areas_fell_short=shortcomings,
                            shortcomings_details={s: rng.choice(["Needs improvement", "Very poor", "Could be better"]) for s in shortcomings},
                            escalation_notes=escalation_notes,
                            escalation_contact_opt_in=rating <= 2 and rng.random() < 0.5,
                            likely_to_visit_again=rng.choice(["Definitely", "Probably", "Unsure", "Unlikely"]) if rating >= 3 else "Unlikely",
                            nps_score=nps,
                            comment=comment,
                            customer_name=cust_name,
                            created_at=booking_dt + timedelta(hours=rng.randint(1, 24))
                        ))
                        feedback_count += 1

            # Commit every 10 days
            if day_offset % 10 == 0:
                await db.commit()
                print(f"  ... Day -{day_offset}: {booking_count} bookings, {txn_count} txns, {feedback_count} feedback")

        await db.commit()
        print(f"\n{'='*50}")
        print(f"✅ SEED COMPLETE — Chennai + Mumbai")
        print(f"{'='*50}")
        print(f"   Outlets:      {len(outlets)} (10 Chennai + 10 Mumbai)")
        print(f"   Services:     {len(all_services)}")
        print(f"   Customers:    {len(customers)}")
        print(f"   Bookings:     {booking_count:,}")
        print(f"   Transactions: {txn_count:,}")
        print(f"   Feedback:     {feedback_count:,}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
