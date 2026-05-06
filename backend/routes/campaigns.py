from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database_pg import get_db, engine
from routes.dependencies import get_current_user
import models_pg
from datetime import datetime, timezone

router = APIRouter(prefix="/marketing/campaigns", tags=["Marketing - Campaigns"])

async def _get_or_create_campaign_conversation(db, company_id, inbox_id, customer_id, identity_id):
    result = await db.execute(
        select(models_pg.MktConversation)
        .where(
            models_pg.MktConversation.company_id == company_id,
            models_pg.MktConversation.inbox_id == inbox_id,
            models_pg.MktConversation.customer_identity_id == identity_id,
        )
        .order_by(models_pg.MktConversation.created_at.desc())
        .limit(1)
    )
    conv = result.scalar_one_or_none()
    if conv:
        return conv.id
    conv = models_pg.MktConversation(
        company_id=company_id,
        inbox_id=inbox_id,
        customer_id=customer_id,
        customer_identity_id=identity_id,
        status="open",
        unread_count=0,
        labels=[],
        last_message_at=datetime.now(timezone.utc),
    )
    db.add(conv)
    await db.flush()
    return conv.id

async def launch_campaign(campaign_id: str, company_id: str, launched_by: str):
    from services.send_pipeline import enqueue_message
    from channels.base import OutboundContent
    async with AsyncSession(engine) as db:
        result = await db.execute(
            select(models_pg.MktCampaign).where(
                models_pg.MktCampaign.id == campaign_id,
                models_pg.MktCampaign.company_id == company_id,
            )
        )
        campaign = result.scalar_one_or_none()
        if not campaign or campaign.status != "running":
            return

        inbox_result = await db.execute(
            select(models_pg.MktInbox).where(models_pg.MktInbox.id == campaign.inbox_id)
        )
        inbox = inbox_result.scalar_one_or_none()
        if not inbox:
            campaign.status = "cancelled"
            await db.commit()
            return

        # Get segment customers
        if campaign.segment_id:
            seg_result = await db.execute(
                select(models_pg.MktSegment).where(models_pg.MktSegment.id == campaign.segment_id)
            )
            segment = seg_result.scalar_one_or_none()
            rules = segment.rules if segment else []
        else:
            rules = []

        from routes.segments import evaluate_segment
        customer_ids = await evaluate_segment(rules, company_id, db)

        stats = {"sent": 0, "failed": 0, "suppressed": 0}

        for customer_id in customer_ids:
            # Get identity for this customer on inbox channel
            id_result = await db.execute(
                select(models_pg.MktCustomerIdentity).where(
                    models_pg.MktCustomerIdentity.company_id == company_id,
                    models_pg.MktCustomerIdentity.customer_id == customer_id,
                    models_pg.MktCustomerIdentity.channel == inbox.channel,
                ).limit(1)
            )
            identity = id_result.scalar_one_or_none()

            if not identity:
                recipient = models_pg.MktCampaignRecipient(
                    campaign_id=campaign_id,
                    customer_id=customer_id,
                    status="suppressed",
                    error="no_channel_identity",
                )
                db.add(recipient)
                await db.commit()
                stats["suppressed"] += 1
                continue

            recipient = models_pg.MktCampaignRecipient(
                campaign_id=campaign_id,
                customer_id=customer_id,
                identity_id=identity.id,
                status="pending",
            )
            db.add(recipient)
            await db.commit()
            await db.refresh(recipient)
            recipient_id = recipient.id

            try:
                conv_id = await _get_or_create_campaign_conversation(
                    db, company_id, campaign.inbox_id, customer_id, identity.id
                )

                content_data = campaign.content or {}
                if campaign.content_type == "template":
                    content = OutboundContent(
                        content_type="template",
                        template_name=content_data.get("template_name"),
                        template_language=content_data.get("template_language", "en"),
                        template_components=content_data.get("template_components"),
                    )
                else:
                    content = OutboundContent(
                        content_type="text",
                        text=content_data.get("text", ""),
                    )

                result_dict = await enqueue_message(
                    db,
                    conversation_id=conv_id,
                    company_id=company_id,
                    customer_id=customer_id,
                    channel=inbox.channel,
                    inbox_id=campaign.inbox_id,
                    content=content,
                    sender_id=launched_by,
                    is_marketing=True,
                )

                r_result = await db.execute(
                    select(models_pg.MktCampaignRecipient).where(
                        models_pg.MktCampaignRecipient.id == recipient_id
                    )
                )
                recipient = r_result.scalar_one()

                if result_dict.get("suppressed"):
                    recipient.status = "suppressed"
                    recipient.error = result_dict.get("reason")
                    stats["suppressed"] += 1
                elif result_dict.get("success"):
                    recipient.status = "sent"
                    recipient.sent_at = datetime.now(timezone.utc)
                    stats["sent"] += 1
                else:
                    recipient.status = "failed"
                    recipient.error = result_dict.get("error")
                    stats["failed"] += 1
                await db.commit()

            except Exception as e:
                r_result = await db.execute(
                    select(models_pg.MktCampaignRecipient).where(
                        models_pg.MktCampaignRecipient.id == recipient_id
                    )
                )
                recipient = r_result.scalar_one_or_none()
                if recipient:
                    recipient.status = "failed"
                    recipient.error = str(e)
                    stats["failed"] += 1
                    await db.commit()

        # Finalize campaign
        c_result = await db.execute(
            select(models_pg.MktCampaign).where(models_pg.MktCampaign.id == campaign_id)
        )
        campaign = c_result.scalar_one()
        campaign.status = "completed"
        campaign.stats = stats
        await db.commit()

@router.get("")
async def list_campaigns(current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktCampaign)
        .where(models_pg.MktCampaign.company_id == current_user.company_id)
        .order_by(models_pg.MktCampaign.created_at.desc())
    )
    return result.scalars().all()

@router.post("")
async def create_campaign(body: dict, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    campaign = models_pg.MktCampaign(
        company_id=current_user.company_id,
        name=body["name"],
        segment_id=body.get("segment_id"),
        inbox_id=body.get("inbox_id"),
        template_id=body.get("template_id"),
        content_type=body.get("content_type", "freeform"),
        content=body.get("content", {}),
        scheduled_at=body.get("scheduled_at"),
        stats={"sent": 0, "failed": 0, "suppressed": 0},
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign

@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktCampaign).where(
            models_pg.MktCampaign.id == campaign_id,
            models_pg.MktCampaign.company_id == current_user.company_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")
    return c

@router.put("/{campaign_id}")
async def update_campaign(campaign_id: str, body: dict, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktCampaign).where(
            models_pg.MktCampaign.id == campaign_id,
            models_pg.MktCampaign.company_id == current_user.company_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.status != "draft":
        raise HTTPException(400, "Only draft campaigns can be edited")
    for field in ["name", "segment_id", "inbox_id", "template_id", "content_type", "content", "scheduled_at"]:
        if field in body:
            setattr(c, field, body[field])
    await db.commit()
    await db.refresh(c)
    return c

@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktCampaign).where(
            models_pg.MktCampaign.id == campaign_id,
            models_pg.MktCampaign.company_id == current_user.company_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.status != "draft":
        raise HTTPException(400, "Only draft campaigns can be deleted")
    await db.delete(c)
    await db.commit()
    return {"ok": True}

@router.post("/{campaign_id}/launch")
async def launch_campaign_endpoint(
    campaign_id: str,
    background_tasks: BackgroundTasks,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(models_pg.MktCampaign).where(
            models_pg.MktCampaign.id == campaign_id,
            models_pg.MktCampaign.company_id == current_user.company_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.status != "draft":
        raise HTTPException(400, f"Cannot launch a campaign with status '{c.status}'")
    c.status = "running"
    await db.commit()
    background_tasks.add_task(launch_campaign, campaign_id, current_user.company_id, current_user.id)
    return {"ok": True, "status": "running"}

@router.get("/{campaign_id}/stats")
async def get_campaign_stats(campaign_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models_pg.MktCampaign).where(
            models_pg.MktCampaign.id == campaign_id,
            models_pg.MktCampaign.company_id == current_user.company_id,
        )
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Campaign not found")
    return {"stats": c.stats, "status": c.status}

@router.get("/{campaign_id}/recipients")
async def list_recipients(campaign_id: str, current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await get_campaign(campaign_id, current_user, db)
    result = await db.execute(
        select(models_pg.MktCampaignRecipient)
        .where(models_pg.MktCampaignRecipient.campaign_id == campaign_id)
        .order_by(models_pg.MktCampaignRecipient.sent_at.desc())
    )
    return result.scalars().all()
