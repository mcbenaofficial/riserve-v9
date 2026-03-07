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

async def seed_inventory():
    print("Initiating Inventory & Supplier Seeder for Simulated Salon...")
    
    async with AsyncSession(engine) as session:
        # 1. Target the 'Simulated Salon'
        stmt = select(models_pg.Company).where(models_pg.Company.name == "Simulated Salon")
        company = (await session.execute(stmt)).scalar_one_or_none()
        
        if not company:
            print("❌ 'Simulated Salon' not found.")
            return
            
        company_id = company.id
        print(f"✅ Found target company: {company.name} ({company_id})")

        # Get central outlet or any outlet for products
        o_stmt = select(models_pg.Outlet).where(models_pg.Outlet.company_id == company_id)
        outlets = (await session.execute(o_stmt)).scalars().all()
        outlet_id = outlets[0].id if outlets else None

        # Clear existing specific to this company just in case (optional, but good for clean run)
        print("Sweeping old inventory and suppliers...")
        await session.execute(delete(models_pg.SupplierProduct).where(
            models_pg.SupplierProduct.supplier_id.in_(
                select(models_pg.Supplier.id).where(models_pg.Supplier.company_id == company_id)
            )
        ))
        await session.execute(delete(models_pg.Product).where(models_pg.Product.company_id == company_id))
        await session.execute(delete(models_pg.Supplier).where(models_pg.Supplier.company_id == company_id))
        await session.flush()

        # 2. Create Suppliers
        suppliers_data = [
            {"name": "L'Oréal Professionnel Direct", "contact": "Marie Curie", "email": "orders@loreal.pro", "phone": "+1 800-555-1001"},
            {"name": "SalonCentric Wholesale", "contact": "John Smith", "email": "john@saloncentric.com", "phone": "+1 800-555-2002"},
            {"name": "Wella Supply Co.", "contact": "Emma Watson", "email": "supply@wella.com", "phone": "+1 800-555-3003"},
            {"name": "Olaplex Distributors", "contact": "David Bond", "email": "distro@olaplex.com", "phone": "+1 800-555-4004"},
            {"name": "Dyson Pro Tech", "contact": "James Dyson", "email": "b2b@dyson.com", "phone": "+1 800-555-5005"},
            {"name": "Marika Beauty Supplies", "contact": "Marika Chen", "email": "sales@marika.com", "phone": "+1 800-555-6006"},
            {"name": "Redken Direct", "contact": "Sarah Connor", "email": "orders@redken.pro", "phone": "+1 800-555-7007"},
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
        print(f"✅ Created {len(vendors)} Vendors.")

        # 3. Create Products (Salon Inventory)
        products_data = [
            # L'Oreal
            {"sku": "LOR-001", "name": "Majirel Hair Color 5.0", "cat": "consumables", "price": 12.0, "cost": 6.5, "stock": 5, "reorder": 15, "vendor": "L'Oréal Professionnel Direct", "lt": 3, "moq": 10},
            {"sku": "LOR-002", "name": "Metal Detox Shampoo 1500ml", "cat": "consumables", "price": 45.0, "cost": 25.0, "stock": 4, "reorder": 8, "vendor": "L'Oréal Professionnel Direct", "lt": 3, "moq": 4},
            {"sku": "LOR-003", "name": "Dia Richesse Semi-Permanent 6.01", "cat": "consumables", "price": 11.5, "cost": 6.0, "stock": 25, "reorder": 15, "vendor": "L'Oréal Professionnel Direct", "lt": 3, "moq": 10},
            
            # Wella
            {"sku": "WEL-001", "name": "Koleston Perfect 6/0", "cat": "consumables", "price": 14.0, "cost": 7.0, "stock": 35, "reorder": 20, "vendor": "Wella Supply Co.", "lt": 5, "moq": 12},
            {"sku": "WEL-002", "name": "Blondor Lightening Powder 800g", "cat": "consumables", "price": 60.0, "cost": 35.0, "stock": 8, "reorder": 10, "vendor": "Wella Supply Co.", "lt": 5, "moq": 6},
            {"sku": "WEL-003", "name": "Illumina Color 8/69", "cat": "consumables", "price": 16.0, "cost": 8.0, "stock": 3, "reorder": 15, "vendor": "Wella Supply Co.", "lt": 5, "moq": 6},
            
            # SalonCentric
            {"sku": "SAL-001", "name": "Framar Processing Foils (500ct)", "cat": "accessories", "price": 25.0, "cost": 12.0, "stock": 1, "reorder": 5, "vendor": "SalonCentric Wholesale", "lt": 2, "moq": 5},
            {"sku": "SAL-002", "name": "Disposable Capes (100ct)", "cat": "accessories", "price": 30.0, "cost": 15.0, "stock": 2, "reorder": 5, "vendor": "SalonCentric Wholesale", "lt": 2, "moq": 5},
            {"sku": "SAL-003", "name": "Nitrile Gloves Size M (100ct)", "cat": "accessories", "price": 18.0, "cost": 9.0, "stock": 10, "reorder": 15, "vendor": "SalonCentric Wholesale", "lt": 2, "moq": 10},

            # Olaplex
            {"sku": "OLA-No1", "name": "Olaplex No.1 Bond Maker", "cat": "consumables", "price": 100.0, "cost": 75.0, "stock": 2, "reorder": 5, "vendor": "Olaplex Distributors", "lt": 7, "moq": 2},
            {"sku": "OLA-No2", "name": "Olaplex No.2 Bond Perfector", "cat": "consumables", "price": 100.0, "cost": 75.0, "stock": 3, "reorder": 5, "vendor": "Olaplex Distributors", "lt": 7, "moq": 2},
            {"sku": "OLA-No4", "name": "Olaplex No.4 Bond Maintenance Shampoo (Retail)", "cat": "retail", "price": 30.0, "cost": 15.0, "stock": 12, "reorder": 10, "vendor": "Olaplex Distributors", "lt": 7, "moq": 6},
            {"sku": "OLA-No5", "name": "Olaplex No.5 Bond Maintenance Conditioner (Retail)", "cat": "retail", "price": 30.0, "cost": 15.0, "stock": 8, "reorder": 10, "vendor": "Olaplex Distributors", "lt": 7, "moq": 6},
            
            # Dyson Pro Tech
            {"sku": "DYS-SP01", "name": "Dyson Supersonic Pro Hair Dryer", "cat": "tools", "price": 450.0, "cost": 350.0, "stock": 4, "reorder": 2, "vendor": "Dyson Pro Tech", "lt": 14, "moq": 2},
            {"sku": "DYS-COR1", "name": "Dyson Corrale Straightener Pro", "cat": "tools", "price": 500.0, "cost": 400.0, "stock": 2, "reorder": 2, "vendor": "Dyson Pro Tech", "lt": 14, "moq": 2},
            
            # Marika Beauty
            {"sku": "MAR-B01", "name": "Marika Boar Bristle Round Brush 2inch", "cat": "accessories", "price": 35.0, "cost": 18.0, "stock": 12, "reorder": 5, "vendor": "Marika Beauty Supplies", "lt": 4, "moq": 10},
            {"sku": "MAR-C01", "name": "Carbon Cutting Combs (12pk)", "cat": "accessories", "price": 20.0, "cost": 8.0, "stock": 5, "reorder": 5, "vendor": "Marika Beauty Supplies", "lt": 4, "moq": 5},
            
            # Redken
            {"sku": "REDK-EQ1", "name": "Shades EQ Gloss 09V Platinum Ice", "cat": "consumables", "price": 10.0, "cost": 5.0, "stock": 2, "reorder": 20, "vendor": "Redken Direct", "lt": 3, "moq": 12},
            {"sku": "REDK-EQ2", "name": "Shades EQ Gloss 06N Moroccan Sand", "cat": "consumables", "price": 10.0, "cost": 5.0, "stock": 35, "reorder": 20, "vendor": "Redken Direct", "lt": 3, "moq": 12},
            {"sku": "REDK-DEV", "name": "Shades EQ Processing Solution 1L", "cat": "consumables", "price": 22.0, "cost": 11.0, "stock": 6, "reorder": 10, "vendor": "Redken Direct", "lt": 3, "moq": 4},
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
            products_list.append((pid, p))
            
        await session.flush()
        print(f"✅ Created {len(products_data)} Products.")

        # 4. Link Products to Suppliers (SupplierProduct)
        for pid, p in products_list:
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

        # 5. Generate Inventory Logs (For Predictive Algo)
        # We need daily logs (burn rate) over the last 30 days for some items to trigger the SUGGESTION logic.
        # Action "deduction" represents usage.
        now = datetime.now(timezone.utc)
        for pid, p in products_list:
            # Generate about 30 deductions for low stock items so algorithm sees high burn rate
            if p["stock"] <= p["reorder"]:
                # High Burn Rate Simulation
                for days_ago in range(1, 31):
                    burn = random.randint(1, 3)
                    log = models_pg.InventoryLog(
                        id=str(uuid.uuid4()),
                        company_id=company_id,
                        product_id=pid,
                        user_id=None,
                        action="sale",
                        quantity=burn,
                        new_quantity=0, # Just mock data, exact new_stock history doesn't matter for algorithm
                        reason="pos_checkout",
                        created_at=now - timedelta(days=days_ago)
                    )
                    session.add(log)
        
        await session.commit()
        print("🎉 Seed completed! You can now check Inventory and Suppliers in the frontend.")

if __name__ == "__main__":
    asyncio.run(seed_inventory())
