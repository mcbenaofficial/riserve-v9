import asyncio
import sys
import os
import random
from datetime import datetime, timezone, timedelta
import uuid

# Add backend directory to path so we can import models and db
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from database_pg import AsyncSessionLocal
from sqlalchemy import select, delete
from passlib.context import CryptContext
import models_pg

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def get_password_hash(password):
    return pwd_context.hash(password)

# Dummy Data Generators
FIRST_NAMES = ["James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"]
LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]

def random_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

def random_phone():
    return f"+1{random.randint(2000000000, 9999999999)}"

async def clear_old_data(session):
    print("Clearing old seed data...")
    emails_to_delete = ['admin@salon.app', 'admin@spa.app', 'admin@clinic.app', 'admin@restaurant.app']
    
    # Cascade delete companies
    stmt = select(models_pg.Company).where(models_pg.Company.email.in_(emails_to_delete))
    result = await session.execute(stmt)
    companies = result.scalars().all()
    for c in companies:
        await session.delete(c)
        
    # Delete super admin
    stmt = select(models_pg.User).where(models_pg.User.email == 'super@riserve.io')
    result = await session.execute(stmt)
    super_user = result.scalar_one_or_none()
    if super_user:
        await session.delete(super_user)
        
    await session.commit()

async def create_super_admin(session, pwd_hash):
    super_admin = models_pg.User(
        id=models_pg.generate_uuid(),
        email='super@riserve.io',
        name='Super Admin',
        password_hash=pwd_hash,
        role='SuperAdmin',
        status='Active'
    )
    session.add(super_admin)
    await session.commit()
    print("Created Super Admin: super@riserve.io / password123")

BUSINESS_CONFIGS = [
    {
        "type": "salon",
        "name": "Lumina Salon",
        "email": "admin@salon.app",
        "is_booking": True,
        "is_retail": True,
        "is_workplace": False,
        "categories": ["Haircuts", "Coloring", "Styling", "Treatments", "Extensions"],
        "service_names": ["Women's Cut", "Men's Cut", "Root Touch Up", "Full Balayage", "Blowout", "Deep Conditioning", "Keratin Treatment"],
        "prices": [50.0, 30.0, 75.0, 150.0, 45.0, 35.0, 200.0]
    },
    {
        "type": "spa",
        "name": "Zenith Wellness Spa",
        "email": "admin@spa.app",
        "is_booking": True,
        "is_retail": True,
        "is_workplace": False,
        "categories": ["Massages", "Facials", "Body Treatments", "Nail Care", "Waxing"],
        "service_names": ["Swedish Massage (60 min)", "Deep Tissue Massage", "Hydrating Facial", "Anti-Aging Facial", "Sugar Scrub", "Classic Manicure", "Pedicure"],
        "prices": [90.0, 110.0, 85.0, 120.0, 65.0, 35.0, 50.0]
    },
    {
        "type": "clinic",
        "name": "Apex Dermatologist Clinic",
        "email": "admin@clinic.app",
        "is_booking": True,
        "is_retail": True,
        "is_workplace": False,
        "categories": ["Consultations", "Laser Treatments", "Injectables", "Skin Assessments"],
        "service_names": ["Initial Consultation", "Follow-up Visit", "Laser Hair Removal (Small Area)", "Botox (per unit)", "Dermal Filler", "Chemical Peel"],
        "prices": [150.0, 75.0, 100.0, 12.0, 600.0, 120.0]
    },
    {
        "type": "restaurant",
        "name": "The Rustic Table",
        "email": "admin@restaurant.app",
        "is_booking": False,
        "is_retail": False, # Uses F&B logic
        "is_workplace": False,
        "categories": ["Starters", "Mains", "Desserts", "Beverages"],
        "service_names": ["Truffle Fries", "Calamari", "Ribeye Steak", "Grilled Salmon", "Mushroom Risotto", "Cheesecake", "Classic Mojito"],
        "prices": [12.0, 14.0, 38.0, 26.0, 22.0, 9.0, 12.0]
    }
]

async def seed_business(session, config, pwd_hash, now):
    print(f"Generating data for {config['name']}...")
    
    # 1. Company
    company = models_pg.Company(
        id=models_pg.generate_uuid(),
        name=config["name"],
        business_type=config["type"],
        email=config["email"],
        phone="555-1234",
        plan="premium",
        status="active",
        is_booking_enabled=config["is_booking"],
        is_retail_enabled=config["is_retail"],
        is_workplace_enabled=config["is_workplace"]
    )
    session.add(company)
    
    # 2. Outlet
    outlet = models_pg.Outlet(
        id=models_pg.generate_uuid(),
        company_id=company.id,
        name=f"{config['name']} - Main Branch",
        type="Flagship",
        location="Downtown"
    )
    session.add(outlet)
    
    # 3. Admin User
    admin_user = models_pg.User(
        id=models_pg.generate_uuid(),
        company_id=company.id,
        email=config["email"],
        name=f"Admin {config['type'].title()}",
        password_hash=pwd_hash,
        role="Admin"
    )
    session.add(admin_user)
    
    # Link admin to outlet
    await session.flush()
    await session.execute(models_pg.user_outlets.insert().values(user_id=admin_user.id, outlet_id=outlet.id))

    # 4. Staff
    staff_list = []
    for i in range(5):
        staff_user = models_pg.User(
            id=models_pg.generate_uuid(),
            company_id=company.id,
            email=f"staff{i+1}_{config['type']}@riserve.io",
            name=random_name(),
            password_hash=pwd_hash,
            role="User"
        )
        session.add(staff_user)
        await session.flush()
        await session.execute(models_pg.user_outlets.insert().values(user_id=staff_user.id, outlet_id=outlet.id))
        
        staff_profile = models_pg.Staff(
            id=models_pg.generate_uuid(),
            company_id=company.id,
            user_id=staff_user.id,
            outlet_id=outlet.id,
            first_name=staff_user.name.split()[0],
            last_name=staff_user.name.split()[-1],
            email=staff_user.email,
            phone=random_phone(),
            status="active"
        )
        session.add(staff_profile)
        staff_list.append(staff_profile)
        
    # 5. Customers
    customers = []
    for _ in range(50):
        cust = models_pg.Customer(
            id=models_pg.generate_uuid(),
            company_id=company.id,
            name=random_name(),
            email=f"cust{random.randint(1000,9999)}@example.com",
            phone=random_phone(),
            total_revenue=0,
            total_bookings=0
        )
        session.add(cust)
        customers.append(cust)

    await session.flush()

    # 6. Services & Categories OR Menu Items
    services_or_items = []
    if config["type"] == "restaurant":
        for cat_name in config["categories"]:
            for _ in range(2):
                idx = random.randint(0, len(config["service_names"])-1)
                item = models_pg.MenuItem(
                    id=models_pg.generate_uuid(),
                    company_id=company.id,
                    outlet_id=outlet.id,
                    name=config["service_names"][idx],
                    category=cat_name,
                    price=config["prices"][idx],
                    active=True,
                    available=True
                )
                session.add(item)
                services_or_items.append(item)
    else:
        for cat_name in config["categories"]:
            cat = models_pg.ServiceCategory(
                id=models_pg.generate_uuid(),
                company_id=company.id,
                name=cat_name,
                active=True
            )
            session.add(cat)
            await session.flush()
            
            for _ in range(3):
                idx = random.randint(0, len(config["service_names"])-1)
                svc = models_pg.Service(
                    id=models_pg.generate_uuid(),
                    company_id=company.id,
                    category_id=cat.id,
                    name=config["service_names"][idx],
                    duration=random.choice([30, 45, 60, 90]),
                    price=config["prices"][idx],
                    active=True
                )
                session.add(svc)
                services_or_items.append(svc)
                
    await session.commit()
    
    # 7. Generate 90 Days of Activity (-60 to +30)
    for day_offset in range(-60, 31):
        current_date = now + timedelta(days=day_offset)
        is_past = day_offset <= 0
        
        # Staff Attendance (only for past days)
        if is_past:
            for s in staff_list:
                # 80% chance of working that day
                if random.random() < 0.8:
                    att = models_pg.Attendance(
                        id=models_pg.generate_uuid(),
                        staff_id=s.id,
                        company_id=company.id,
                        date=current_date.date(),
                        clock_in=current_date.replace(hour=8, minute=random.randint(0, 59)),
                        clock_out=current_date.replace(hour=17, minute=random.randint(0, 59)),
                        hours_worked=8.0,
                        status="present"
                    )
                    session.add(att)
        
        # Bookings / Orders (10 per day average)
        num_events = random.randint(5, 15)
        for _ in range(num_events):
            cust = random.choice(customers)
            item = random.choice(services_or_items)
            staff = random.choice(staff_list)
            
            # Timeslot
            hour = random.randint(9, 18)
            event_time = f"{hour:02d}:00"
            created_at = current_date - timedelta(days=random.randint(1, 14))
            
            if config["type"] == "restaurant":
                status = "Completed" if is_past else "New"
                order = models_pg.RestaurantOrder(
                    id=models_pg.generate_uuid(),
                    company_id=company.id,
                    outlet_id=outlet.id,
                    order_number=f"RES-{random.randint(1000,9999)}",
                    customer_name=cust.name,
                    contact_number=cust.phone,
                    order_type=random.choice(["dine_in", "takeaway"]),
                    items=[{"name": item.name, "price": str(item.price), "quantity": 1}],
                    total_amount=item.price,
                    status=status,
                    payment_status="paid" if is_past else "pending",
                    confirmation_token=models_pg.generate_uuid(),
                    created_at=current_date
                )
                session.add(order)
                
                if is_past:
                    txn = models_pg.Transaction(
                        id=models_pg.generate_uuid(),
                        company_id=company.id,
                        outlet_id=outlet.id,
                        customer_id=cust.id,
                        type="fnb_sale",
                        payment_method=random.choice(["card", "cash"]),
                        total_amount=item.price,
                        gross=item.price,
                        status="Settled",
                        date=current_date,
                        created_at=current_date
                    )
                    session.add(txn)
                    cust.total_revenue += item.price
                    cust.total_bookings += 1
                    
            else:
                status = "Completed" if is_past else "Pending"
                booking = models_pg.Booking(
                    id=models_pg.generate_uuid(),
                    company_id=company.id,
                    outlet_id=outlet.id,
                    customer_id=cust.id,
                    service_id=item.id,
                    customer=cust.name,
                    customer_name=cust.name,
                    customer_phone=cust.phone,
                    customer_email=cust.email,
                    time=event_time,
                    date=current_date.date(),
                    duration=item.duration,
                    total_amount=item.price,
                    service_amount=item.price,
                    status=status,
                    source="app",
                    created_at=created_at
                )
                session.add(booking)
                
                # Make dummy assignment
                # Since staff resources are currently distinct, we skip full resource assignment here for simplicity,
                # but we can generate a Transaction.
                if is_past:
                    txn = models_pg.Transaction(
                        id=models_pg.generate_uuid(),
                        company_id=company.id,
                        outlet_id=outlet.id,
                        booking_id=booking.id,
                        customer_id=cust.id,
                        type="booking_sale",
                        payment_method=random.choice(["card", "cash"]),
                        total_amount=item.price,
                        service_revenue=item.price,
                        gross=item.price,
                        status="Settled",
                        date=current_date,
                        created_at=current_date
                    )
                    session.add(txn)
                    cust.total_revenue += item.price
                    cust.total_bookings += 1

    await session.commit()
    print(f"Data generated for {config['name']} ({config['email']}).")

async def main():
    print("Starting 90-Day Seed Data Generation...")
    now = datetime.now(timezone.utc)
    pwd_hash = get_password_hash("password123")
    
    async with AsyncSessionLocal() as session:
        await clear_old_data(session)
        await create_super_admin(session, pwd_hash)
        
        for config in BUSINESS_CONFIGS:
            await seed_business(session, config, pwd_hash, now)
            
    print("\n✅ Seed Generation Complete!")

if __name__ == "__main__":
    asyncio.run(main())
