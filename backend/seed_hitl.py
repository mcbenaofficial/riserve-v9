import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv('.env')

import models_pg
from database_pg import engine

async def seed_hitl_report():
    print("Connecting to PostgreSQL...")
    
    async with AsyncSession(engine) as session:
        # Get the first company and user
        company_stmt = select(models_pg.Company).limit(1)
        company = (await session.execute(company_stmt)).scalar_one_or_none()
        
        if not company:
            print("No company found. Run the main seed first.")
            return
            
        user_stmt = select(models_pg.User).where(models_pg.User.company_id == company.id).limit(1)
        user = (await session.execute(user_stmt)).scalar_one_or_none()
        
        if not user:
            # Fallback to any user
            user_stmt = select(models_pg.User).limit(1)
            user = (await session.execute(user_stmt)).scalar_one_or_none()
            if not user:
                print("No user found.")
                return

        print(f"Using Company: {company.name} ({company.id})")
        print(f"Using User: {user.email} ({user.id})")
        
        report_id = str(uuid.uuid4())
        report_data = models_pg.HITLReport(
            id=report_id,
            company_id=company.id,
            user_id=user.id,
            created_by_agent=True,
            flow_type="dynamic_pricing",
            status="pending",
            report_json={
                "what_this_is": "Vorta Revenue Agent suggests increasing weekend Premium Wash prices by 15% to capitalize on predicted high demand.",
                "why_recommended": "Historical data shows a 45% surge in weekend bookings when local weather is clear. Current utilization for the upcoming weekend is tracking 20% faster than average.",
                "who_it_affects": ["Outlet Managers", "Customers booking weekend slots"],
                "how_it_works": ["Identify high-demand periods", "Temporarily adjust base price in slot configs", "Revert to standard pricing on Monday morning"],
                "chart_data": [
                    {"name": "Mon", "value": 400},
                    {"name": "Tue", "value": 300},
                    {"name": "Wed", "value": 350},
                    {"name": "Thu", "value": 500},
                    {"name": "Fri", "value": 800},
                    {"name": "Sat", "value": 1150},
                    {"name": "Sun", "value": 1200}
                ],
                "recommended_action": "Enable Dynamic Surge Pricing (+15%)"
            }
        )
        
        session.add(report_data)
        await session.commit()
    
    print(f"Successfully inserted pending HITL report: {report_id}")

if __name__ == "__main__":
    asyncio.run(seed_hitl_report())
