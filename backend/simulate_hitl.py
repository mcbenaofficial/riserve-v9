import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

# Load environment variables
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

import models_pg
from database_pg import engine

async def simulate_hitl_scenarios():
    print("Initiating HITL Scenario Simulator...")
    
    async with AsyncSession(engine) as session:
        # 1. Get an active company to map these reports to
        stmt = select(models_pg.Company).limit(1)
        company = (await session.execute(stmt)).scalar_one_or_none()
        
        if not company:
            company_id = str(uuid.uuid4())
            new_company = models_pg.Company(
                id=company_id, 
                name="Simulated Salon",
                email="simulated@example.com",
                business_type="salon"
            )
            session.add(new_company)
            await session.flush()
            print(f"✅ Created mock company: Simulated Salon ({company_id})")
        else:
            company_id = company.id
            print(f"✅ Found company: {company.name} ({company_id})")

        # Clear existing pending reports for a clean slate
        del_stmt = delete(models_pg.HITLReport).where(
            models_pg.HITLReport.company_id == company_id,
            models_pg.HITLReport.status == "pending"
        )
        result = await session.execute(del_stmt)
        print(f"🧹 Cleared existing pending AI recommendations.")

        now = datetime.now(timezone.utc)
        reports_to_insert = []

        # --- Scenario 1: Quiet Hour Promotion ---
        tomorrow = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        reports_to_insert.append(models_pg.HITLReport(
            id=str(uuid.uuid4()),
            company_id=company_id,
            user_id="system_agent",
            created_by_agent=True,
            flow_type="quiet_hour_promotion",
            status="pending",
            report_json={
                "what_this_is": f"AI detected anomalously low booking volume for tomorrow ({tomorrow}).",
                "why_recommended": "Historical data suggests Tuesday afternoons maintain a 65% capacity, but tomorrow is currently tracking at 12%. Recommending a flash promotion to fill empty slots.",
                "who_it_affects": ["Customers (via Email)", "Marketing", "Staff"],
                "how_it_works": [
                    "Generates a 'QUIET20' discount code.",
                    "Caps redemption at 20 uses.",
                    "Automatically emails customers who haven't booked in 30 days."
                ],
                "chart_data": [
                    {"name": "09:00", "value": 4, "goal": 10},
                    {"name": "10:00", "value": 5, "goal": 12},
                    {"name": "11:00", "value": 2, "goal": 15},
                    {"name": "12:00", "value": 8, "goal": 20},
                    {"name": "13:00", "value": 1, "goal": 18},
                    {"name": "14:00", "value": 0, "goal": 15},
                    {"name": "15:00", "value": 2, "goal": 12},
                    {"name": "16:00", "value": 5, "goal": 10},
                ],
                "chart_type": "bookings",
                "cost_credits": 1,
                "recommended_action": "Launch 20% Flash Sale",
                "target_date": tomorrow,
                "discount_value": 20,
                "discount_type": "percentage"
            }
        ))

        # --- Scenario 2: Inventory Reorder Risk ---
        reports_to_insert.append(models_pg.HITLReport(
            id=str(uuid.uuid4()),
            company_id=company_id,
            user_id="system_agent",
            created_by_agent=True,
            flow_type="inventory_reorder",
            status="pending",
            report_json={
                "what_this_is": "Predictive stockout warning for high-margin retail products.",
                "why_recommended": "The 'Premium Hair Serum' and 'Styling Gel' are depleting 40% faster than their moving average. They will stock out before the weekend rush.",
                "who_it_affects": ["Operations", "Suppliers"],
                "how_it_works": [
                    "Drafts an automated PO to 'Loreal Pro Dist'.",
                    "Requests expedited shipping (2-day).",
                    "Updates internal inventory ledger to 'Ordered' state."
                ],
                "chart_data": [
                    {"name": "Hair Serum", "value": 4, "threshold": 15},
                    {"name": "Styling Gel", "value": 8, "threshold": 20},
                    {"name": "Color Tube 5N", "value": 12, "threshold": 25},
                    {"name": "Foil Rolls", "value": 2, "threshold": 10},
                ],
                "chart_type": "inventory",
                "cost_credits": 2,
                "recommended_action": "Auto-Reorder 4 Critical SKUs",
                "items_to_order": [
                    {"product_id": "prod_1", "name": "Premium Hair Serum", "current_stock": 4, "reorder_level": 15, "suggested_order_qty": 20, "estimated_unit_cost": 25.50},
                    {"product_id": "prod_2", "name": "Styling Gel", "current_stock": 8, "reorder_level": 20, "suggested_order_qty": 24, "estimated_unit_cost": 12.00}
                ],
                "total_estimated_cost": 798.00
            }
        ))

        # --- Scenario 3: Dynamic Pricing ---
        reports_to_insert.append(models_pg.HITLReport(
            id=str(uuid.uuid4()),
            company_id=company_id,
            user_id="system_agent",
            created_by_agent=True,
            flow_type="dynamic_pricing",
            status="pending",
            report_json={
                "what_this_is": "Surge pricing recommendation due to extreme demand.",
                "why_recommended": "Your weekend slots for 'Balayage & Color' are 95% booked three weeks in advance. Enabling a modest 15% price surge for peak hours will drastically improve margins without affecting fill-rate.",
                "who_it_affects": ["Customers", "Finance"],
                "how_it_works": [
                    "Temporarily increases 'Balayage' base price by 15% for Sat/Sun.",
                    "Existing bookings remain unaffected.",
                    "Automatically reverts on Monday."
                ],
                "chart_data": [
                    {"name": "Week 1", "value": 2800, "goal": 2500},
                    {"name": "Week 2", "value": 3100, "goal": 2500},
                    {"name": "Week 3", "value": 3600, "goal": 2600},
                    {"name": "Week 4", "value": 4200, "goal": 2800},
                ],
                "chart_type": "currency",
                "cost_credits": 3,
                "recommended_action": "Enable 15% Surge Pricing"
            }
        ))

        # --- Scenario 4: Staff Reallocation ---
        reports_to_insert.append(models_pg.HITLReport(
            id=str(uuid.uuid4()),
            company_id=company_id,
            user_id="system_agent",
            created_by_agent=True,
            flow_type="staff_reallocation",
            status="pending",
            report_json={
                "what_this_is": "Cross-outlet staff optimization.",
                "why_recommended": "'Downtown HQ' is overbooked by 22% for tomorrow while 'Westside Branch' has 3 idle staff members. Reallocating 2 staff members will recover an estimated $600 in lost revenue.",
                "who_it_affects": ["Staff (Sarah, Mike)", "Managers"],
                "how_it_works": [
                    "Updates Sarah and Mike's roster to 'Downtown HQ' for tomorrow.",
                    "Sends SMS notification to both staff members.",
                    "Unblocks calendar slots at Downtown HQ immediately."
                ],
                "chart_data": [
                    {"name": "Downtown", "value": 122, "threshold": 100},
                    {"name": "Westside", "value": 45, "threshold": 80},
                    {"name": "North St", "value": 90, "threshold": 95},
                    {"name": "Airport", "value": 60, "threshold": 70},
                ],
                "chart_type": "bar",
                "cost_credits": 1,
                "recommended_action": "Reallocate 2 Staff Members"
            }
        ))

        if reports_to_insert:
            session.add_all(reports_to_insert)
            await session.commit()
            print(f"🎉 Successfully injected {len(reports_to_insert)} AI recommendation scenarios!")
    
if __name__ == "__main__":
    print("Running HITL Simulation Script...")
    asyncio.run(simulate_hitl_scenarios())
