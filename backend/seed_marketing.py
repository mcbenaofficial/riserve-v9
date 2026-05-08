"""
Marketing Module Seed Script
Populates: inboxes, conversations, messages, templates, segments, campaigns,
           journeys, enrollments, brand voice, agent config, knowledge base.
Run: cd backend && source venv/bin/activate && python3 seed_marketing.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

from database_pg import DATABASE_URL
import models_pg

uid = lambda: str(uuid.uuid4())

def ts(days_ago=0, hours_ago=0, minutes_ago=0):
    return datetime.now(timezone.utc) - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)


async def seed():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as db:
        # ── Discover company + admin ──────────────────────────────────────────
        company = (await db.execute(
            select(models_pg.Company).where(models_pg.Company.name == "Kosmo Cafe")
        )).scalar_one_or_none()
        if not company:
            print("❌ 'Kosmo Cafe' not found. Run restore_dev_account.py first.")
            return
        COMPANY_ID = company.id
        print(f"✓ Company: {company.name} ({COMPANY_ID})")

        admin = (await db.execute(
            select(models_pg.User).where(
                models_pg.User.company_id == COMPANY_ID,
                models_pg.User.role == "Admin",
            )
        )).scalars().first()
        ADMIN_ID = admin.id if admin else "system"
        print(f"✓ Admin: {admin.email if admin else 'system'} ({ADMIN_ID})")

        customers_rows = (await db.execute(
            select(models_pg.Customer)
            .where(models_pg.Customer.company_id == COMPANY_ID)
            .limit(12)
        )).scalars().all()
        customers = customers_rows
        print(f"✓ Customers available: {len(customers)}")

        # ── Clean existing marketing data ─────────────────────────────────────
        print("Cleaning existing marketing data…")
        for model in [
            models_pg.MktJourneyStepLog,
            models_pg.MktJourneyEnrollment,
            models_pg.MktJourney,
            models_pg.MktCampaignRecipient,
            models_pg.MktCampaign,
            models_pg.MktSegment,
            models_pg.MktInternalNote,
            models_pg.MktMessage,
            models_pg.MktConversation,
            models_pg.MktCustomerIdentity,
            models_pg.MktTemplate,
            models_pg.MktFrequencyCapConfig,
            models_pg.MktWebhookRawEvent,
        ]:
            tbl = model.__table__
            if hasattr(model, "company_id"):
                await db.execute(delete(model).where(tbl.c.company_id == COMPANY_ID))
            elif hasattr(model, "inbox_id"):
                pass  # cleaned via cascade
        # Clean knowledge + agent per tenant
        await db.execute(delete(models_pg.KnowledgeChunk).where(
            models_pg.KnowledgeChunk.tenant_id == COMPANY_ID))
        await db.execute(delete(models_pg.KnowledgeSource).where(
            models_pg.KnowledgeSource.tenant_id == COMPANY_ID))
        await db.execute(delete(models_pg.BrandVoiceProfile).where(
            models_pg.BrandVoiceProfile.tenant_id == COMPANY_ID))
        await db.execute(delete(models_pg.AgentConfig).where(
            models_pg.AgentConfig.tenant_id == COMPANY_ID))
        await db.execute(delete(models_pg.MktInbox).where(
            models_pg.MktInbox.company_id == COMPANY_ID))
        await db.commit()
        print("✓ Cleaned")

        # ═══════════════════════════════════════════════════════════════════════
        # 1. INBOXES
        # ═══════════════════════════════════════════════════════════════════════
        inbox_wa_id = uid()
        inbox_ig_id = uid()
        db.add(models_pg.MktInbox(
            id=inbox_wa_id,
            company_id=COMPANY_ID,
            name="Simulated Salon WhatsApp",
            channel="whatsapp",
            credentials_ref='{"phone_number_id":"123456789","access_token":"EAADev..."}',
            webhook_secret="dev_secret_wa",
            is_active=True,
            auto_assignment_rule="round_robin",
            business_hours={"mon_fri": "09:00-20:00", "sat": "09:00-18:00", "sun": "closed"},
            feature_flags={"ai_enabled": True, "auto_reply": True},
        ))
        db.add(models_pg.MktInbox(
            id=inbox_ig_id,
            company_id=COMPANY_ID,
            name="Simulated Salon Instagram DMs",
            channel="instagram",
            credentials_ref='{"page_id":"987654321","access_token":"EAADev..."}',
            webhook_secret="dev_secret_ig",
            is_active=True,
            auto_assignment_rule="manual",
            business_hours={},
            feature_flags={"ai_enabled": False},
        ))
        await db.commit()
        print("✓ Inboxes created")

        # ═══════════════════════════════════════════════════════════════════════
        # 2. TEMPLATES
        # ═══════════════════════════════════════════════════════════════════════
        templates = [
            models_pg.MktTemplate(
                id=uid(), company_id=COMPANY_ID, channel="whatsapp",
                name="booking_confirmation", locale="en",
                body="Hi {{1}}, your booking at Simulated Salon on {{2}} at {{3}} is confirmed! Reply CANCEL to cancel. We look forward to seeing you ✨",
                variables={"1": "customer name", "2": "date", "3": "time"},
                provider_status="APPROVED", version=1, is_active=True,
            ),
            models_pg.MktTemplate(
                id=uid(), company_id=COMPANY_ID, channel="whatsapp",
                name="reengagement_30d", locale="en",
                body="Hi {{1}}! 👋 We miss you at Simulated Salon. It's been a while — book your next appointment and enjoy 15% off with code WELCOME15. Book now: {{2}}",
                variables={"1": "customer name", "2": "booking URL"},
                provider_status="APPROVED", version=1, is_active=True,
            ),
            models_pg.MktTemplate(
                id=uid(), company_id=COMPANY_ID, channel="whatsapp",
                name="post_visit_feedback", locale="en",
                body="Hi {{1}}, thank you for visiting Simulated Salon today! 💆 How was your experience? Reply with a number: 1 (Excellent) · 2 (Good) · 3 (Could be better)",
                variables={"1": "customer name"},
                provider_status="APPROVED", version=1, is_active=True,
            ),
            models_pg.MktTemplate(
                id=uid(), company_id=COMPANY_ID, channel="whatsapp",
                name="seasonal_offer", locale="en",
                body="✨ Exclusive offer for you, {{1}}! This week only: 20% off all hair treatments at Simulated Salon. Limited slots available — reply YES to book or visit {{2}}",
                variables={"1": "customer name", "2": "booking URL"},
                provider_status="APPROVED", version=2, is_active=True,
            ),
            models_pg.MktTemplate(
                id=uid(), company_id=COMPANY_ID, channel="whatsapp",
                name="appointment_reminder_24h", locale="en",
                body="Reminder ⏰ Hi {{1}}, you have an appointment tomorrow at {{2}} at Simulated Salon. Need to reschedule? Reply RESCHEDULE.",
                variables={"1": "customer name", "2": "time"},
                provider_status="APPROVED", version=1, is_active=True,
            ),
            models_pg.MktTemplate(
                id=uid(), company_id=COMPANY_ID, channel="whatsapp",
                name="loyalty_milestone", locale="en",
                body="🎉 Congrats {{1}}! You've reached Gold status with Simulated Salon. Enjoy complimentary hair wash on your next visit + priority booking. Thank you for being loyal!",
                variables={"1": "customer name"},
                provider_status="PENDING", version=1, is_active=True,
            ),
        ]
        for t in templates:
            db.add(t)
        await db.commit()
        print(f"✓ {len(templates)} templates created")

        # ═══════════════════════════════════════════════════════════════════════
        # 3. CUSTOMER IDENTITIES (link customers → WhatsApp handles)
        # ═══════════════════════════════════════════════════════════════════════
        identity_map = {}  # customer_id → identity_id
        for c in customers:
            iid = uid()
            identity_map[c.id] = iid
            db.add(models_pg.MktCustomerIdentity(
                id=iid,
                company_id=COMPANY_ID,
                customer_id=c.id,
                channel="whatsapp",
                external_id=c.phone or f"+91990000{c.id[:4]}",
                verified=True,
                source="import",
            ))
        await db.commit()
        print(f"✓ {len(identity_map)} customer identities created")

        # ═══════════════════════════════════════════════════════════════════════
        # 4. CONVERSATIONS + MESSAGES
        # ═══════════════════════════════════════════════════════════════════════

        conv_specs = [
            # (customer_idx, status, ai_state, label, thread)
            (0, "open", "ai_handling", ["booking"], [
                ("in",  "customer", "Hi, I'd like to book a hair spa for next Saturday around 11am?", -25),
                ("out", "bot",      "Hi Nisha! 👋 Sure, we have a Hair Spa Treatment (60 min, ₹1,499) available this Saturday at 11:00 AM at our Indiranagar Flagship. Shall I confirm the booking?", -24),
                ("in",  "customer", "Yes please!", -23),
                ("out", "bot",      "Done! Your Hair Spa Treatment is booked for Saturday at 11:00 AM at Indiranagar Flagship. You'll receive a confirmation on WhatsApp. See you then! ✨", -22),
                ("in",  "customer", "Can I also get a blow dry after the spa?", -10),
                ("out", "bot",      "Absolutely! I can add a Blow Dry & Styling (30 min, ₹599) right after your spa at 12:00 PM. Would you like me to add that?", -5),
            ]),
            (1, "open", "escalated", ["complaint", "vip"], [
                ("in",  "customer", "I had an appointment yesterday and the stylist was 30 minutes late. This is completely unacceptable!", -120),
                ("out", "bot",      "Hi Aarav, I'm really sorry to hear about your experience. A 30-minute delay is not the standard we hold ourselves to. Let me connect you with our salon manager right away.", -118),
                ("in",  "customer", "I demand a full refund for my appointment.", -115),
                ("out", "agent",    "Hi Aarav, this is Priya from the management team. I sincerely apologise for the inconvenience. I'm processing a full refund and would like to offer you a complimentary session on your next visit.", -60),
                ("in",  "customer", "Thank you, I appreciate that.", -45),
            ]),
            (2, "resolved", None, ["post-visit"], [
                ("in",  "customer", "Hey, I visited today for a keratin treatment. Just wanted to say it turned out amazing!", -2880),
                ("out", "bot",      "That's wonderful to hear, Vivaan! 😊 So glad you loved your Keratin Treatment. Your hair will stay frizz-free for up to 3 months. We hope to see you again soon!", -2875),
                ("in",  "customer", "Will do, see you next time!", -2870),
            ]),
            (3, "open", None, ["new-customer"], [
                ("in",  "customer", "Hello, what are your prices for hair colouring?", -180),
                ("out", "bot",      "Hi Ananya! 👋 Here's our colour menu:\n• Global Colour — from ₹1,999\n• Highlights (partial) — ₹2,499\n• Balayage — ₹4,999\n• Ombre — ₹3,999\n\nAll prices include a wash, blow dry, and toning. Shall I book a consultation?", -175),
                ("in",  "customer", "How long does balayage take?", -170),
                ("out", "bot",      "Balayage typically takes 2.5 to 3 hours depending on hair length and the look you're going for. We recommend coming in for a quick 15-min consultation first — it's free! Want me to book one?", -165),
                ("in",  "customer", "Yes that works, any slots this week?", -30),
            ]),
            (4, "open", "ai_handling", ["inquiry"], [
                ("in",  "customer", "Do you have any slots available tomorrow for a haircut?", -90),
                ("out", "bot",      "Hi Vikram! We have slots open tomorrow for a Classic Haircut (30 min, ₹499):\n• 10:00 AM\n• 1:30 PM\n• 4:00 PM\nat Koramangala Premium. Which works best for you?", -85),
                ("in",  "customer", "4pm works", -80),
                ("out", "bot",      "Perfect! Booking confirmed: Classic Haircut tomorrow at 4:00 PM at Koramangala Premium. See you then, Vikram! ✂️", -75),
            ]),
            (5, "pending", None, ["snooze", "follow-up"], [
                ("in",  "customer", "I'd like to know more about your bridal packages", -4320),
                ("out", "bot",      "Hi Arjun! Our Bridal Package includes: Hair styling + makeup + nail art + skin treatment. Packages start at ₹12,999. Would you like to schedule a bridal consultation?", -4315),
                ("in",  "customer", "Not right now, maybe in 2 months", -4310),
                ("out", "agent",    "Of course! I'll follow up with you in 2 months. Congrats on the upcoming occasion! 🎊", -4300),
            ]),
            (6, "open", None, ["inquiry"], [
                ("in",  "customer", "What's your cancellation policy?", -45),
                ("out", "bot",      "Hi Rahul! You can cancel or reschedule up to 2 hours before your appointment at no charge. For same-day cancellations, a 50% cancellation fee applies. Is there an appointment you'd like to change?", -40),
                ("in",  "customer", "No just checking, thanks", -35),
            ]),
            (7, "open", "ai_handling", ["returning"], [
                ("in",  "customer", "Hi, I'm looking for availability for hair spa next week", -15),
                ("out", "bot",      "[DRAFT] Hi Sai! We have the following Hair Spa Treatment slots next week:\n• Monday 10:00 AM\n• Wednesday 2:30 PM\n• Friday 11:00 AM\n\nAll at Indiranagar Flagship (₹1,499). Which day suits you?", -10),
            ]),
        ]

        conv_ids = []
        for idx, (cust_idx, status, ai_state, labels, thread) in enumerate(conv_specs):
            if cust_idx >= len(customers):
                continue
            c = customers[cust_idx]
            cid = uid()
            conv_ids.append(cid)

            last_msg_time = ts(minutes_ago=abs(thread[-1][3]))
            unread = sum(1 for m in thread if m[0] == "in" and abs(m[3]) < 60)

            db.add(models_pg.MktConversation(
                id=cid,
                company_id=COMPANY_ID,
                inbox_id=inbox_wa_id,
                customer_id=c.id,
                customer_identity_id=identity_map.get(c.id),
                status=status,
                assignee_id=ADMIN_ID if status in ("open", "pending") else None,
                last_message_at=last_msg_time,
                last_customer_message_at=last_msg_time,
                unread_count=unread,
                labels=labels,
                ai_handling_state=ai_state,
            ))
            for direction, sender_type, text, mins in thread:
                db.add(models_pg.MktMessage(
                    id=uid(),
                    company_id=COMPANY_ID,
                    conversation_id=cid,
                    direction=direction,
                    sender_type=sender_type,
                    sender_id=c.id if direction == "in" else ADMIN_ID,
                    content_type="text",
                    content_text=text,
                    delivery_status="read" if direction == "out" else "delivered",
                    sent_at=ts(minutes_ago=abs(mins)),
                    created_at=ts(minutes_ago=abs(mins)),
                ))

        await db.commit()
        print(f"✓ {len(conv_ids)} conversations + messages created")

        # ═══════════════════════════════════════════════════════════════════════
        # 5. INTERNAL NOTES
        # ═══════════════════════════════════════════════════════════════════════
        if len(conv_ids) > 1:
            db.add(models_pg.MktInternalNote(
                id=uid(), company_id=COMPANY_ID,
                conversation_id=conv_ids[1],
                author_id=ADMIN_ID,
                body="VIP customer — handled refund for late appointment. Offered complimentary session. Escalation resolved by manager Priya.",
                mentions=[],
            ))
        if len(conv_ids) > 5:
            db.add(models_pg.MktInternalNote(
                id=uid(), company_id=COMPANY_ID,
                conversation_id=conv_ids[5],
                author_id=ADMIN_ID,
                body="Bridal inquiry — follow up in ~2 months (approx July 2026). Customer said 'not right now'.",
                mentions=[],
            ))
        await db.commit()
        print("✓ Internal notes created")

        # ═══════════════════════════════════════════════════════════════════════
        # 6. SEGMENTS
        # ═══════════════════════════════════════════════════════════════════════
        seg_lapsed_id = uid()
        seg_vip_id = uid()
        seg_new_id = uid()
        segments = [
            models_pg.MktSegment(
                id=seg_lapsed_id, company_id=COMPANY_ID,
                name="Lapsed Customers (30+ days)",
                description="Customers who haven't visited in 30 or more days — prime re-engagement targets",
                rules=[
                    {"field": "last_visit_days_ago", "op": "gte", "value": 30},
                    {"field": "total_bookings", "op": "gte", "value": 1},
                ],
                estimated_count=142,
            ),
            models_pg.MktSegment(
                id=seg_vip_id, company_id=COMPANY_ID,
                name="VIP / High-Spenders",
                description="Customers with lifetime spend above ₹10,000 — receive exclusive offers",
                rules=[
                    {"field": "lifetime_spend", "op": "gte", "value": 10000},
                ],
                estimated_count=38,
            ),
            models_pg.MktSegment(
                id=seg_new_id, company_id=COMPANY_ID,
                name="New Customers (First Visit)",
                description="Customers who completed their first appointment in the last 14 days",
                rules=[
                    {"field": "total_bookings", "op": "eq", "value": 1},
                    {"field": "first_visit_days_ago", "op": "lte", "value": 14},
                ],
                estimated_count=23,
            ),
        ]
        for s in segments:
            db.add(s)
        await db.commit()
        print(f"✓ {len(segments)} segments created")

        # ═══════════════════════════════════════════════════════════════════════
        # 7. CAMPAIGNS
        # ═══════════════════════════════════════════════════════════════════════
        campaigns = [
            models_pg.MktCampaign(
                id=uid(), company_id=COMPANY_ID,
                name="May Monsoon Hair Care Offer",
                segment_id=seg_lapsed_id,
                inbox_id=inbox_wa_id,
                content_type="freeform",
                content={"text": "☔ Monsoon is here! Protect your hair with our Keratin or Hair Spa treatment. Book this week and get 20% off. Reply YES to claim your slot!"},
                scheduled_at=ts(days_ago=0) + timedelta(days=2),
                status="scheduled",
                stats={"total": 142, "sent": 0, "delivered": 0, "read": 0, "replied": 0},
            ),
            models_pg.MktCampaign(
                id=uid(), company_id=COMPANY_ID,
                name="VIP Appreciation — Complimentary Wash",
                segment_id=seg_vip_id,
                inbox_id=inbox_wa_id,
                content_type="freeform",
                content={"text": "💛 A special thank-you from Simulated Salon! As one of our most valued guests, enjoy a complimentary hair wash on your next visit. No booking needed — just walk in and mention this message."},
                scheduled_at=ts(days_ago=3),
                status="sent",
                stats={"total": 38, "sent": 38, "delivered": 36, "read": 29, "replied": 7},
            ),
            models_pg.MktCampaign(
                id=uid(), company_id=COMPANY_ID,
                name="Welcome Series — New Customers",
                segment_id=seg_new_id,
                inbox_id=inbox_wa_id,
                content_type="freeform",
                content={"text": "Welcome to the Simulated Salon family! 🎉 We hope you loved your first visit. For your second appointment, enjoy 10% off any service. Book now: https://book.ridn.com"},
                scheduled_at=None,
                status="draft",
                stats={},
            ),
            models_pg.MktCampaign(
                id=uid(), company_id=COMPANY_ID,
                name="Diwali Glow Package Blast",
                segment_id=seg_lapsed_id,
                inbox_id=inbox_wa_id,
                content_type="freeform",
                content={"text": "✨ Diwali is around the corner! Look your best with our Glow Package: Facial + Hair Styling + Nail Art for just ₹3,999 (was ₹5,499). Limited slots — book before they're gone!"},
                scheduled_at=ts(days_ago=45),
                status="sent",
                stats={"total": 156, "sent": 156, "delivered": 149, "read": 121, "replied": 34},
            ),
        ]
        for c in campaigns:
            db.add(c)
        await db.commit()
        print(f"✓ {len(campaigns)} campaigns created")

        # ═══════════════════════════════════════════════════════════════════════
        # 8. JOURNEYS
        # ═══════════════════════════════════════════════════════════════════════

        def make_dag(trigger_type, steps):
            trigger_node = {"id": "trigger", "type": "trigger", "trigger_type": trigger_type}
            end_node = {"id": "end", "type": "end"}
            all_nodes = [trigger_node] + steps + [end_node]
            edges = [{"from": all_nodes[i]["id"], "to": all_nodes[i+1]["id"]} for i in range(len(all_nodes)-1)]
            return {"nodes": all_nodes, "edges": edges}

        journey_post_visit_id = uid()
        journey_reengagement_id = uid()
        journey_welcome_id = uid()

        journey_defs = [
            models_pg.MktJourney(
                id=journey_post_visit_id,
                company_id=COMPANY_ID,
                name="Post-Visit Follow-Up",
                description="Sends a feedback request 2 hours after each visit, then a re-booking nudge after 25 days",
                trigger_type="conversation_opened",
                trigger_config={"label": "post-visit"},
                dag=make_dag("conversation_opened", [
                    {"id": "n1", "type": "wait", "duration_hours": 2},
                    {"id": "n2", "type": "send_message", "inbox_id": inbox_wa_id,
                     "content_type": "freeform",
                     "text": "Hi {{customer_name}}! 💆 How was your experience at Simulated Salon today? Reply 1 (Excellent), 2 (Good), or 3 (Could be better)."},
                    {"id": "n3", "type": "wait", "duration_hours": 600},
                    {"id": "n4", "type": "send_message", "inbox_id": inbox_wa_id,
                     "content_type": "freeform",
                     "text": "Hi {{customer_name}}, it's been 25 days since your last visit! Ready for your next appointment? Book now and use code BACK10 for 10% off 🌟"},
                ]),
                is_active=True,
            ),
            models_pg.MktJourney(
                id=journey_reengagement_id,
                company_id=COMPANY_ID,
                name="30-Day Re-engagement",
                description="Automatically reaches out to customers who haven't visited in 30 days",
                trigger_type="tag_added",
                trigger_config={"tag": "lapsed-30d"},
                dag=make_dag("tag_added", [
                    {"id": "n1", "type": "wait", "duration_hours": 24},
                    {"id": "n2", "type": "send_message", "inbox_id": inbox_wa_id,
                     "content_type": "freeform",
                     "text": "Hi {{customer_name}} 👋 We miss you! It's been a while since your last visit. Come back and enjoy 15% off your next service with code WELCOME15."},
                    {"id": "n3", "type": "wait", "duration_hours": 168},
                    {"id": "n4", "type": "send_message", "inbox_id": inbox_wa_id,
                     "content_type": "freeform",
                     "text": "Last chance! Your 15% off code WELCOME15 expires in 48 hours. Book your spot at Simulated Salon now — we'd love to see you! 💇"},
                ]),
                is_active=True,
            ),
            models_pg.MktJourney(
                id=journey_welcome_id,
                company_id=COMPANY_ID,
                name="New Customer Welcome",
                description="Onboards first-time customers with a welcome message and a 10% discount for their second visit",
                trigger_type="conversation_opened",
                trigger_config={"label": "new-customer"},
                dag=make_dag("conversation_opened", [
                    {"id": "n1", "type": "send_message", "inbox_id": inbox_wa_id,
                     "content_type": "freeform",
                     "text": "Welcome to Simulated Salon, {{customer_name}}! 🎉 We're thrilled to have you. Here's 10% off your next visit — use code NEW10 when booking."},
                    {"id": "n2", "type": "wait", "duration_hours": 72},
                    {"id": "n3", "type": "send_message", "inbox_id": inbox_wa_id,
                     "content_type": "freeform",
                     "text": "Hi {{customer_name}}, don't forget your 10% welcome discount (NEW10) — it expires in 4 days! Ready to book? Reply with your preferred date."},
                ]),
                is_active=False,
            ),
        ]
        for j in journey_defs:
            db.add(j)
        await db.commit()
        print(f"✓ {len(journey_defs)} journeys created")

        # ═══════════════════════════════════════════════════════════════════════
        # 9. JOURNEY ENROLLMENTS
        # ═══════════════════════════════════════════════════════════════════════
        enrollment_specs = [
            # (journey_id, customer_idx, status, current_node, enrolled_days_ago)
            (journey_post_visit_id, 2, "completed", "end",     3),
            (journey_post_visit_id, 4, "active",    "n3",      1),
            (journey_post_visit_id, 6, "active",    "n2",      0),
            (journey_reengagement_id, 0, "active",  "n3",      2),
            (journey_reengagement_id, 1, "active",  "n2",      5),
            (journey_reengagement_id, 5, "active",  "n2",      4),
            (journey_reengagement_id, 7, "completed","end",    10),
        ]
        for journey_id, cust_idx, status, current_node, days_ago in enrollment_specs:
            if cust_idx >= len(customers):
                continue
            enr_id = uid()
            db.add(models_pg.MktJourneyEnrollment(
                id=enr_id,
                journey_id=journey_id,
                customer_id=customers[cust_idx].id,
                current_node_id=current_node,
                status=status,
                enrolled_at=ts(days_ago=days_ago),
                completed_at=ts(days_ago=0) if status == "completed" else None,
            ))
        await db.commit()
        print("✓ Journey enrollments created")

        # ═══════════════════════════════════════════════════════════════════════
        # 10. FREQUENCY CAP CONFIG
        # ═══════════════════════════════════════════════════════════════════════
        db.add(models_pg.MktFrequencyCapConfig(
            id=uid(),
            company_id=COMPANY_ID,
            max_per_day=2,
            max_per_week=8,
            quiet_hours_start="21:00",
            quiet_hours_end="09:00",
        ))
        await db.commit()
        print("✓ Frequency cap config created")

        # ═══════════════════════════════════════════════════════════════════════
        # 11. BRAND VOICE PROFILE
        # ═══════════════════════════════════════════════════════════════════════
        db.add(models_pg.BrandVoiceProfile(
            id=uid(),
            tenant_id=COMPANY_ID,
            tone="warm, friendly, professional",
            do_phrases=[
                "Use the customer's name",
                "Acknowledge the customer's concern before responding",
                "End with an offer to help or a call to action",
                "Use light emojis to keep the tone warm",
                "Always confirm booking details clearly (date, time, location, price)",
            ],
            dont_phrases=[
                "Never say 'I can't help with that'",
                "Avoid 'Please hold' or 'one moment please'",
                "Don't use all-caps",
                "Avoid overly formal language like 'Esteemed customer'",
            ],
            required_disclosures=[
                "Prices quoted are indicative and may vary based on hair length",
                "Cancellation policy: free cancellation up to 2 hours before appointment",
            ],
            example_messages=[
                {"role": "customer", "content": "Do you have slots this weekend?"},
                {"role": "assistant", "content": "Hi Priya! 😊 Yes, we have a few slots open this Saturday and Sunday. What service are you looking for? I'll check availability for you right away!"},
            ],
        ))
        await db.commit()
        print("✓ Brand voice profile created")

        # ═══════════════════════════════════════════════════════════════════════
        # 12. AGENT CONFIG (Concierge)
        # ═══════════════════════════════════════════════════════════════════════
        db.add(models_pg.AgentConfig(
            id=uid(),
            tenant_id=COMPANY_ID,
            agent_name="concierge",
            version="v1",
            system_prompt_id="concierge:v1",
            model="gpt-4o-mini",
            allowed_tools={
                "inbox.list_recent_messages": True,
                "inbox.send_reply": True,
                "inbox.add_internal_note": True,
                "inbox.assign_to_human": True,
                "customer.get_profile": True,
                "kb.search": True,
                "shadow_mode": True,
            },
            autonomy_level="L1",
            confidence_threshold=0.72,
            is_active=True,
        ))
        await db.commit()
        print("✓ Agent config created")

        # ═══════════════════════════════════════════════════════════════════════
        # 13. KNOWLEDGE BASE (chunks — no embeddings for seed)
        # ═══════════════════════════════════════════════════════════════════════
        ks_id = uid()
        db.add(models_pg.KnowledgeSource(
            id=ks_id,
            tenant_id=COMPANY_ID,
            type="manual",
            source_ref="seed_marketing.py",
            status="indexed",
            last_synced_at=ts(),
        ))
        await db.commit()

        kb_chunks = [
            ("services_pricing",
             "Simulated Salon Services & Pricing:\n"
             "Hair Services: Classic Haircut ₹499 (30 min), Premium Haircut & Wash ₹799 (45 min), "
             "Hair Spa Treatment ₹1,499 (60 min), Blow Dry & Styling ₹599 (30 min), "
             "Keratin Treatment ₹3,999 (90 min).\n"
             "Colour & Chemical: Global Colour from ₹1,999, Highlights ₹2,499, Balayage ₹4,999, Ombre ₹3,999.\n"
             "Skin & Facial: Basic Clean-Up ₹799, Premium Facial ₹1,499, Anti-Tan Treatment ₹1,199.\n"
             "Nail Services: Manicure ₹599, Pedicure ₹699, Gel Nails ₹999.\n"
             "Bridal Packages: starting ₹12,999."),
            ("booking_policy",
             "Booking Policy: Appointments can be booked online at book.ridn.com, via WhatsApp, or by calling the outlet. "
             "Advance booking recommended for weekends and special services (Keratin, Balayage, Bridal). "
             "Walk-ins accepted subject to availability. "
             "Cancellation: free up to 2 hours before appointment. Same-day cancellation incurs a 50% fee. "
             "No-show is charged 100%."),
            ("outlets",
             "Simulated Salon Locations:\n"
             "1. Indiranagar Flagship — 100 Feet Road, Indiranagar | Mon-Sat 9am-9pm, Sun 10am-7pm\n"
             "2. Koramangala Premium — 80 Feet Road, Koramangala | Mon-Sat 9am-9pm, Sun 10am-7pm\n"
             "3. HSR Layout Studio — 27th Main, HSR Layout | Tue-Sun 10am-8pm\n"
             "4. Whitefield Mall — Phoenix Marketcity | Daily 10am-9pm\n"
             "5. Jayanagar Classic — 4th Block, Jayanagar | Mon-Sat 9am-8pm\n"
             "All outlets accept walk-ins. Parking available at all locations."),
            ("loyalty_program",
             "Simulated Salon Loyalty Program:\n"
             "Silver (0-9,999 lifetime spend): 5% off on services.\n"
             "Gold (₹10,000-₹24,999 lifetime spend): 10% off + complimentary hair wash on every visit + priority booking.\n"
             "Platinum (₹25,000+ lifetime spend): 15% off + complimentary treatments monthly + personal stylist assignment.\n"
             "Points: earn 1 point per ₹100 spent. Redeem 100 points = ₹50 off."),
            ("promotions",
             "Current Promotions:\n"
             "• WELCOME15 — 15% off for lapsed customers (30+ day re-engagement)\n"
             "• NEW10 — 10% off second visit for new customers\n"
             "• BACK10 — 10% off re-booking after 25+ days\n"
             "• Monsoon Hair Care: 20% off Keratin/Hair Spa this week\n"
             "Promotions cannot be combined. One code per visit."),
            ("faqs",
             "Frequently Asked Questions:\n"
             "Q: How long does a Keratin treatment last? A: 3-5 months with proper care.\n"
             "Q: Can I wash my hair after Keratin? A: Avoid washing for 72 hours post-treatment.\n"
             "Q: Do you offer home services? A: Currently not available. In-salon only.\n"
             "Q: What payment methods are accepted? A: Cash, UPI, credit/debit cards, and net banking.\n"
             "Q: Is there a waiting area? A: Yes, all outlets have a comfortable waiting lounge with complimentary tea/coffee."),
        ]

        for chunk_type, content in kb_chunks:
            db.add(models_pg.KnowledgeChunk(
                id=uid(),
                source_id=ks_id,
                tenant_id=COMPANY_ID,
                content=content,
                embedding=None,
                chunk_metadata={"type": chunk_type, "source": "seed"},
            ))
        await db.commit()
        print(f"✓ Knowledge base: 1 source + {len(kb_chunks)} chunks")

        # ── Summary ───────────────────────────────────────────────────────────
        print("\n✅ Marketing seed complete!")
        print(f"   Inboxes:        2 (WhatsApp + Instagram)")
        print(f"   Templates:      {len(templates)}")
        print(f"   Identities:     {len(identity_map)}")
        print(f"   Conversations:  {len(conv_ids)} (open/resolved/pending + AI states)")
        print(f"   Segments:       {len(segments)}")
        print(f"   Campaigns:      {len(campaigns)} (draft/scheduled/sent)")
        print(f"   Journeys:       {len(journey_defs)} (2 active, 1 draft)")
        print(f"   Enrollments:    7")
        print(f"   KB chunks:      {len(kb_chunks)}")
        print(f"   Brand voice:    ✓")
        print(f"   Agent config:   concierge L1 (shadow mode ON)")


if __name__ == "__main__":
    asyncio.run(seed())
