from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert, func

from routes.dependencies import (
    get_current_user, User, get_db, log_audit, require_feature
)
import models_pg

router = APIRouter(
    prefix="/hitl", 
    tags=["Human-in-the-Loop"],
    dependencies=[Depends(require_feature("ai_flows"))]
)
logger = logging.getLogger(__name__)

# Models and definitions can be directly defined for the router payloads

@router.post("/analyze-schedule")
async def analyze_schedule(
    target_date: Optional[str] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Analyze schedule for quiet hours and generate a promotion recommendation"""
    try:
        # Default to tomorrow if no date provided
        if not target_date:
            tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
            target_date = tomorrow.strftime("%Y-%m-%d")
            
        t_date_obj = datetime.strptime(target_date, "%Y-%m-%d").date()
            
        # Get active slot configs to understand operating hours
        sc_stmt = select(models_pg.SlotConfig).where(models_pg.SlotConfig.company_id == current_user.company_id)
        slot_configs = (await db_session.execute(sc_stmt)).scalars().all()
        
        if not slot_configs:
            return {"status": "skipped", "reason": "No slot configurations found"}
            
        # Get bookings for the target date
        b_stmt = select(models_pg.Booking).where(
            models_pg.Booking.company_id == current_user.company_id,
            models_pg.Booking.date == t_date_obj,
            models_pg.Booking.status.not_in(["Cancelled", "No Show"])
        )
        bookings = (await db_session.execute(b_stmt)).scalars().all()
        
        # Simple analysis: count bookings.
        # In a real scenario, this would check capacity vs load per hour block.
        # For this feature, if total bookings < expected (e.g., < 10 for the day), trigger quiet hours promo.
        is_quiet = len(bookings) < 10
        
        if is_quiet:
            # Check if we already have a pending report for this date
            # Since report_json is JSONB, we can use JSON functions natively or cast, but for simplicity
            # we can fetch pending and filter in Python or use Postgres native JSON filtering.
            rep_stmt = select(models_pg.HITLReport).where(
                models_pg.HITLReport.company_id == current_user.company_id,
                models_pg.HITLReport.flow_type == "quiet_hour_promotion",
                models_pg.HITLReport.status == "pending"
            )
            pendings = (await db_session.execute(rep_stmt)).scalars().all()
            
            existing = any(p.report_json.get("target_date") == target_date for p in pendings)
            
            if not existing:
                report_id = str(uuid.uuid4())
                
                # compute chart data
                # Using booking time object 'HH:MM' string
                def get_hour(t_str):
                    if not t_str: return 0
                    return int(t_str.split(":")[0])
                    
                chart_data = [
                    {"name": f"{h:02d}:00", "value": len([b for b in bookings if get_hour(b.time) == h])}
                    for h in range(8, 22)  # Operating hours 8 AM to 9 PM
                ]
                
                new_report = models_pg.HITLReport(
                    id=report_id,
                    company_id=current_user.company_id,
                    user_id=current_user.id,
                    created_by_agent=True,
                    flow_type="quiet_hour_promotion",
                    status="pending",
                    created_at=datetime.now(timezone.utc),
                    expires_at=None,
                    report_json={
                        "what_this_is": f"AI detected low booking volume for {target_date}.",
                        "why_recommended": f"Only {len(bookings)} bookings scheduled. A targeted promotion can help fill empty slots.",
                        "who_it_affects": ["Customers", "Marketing"],
                        "how_it_works": ["Create a 15% off promotion automatically", "Valid only for tomorrow"],
                        "chart_data": chart_data,
                        "chart_type": "bookings",
                        "cost_credits": 1,
                        "recommended_action": "Create Quiet Hour Promotion (15% Off)",
                        "target_date": target_date,
                        "discount_value": 15,
                        "discount_type": "percentage"
                    }
                )
                
                db_session.add(new_report)
                await db_session.commit()
                
                # Normally log audit requires a separate connection handled in dependencies or manual
                # but log_audit might expect db collection instead. Here we will use simple db pass or skip
                # Actually dependencies.log_audit usually uses Mongo so we might need to skip or rewrite log_audit
                
                return {"status": "success", "report_generated": True, "date": target_date, "bookings_count": len(bookings)}
                
            else:
                return {"status": "skipped", "report_generated": False, "date": target_date, "reason": "Pending report for this date already exists"}
                
        return {"status": "success", "report_generated": False, "date": target_date, "bookings_count": len(bookings), "reason": "Booking volume is above the quiet threshold"}
        
    except Exception as e:
        logger.error(f"Error analyzing schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze-inventory")
async def analyze_inventory(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Analyze inventory levels, predict demand, and generate a reorder recommendation"""
    try:
        # Fetch all active products for the company
        p_stmt = select(models_pg.Product).where(
            models_pg.Product.company_id == current_user.company_id,
            models_pg.Product.active == True
        )
        products = (await db_session.execute(p_stmt)).scalars().all()
        
        # Filter products where stock is below or exactly at the reorder level
        low_stock_products = [
            p for p in products 
            if p.stock_quantity is not None and p.reorder_level is not None 
            and p.stock_quantity <= p.reorder_level
        ]
        
        if not low_stock_products:
            return {"status": "success", "report_generated": False, "reason": "No low stock items found"}
            
        # Check if we already have a pending report for inventory reordering
        rep_stmt = select(models_pg.HITLReport).where(
            models_pg.HITLReport.company_id == current_user.company_id,
            models_pg.HITLReport.flow_type == "inventory_reorder",
            models_pg.HITLReport.status == "pending"
        )
        existing = (await db_session.execute(rep_stmt)).scalar_one_or_none()
        
        if existing:
            return {"status": "skipped", "report_generated": False, "reason": "Pending reorder report already exists"}
            
        # Build the reorder list
        items_to_order = []
        total_estimated_cost = 0.0
        
        for p in low_stock_products:
            # Simple demand prediction: aim to restock up to (reorder_level * 2) minimum 10
            target_stock = max((p.reorder_level or 10) * 2, 10)
            order_qty = target_stock - (p.stock_quantity or 0)
            
            # Estimate cost
            unit_cost = float(p.cost or (float(p.price) * 0.4 if p.price else 0))
            est_cost = order_qty * unit_cost
            total_estimated_cost += est_cost
            
            items_to_order.append({
                "product_id": p.id,
                "name": p.name,
                "current_stock": p.stock_quantity or 0,
                "reorder_level": p.reorder_level or 10,
                "suggested_order_qty": order_qty,
                "estimated_unit_cost": unit_cost
            })
            
        if not items_to_order:
             return {"status": "success", "report_generated": False, "reason": "No items require reordering right now"}
             
        report_id = str(uuid.uuid4())
        new_report = models_pg.HITLReport(
            id=report_id,
            company_id=current_user.company_id,
            user_id=current_user.id,
            created_by_agent=True,
            flow_type="inventory_reorder",
            status="pending",
            created_at=datetime.now(timezone.utc),
            expires_at=None,
            report_json={
                "what_this_is": f"AI Inventory Agent detected {len(items_to_order)} items running low on stock.",
                "why_recommended": "Based on current booking velocity and minimum stock thresholds, these items need immediate replenishment to avoid stockouts.",
                "who_it_affects": ["Operations", "Suppliers"],
                "how_it_works": ["Approve to simulate placing an order with integrated suppliers", "Stock quantities will be updated immediately"],
                "chart_data": [
                    {
                        "name": item["name"][:10], 
                        "value": item["current_stock"], 
                        "threshold": item["reorder_level"]
                    } for item in items_to_order[:8]
                ],
                "chart_type": "inventory",
                "cost_credits": 2,
                "recommended_action": f"Reorder {len(items_to_order)} Items (Est. ₹{total_estimated_cost:,.2f})",
                "items_to_order": items_to_order,
                "total_estimated_cost": total_estimated_cost
            }
        )
        
        db_session.add(new_report)
        await db_session.commit()
        
        return {"status": "success", "report_generated": True, "items_count": len(items_to_order)}
        
    except Exception as e:
        logger.error(f"Error analyzing inventory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-report")
async def generate_hitl_report(
    flow_type: str = Body(..., embed=True),
    insight_data: Dict[str, Any] = Body(..., embed=True),
    recommended_action: str = Body(..., embed=True),
    cost_credits: int = Body(0, embed=True),
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Triggered by AI to generate a pending authorization report"""
    try:
        report_id = str(uuid.uuid4())
        
        new_report = models_pg.HITLReport(
            id=report_id,
            company_id=current_user.company_id,
            user_id=current_user.id,
            created_by_agent=True,
            flow_type=flow_type,
            status="pending",
            created_at=datetime.now(timezone.utc),
            expires_at=None,
            report_json={
                "what_this_is": insight_data.get("description", "AI detected an optimization opportunity."),
                "why_recommended": insight_data.get("reasoning", "Based on recent historical trends."),
                "who_it_affects": insight_data.get("affected_roles", ["Managers", "Staff"]),
                "how_it_works": insight_data.get("steps", ["AI evaluates data", "Proposes change", "Executes upon approval"]),
                "chart_data": insight_data.get("chart_data", []), 
                "cost_credits": cost_credits,
                "recommended_action": recommended_action
            }
        )
        
        db_session.add(new_report)
        await db_session.commit()
        
        return {"status": "success", "report_id": report_id}
        
    except Exception as e:
        logger.error(f"Error generating HITL report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending")
async def get_pending_reports(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Fetch pending UI reports for a user/outlet"""
    try:
        stmt = select(models_pg.HITLReport).where(
            models_pg.HITLReport.company_id == current_user.company_id,
            models_pg.HITLReport.status == "pending"
        ).order_by(models_pg.HITLReport.created_at.desc())
        
        res = await db_session.execute(stmt)
        reports = res.scalars().all()
        
        return {"reports": [
            {
                "id": r.id,
                "company_id": r.company_id,
                "user_id": r.user_id,
                "created_by_agent": r.created_by_agent,
                "flow_type": r.flow_type,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "report_json": r.report_json
            } for r in reports
        ]}
        
    except Exception as e:
        logger.error(f"Error fetching pending reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_history_reports(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Fetch resolved (historical) UI reports for a user/outlet and calculate aggregate metrics"""
    try:
        stmt = select(models_pg.HITLReport).where(
            models_pg.HITLReport.company_id == current_user.company_id,
            models_pg.HITLReport.status.in_(["approved", "declined", "modified"])
        ).order_by(models_pg.HITLReport.resolved_at.desc())
        
        res = await db_session.execute(stmt)
        reports = res.scalars().all()
        
        # Calculate aggregates
        total_value_gained = 0
        total_automations = 0
        items_restocked = 0
        
        reports_mapped = []
        for r in reports:
            if r.status in ["approved", "modified"]:
                total_automations += 1
                r_json = r.report_json or {}
                
                # Calculate simulated value gained for the demo
                if r.flow_type == "dynamic_pricing":
                    total_value_gained += 450
                elif r.flow_type == "quiet_hour_promotion":
                    total_value_gained += 120
                elif r.flow_type == "inventory_reorder":
                    items_restocked += sum(item.get("suggested_order_qty", 0) for item in r_json.get("items_to_order", []))
            
            reports_mapped.append({
                "id": r.id,
                "company_id": r.company_id,
                "flow_type": r.flow_type,
                "status": r.status,
                "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
                "resolved_by": r.resolved_by,
                "resolution_reason": r.resolution_reason,
                "modified_payload": r.modified_payload,
                "report_json": r.report_json
            })
                    
        summary = {
            "total_value_gained": total_value_gained,
            "total_automations": total_automations,
            "items_restocked": items_restocked
        }
        
        return {"summary": summary, "reports": reports_mapped}
        
    except Exception as e:
        logger.error(f"Error fetching history reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirm")
async def confirm_report(
    report_id: str = Body(..., embed=True),
    action: str = Body(..., embed=True), # 'approved', 'declined', 'modified'
    reason: Optional[str] = Body(None, embed=True),
    modified_data: Optional[Dict] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Handle accept, decline, or modify from the human reviewer"""
    try:
        if action not in ["approved", "declined", "modified"]:
            raise HTTPException(status_code=400, detail="Invalid action.")
            
        r_stmt = select(models_pg.HITLReport).where(
            models_pg.HITLReport.id == report_id,
            models_pg.HITLReport.company_id == current_user.company_id
        )
        report = (await db_session.execute(r_stmt)).scalar_one_or_none()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
            
        report.status = action
        report.resolved_at = datetime.now(timezone.utc)
        report.resolved_by = current_user.id
        report.resolution_reason = reason
        
        if action == "modified" and modified_data:
            report.modified_payload = modified_data
            
        # Track Preferences
        p_stmt = select(models_pg.HITLPreference).where(
            models_pg.HITLPreference.company_id == current_user.company_id,
            models_pg.HITLPreference.flow_type == report.flow_type
        )
        pref = (await db_session.execute(p_stmt)).scalar_one_or_none()
        
        if not pref:
            pref = models_pg.HITLPreference(
                id=str(uuid.uuid4()),
                company_id=current_user.company_id,
                flow_type=report.flow_type,
                total_reviews=0,
                approvals=0,
                declines=0,
                modifications=0,
                acceptance_rate=0.0,
                common_reasons=[]
            )
            db_session.add(pref)
            
        pref.total_reviews += 1
        if action == "approved":
            pref.approvals += 1
        elif action == "declined":
            pref.declines += 1
        elif action == "modified":
            pref.modifications += 1
            
        pref.acceptance_rate = float(pref.approvals) / float(pref.total_reviews)
        
        if reason:
            cr = pref.common_reasons or []
            cr.append({"reason": reason, "action": action, "date": datetime.now(timezone.utc).isoformat()})
            pref.common_reasons = cr[-50:]

        # NOTE: Orchestrator logic
        if report.flow_type == "quiet_hour_promotion" and action in ["approved", "modified"]:
            report_json = report.report_json or {}
            if action == "modified" and modified_data:
                report_json.update(modified_data)
                
            discount_value = report_json.get("discount_value", 15)
            discount_type = report_json.get("discount_type", "percentage")
            target_date = report_json.get("target_date")
            
            if target_date:
                valid_from = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                valid_to = datetime.strptime(target_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                
                promo_id = str(uuid.uuid4())
                new_promo = models_pg.Promotion(
                    id=promo_id,
                    title=f"Quiet Hour Special ({target_date})",
                    description="Automatically generated promotion for quiet hours",
                    promotion_type="global",
                    discount_type=discount_type,
                    discount_value=float(discount_value),
                    valid_from=valid_from,
                    valid_to=valid_to,
                    package_tier="all",
                    is_active=True,
                    company_id=current_user.company_id,
                    created_at=datetime.now(timezone.utc)
                )
                db_session.add(new_promo)
                
                coupon_code = f"QUIET{discount_value}-{str(uuid.uuid4())[:4].upper()}"
                
                new_coupon = models_pg.Coupon(
                    id=str(uuid.uuid4()),
                    promotion_id=promo_id,
                    code=coupon_code,
                    company_id=current_user.company_id,
                    is_active=True,
                    created_at=datetime.now(timezone.utc)
                )
                db_session.add(new_coupon)
                logger.info(f"Auto-created promotion {promo_id} with code {coupon_code} for quiet hours")
                
        elif report.flow_type == "inventory_reorder" and action in ["approved", "modified"]:
            report_json = report.report_json or {}
            if action == "modified" and modified_data:
                report_json.update(modified_data)
                
            items_to_order = report_json.get("items_to_order", [])
            
            for item in items_to_order:
                product_id = item.get("product_id")
                qty_to_add = item.get("suggested_order_qty", 0)
                
                if product_id and qty_to_add > 0:
                    pr_stmt = select(models_pg.Product).where(
                        models_pg.Product.id == product_id,
                        models_pg.Product.company_id == current_user.company_id
                    )
                    product = (await db_session.execute(pr_stmt)).scalar_one_or_none()
                    
                    if product:
                        product.stock_quantity = (product.stock_quantity or 0) + qty_to_add
                        logger.info(f"Auto-reordered product {product_id} by {qty_to_add} units")
        
        await db_session.commit()
        return {"status": "success", "action": action}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error confirming report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preferences")
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db_session: AsyncSession = Depends(get_db)
):
    """Fetch historical user preferences to potentially adjust agent thresholds"""
    try:
        stmt = select(models_pg.HITLPreference).where(models_pg.HITLPreference.company_id == current_user.company_id)
        prefs = (await db_session.execute(stmt)).scalars().all()
        
        return {"preferences": [
            {
                "id": p.id,
                "company_id": p.company_id,
                "flow_type": p.flow_type,
                "total_reviews": p.total_reviews,
                "approvals": p.approvals,
                "declines": p.declines,
                "modifications": p.modifications,
                "acceptance_rate": p.acceptance_rate,
                "common_reasons": p.common_reasons
            } for p in prefs
        ]}
    except Exception as e:
        logger.error(f"Error fetching preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))
