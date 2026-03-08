import asyncio
import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database_pg import engine
import models_pg

async def seed_retail_inventory():
    print("Initiating full Retail Seeder for Urban Style Apparel...")
    
    async with AsyncSession(engine) as session:
        # 1. Target the Retail Company
        stmt = select(models_pg.Company).where(models_pg.Company.name == "Urban Style Apparel")
        company = (await session.execute(stmt)).scalar_one_or_none()
        
        if not company:
            print("❌ 'Urban Style Apparel' not found. Please run seed_final.py first.")
            return
            
        company_id = company.id
        print(f"✅ Found target company: {company.name} ({company_id})")

        # Get outlet
        o_stmt = select(models_pg.Outlet).where(models_pg.Outlet.company_id == company_id)
        outlets = (await session.execute(o_stmt)).scalars().all()
        outlet_id = outlets[0].id if outlets else None
        
        # Get admin user
        u_stmt = select(models_pg.User).where(models_pg.User.company_id == company_id)
        users = (await session.execute(u_stmt)).scalars().all()
        user_id = users[0].id if users else None

        # Clean existing data
        print("Sweeping old inventory, suppliers, transactions, and customers...")
        await session.execute(delete(models_pg.Transaction).where(models_pg.Transaction.company_id == company_id))
        await session.execute(delete(models_pg.InventoryLog).where(models_pg.InventoryLog.company_id == company_id))
        await session.execute(delete(models_pg.SupplierProduct).where(
            models_pg.SupplierProduct.supplier_id.in_(
                select(models_pg.Supplier.id).where(models_pg.Supplier.company_id == company_id)
            )
        ))
        await session.execute(delete(models_pg.Product).where(models_pg.Product.company_id == company_id))
        await session.execute(delete(models_pg.Supplier).where(models_pg.Supplier.company_id == company_id))
        await session.execute(delete(models_pg.Customer).where(models_pg.Customer.company_id == company_id))
        await session.flush()

        # 2. Create Suppliers
        suppliers_data = [
            {"name": "Nike Wholesale", "contact": "Phil Knight", "email": "b2b@nike.com", "phone": "+1 800-444-1001"},
            {"name": "Levi's Distributors", "contact": "Levi Strauss", "email": "sales@levi.com", "phone": "+1 800-444-2002"},
            {"name": "H&M Supply", "contact": "Helena B.", "email": "supply@hm.com", "phone": "+1 800-444-3003"},
            {"name": "Gucci Direct", "contact": "Aldo Gucci", "email": "b2b@gucci.com", "phone": "+1 800-444-4004"},
            {"name": "Adidas Group", "contact": "Adi Dassler", "email": "wholesale@adidas.com", "phone": "+1 800-444-5005"}
        ]

        vendors = {}
        for s in suppliers_data:
            sid = str(uuid.uuid4())
            supplier = models_pg.Supplier(
                id=sid,
                company_id=company_id,
                name=s["name"],
                contact_person=s["contact"],
                email=s["email"],
                phone=s["phone"]
            )
            session.add(supplier)
            vendors[s["name"]] = sid
        
        await session.flush()
        print(f"✅ Created {len(vendors)} Suppliers.")

        # 3. Create Products
        products_data = [
            # Nike
            {"sku": "NK-AM90", "name": "Air Max 90 Sneakers", "cat": "Shoes", "price": 130.0, "cost": 65.0, "stock": 15, "reorder": 5, "vendor": "Nike Wholesale", "lt": 10, "moq": 10},
            {"sku": "NK-AF1", "name": "Air Force 1 '07", "cat": "Shoes", "price": 110.0, "cost": 55.0, "stock": 25, "reorder": 10, "vendor": "Nike Wholesale", "lt": 10, "moq": 10},
            {"sku": "NK-SW", "name": "Nike Classic Sweatpants", "cat": "Trousers", "price": 60.0, "cost": 25.0, "stock": 3, "reorder": 10, "vendor": "Nike Wholesale", "lt": 7, "moq": 15},
            
            # Levi's
            {"sku": "LVS-501", "name": "501 Original Fit Jeans", "cat": "Trousers", "price": 80.0, "cost": 35.0, "stock": 40, "reorder": 15, "vendor": "Levi's Distributors", "lt": 5, "moq": 20},
            {"sku": "LVS-JKT", "name": "Vintage Denim Trucker Jacket", "cat": "Outerwear", "price": 120.0, "cost": 50.0, "stock": 5, "reorder": 10, "vendor": "Levi's Distributors", "lt": 5, "moq": 5},
            
            # H&M
            {"sku": "HM-TS", "name": "Basic Cotton T-Shirt (White)", "cat": "T-Shirts", "price": 15.0, "cost": 4.0, "stock": 120, "reorder": 30, "vendor": "H&M Supply", "lt": 3, "moq": 50},
            {"sku": "HM-HD", "name": "Relaxed Fit Hoodie", "cat": "Outerwear", "price": 35.0, "cost": 12.0, "stock": 2, "reorder": 10, "vendor": "H&M Supply", "lt": 3, "moq": 20},
            {"sku": "HM-SOX", "name": "Ankle Socks (5-Pack)", "cat": "Accessories", "price": 12.0, "cost": 3.0, "stock": 80, "reorder": 20, "vendor": "H&M Supply", "lt": 3, "moq": 30},

            # Gucci
            {"sku": "GC-BLT", "name": "Marmont Leather Belt", "cat": "Accessories", "price": 450.0, "cost": 180.0, "stock": 3, "reorder": 2, "vendor": "Gucci Direct", "lt": 14, "moq": 2},
            {"sku": "GC-WLT", "name": "Ophidia GG Wallet", "cat": "Accessories", "price": 550.0, "cost": 200.0, "stock": 5, "reorder": 2, "vendor": "Gucci Direct", "lt": 14, "moq": 2},
            
            # Adidas
            {"sku": "AD-UB", "name": "Ultraboost 1.0", "cat": "Shoes", "price": 190.0, "cost": 85.0, "stock": 12, "reorder": 5, "vendor": "Adidas Group", "lt": 7, "moq": 10},
            {"sku": "AD-SS", "name": "Superstar Classic", "cat": "Shoes", "price": 100.0, "cost": 45.0, "stock": 18, "reorder": 8, "vendor": "Adidas Group", "lt": 7, "moq": 10},
            {"sku": "AD-BAG", "name": "Originals Duffel Bag", "cat": "Accessories", "price": 50.0, "cost": 20.0, "stock": 10, "reorder": 5, "vendor": "Adidas Group", "lt": 7, "moq": 5},
        ]

        products_list = []
        for p in products_data:
            pid = str(uuid.uuid4())
            prod = models_pg.Product(
                id=pid,
                company_id=company_id,
                outlet_id=outlet_id,
                name=p["name"],
                sku=p["sku"],
                category=p["cat"],
                price=p["price"],
                cost=p["cost"],
                stock_quantity=p["stock"],
                reorder_level=p["reorder"],
                is_addon=False,
                active=True
            )
            session.add(prod)
            products_list.append((pid, prod, p))
            
        await session.flush()
        print(f"✅ Created {len(products_data)} Products.")

        # 4. Link Products to Suppliers 
        for pid, prod, p in products_list:
            sup_id = vendors[p["vendor"]]
            sp = models_pg.SupplierProduct(
                id=str(uuid.uuid4()),
                company_id=company_id,
                supplier_id=sup_id,
                product_id=pid,
                lead_time_days=p["lt"],
                moq=p["moq"],
                unit_cost=p["cost"]
            )
            session.add(sp)

        # 5. Create Customers
        customers_data = ["Sarah Jenkins", "Michael Scott", "Jim Halpert", "Pam Beesly", 
                          "Dwight Schrute", "Kevin Malone", "Angela Martin", "Stanley Hudson"]
        customer_ids = []
        for cname in customers_data:
            cid = str(uuid.uuid4())
            customer = models_pg.Customer(
                id=cid,
                company_id=company_id,
                name=cname,
                email=f"{cname.split()[0].lower()}@example.com",
                phone=f"555-010{random.randint(1,9)}"
            )
            session.add(customer)
            customer_ids.append(cid)

        await session.flush()
        print(f"✅ Created {len(customer_ids)} Customers.")

        # 6. Generate POS Transactions & Inventory Logs (Last 30 days)
        now = datetime.now(timezone.utc)
        total_tx = 0
        total_revenue = 0

        for days_ago in range(30, -1, -1):
            # 1 to 4 transactions per day
            num_tx = random.randint(1, 4)
            for _ in range(num_tx):
                txn_id = str(uuid.uuid4())
                tx_date = now - timedelta(days=days_ago, hours=random.randint(1, 8))
                
                # Pick 1 to 3 random products
                num_items = random.randint(1, 3)
                selected_prods = random.sample(products_list, num_items)
                
                txn_gross = 0
                txn_cost = 0
                items_json = []

                for pid, prod, pdata in selected_prods:
                    qty = random.randint(1, 2)
                    line_total = prod.price * qty
                    txn_gross += line_total
                    txn_cost += (prod.cost or 0) * qty
                    
                    items_json.append({
                        "id": pid,
                        "name": prod.name,
                        "type": "product",
                        "price": float(prod.price),
                        "quantity": qty,
                        "total": float(line_total)
                    })

                    # Generate Inventory Log representing checkout
                    log = models_pg.InventoryLog(
                        id=str(uuid.uuid4()),
                        company_id=company_id,
                        product_id=pid,
                        user_id=user_id,
                        action="sale",
                        quantity=qty,
                        new_quantity=max(0, prod.stock_quantity - qty),
                        reason="pos_checkout",
                        reference_id=txn_id,
                        created_at=tx_date
                    )
                    session.add(log)

                # Create Transaction
                total_revenue += txn_gross
                total_tx += 1
                
                transaction = models_pg.Transaction(
                    id=txn_id,
                    company_id=company_id,
                    outlet_id=outlet_id,
                    customer_id=random.choice(customer_ids),
                    type="sale",
                    payment_method=random.choice(["Credit Card", "Cash", "Apple Pay"]),
                    total_amount=txn_gross,
                    gross=txn_gross,
                    service_revenue=0,
                    product_revenue=txn_gross,
                    product_cost=txn_cost,
                    items=items_json,
                    status="Settled",
                    created_by=user_id,
                    date=tx_date,
                    created_at=tx_date
                )
                session.add(transaction)

        await session.commit()
        print(f"✅ Generated {total_tx} POS Transactions (~${total_revenue:,.2f} revenue).")
        print("🎉 Retail Data Seed completed! Dashboards and POS history are now populated.")

if __name__ == "__main__":
    asyncio.run(seed_retail_inventory())
