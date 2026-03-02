import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from dateutil.parser import isoparse
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import models_pg
from database_pg import AsyncSessionLocal

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "riserve_db")

def parse_dt(dt_str):
    if not dt_str:
        return None
    if isinstance(dt_str, str):
        try:
            return isoparse(dt_str)
        except Exception:
            return None
    return dt_str

def parse_date(d_str):
    dt = parse_dt(d_str)
    return dt.date() if dt else None

async def migrate_data():
    print("🚀 Starting MongoDB to PostgreSQL ETL Migration...")
    
    # Mongo connection
    mongo_client = AsyncIOMotorClient(MONGO_URI)
    db = mongo_client[DB_NAME]
    
    async with AsyncSessionLocal() as session:
        # Delete existing data in target database to avoid conflicts
        print("Cleaning target Postgres definitions...")
        await session.execute(text("TRUNCATE TABLE companies CASCADE"))
        await session.commit()
        print("Cleaned!")
        
        migrated_company_ids = set()
        migrated_user_ids = set()
        migrated_outlet_ids = set()
        migrated_service_ids = set()
        migrated_customer_ids = set()
        migrated_booking_ids = set()
        migrated_product_ids = set()

        # 1. Companies
        companies = await db.companies.find().to_list(None)
        print(f"Migrating {len(companies)} Companies...")
        for cp in companies:
            cid = cp.get("id")
            if not cid: continue
            new_cp = models_pg.Company(
                id=cid,
                name=cp.get("name"),
                plan=cp.get("plan"),
                status=cp.get("status", "active"),
                created_at=parse_dt(cp.get("created_at"))
            )
            session.add(new_cp)
            migrated_company_ids.add(cid)
        await session.commit()

        # 2. Services
        services = await db.services.find().to_list(None)
        print(f"Migrating {len(services)} Services...")
        for sv in services:
            sid = sv.get("id")
            cid = sv.get("company_id")
            if not sid or cid not in migrated_company_ids: continue
            new_sv = models_pg.Service(
                id=sid,
                company_id=cid,
                name=sv.get("name"),
                price=sv.get("price", 0),
                duration=sv.get("duration", 30),
                created_at=parse_dt(sv.get("created_at"))
            )
            session.add(new_sv)
            migrated_service_ids.add(sid)
        await session.commit()
        
        # 3. Users
        users = await db.users.find().to_list(None)
        print(f"Migrating {len(users)} Users...")
        for u in users:
            uid = u.get("id")
            cid = u.get("company_id")
            # Some users (SuperAdmin) might not have company_id
            if not uid: continue
            if cid and cid not in migrated_company_ids: continue
            new_u = models_pg.User(
                id=uid,
                company_id=cid,
                email=u.get("email"),
                name=u.get("name"),
                password_hash=u.get("password_hash"),
                role=u.get("role", "User"),
                phone=u.get("phone", ""),
                status=u.get("status", "Active"),
                created_at=parse_dt(u.get("created_at"))
            )
            session.add(new_u)
            migrated_user_ids.add(uid)
        await session.commit()

        # 4. Outlets & M-M User/Outlets
        outlets = await db.outlets.find().to_list(None)
        print(f"Migrating {len(outlets)} Outlets...")
        for ot in outlets:
            oid = ot.get("id")
            cid = ot.get("company_id")
            if not oid or cid not in migrated_company_ids: continue
            new_ot = models_pg.Outlet(
                id=oid,
                company_id=cid,
                name=ot.get("name"),
                type=ot.get("type"),
                location=ot.get("location"),
                contact_email=ot.get("contact_email"),
                contact_phone=ot.get("contact_phone"),
                capacity=ot.get("capacity", 1),
                status=ot.get("status", "active"),
                created_at=parse_dt(ot.get("created_at"))
            )
            session.add(new_ot)
            migrated_outlet_ids.add(oid)
        await session.commit()

        # Users<->Outlets M-M
        for u in users:
            uid = u.get("id")
            if uid not in migrated_user_ids: continue
            ou_array = u.get("outlets", [])
            for ou_id in ou_array:
                if ou_id in migrated_outlet_ids:
                    await session.execute(
                        models_pg.user_outlets.insert().values(user_id=uid, outlet_id=ou_id)
                    )
        await session.commit()

        # Nested Resources
        resource_count = 0
        migrated_resource_ids = set()
        for ot in outlets:
            oid = ot.get("id")
            if oid not in migrated_outlet_ids: continue
            resources = ot.get("resources", [])
            for res in resources:
                rid = res.get("id")
                if not rid: continue
                uid = res.get("user_id")
                if uid and uid not in migrated_user_ids: uid = None
                new_res = models_pg.Resource(
                    id=rid,
                    outlet_id=oid,
                    user_id=uid,
                    name=res.get("name"),
                    capacity=res.get("capacity", 1),
                    active=res.get("active", True)
                )
                session.add(new_res)
                migrated_resource_ids.add(rid)
                resource_count += 1
        await session.commit()
        print(f"Migrated {resource_count} embedded Resources.")

        # 5. Staff
        staff_members = await db.staff.find().to_list(None)
        print(f"Migrating {len(staff_members)} Staff...")
        for st in staff_members:
            sid = st.get("id")
            uid = st.get("user_id")
            cid = st.get("company_id")
            if not sid or uid not in migrated_user_ids or cid not in migrated_company_ids: continue
            oid = st.get("outlet_id")
            if oid and oid not in migrated_outlet_ids: oid = None
            new_st = models_pg.Staff(
                id=sid,
                user_id=uid,
                company_id=cid,
                outlet_id=oid,
                first_name=st.get("first_name"),
                last_name=st.get("last_name"),
                email=st.get("email"),
                phone=st.get("phone"),
                status=st.get("status", "active"),
                department=st.get("department"),
                employment_type=st.get("employment_type"),
                skills=st.get("skills", []),
                certifications=st.get("certifications", []),
                created_at=parse_dt(st.get("created_at")),
                updated_at=parse_dt(st.get("updated_at"))
            )
            session.add(new_st)
        await session.commit()

        # 6. Customers
        customers = await db.customers.find().to_list(None)
        print(f"Migrating {len(customers)} Customers...")
        for c in customers:
            cid_p = c.get("id")
            cid = c.get("company_id")
            if not cid_p or cid not in migrated_company_ids: continue
            new_c = models_pg.Customer(
                id=cid_p,
                company_id=cid,
                name=c.get("name"),
                email=c.get("email"),
                phone=c.get("phone"),
                notes=c.get("notes"),
                custom_fields=c.get("custom_fields", {}),
                total_revenue=c.get("total_revenue", 0),
                total_bookings=c.get("total_bookings", 0),
                last_visit=c.get("last_visit"),
                created_at=parse_dt(c.get("created_at")),
                updated_at=parse_dt(c.get("updated_at"))
            )
            session.add(new_c)
            migrated_customer_ids.add(cid_p)
        await session.commit()

        # 7. Bookings & Services M-M
        bookings = await db.bookings.find().to_list(None)
        print(f"Migrating {len(bookings)} Bookings...")
        for b in bookings:
            bid = b.get("id")
            cid = b.get("company_id")
            oid = b.get("outlet_id")
            cust_id = b.get("customer_id")
            if not bid or cid not in migrated_company_ids or oid not in migrated_outlet_ids or cust_id not in migrated_customer_ids: continue
            
            res_id = b.get("resource_id")
            if res_id and res_id not in migrated_resource_ids: res_id = None
            
            svc_id = b.get("service_id")
            if svc_id and svc_id not in migrated_service_ids: svc_id = None

            new_b = models_pg.Booking(
                id=bid,
                company_id=cid,
                outlet_id=oid,
                customer_id=cust_id,
                resource_id=res_id,
                service_id=svc_id,
                customer=b.get("customer"),
                customer_name=b.get("customer_name"),
                customer_phone=b.get("customer_phone"),
                customer_email=b.get("customer_email"),
                time=b.get("time"),
                date=parse_date(b.get("date")),
                duration=b.get("duration"),
                notes=b.get("notes"),
                custom_fields=b.get("custom_fields", {}),
                amount=b.get("amount", 0),
                status=b.get("status", "Pending"),
                source=b.get("source", "app"),
                created_at=parse_dt(b.get("created_at"))
            )
            session.add(new_b)
            migrated_booking_ids.add(bid)
        await session.commit()

        # Associate multiple services per booking
        service_mapping_count = 0
        for b in bookings:
            bid = b.get("id")
            if bid not in migrated_booking_ids: continue
            svcs = b.get("service_ids", [])
            for s_id in svcs:
                if s_id in migrated_service_ids:
                    await session.execute(
                        models_pg.booking_services.insert().values(booking_id=bid, service_id=s_id)
                    )
                    service_mapping_count += 1
        await session.commit()
        print(f"Migrated {service_mapping_count} M-M Booking-Service bindings.")

        # 8. Transactions
        transactions = await db.transactions.find().to_list(None)
        print(f"Migrating {len(transactions)} Transactions...")
        for tx in transactions:
            tx_id = tx.get("id")
            cid = tx.get("company_id")
            if not tx_id or cid not in migrated_company_ids: continue
            bid = tx.get("booking_id")
            if bid and bid not in migrated_booking_ids: bid = None
            oid = tx.get("outlet_id")
            if oid and oid not in migrated_outlet_ids: oid = None
            
            new_tx = models_pg.Transaction(
                id=tx_id,
                company_id=cid,
                booking_id=bid,
                outlet_id=oid,
                gross=tx.get("gross", 0),
                commission=tx.get("commission", 0),
                partner_share=tx.get("partner_share", 0),
                status=tx.get("status", "Settled"),
                date=parse_dt(tx.get("date"))
            )
            session.add(new_tx)
        await session.commit()

        # 9. HITL Reports
        hitls = await db.hitl_reports.find().to_list(None)
        print(f"Migrating {len(hitls)} HITL Reports...")
        for h in hitls:
            hid = h.get("id")
            cid = h.get("company_id")
            if not hid or cid not in migrated_company_ids: continue
            new_h = models_pg.HITLReport(
                id=hid,
                company_id=cid,
                user_id=h.get("user_id"),
                created_by_agent=h.get("created_by_agent", True),
                flow_type=h.get("flow_type"),
                status=h.get("status", "pending"),
                report_json=h.get("report_json", {}),
                created_at=parse_dt(h.get("created_at")),
                expires_at=parse_dt(h.get("expires_at"))
            )
            session.add(new_h)
        await session.commit()

        # 10. Products
        products = await db.products.find().to_list(None)
        print(f"Migrating {len(products)} Products...")
        for p in products:
            pid = p.get("id")
            cid = p.get("company_id")
            if not pid or cid not in migrated_company_ids: continue
            oid = p.get("outlet_id")
            if oid and oid not in migrated_outlet_ids: oid = None
            new_p = models_pg.Product(
                id=pid,
                company_id=cid,
                outlet_id=oid,
                name=p.get("name"),
                sku=p.get("sku"),
                category=p.get("category", "general"),
                description=p.get("description"),
                price=p.get("price", 0),
                cost=p.get("cost", 0),
                stock_quantity=p.get("stock_quantity", 0),
                reorder_level=p.get("reorder_level", 10),
                is_addon=p.get("is_addon", True),
                active=p.get("active", True),
                created_at=parse_dt(p.get("created_at")),
                updated_at=parse_dt(p.get("updated_at"))
            )
            session.add(new_p)
            migrated_product_ids.add(pid)
        await session.commit()

        # 11. Inventory Logs & Alerts
        logs = await db.inventory_logs.find().to_list(None)
        print(f"Migrating {len(logs)} Inventory Logs...")
        for l in logs:
            lid = l.get("id")
            cid = l.get("company_id")
            pid = l.get("product_id")
            if not lid or cid not in migrated_company_ids or pid not in migrated_product_ids: continue
            new_l = models_pg.InventoryLog(
                id=lid,
                company_id=cid,
                product_id=pid,
                user_id=l.get("user_id"),
                action=l.get("action"),
                quantity=l.get("quantity", 0),
                new_quantity=l.get("new_quantity", 0),
                reason=l.get("reason"),
                reference_id=l.get("reference_id"),
                created_at=parse_dt(l.get("created_at"))
            )
            session.add(new_l)
        
        alerts = await db.inventory_alerts.find().to_list(None)
        print(f"Migrating {len(alerts)} Inventory Alerts...")
        for a in alerts:
            aid = a.get("id")
            cid = a.get("company_id")
            pid = a.get("product_id")
            if not aid or cid not in migrated_company_ids or pid not in migrated_product_ids: continue
            new_a = models_pg.InventoryAlert(
                id=aid,
                company_id=cid,
                outlet_id=a.get("outlet_id"),
                product_id=pid,
                type=a.get("type", "low_stock"),
                product_name=a.get("product_name"),
                current_quantity=a.get("current_quantity", 0),
                reorder_level=a.get("reorder_level", 0),
                resolved=a.get("resolved", False),
                created_at=parse_dt(a.get("created_at"))
            )
            session.add(new_a)
        await session.commit()

        # 12. Slot Configs
        slots = await db.slot_configs.find().to_list(None)
        print(f"Migrating {len(slots)} Slot Configs...")
        for s in slots:
            sid = s.get("id")
            cid = s.get("company_id")
            oid = s.get("outlet_id")
            if not sid or cid not in migrated_company_ids or oid not in migrated_outlet_ids: continue
            new_s = models_pg.SlotConfig(
                id=sid,
                company_id=cid,
                outlet_id=oid,
                configuration=s.get("configuration", {})
            )
            session.add(new_s)
        await session.commit()

        # 13. Promotions & Coupons
        promos = await db.promotions.find().to_list(None)
        print(f"Migrating {len(promos)} Promotions...")
        migrated_promo_ids = set()
        for pr in promos:
            prid = pr.get("id")
            cid = pr.get("company_id")
            if not prid or cid not in migrated_company_ids: continue
            new_pr = models_pg.Promotion(
                id=prid,
                company_id=cid,
                title=pr.get("title"),
                description=pr.get("description"),
                promotion_type=pr.get("promotion_type"),
                discount_type=pr.get("discount_type"),
                discount_value=pr.get("discount_value", 0),
                valid_from=parse_dt(pr.get("valid_from")),
                valid_to=parse_dt(pr.get("valid_to")),
                package_tier=pr.get("package_tier", "all"),
                is_active=pr.get("is_active", True)
            )
            session.add(new_pr)
            migrated_promo_ids.add(prid)
        
        coupons = await db.coupons.find().to_list(None)
        print(f"Migrating {len(coupons)} Coupons...")
        for cp in coupons:
            cpid = cp.get("id")
            cid = cp.get("company_id")
            prid = cp.get("promotion_id")
            if not cpid or cid not in migrated_company_ids or prid not in migrated_promo_ids: continue
            new_cp = models_pg.Coupon(
                id=cpid,
                company_id=cid,
                promotion_id=prid,
                code=cp.get("code"),
                is_active=cp.get("is_active", True)
            )
            session.add(new_cp)
        await session.commit()

        # 14. HITL Preferences
        prefs = await db.hitl_preferences.find().to_list(None)
        print(f"Migrating {len(prefs)} HITL Preferences...")
        for pf in prefs:
            pid = pf.get("id")
            cid = pf.get("company_id")
            if not pid or cid not in migrated_company_ids: continue
            new_pf = models_pg.HITLPreference(
                id=pid,
                company_id=cid,
                flow_type=pf.get("flow_type"),
                total_reviews=pf.get("total_reviews", 0),
                approvals=pf.get("approvals", 0),
                declines=pf.get("declines", 0),
                modifications=pf.get("modifications", 0),
                acceptance_rate=pf.get("acceptance_rate", 0),
                common_reasons=pf.get("common_reasons", [])
            )
            session.add(new_pf)
        await session.commit()

        # 15. Leave Balances
        leaves = await db.leave_balances.find().to_list(None)
        print(f"Migrating {len(leaves)} Leave Balances...")
        for lv in leaves:
            lid = lv.get("id")
            cid = lv.get("company_id")
            # Skip if company or staff not migrated - assuming staff migrated if sid in st list
            # We don't have a migrated_staff_ids set yet, let's just use company check
            if not lid or cid not in migrated_company_ids: continue
            new_lv = models_pg.LeaveBalance(
                id=lid,
                company_id=cid,
                staff_id=lv.get("staff_id"),
                year=lv.get("year", 2024),
                balances=lv.get("balances", {})
            )
            session.add(new_lv)
        await session.commit()

        # 16. Onboarding Progress & Conversations
        onb_prog = await db.onboarding_progress.find().to_list(None)
        print(f"Migrating {len(onb_prog)} Onboarding Progress items...")
        for op in onb_prog:
            oid = op.get("id")
            cid = op.get("company_id")
            if not oid or cid not in migrated_company_ids: continue
            new_op = models_pg.OnboardingProgress(
                id=oid,
                company_id=cid,
                conversation_id=op.get("conversation_id"),
                percentage=op.get("percentage", 0),
                completed_steps=op.get("completed_steps", []),
                pending_steps=op.get("pending_steps", []),
                skipped=op.get("skipped", False),
                completed_at=parse_dt(op.get("completed_at"))
            )
            session.add(new_op)
        
        onb_convs = await db.onboarding_conversations.find().to_list(None)
        print(f"Migrating {len(onb_convs)} Onboarding Conversations...")
        for oc in onb_convs:
            ocid = oc.get("id")
            cid = oc.get("company_id")
            if not ocid or cid not in migrated_company_ids: continue
            new_oc = models_pg.OnboardingConversation(
                id=ocid,
                company_id=cid,
                user_id=oc.get("user_id"),
                messages=oc.get("messages", [])
            )
            session.add(new_oc)
        await session.commit()

        # 17. AI Conversations
        ai_convs = await db.ai_conversations.find().to_list(None)
        print(f"Migrating {len(ai_convs)} AI Conversations...")
        for ac in ai_convs:
            acid = ac.get("id")
            uid = ac.get("user_id")
            if not acid or uid not in migrated_user_ids: continue
            new_ac = models_pg.AIConversation(
                id=acid,
                user_id=uid,
                title=ac.get("title"),
                messages=ac.get("messages", [])
            )
            session.add(new_ac)
        await session.commit()

        # 18. Audit Logs
        audits = await db.audit_logs.find().to_list(None)
        print(f"Migrating {len(audits)} Audit Logs...")
        for al in audits:
            alid = al.get("id")
            cid = al.get("company_id")
            if cid and cid not in migrated_company_ids: cid = None
            new_al = models_pg.AuditLog(
                id=alid,
                action=al.get("action"),
                entity_type=al.get("entity_type"),
                entity_id=al.get("entity_id"),
                user_id=al.get("user_id"),
                user_email=al.get("user_email"),
                company_id=cid,
                details=al.get("details", {}),
                ip_address=al.get("ip_address"),
                timestamp=parse_dt(al.get("timestamp"))
            )
            session.add(new_al)
        await session.commit()

        # 19. Dashboard Configs (THIS IS LIKELY THE MISSING WORKSPACE)
        dashboards = await db.dashboard_configs.find().to_list(None)
        print(f"Migrating {len(dashboards)} Dashboard Configs...")
        for dc in dashboards:
            did = dc.get("id")
            uid = dc.get("user_id")
            cid = dc.get("company_id")
            if not did or uid not in migrated_user_ids: continue
            if cid and cid not in migrated_company_ids: cid = None
            new_dc = models_pg.DashboardConfig(
                id=did,
                user_id=uid,
                company_id=cid,
                name=dc.get("name", "Main Dashboard"),
                is_default=dc.get("is_default", False),
                widgets=dc.get("widgets", [])
            )
            session.add(new_dc)
        await session.commit()

        # 20. Feedback Configs & Feedback
        fb_configs = await db.feedback_configs.find().to_list(None)
        print(f"Migrating {len(fb_configs)} Feedback Configs...")
        for fc in fb_configs:
            fid = fc.get("id")
            cid = fc.get("company_id")
            if not fid or cid not in migrated_company_ids: continue
            new_fc = models_pg.FeedbackConfig(
                id=fid,
                company_id=cid,
                enabled=fc.get("enabled", True),
                auto_send_after_completion=fc.get("auto_send_after_completion", True),
                send_via_email=fc.get("send_via_email", True),
                send_via_sms=fc.get("send_via_sms", False),
                email_subject=fc.get("email_subject"),
                email_message=fc.get("email_message"),
                sms_message=fc.get("sms_message"),
                thank_you_message=fc.get("thank_you_message")
            )
            session.add(new_fc)
        
        feedbacks = await db.feedback.find().to_list(None)
        print(f"Migrating {len(feedbacks)} Feedback items...")
        for f in feedbacks:
            fid = f.get("id")
            cid = f.get("company_id")
            if not fid or cid not in migrated_company_ids: continue
            new_f = models_pg.Feedback(
                id=fid,
                company_id=cid,
                booking_id=f.get("booking_id"),
                outlet_id=f.get("outlet_id"),
                service_id=f.get("service_id"),
                rating=f.get("rating", 5),
                comment=f.get("comment"),
                customer_name=f.get("customer_name"),
                customer_email=f.get("customer_email"),
                created_at=parse_dt(f.get("created_at"))
            )
            session.add(new_f)
        await session.commit()

        # 21. Company Settings
        settings = await db.company_settings.find().to_list(None)
        print(f"Migrating {len(settings)} Company Settings...")
        for st in settings:
            sid = st.get("id")
            cid = st.get("company_id")
            if not sid or cid not in migrated_company_ids: continue
            new_st = models_pg.CompanySetting(
                id=sid,
                company_id=cid,
                inventory_settings=st.get("inventory_settings", {}),
                general_settings=st.get("general_settings", {})
            )
            session.add(new_st)
        await session.commit()

        print("✅ Migration Complete!")
        
    mongo_client.close()

if __name__ == "__main__":
    asyncio.run(migrate_data())
