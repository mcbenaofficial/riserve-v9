import uuid
import random
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

client = MongoClient("mongodb://127.0.0.1:27017")
db = client.ridn_db

user = db.users.find_one({"email": "admin@urbanstyle.com"})
if not user:
    print("User not found in ridn_db!")
    user = client.riserve_db.users.find_one({"email": "admin@urbanstyle.com"})
    if user:
        print("User found in riserve_db! Using riserve_db.")
        db = client.riserve_db
    else:
        print("User not found anywhere!")
        exit(1)

company_id = user.get("company_id")
print(f"Using company_id: {company_id}")

# Get or create outlets
outlets = list(db.outlets.find({"company_id": company_id}))
if not outlets:
    # create dummy outlet
    outlet_id = str(uuid.uuid4())
    db.outlets.insert_one({
        "id": outlet_id,
        "company_id": company_id,
        "name": "Downtown Store",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    outlets = list(db.outlets.find({"company_id": company_id}))

# Get or create products
products = list(db.products.find({"company_id": company_id, "active": True}))
if not products:
    print("No products found, creating some mock products...")
    mock_products = [
        {"name": "Graphic T-Shirt", "price": 25.0, "category": "Apparel"},
        {"name": "Denim Jeans", "price": 60.0, "category": "Apparel"},
        {"name": "Sneakers", "price": 85.0, "category": "Footwear"},
        {"name": "Leather Belt", "price": 30.0, "category": "Accessories"},
        {"name": "Winter Jacket", "price": 120.0, "category": "Apparel"},
        {"name": "Sunglasses", "price": 45.0, "category": "Accessories"},
    ]
    for mp in mock_products:
        prod_id = str(uuid.uuid4())
        db.products.insert_one({
            "id": prod_id,
            "name": mp["name"],
            "sku": f"SKU-{prod_id[:6].upper()}",
            "category": mp["category"],
            "price": mp["price"],
            "cost": mp["price"] * 0.4,
            "stock_quantity": 500,
            "reorder_level": 20,
            "is_addon": False,
            "active": True,
            "company_id": company_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    products = list(db.products.find({"company_id": company_id, "active": True}))

# Generate 500 transactions over the last 30 days
print(f"Generating 500 transactions for company {company_id}...")
now = datetime.now(timezone.utc)
transactions = []
payment_methods = ["card", "cash", "card", "card", "cash"] # weighted towards card

# First, clear previous transactions for this user/company to ensure we don't duplicate excessively if run multiple times
db.transactions.delete_many({"company_id": company_id})

for i in range(500):
    # Random time in the last 30 days
    days_ago = random.uniform(0, 30)
    tx_time = now - timedelta(days=days_ago)
    
    # 1 to 4 items per transaction
    num_items = random.randint(1, 4)
    tx_items = []
    total_amount = 0
    
    for _ in range(num_items):
        prod = random.choice(products)
        qty = random.randint(1, 3)
        price = prod["price"]
        total_amount += price * qty
        tx_items.append({
            "product_id": prod["id"],
            "quantity": qty,
            "price": price,
        })
    
    outlet_id = random.choice(outlets)["id"]
    
    tx = {
        "id": str(uuid.uuid4()),
        "type": "pos_sale",
        "total_amount": total_amount,
        "payment_method": random.choice(payment_methods),
        "items": tx_items,
        "outlet_id": outlet_id,
        "customer_id": None,
        "status": "Completed",
        "company_id": company_id,
        "created_by": user["id"],
        "date": tx_time.isoformat(),
        "created_at": tx_time.isoformat()
    }
    transactions.append(tx)

db.transactions.insert_many(transactions)
print(f"✅ Successfully inserted 500 transactions for {user['email']}.")
