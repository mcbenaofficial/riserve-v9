import asyncio
import uuid
import random
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

client = MongoClient("mongodb://127.0.0.1:27017")
db = client.ridn_db

user = db.users.find_one({"email": "admin@ridn.com"})
if not user:
    user = client.riserve_db.users.find_one({"email": "admin@ridn.com"})
    if user:
        db = client.riserve_db
        print("Using riserve_db")
    else:
        print("User not found!")
        exit(1)
else:
    print("Using ridn_db")

company_id = user["company_id"]
customer_names = ["John Doe", "Jane Smith", "Michael Johnson", "Emily Davis", "Chris Brown", "Sarah Wilson", "David Taylor", "Emma Anderson", "James Martinez", "Olivia Thomas"]

# 1. Outlets
outlets = list(db.outlets.find({"company_id": company_id}))
if not outlets:
    print("Creating mock outlets...")
    outlet_names = ["Downtown Branch", "Uptown AutoWash", "Suburban Center"]
    for name in outlet_names:
        db.outlets.insert_one({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "name": name,
            "status": "Active",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    outlets = list(db.outlets.find({"company_id": company_id}))

# 2. Services
services = list(db.services.find({"company_id": company_id}))
if not services:
    print("Creating mock services...")
    service_defs = [
        {"name": "Standard Exterior Wash", "price": 15.0, "duration": 30},
        {"name": "Premium Interior Detailing", "price": 45.0, "duration": 60},
        {"name": "Ultimate Full Service", "price": 80.0, "duration": 120}
    ]
    for s_def in service_defs:
        db.services.insert_one({
            "id": str(uuid.uuid4()),
            "company_id": company_id,
            "name": s_def["name"],
            "price": s_def["price"],
            "duration": s_def["duration"],
            "category": "Washes",
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    services = list(db.services.find({"company_id": company_id}))

# Clear previous mock data for clean run (optional, but good for idempotent testing)
print("Clearing old bookings, transactions, and feedback...")
db.bookings.delete_many({"company_id": company_id, "created_by": "auto_seed"})
db.transactions.delete_many({"company_id": company_id, "created_by": "auto_seed"})
db.feedback.delete_many({"company_id": company_id})

# 3. Bookings & Transactions (Last 30 days)
print(f"Generating 150 bookings and transactions for {user['email']}...")
now = datetime.now(timezone.utc)
bookings = []
transactions = []

for _ in range(150):
    days_ago = random.uniform(0, 30)
    event_time = now - timedelta(days=days_ago)
    
    service = random.choice(services)
    outlet = random.choice(outlets)
    customer = random.choice(customer_names)
    status_choice = random.choices(["Completed", "In Progress", "Cancelled", "Upcoming"], weights=[70, 10, 5, 15])[0]
    
    booking_id = str(uuid.uuid4())
    
    bookings.append({
        "id": booking_id,
        "customer": customer,
        "service_id": service["id"],
        "outlet_id": outlet["id"],
        "company_id": company_id,
        "amount": service["price"],
        "date": event_time.isoformat(),
        "status": status_choice,
        "created_by": "auto_seed",
        "created_at": event_time.isoformat()
    })
    
    # Generate correlation transaction for completed/in-progress
    if status_choice in ["Completed", "In Progress"]:
        tx_status = "Settled" if status_choice == "Completed" else "Held"
        transactions.append({
            "id": str(uuid.uuid4()),
            "booking_id": booking_id,
            "type": "booking_payment",
            "amount": service["price"],
            "total_amount": service["price"],
            "gross": service["price"],
            "commission": service["price"] * 0.15,
            "partner_share": service["price"] * 0.85,
            "payment_method": random.choice(["card", "cash"]),
            "status": tx_status,
            "company_id": company_id,
            "date": event_time.isoformat(),
            "created_by": "auto_seed",
            "created_at": event_time.isoformat()
        })

if bookings:
    db.bookings.insert_many(bookings)
if transactions:
    db.transactions.insert_many(transactions)

# 4. Feedback / Rating
print("Generating feedback reviews...")
feedbacks = []
for b in bookings:
    if b["status"] == "Completed" and random.random() > 0.4:
        rating = random.choices([5, 4, 3, 2, 1], weights=[50, 30, 10, 5, 5])[0]
        feedbacks.append({
            "id": str(uuid.uuid4()),
            "booking_id": b["id"],
            "company_id": company_id,
            "rating": rating,
            "comment": "Great service!" if rating >= 4 else "Could be better.",
            "date": b["date"],
            "created_at": b["created_at"]
        })

if feedbacks:
    db.feedback.insert_many(feedbacks)

print("✅ Dashboard Seeding Complete!")
