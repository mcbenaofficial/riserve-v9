from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any

from routes.dependencies import get_current_user, User, get_db
import models_pg

router = APIRouter(prefix="/analytics", tags=["Analytics"])

@router.get("/staff-scheduling")
async def get_staff_scheduling_analytics(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """
    Returns AI-driven staff scheduling recommendations and utilization data.
    Uses realistic mock data structured to match the dashboard requirements.
    """
    try:
        # Determine the primary outlet or use a default name for context
        outlet_name = "Ekkaduthangal outlet"
        if current_user.company_id:
            stmt = select(models_pg.Outlet).where(models_pg.Outlet.company_id == current_user.company_id).limit(1)
            outlet = (await db_session.execute(stmt)).scalar_one_or_none()
            if outlet:
                outlet_name = outlet.name

        return {
            "status": "success",
            "outlet_name": outlet_name,
            "pipeline_steps": [
                { "id": 1, "title": "1. Historical Data", "subtitle": "4 weeks booking patterns analyzed", "active": True },
                { "id": 2, "title": "2. Peak Detection", "subtitle": "Thu-Fri 3-7pm identified as peak", "active": True },
                { "id": 3, "title": "3. Dynamic Rosters", "subtitle": "AI recommends shift rebalancing", "active": True },
                { "id": 4, "title": "4. Idle Tracking", "subtitle": "Flags underutilization by stylist", "active": True }
            ],
            "alert": {
                "title": "Scheduling Inefficiency Detected",
                "message": f"{outlet_name}: 23% idle stylist time Tue 10am-2pm, but 40% overbooked Sat 4-7pm. CPO agent recommends shift rebalancing to save ₹18,000/month in wasted wages."
            },
            "kpi_metrics": {
                "idle_time": "23%",
                "idle_time_label": "Idle Time (Tue 10am-2pm)",
                "overbooking": "40%",
                "overbooking_label": "Overbooking (Sat 4-7pm)",
                "savings_potential": "15-20%",
                "monthly_savings": "₹18k"
            },
            "heatmap": {
                "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                "time_slots": ["10am-12pm", "12pm-2pm", "2pm-4pm", "4pm-7pm", "7pm-9pm"],
                "data": [
                    [65, 70, 55, 75, 58],  # Mon
                    [32, 28, 25, 60, 35],  # Tue
                    [58, 62, 50, 78, 55],  # Wed
                    [72, 78, 82, 95, 80],  # Thu
                    [85, 88, 90, 97, 85],  # Fri
                    [92, 95, 98, 140, 92], # Sat
                    [68, 72, 65, 88, 70]   # Sun
                ]
            },
            "stylists": [
                { "name": "Priya Kumar", "role": "Senior Stylist • 5 years exp", "utilization": 87, "idle": 5.2, "peak": "Thu-Sat peak shifts", "peakColor": "text-emerald-400", "status": "Optimal", "statusColor": "border-emerald-500/30 text-emerald-400", "recommendation": "Maintain current", "actionText": "Maintain current", "actionType": "secondary" },
                { "name": "Arun Sharma", "role": "Junior Stylist • 2 years exp", "utilization": 45, "idle": 22, "peak": "Tue-Wed off-peak", "peakColor": "text-red-400", "status": "Underutilized", "statusColor": "border-red-500/30 text-red-400", "recommendation": "Shift to Thu-Sat", "actionText": "Shift to Thu-Sat", "actionType": "primary" },
                { "name": "Lakshmi Reddy", "role": "Senior Stylist • 7 years exp", "utilization": 92, "idle": 3.2, "peak": "Sat peak shifts", "peakColor": "text-emerald-400", "status": "Optimal", "statusColor": "border-emerald-500/30 text-emerald-400", "recommendation": "Maintain current", "actionText": "Maintain current", "actionType": "secondary" },
                { "name": "Sneha Iyer", "role": "Mid-Level Stylist • 3 years exp", "utilization": 58, "idle": 16.8, "peak": "Mon-Tue mixed", "peakColor": "text-amber-400", "status": "Below Target", "statusColor": "border-amber-500/30 text-amber-400", "recommendation": "Rebalance shifts", "actionText": "Rebalance shifts", "actionType": "primary" },
                { "name": "Raj Patel", "role": "Senior Stylist • 6 years exp", "utilization": 78, "idle": 8.8, "peak": "Fri-Sat peak shifts", "peakColor": "text-emerald-400", "status": "Optimal", "statusColor": "border-emerald-500/30 text-emerald-400", "recommendation": "Maintain current", "actionText": "Maintain current", "actionType": "secondary" }
            ],
            "recommendations": [
                { "id": 1, "title": "1. Shift Arun Sharma to Thu-Sat peak", "description": "Currently 22 hrs idle on Tue-Wed. Move to peak slots = +15% utilization, ₹12k/month savings" },
                { "id": 2, "title": "2. Add Sneha Iyer to Sat 4-7pm rotation", "description": "Reduces 140% overbooking. Improves wait times. +12% utilization for Sneha" },
                { "id": 3, "title": "3. Reduce Tue 10am-2pm staff from 4 to 2", "description": "23% idle time slot. Save ₹6k/month in wages during low-demand period" },
                { "id": 4, "title": "4. Implement dynamic pricing for off-peak", "description": "15% discount Tue-Wed 10am-2pm to fill idle slots. Recover ₹8k/month revenue" }
            ],
            "comparison_current": [
                "23% idle time during off-peak",
                "40% overbooking on Sat evenings",
                "Customer complaints about wait times",
                "Junior stylists underutilized (45%)",
                "Manual scheduling spreadsheets"
            ],
            "comparison_optimized": [
                "Idle time reduced to <10%",
                "Overbooking eliminated via rebalancing",
                "Zero wait-time complaints projected",
                "All stylists 75%+ utilization",
                "AI auto-scheduling with 1-click apply"
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
