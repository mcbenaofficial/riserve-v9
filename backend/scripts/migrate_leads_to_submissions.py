#!/usr/bin/env python3
"""
migrate_leads_to_submissions.py

One-time idempotent migration: copies leads + lead_events into submissions + submission_events.
Safe to re-run (skips rows that already exist by ID).

Usage:
    cd backend && source venv/bin/activate
    python3 scripts/migrate_leads_to_submissions.py [--dry-run]
"""
import asyncio
import argparse
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Add backend root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import select, text
from sqlalchemy.orm import sessionmaker
import models_pg
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent.parent / '.env')

DATABASE_URL = os.getenv('POSTGRES_URL', 'postgresql+asyncpg://localhost:5432/riserve_db')

generate_uuid = lambda: str(uuid.uuid4())

SOURCE_CHANNEL_MAP = {
    'instagram': 'instagram',
    'facebook': 'facebook',
    'whatsapp': 'whatsapp',
}

STAGE_MAP = {
    'new': 'new',
    'engaging': 'engaging',
    'qualified': 'qualified',
    'converted': 'converted',
    'lost': 'lost',
    'blocked': 'lost',
}

EVENT_KIND_MAP = {
    'promoted_to_customer': 'promoted',
    'blocked': 'lost',
}


async def get_or_create_campaign(
    session: AsyncSession,
    tenant_id: str,
    campaign_type_id: str,
    name: str,
    status: str,
    dry_run: bool,
    campaign_cache: dict,
    cache_key: str,
) -> str:
    """Return campaign id, creating the row if it doesn't already exist."""
    if cache_key in campaign_cache:
        return campaign_cache[cache_key]

    # Check by name + tenant (idempotency: if this script already ran, find the existing row)
    stmt = select(models_pg.Campaign).where(
        models_pg.Campaign.tenant_id == tenant_id,
        models_pg.Campaign.name == name,
    )
    result = await session.execute(stmt)
    existing = result.scalars().first()
    if existing:
        campaign_cache[cache_key] = existing.id
        return existing.id

    campaign_id = generate_uuid()
    now = datetime.now(timezone.utc)
    campaign = models_pg.Campaign(
        id=campaign_id,
        tenant_id=tenant_id,
        name=name,
        campaign_type_id=campaign_type_id,
        status=status,
        form_schema={},
        audience_spec={"_note": "Legacy import — re-target as needed"},
        created_at=now,
        updated_at=now,
    )
    session.add(campaign)
    if not dry_run:
        await session.flush()
    print(f"  [campaign] Created '{name}' (id={campaign_id}, tenant={tenant_id})")
    campaign_cache[cache_key] = campaign_id
    return campaign_id


async def main(dry_run: bool):
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:

        # ------------------------------------------------------------------
        # 0. Resolve the customer_acquisition CampaignType id
        # ------------------------------------------------------------------
        ct_stmt = select(models_pg.CampaignType).where(
            models_pg.CampaignType.key == 'customer_acquisition'
        )
        ct_result = await session.execute(ct_stmt)
        campaign_type = ct_result.scalars().first()
        if not campaign_type:
            print("ERROR: CampaignType with key='customer_acquisition' not found in database.")
            print("       Seed the campaign_types table before running this migration.")
            sys.exit(1)

        campaign_type_id = campaign_type.id
        print(f"Found CampaignType 'customer_acquisition' -> id={campaign_type_id}")

        # ------------------------------------------------------------------
        # 1. Load all leads
        # ------------------------------------------------------------------
        leads_stmt = select(models_pg.Lead)
        leads_result = await session.execute(leads_stmt)
        all_leads = leads_result.scalars().all()
        print(f"\nFound {len(all_leads)} leads to migrate.")

        # ------------------------------------------------------------------
        # 2. Load all relevant LeadFlows keyed by id
        # ------------------------------------------------------------------
        flow_ids = {lead.current_flow_id for lead in all_leads if lead.current_flow_id}
        flow_map: dict[str, models_pg.LeadFlow] = {}
        if flow_ids:
            flows_stmt = select(models_pg.LeadFlow).where(
                models_pg.LeadFlow.id.in_(list(flow_ids))
            )
            flows_result = await session.execute(flows_stmt)
            for flow in flows_result.scalars().all():
                flow_map[flow.id] = flow

        # ------------------------------------------------------------------
        # 3. Build campaigns for each (tenant_id, flow_id) pair and
        #    for each tenant that has leads with no flow
        # ------------------------------------------------------------------
        campaign_cache: dict[str, str] = {}  # cache_key -> campaign_id

        # 3a. Campaigns for specific flows
        for flow_id in flow_ids:
            flow = flow_map.get(flow_id)
            if not flow:
                print(f"  WARNING: LeadFlow {flow_id} not found — leads will fall into catch-all.")
                continue

            # Gather tenant_ids that use this flow
            tenant_ids_for_flow = {
                lead.tenant_id for lead in all_leads if lead.current_flow_id == flow_id
            }
            for tenant_id in tenant_ids_for_flow:
                cache_key = f"flow:{flow_id}:{tenant_id}"
                campaign_name = f"{flow.name} (migrated)"
                campaign_status = 'active' if flow.is_active else 'completed'
                await get_or_create_campaign(
                    session=session,
                    tenant_id=tenant_id,
                    campaign_type_id=campaign_type_id,
                    name=campaign_name,
                    status=campaign_status,
                    dry_run=dry_run,
                    campaign_cache=campaign_cache,
                    cache_key=cache_key,
                )

        # 3b. Catch-all campaigns for leads without a flow
        tenant_ids_no_flow = {
            lead.tenant_id for lead in all_leads if not lead.current_flow_id
        }
        for tenant_id in tenant_ids_no_flow:
            cache_key = f"catchall:{tenant_id}"
            await get_or_create_campaign(
                session=session,
                tenant_id=tenant_id,
                campaign_type_id=campaign_type_id,
                name="Unassigned Leads (migrated)",
                status='completed',
                dry_run=dry_run,
                campaign_cache=campaign_cache,
                cache_key=cache_key,
            )

        # ------------------------------------------------------------------
        # 4. Migrate each Lead -> Submission (idempotent by id)
        # ------------------------------------------------------------------
        # Load existing submission ids in one query
        existing_sub_stmt = select(models_pg.Submission.id)
        existing_sub_result = await session.execute(existing_sub_stmt)
        existing_submission_ids = {row[0] for row in existing_sub_result.fetchall()}

        submissions_created = 0
        submissions_skipped = 0

        for lead in all_leads:
            print(f"Migrating lead {lead.id}...", end=" ")

            if lead.id in existing_submission_ids:
                print("SKIPPED (already in submissions)")
                submissions_skipped += 1
                continue

            # Resolve campaign id
            if lead.current_flow_id and f"flow:{lead.current_flow_id}:{lead.tenant_id}" in campaign_cache:
                campaign_id = campaign_cache[f"flow:{lead.current_flow_id}:{lead.tenant_id}"]
            else:
                # Fallback: flow not found in map — use catch-all
                cache_key = f"catchall:{lead.tenant_id}"
                if cache_key not in campaign_cache:
                    # Create catch-all on-the-fly (edge case: flow_id set but flow deleted)
                    campaign_id = await get_or_create_campaign(
                        session=session,
                        tenant_id=lead.tenant_id,
                        campaign_type_id=campaign_type_id,
                        name="Unassigned Leads (migrated)",
                        status='completed',
                        dry_run=dry_run,
                        campaign_cache=campaign_cache,
                        cache_key=cache_key,
                    )
                else:
                    campaign_id = campaign_cache[cache_key]

            # Map source_channel
            source_channel = SOURCE_CHANNEL_MAP.get(
                (lead.source_platform or '').lower(), 'import'
            )

            # Map stage
            stage = STAGE_MAP.get((lead.status or '').lower(), 'new')

            submission = models_pg.Submission(
                id=lead.id,
                tenant_id=lead.tenant_id,
                campaign_id=campaign_id,
                campaign_type_snapshot='customer_acquisition',
                tags_snapshot=[],
                source_channel=source_channel,
                submitter_handle=lead.source_handle,
                responses=lead.attributes or {},
                pii_field_names=[],
                common_name=lead.captured_name,
                common_phone=lead.captured_phone,
                common_email=lead.captured_email,
                score=lead.score or 0,
                score_breakdown=lead.score_breakdown or {},
                stage=stage,
                stage_entered_at=lead.captured_at,
                promoted_to_table='customers' if lead.promoted_to_customer_id else None,
                promoted_to_id=lead.promoted_to_customer_id,
                promoted_at=lead.promoted_at,
                retention_class_snapshot='standard',
                expires_at=lead.expires_at,
                consent_snapshot={},
                created_at=lead.captured_at,
                updated_at=lead.captured_at,
            )
            session.add(submission)
            if not dry_run:
                await session.flush()

            print("OK")
            submissions_created += 1
            existing_submission_ids.add(lead.id)  # prevent double insert on re-run within session

        # ------------------------------------------------------------------
        # 5. Migrate each LeadEvent -> SubmissionEvent (idempotent by
        #    submission_id + kind + occurred_at)
        # ------------------------------------------------------------------
        events_stmt = select(models_pg.LeadEvent)
        events_result = await session.execute(events_stmt)
        all_lead_events = events_result.scalars().all()
        print(f"\nFound {len(all_lead_events)} lead events to migrate.")

        # Load existing submission events for deduplication
        existing_events_stmt = select(
            models_pg.SubmissionEvent.submission_id,
            models_pg.SubmissionEvent.kind,
            models_pg.SubmissionEvent.occurred_at,
        )
        existing_events_result = await session.execute(existing_events_stmt)
        existing_event_keys = {
            (row[0], row[1], row[2]) for row in existing_events_result.fetchall()
        }

        events_created = 0
        events_skipped = 0

        for le in all_lead_events:
            # Map event kind
            mapped_kind = EVENT_KIND_MAP.get(le.kind, le.kind)

            dedup_key = (le.lead_id, mapped_kind, le.occurred_at)
            if dedup_key in existing_event_keys:
                events_skipped += 1
                continue

            sub_event = models_pg.SubmissionEvent(
                id=generate_uuid(),
                submission_id=le.lead_id,
                tenant_id=le.tenant_id,
                kind=mapped_kind,
                payload=le.payload or {},
                actor_type='system',
                occurred_at=le.occurred_at,
            )
            session.add(sub_event)
            events_created += 1
            existing_event_keys.add(dedup_key)

        if not dry_run:
            await session.flush()

        # ------------------------------------------------------------------
        # 6. Print summary and manual cleanup SQL
        # ------------------------------------------------------------------
        print("\n" + "=" * 60)
        print("MIGRATION SUMMARY")
        print("=" * 60)
        print(f"  Campaigns created :  {len(campaign_cache)}")
        print(f"  Submissions created: {submissions_created}")
        print(f"  Submissions skipped: {submissions_skipped} (already existed)")
        print(f"  Events created     : {events_created}")
        print(f"  Events skipped     : {events_skipped} (already existed)")
        print()
        print("After verifying data integrity, run the following SQL manually")
        print("to archive the legacy tables (DO NOT DROP — keep for safety):")
        print()
        print("  ALTER TABLE leads RENAME TO leads_legacy_pre_unification;")
        print("  ALTER TABLE lead_events RENAME TO lead_events_legacy_pre_unification;")
        print()

        if dry_run:
            print("[DRY RUN] Rolling back all changes — nothing was written to the database.")
            await session.rollback()
        else:
            await session.commit()
            print("Migration committed successfully.")

    await engine.dispose()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Migrate leads + lead_events into submissions + submission_events (Addendum 6.2).'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Run the full migration logic but roll back at the end — nothing is written.',
    )
    args = parser.parse_args()
    asyncio.run(main(args.dry_run))
