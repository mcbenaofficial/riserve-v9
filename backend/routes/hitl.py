from fastapi import APIRouter, Depends, HTTPException, Body
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import uuid
import logging

from routes.dependencies import (
    get_current_user, User, get_db, log_audit,
    promotions_collection, coupons_collection, bookings_collection, slot_configs_collection
)

router = APIRouter(prefix="/hitl", tags=["Human-in-the-Loop"])
logger = logging.getLogger(__name__)

# Models and definitions can be directly defined for the router payloads

@router.post("/analyze-schedule")
async def analyze_schedule(
    target_date: Optional[str] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Analyze schedule for quiet hours and generate a promotion recommendation"""
    try:
        # Default to tomorrow if no date provided
        if not target_date:
            tomorrow = datetime.now(timezone.utc) + timedelta(days=1)
            target_date = tomorrow.strftime("%Y-%m-%d")
            
        # Get active slot configs to understand operating hours
        slot_configs = await slot_configs_collection.find({"company_id": current_user.company_id}).to_list(100)
        if not slot_configs:
            return {"status": "skipped", "reason": "No slot configurations found"}
            
        # Get bookings for the target date
        bookings = await bookings_collection.find({
            "company_id": current_user.company_id,
            "date": target_date,
            "status": {"$nin": ["Cancelled", "No Show"]}
        }).to_list(1000)
        
        # Simple analysis: count bookings.
        # In a real scenario, this would check capacity vs load per hour block.
        # For this feature, if total bookings < expected (e.g., < 10 for the day), trigger quiet hours promo.
        is_quiet = len(bookings) < 10
        
        if is_quiet:
            # Check if we already have a pending report for this date
            existing = await db.hitl_reports.find_one({
                "company_id": current_user.company_id,
                "flow_type": "quiet_hour_promotion",
                "status": "pending",
                "report_json.target_date": target_date
            })
            
            if not existing:
                report_id = str(uuid.uuid4())
                report_data = {
                    "id": report_id,
                    "company_id": current_user.company_id,
                    "user_id": current_user.id,
                    "created_by_agent": True,
                    "flow_type": "quiet_hour_promotion",
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": None,
                    "report_json": {
                        "what_this_is": f"AI detected low booking volume for {target_date}.",
                        "why_recommended": f"Only {len(bookings)} bookings scheduled. A targeted promotion can help fill empty slots.",
                        "who_it_affects": ["Customers", "Marketing"],
                        "how_it_works": ["Create a 15% off promotion automatically", "Valid only for tomorrow"],
                        "chart_data": [
                            {"name": f"{h:02d}:00", "value": len([b for b in bookings if datetime.fromisoformat(b['created_at'].replace('Z', '+00:00')).hour == h])}
                            for h in range(8, 22)  # Operating hours 8 AM to 9 PM
                        ],
                        "chart_type": "bookings",
                        "cost_credits": 1,
                        "recommended_action": "Create Quiet Hour Promotion (15% Off)",
                        "target_date": target_date,
                        "discount_value": 15,
                        "discount_type": "percentage"
                    }
                }
                
                await db.hitl_reports.insert_one(report_data)
                
                await log_audit(
                    action="hitl_report_generated",
                    entity_type="hitl_report",
                    entity_id=report_id,
                    user_id="system_agent",
                    user_email="agent@riserve.ai",
                    company_id=current_user.company_id,
                    details={"flow_type": "quiet_hour_promotion", "target_date": target_date}
                )
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
    db = Depends(get_db)
):
    """Analyze inventory levels, predict demand, and generate a reorder recommendation"""
    from routes.dependencies import products_collection
    try:
        # Fetch all active products for the company
        products = await products_collection.find({
            "company_id": current_user.company_id,
            "active": True
        }).to_list(1000)
        
        # Filter products where stock is below or exactly at the reorder level
        low_stock_products = [
            p for p in products 
            if p.get("stock_quantity") is not None and p.get("reorder_level") is not None 
            and p.get("stock_quantity", 0) <= p.get("reorder_level", 0)
        ]
        
        if not low_stock_products:
            return {"status": "success", "report_generated": False, "reason": "No low stock items found"}
            
        # Check if we already have a pending report for inventory reordering
        existing = await db.hitl_reports.find_one({
            "company_id": current_user.company_id,
            "flow_type": "inventory_reorder",
            "status": "pending"
        })
        
        if existing:
            return {"status": "skipped", "report_generated": False, "reason": "Pending reorder report already exists"}
            
        # Build the reorder list
        items_to_order = []
        total_estimated_cost = 0
        
        for p in low_stock_products:
            # Simple demand prediction: aim to restock up to (reorder_level * 2) minimum 10
            target_stock = max(p.get("reorder_level", 10) * 2, 10)
            order_qty = target_stock - p.get("stock_quantity", 0)
            
            # Estimate cost
            unit_cost = p.get("cost", p.get("price", 0) * 0.4) # Assume 40% margin if no cost
            est_cost = order_qty * unit_cost
            total_estimated_cost += est_cost
            
            items_to_order.append({
                "product_id": p.get("id"),
                "name": p.get("name"),
                "current_stock": p.get("stock_quantity", 0),
                "reorder_level": p.get("reorder_level", 10),
                "suggested_order_qty": order_qty,
                "estimated_unit_cost": unit_cost
            })
            
        if not items_to_order:
             return {"status": "success", "report_generated": False, "reason": "No items require reordering right now"}
             
        report_id = str(uuid.uuid4())
        report_data = {
            "id": report_id,
            "company_id": current_user.company_id,
            "user_id": current_user.id,
            "created_by_agent": True,
            "flow_type": "inventory_reorder",
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": None,
            "report_json": {
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
        }
        
        await db.hitl_reports.insert_one(report_data)
        
        await log_audit(
            action="hitl_report_generated",
            entity_type="hitl_report",
            entity_id=report_id,
            user_id="system_agent",
            user_email="agent@riserve.ai",
            company_id=current_user.company_id,
            details={"flow_type": "inventory_reorder"}
        )
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
    db = Depends(get_db)
):
    """Triggered by AI to generate a pending authorization report"""
    try:
        report_id = str(uuid.uuid4())
        
        # Build the dynamic report payload based on the AI requirement
        report_data = {
            "id": report_id,
            "company_id": current_user.company_id,
            "user_id": current_user.id,
            "created_by_agent": True,
            "flow_type": flow_type,
            "status": "pending",  # pending | approved | declined | modified
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": None, # Could add TTL
            "report_json": {
                "what_this_is": insight_data.get("description", "AI detected an optimization opportunity."),
                "why_recommended": insight_data.get("reasoning", "Based on recent historical trends."),
                "who_it_affects": insight_data.get("affected_roles", ["Managers", "Staff"]),
                "how_it_works": insight_data.get("steps", ["AI evaluates data", "Proposes change", "Executes upon approval"]),
                "chart_data": insight_data.get("chart_data", []), 
                "cost_credits": cost_credits,
                "recommended_action": recommended_action
            }
        }
        
        await db.hitl_reports.insert_one(report_data)
        
        await log_audit(
            action="hitl_report_generated",
            entity_type="hitl_report",
            entity_id=report_id,
            user_id="system_agent",
            user_email="agent@riserve.ai",
            company_id=current_user.company_id,
            details={"flow_type": flow_type}
        )
        
        return {"status": "success", "report_id": report_id}
        
    except Exception as e:
        logger.error(f"Error generating HITL report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pending")
async def get_pending_reports(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Fetch pending UI reports for a user/outlet"""
    try:
        # Depending on RBAC, filter. For now, filter by company and pending status
        query = {
            "company_id": current_user.company_id,
            "status": "pending"
        }
        
        reports = await db.hitl_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
        return {"reports": reports}
        
    except Exception as e:
        logger.error(f"Error fetching pending reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirm")
async def confirm_report(
    report_id: str = Body(..., embed=True),
    action: str = Body(..., embed=True), # 'approve', 'decline', 'modify'
    reason: Optional[str] = Body(None, embed=True),
    modified_data: Optional[Dict] = Body(None, embed=True),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Handle accept, decline, or modify from the human reviewer"""
    try:
        if action not in ["approved", "declined", "modified"]:
            raise HTTPException(status_code=400, detail="Invalid action.")
            
        report = await db.hitl_reports.find_one({"id": report_id, "company_id": current_user.company_id})
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
            
        update_data = {
            "status": action,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": current_user.id,
            "resolution_reason": reason
        }
        
        if action == "modified" and modified_data:
            update_data["modified_payload"] = modified_data
            
        await db.hitl_reports.update_one(
            {"id": report_id},
            {"$set": update_data}
        )
        
        # Track Preferences (Simple ML Prep)
        pref_query = {"company_id": current_user.company_id, "flow_type": report["flow_type"]}
        pref = await db.hitl_preferences.find_one(pref_query)
        
        if not pref:
            pref = {
                "company_id": current_user.company_id,
                "flow_type": report["flow_type"],
                "total_reviews": 0,
                "approvals": 0,
                "declines": 0,
                "modifications": 0,
                "acceptance_rate": 0.0,
                "common_reasons": []
            }
            
        pref["total_reviews"] += 1
        if action == "approved":
            pref["approvals"] += 1
        elif action == "declined":
            pref["declines"] += 1
        elif action == "modified":
            pref["modifications"] += 1
            
        pref["acceptance_rate"] = pref["approvals"] / pref["total_reviews"]
        
        if reason:
            pref["common_reasons"].append({"reason": reason, "action": action, "date": datetime.now(timezone.utc).isoformat()})
            # Keep only last 50 reasons to avoid bloat
            pref["common_reasons"] = pref["common_reasons"][-50:]
            
        await db.hitl_preferences.update_one(
            pref_query,
            {"$set": pref},
            upsert=True
        )

        await log_audit(
            action=f"hitl_report_{action}",
            entity_type="hitl_report",
            entity_id=report_id,
            user_id=current_user.id,
            user_email=current_user.email,
            company_id=current_user.company_id,
            details={"flow_type": report["flow_type"], "reason": reason}
        )
        
        # NOTE: Here you would integrate with the Orchestrator/Swarm to execute the flow if 'approved' or 'modified'
        if report["flow_type"] == "quiet_hour_promotion" and action in ["approved", "modified"]:
            report_json = report.get("report_json", {})
            if action == "modified" and modified_data:
                report_json.update(modified_data)
                
            discount_value = report_json.get("discount_value", 15)
            discount_type = report_json.get("discount_type", "percentage")
            target_date = report_json.get("target_date")
            
            if target_date:
                # Set validity from start of target date to end of target date
                valid_from = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=timezone.utc).isoformat()
                valid_to = (datetime.strptime(target_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)).isoformat()
                
                promo_id = str(uuid.uuid4())
                promo_dict = {
                    "promotion_id": promo_id,
                    "title": f"Quiet Hour Special ({target_date})",
                    "description": "Automatically generated promotion for quiet hours",
                    "promotion_type": "global",
                    "discount_type": discount_type,
                    "discount_value": discount_value,
                    "valid_from": valid_from,
                    "valid_to": valid_to,
                    "package_tier": "all",
                    "is_active": True,
                    "company_id": current_user.company_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await promotions_collection.insert_one(promo_dict)
                
                # Generate a single global coupon code for this promo
                coupon_code = f"QUIET{discount_value}"
                # Add random suffix to ensure uniqueness
                coupon_code += f"-{str(uuid.uuid4())[:4].upper()}"
                
                coupon = {
                    "coupon_id": str(uuid.uuid4()),
                    "promotion_id": promo_id,
                    "code": coupon_code,
                    "company_id": current_user.company_id,
                    "is_active": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await coupons_collection.insert_one(coupon)
                logger.info(f"Auto-created promotion {promo_id} with code {coupon_code} for quiet hours")
                
        elif report["flow_type"] == "inventory_reorder" and action in ["approved", "modified"]:
            report_json = report.get("report_json", {})
            if action == "modified" and modified_data:
                report_json.update(modified_data)
                
            items_to_order = report_json.get("items_to_order", [])
            from routes.dependencies import products_collection
            
            for item in items_to_order:
                product_id = item.get("product_id")
                qty_to_add = item.get("suggested_order_qty", 0)
                
                if product_id and qty_to_add > 0:
                    product = await products_collection.find_one({"id": product_id, "company_id": current_user.company_id})
                    if product:
                        new_stock = product.get("stock_quantity", 0) + qty_to_add
                        await products_collection.update_one(
                            {"id": product_id},
                            {"$set": {"stock_quantity": new_stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
                        )
                        # Normally we would call log_inventory_action here, but we'll just log an audit
                        await log_audit(
                            action="inventory_auto_reorder",
                            entity_type="product",
                            entity_id=product_id,
                            user_id=current_user.id,
                            user_email=current_user.email,
                            company_id=current_user.company_id,
                            details={"added_qty": qty_to_add, "new_stock": new_stock, "reason": "auto_reorder_approved"}
                        )
                        logger.info(f"Auto-reordered product {product_id} by {qty_to_add} units")
        
        return {"status": "success", "action": action}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error confirming report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/preferences")
async def get_preferences(
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """Fetch historical user preferences to potentially adjust agent thresholds"""
    try:
        prefs = await db.hitl_preferences.find({"company_id": current_user.company_id}, {"_id": 0}).to_list(None)
        return {"preferences": prefs}
    except Exception as e:
        logger.error(f"Error fetching preferences: {e}")
        raise HTTPException(status_code=500, detail=str(e))
