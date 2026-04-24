"""
HQ Intelligence Seed Script
Creates 10 outlets with full end-to-end data: staff, services, slot configs,
inventory, suppliers, 60 days of bookings, and service feedback.
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
COMPANY_ID = None  # Will be discovered at runtime
ADMIN_USER_ID = None  # Will be discovered at runtime

OUTLET_DEFS = [
    {"name": "Indiranagar Flagship",  "location": "100 Feet Road, Indiranagar, Bengaluru",     "phone": "+91 80 4123 0001"},
    {"name": "Koramangala Premium",   "location": "80 Feet Road, Koramangala, Bengaluru",      "phone": "+91 80 4123 0002"},
    {"name": "HSR Layout Studio",     "location": "27th Main, HSR Layout, Bengaluru",          "phone": "+91 80 4123 0003"},
    {"name": "Whitefield Mall",       "location": "Phoenix Marketcity, Whitefield, Bengaluru", "phone": "+91 80 4123 0004"},
    {"name": "Jayanagar Classic",     "location": "4th Block, Jayanagar, Bengaluru",           "phone": "+91 80 4123 0005"},
    {"name": "MG Road Express",       "location": "MG Road, Bengaluru",                        "phone": "+91 80 4123 0006"},
    {"name": "Malleshwaram Heritage", "location": "8th Cross, Malleshwaram, Bengaluru",        "phone": "+91 80 4123 0007"},
    {"name": "Electronic City Hub",   "location": "Phase 1, Electronic City, Bengaluru",       "phone": "+91 80 4123 0008"},
    {"name": "JP Nagar Boutique",     "location": "15th Cross, JP Nagar, Bengaluru",           "phone": "+91 80 4123 0009"},
    {"name": "Marathahalli Connect",  "location": "Outer Ring Road, Marathahalli, Bengaluru",  "phone": "+91 80 4123 0010"},
]

SERVICE_CATEGORIES = [
    {"name": "Hair Services",    "description": "Haircuts, styling, and treatments"},
    {"name": "Colour & Chemical","description": "Hair colour, highlights, and chemical treatments"},
    {"name": "Skin & Facial",    "description": "Facials, clean-ups, and skin treatments"},
    {"name": "Nail Services",    "description": "Manicure, pedicure, and nail art"},
    {"name": "Bridal & Occasion","description": "Bridal packages and special occasion styling"},
]

SERVICES = {
    "Hair Services": [
        {"name": "Classic Haircut",       "duration": 30,  "price": 499},
        {"name": "Premium Haircut & Wash", "duration": 45, "price": 799},
        {"name": "Hair Spa Treatment",    "duration": 60,  "price": 1499},
        {"name": "Blow Dry & Styling",    "duration": 30,  "price": 599},
        {"name": "Keratin Treatment",     "duration": 90,  "price": 3999},
    ],
    "Colour & Chemical": [
        {"name": "Root Touch-Up",         "duration": 45,  "price": 1299},
        {"name": "Global Hair Colour",    "duration": 90,  "price": 2999},
        {"name": "Highlights / Balayage", "duration": 120, "price": 4999},
        {"name": "Smoothening",           "duration": 120, "price": 5499},
    ],
    "Skin & Facial": [
        {"name": "Classic Facial",        "duration": 45,  "price": 999},
        {"name": "Gold Facial",           "duration": 60,  "price": 1999},
        {"name": "Hydra Facial",          "duration": 60,  "price": 2999},
        {"name": "Clean-Up",             "duration": 30,  "price": 699},
    ],
    "Nail Services": [
        {"name": "Classic Manicure",      "duration": 30,  "price": 499},
        {"name": "Classic Pedicure",      "duration": 45,  "price": 699},
        {"name": "Gel Nail Art",          "duration": 60,  "price": 1299},
    ],
    "Bridal & Occasion": [
        {"name": "Bridal Makeup",         "duration": 120, "price": 14999},
        {"name": "Party Makeup",          "duration": 60,  "price": 3999},
        {"name": "Pre-Bridal Package",    "duration": 180, "price": 9999},
    ],
}

STAFF_NAMES = [
    "Priya Sharma", "Ananya Reddy", "Kavya Nair", "Sneha Gupta", "Deepika Rao",
    "Meera Iyer", "Riya Patel", "Tanvi Kulkarni", "Isha Mehta", "Aisha Khan",
    "Divya Menon", "Neha Joshi", "Pooja Shetty", "Swati Verma", "Lakshmi Bhat",
    "Simran Kaur", "Anjali Das", "Ritika Singh", "Shruti Hegde", "Nandini Rao",
    "Pallavi Gowda", "Aditi Prasad", "Manisha Pillai", "Harini Suresh", "Gayatri Mishra",
    "Preeti Bansal", "Varsha Naik", "Kiran Desai", "Archana Raju", "Shalini Mohan",
]

CUSTOMER_FIRST = ["Aarav","Vivaan","Aditya","Sai","Arjun","Rohan","Karthik","Rahul","Vikram","Neel",
                   "Ananya","Priya","Diya","Saanvi","Isha","Riya","Kavya","Nisha","Pooja","Meera"]
CUSTOMER_LAST = ["Sharma","Patel","Reddy","Kumar","Singh","Gupta","Iyer","Nair","Rao","Joshi",
                 "Desai","Menon","Das","Pillai","Hegde","Kulkarni","Shetty","Verma","Bhat","Gowda"]

PRODUCT_DEFS = [
    {"name": "L'Oréal Hair Serum",       "sku": "LOR-HS-001", "category": "Hair Care",    "price": 799,  "cost": 450, "stock": 45},
    {"name": "Matrix Shampoo 500ml",      "sku": "MTX-SH-002", "category": "Hair Care",    "price": 649,  "cost": 350, "stock": 60},
    {"name": "Schwarzkopf Conditioner",   "sku": "SCH-CD-003", "category": "Hair Care",    "price": 549,  "cost": 300, "stock": 38},
    {"name": "Wella Hair Colour Kit",     "sku": "WEL-HC-004", "category": "Colour",       "price": 1299, "cost": 700, "stock": 25},
    {"name": "VLCC Facial Kit",           "sku": "VLC-FK-005", "category": "Skin Care",    "price": 999,  "cost": 500, "stock": 30},
    {"name": "Kérastase Hair Oil",        "sku": "KER-HO-006", "category": "Hair Care",    "price": 2499, "cost": 1400,"stock": 15},
    {"name": "OPI Nail Polish Set",       "sku": "OPI-NP-007", "category": "Nail Care",    "price": 1199, "cost": 650, "stock": 20},
    {"name": "Moroccanoil Treatment",     "sku": "MOR-OT-008", "category": "Hair Care",    "price": 3499, "cost": 2000,"stock": 12},
    {"name": "Biotique Face Wash",        "sku": "BIO-FW-009", "category": "Skin Care",    "price": 349,  "cost": 180, "stock": 55},
    {"name": "Neutrogena Sunscreen",      "sku": "NEU-SS-010", "category": "Skin Care",    "price": 599,  "cost": 320, "stock": 40},
]

SUPPLIER_DEFS = [
    {"name": "Cosmo Beauty Supplies",   "contact_name": "Rajesh Mehta",  "email": "orders@cosmobeauty.in",   "phone": "+91 98450 11001"},
    {"name": "Salon Pro Distributors",  "contact_name": "Sunita Reddy",  "email": "supply@salonpro.co.in",   "phone": "+91 98450 11002"},
    {"name": "GlamSource India",        "contact_name": "Amit Sharma",   "email": "sales@glamsource.in",     "phone": "+91 98450 11003"},
]

LIKED_OPTIONS = [
    "Stylist's skill & expertise", "Friendliness & warmth", "Final result / look",
    "Cleanliness & hygiene", "Short wait / punctuality", "Value for money"
]
SHORTCOMING_OPTIONS = [
    "Wait time", "Staff behaviour / empathy", "Service result / consistency",
    "Cleanliness", "Pricing / billing"
]

rng = random.Random(42)

def uid():
    return str(uuid.uuid4())


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # ── Discover company ──
        company = (await db.execute(
            select(models_pg.Company).where(models_pg.Company.name == "Simulated Salon")
        )).scalar_one_or_none()
        
        if not company:
            print("❌ Company 'Simulated Salon' not found. Please run restore_dev_account.py first.")
            return
            
        COMPANY_ID = company.id
        print(f"Using company: {company.name} ({COMPANY_ID})")

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

        # ── Clean existing seed data for this company ──
        print("Cleaning existing data...")
        await db.execute(delete(models_pg.Feedback).where(models_pg.Feedback.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.Transaction).where(models_pg.Transaction.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.Booking).where(models_pg.Booking.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.SupplierProduct).where(models_pg.SupplierProduct.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.Product).where(models_pg.Product.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.Supplier).where(models_pg.Supplier.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.SlotConfig).where(models_pg.SlotConfig.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.Resource).where(models_pg.Resource.outlet_id.in_(
            select(models_pg.Outlet.id).where(models_pg.Outlet.company_id == COMPANY_ID)
        )))
        
        await db.execute(delete(models_pg.Staff).where(models_pg.Staff.outlet_id.in_(
            select(models_pg.Outlet.id).where(models_pg.Outlet.company_id == COMPANY_ID)
        )))

        # Delete all Non-Admin users for this company
        await db.execute(delete(models_pg.User).where(
            models_pg.User.company_id == COMPANY_ID,
            models_pg.User.role != 'Admin'
        ))

        await db.execute(delete(models_pg.Customer).where(models_pg.Customer.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.Service).where(models_pg.Service.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.ServiceCategory).where(models_pg.ServiceCategory.company_id == COMPANY_ID))
        await db.execute(delete(models_pg.Outlet).where(models_pg.Outlet.company_id == COMPANY_ID))
        await db.commit()
        print("✓ Cleaned")

        # ═══════════════════════════════════════════════
        # 1. Service Categories & Services
        # ═══════════════════════════════════════════════
        print("Creating service categories & services...")
        cat_map = {}  # cat_name -> id
        all_services = []  # list of (service_obj, price)

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
        print("Creating outlets...")
        outlets = []
        all_resources = {}  # outlet_id -> [resource_ids]
        all_staff_ids = {}  # outlet_id -> [staff_ids]
        staff_name_idx = 0

        # Phase 1: Create outlets first and flush
        for i, odef in enumerate(OUTLET_DEFS):
            outlet_id = uid()
            db.add(models_pg.Outlet(
                id=outlet_id, company_id=COMPANY_ID,
                name=odef["name"], location=odef["location"],
                contact_phone=odef["phone"], status="active",
                capacity=rng.randint(4, 10)
            ))
            outlets.append((outlet_id, odef["name"]))

        await db.flush()
        print(f"  ✓ {len(outlets)} outlets created")

        # Phase 2: Create resources, staff, and slot configs
        for i, (outlet_id, outlet_name) in enumerate(outlets):
            # Resources (chairs/stations): 4-8 per outlet
            num_resources = rng.randint(4, 8)
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

            # Staff: 3-5 per outlet
            num_staff = rng.randint(3, 5)
            staff_ids = []
            for s in range(num_staff):
                name = STAFF_NAMES[staff_name_idx % len(STAFF_NAMES)]
                staff_name_idx += 1
                # Create a user for this staff member
                user_id = uid()
                email = f"{name.lower().replace(' ', '.')}.{i}{s}@naturals.in"
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
        # 3. Customers
        # ═══════════════════════════════════════════════
        print("Creating customers...")
        customers = []
        for c in range(200):
            first = rng.choice(CUSTOMER_FIRST)
            last = rng.choice(CUSTOMER_LAST)
            name = f"{first} {last}"
            cust_id = uid()
            db.add(models_pg.Customer(
                id=cust_id, company_id=COMPANY_ID,
                name=name,
                email=f"{first.lower()}.{last.lower()}{rng.randint(1,99)}@gmail.com",
                phone=f"+91 9{rng.randint(100000000, 999999999)}",
                total_bookings=0, total_revenue=Decimal("0"),
            ))
            customers.append((cust_id, name))
        await db.flush()
        print(f"  ✓ {len(customers)} customers")

        # ═══════════════════════════════════════════════
        # 4. Products & Suppliers
        # ═══════════════════════════════════════════════
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

        # Link products to suppliers
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

        for day_offset in range(60, -1, -1):
            booking_date = today - timedelta(days=day_offset)
            is_weekend = booking_date.weekday() >= 5

            for outlet_id, outlet_name in outlets:
                resources = all_resources[outlet_id]

                # More bookings on weekends
                base_bookings = rng.randint(8, 18) if is_weekend else rng.randint(4, 12)
                num_bookings = base_bookings

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
                    # Some variability
                    if rng.random() < 0.15:
                        amount = amount * Decimal("0.85")  # 15% discount
                    amount = amount.quantize(Decimal("0.01"))

                    status = rng.choices(
                        ["Completed", "Completed", "Completed", "Completed", "Cancelled", "No-Show"],
                        weights=[40, 30, 15, 10, 3, 2]
                    )[0]

                    booking_id = uid()
                    booking_dt = datetime(
                        booking_date.year, booking_date.month, booking_date.day,
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

                    # Feedback for ~30% of completed bookings
                    if status == "Completed" and rng.random() < 0.30:
                        # Weighted ratings: mostly 4-5, some 3, fewer 1-2
                        rating = rng.choices([1, 2, 3, 4, 5], weights=[2, 5, 10, 35, 48])[0]
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

            # Commit every 10 days to keep transactions manageable
            if day_offset % 10 == 0:
                await db.commit()
                print(f"  ... Day -{day_offset}: {booking_count} bookings, {txn_count} txns, {feedback_count} feedback so far")

        await db.commit()
        print(f"\n✅ SEED COMPLETE")
        print(f"   Outlets:      {len(outlets)}")
        print(f"   Services:     {len(all_services)}")
        print(f"   Customers:    {len(customers)}")
        print(f"   Products:     {len(product_ids)}")
        print(f"   Suppliers:    {len(supplier_ids)}")
        print(f"   Bookings:     {booking_count}")
        print(f"   Transactions: {txn_count}")
        print(f"   Feedback:     {feedback_count}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
