"""add unified campaign model (submissions, campaigns, campaign_types)

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-05-11 03:00:00.000000

"""
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'j3k4l5m6n7o8'
down_revision = 'i2j3k4l5m6n7'
branch_labels = None
depends_on = None

DEFAULT_STAGE_SET_CUSTOMER = {
    "stages": [
        {"key": "new", "label": "New", "is_initial": True},
        {"key": "engaging", "label": "Engaging", "sla_hours": 24},
        {"key": "qualified", "label": "Qualified", "promotion_eligible": True, "sla_hours": 48},
        {"key": "converted", "label": "Converted", "is_terminal": True, "outcome": "won"},
        {"key": "lost", "label": "Lost", "is_terminal": True, "outcome": "lost"},
    ],
    "transitions": [
        {"from": "new", "to": "engaging", "trigger": "first_response"},
        {"from": "engaging", "to": "qualified", "trigger": "score_threshold"},
        {"from": "qualified", "to": "converted", "trigger": "promotion"},
    ],
}


def upgrade() -> None:
    # 1. campaign_types — system-seeded global reference table
    op.create_table(
        'campaign_types',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('key', sa.String(100), nullable=False, unique=True),
        sa.Column('display_name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('default_stage_set', JSONB, nullable=True),
        sa.Column('default_promotion_target', sa.String(100), nullable=True),
        sa.Column('default_retention_class', sa.String(50), server_default='standard'),
        sa.Column('meta_ad_category', sa.String(50), server_default='none'),
        sa.Column('default_agent_persona_id', sa.String(36), nullable=True),
        sa.Column('requires_legal_disclosure', sa.Boolean, server_default='false'),
    )

    # Seed the 6 built-in campaign types
    campaign_types_table = sa.table(
        'campaign_types',
        sa.column('id', sa.String),
        sa.column('key', sa.String),
        sa.column('display_name', sa.String),
        sa.column('description', sa.Text),
        sa.column('default_stage_set', JSONB),
        sa.column('default_promotion_target', sa.String),
        sa.column('default_retention_class', sa.String),
        sa.column('meta_ad_category', sa.String),
        sa.column('default_agent_persona_id', sa.String),
        sa.column('requires_legal_disclosure', sa.Boolean),
    )
    op.bulk_insert(campaign_types_table, [
        {
            'id': str(uuid.uuid4()),
            'key': 'customer_acquisition',
            'display_name': 'Customer Acquisition',
            'description': None,
            'default_stage_set': DEFAULT_STAGE_SET_CUSTOMER,
            'default_promotion_target': 'customers',
            'default_retention_class': 'standard',
            'meta_ad_category': 'none',
            'default_agent_persona_id': None,
            'requires_legal_disclosure': False,
        },
        {
            'id': str(uuid.uuid4()),
            'key': 'talent_acquisition',
            'display_name': 'Talent Acquisition',
            'description': None,
            'default_stage_set': DEFAULT_STAGE_SET_CUSTOMER,
            'default_promotion_target': 'employees',
            'default_retention_class': 'sensitive',
            'meta_ad_category': 'employment',
            'default_agent_persona_id': None,
            'requires_legal_disclosure': True,
        },
        {
            'id': str(uuid.uuid4()),
            'key': 'franchise_development',
            'display_name': 'Franchise Development',
            'description': None,
            'default_stage_set': DEFAULT_STAGE_SET_CUSTOMER,
            'default_promotion_target': 'franchisees',
            'default_retention_class': 'regulated',
            'meta_ad_category': 'credit_or_employment',
            'default_agent_persona_id': None,
            'requires_legal_disclosure': True,
        },
        {
            'id': str(uuid.uuid4()),
            'key': 'vendor_sourcing',
            'display_name': 'Vendor Sourcing',
            'description': None,
            'default_stage_set': DEFAULT_STAGE_SET_CUSTOMER,
            'default_promotion_target': None,
            'default_retention_class': 'standard',
            'meta_ad_category': 'none',
            'default_agent_persona_id': None,
            'requires_legal_disclosure': False,
        },
        {
            'id': str(uuid.uuid4()),
            'key': 'partnership_outreach',
            'display_name': 'Partnership Outreach',
            'description': None,
            'default_stage_set': DEFAULT_STAGE_SET_CUSTOMER,
            'default_promotion_target': None,
            'default_retention_class': 'extended',
            'meta_ad_category': 'none',
            'default_agent_persona_id': None,
            'requires_legal_disclosure': False,
        },
        {
            'id': str(uuid.uuid4()),
            'key': 'general_lead_gen',
            'display_name': 'General Lead Gen',
            'description': None,
            'default_stage_set': DEFAULT_STAGE_SET_CUSTOMER,
            'default_promotion_target': None,
            'default_retention_class': 'standard',
            'meta_ad_category': 'none',
            'default_agent_persona_id': None,
            'requires_legal_disclosure': False,
        },
    ])

    # 2. campaign_tag_groups
    op.create_table(
        'campaign_tag_groups',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('color_hex', sa.String(7), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_campaign_tag_groups_tenant_id', 'campaign_tag_groups', ['tenant_id'])

    # 3. campaigns
    op.create_table(
        'campaigns',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('internal_notes', sa.Text, nullable=True),
        sa.Column('campaign_type_id', sa.String(36), sa.ForeignKey('campaign_types.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('tag_group_id', sa.String(36), sa.ForeignKey('campaign_tag_groups.id', ondelete='SET NULL'), nullable=True),
        sa.Column('tags', JSONB, nullable=True),
        sa.Column('status', sa.String(50), server_default='draft'),
        sa.Column('form_schema', JSONB, nullable=True),
        sa.Column('audience_spec', JSONB, nullable=True),
        sa.Column('creative_refs', JSONB, nullable=True),
        sa.Column('lifecycle_stages_override', JSONB, nullable=True),
        sa.Column('qualification_threshold', sa.Integer, server_default='40'),
        sa.Column('qualification_rules', JSONB, nullable=True),
        sa.Column('promotion_rules', JSONB, nullable=True),
        sa.Column('retention_class', sa.String(50), server_default='standard'),
        sa.Column('disclosure_footer', sa.Text, nullable=True),
        sa.Column('agent_persona_id', sa.String(36), nullable=True),
        sa.Column('agent_autonomy_level', sa.String(10), server_default='L1'),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('end_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('daily_submission_cap', sa.Integer, nullable=True),
        sa.Column('total_submission_cap', sa.Integer, nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_campaigns_tenant_id', 'campaigns', ['tenant_id'])
    op.create_index('ix_campaigns_status', 'campaigns', ['status'])
    op.create_index('ix_campaigns_tenant_status_type', 'campaigns', ['tenant_id', 'status', 'campaign_type_id'])
    op.create_index('ix_campaigns_tags_gin', 'campaigns', ['tags'], postgresql_using='gin')

    # 4. campaign_templates
    op.create_table(
        'campaign_templates',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('campaign_type_id', sa.String(36), sa.ForeignKey('campaign_types.id', ondelete='CASCADE'), nullable=False),
        sa.Column('form_schema', JSONB, nullable=True),
        sa.Column('audience_spec', JSONB, nullable=True),
        sa.Column('default_creative_pattern', JSONB, nullable=True),
        sa.Column('is_built_in', sa.Boolean, server_default='false'),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_campaign_templates_tenant_id', 'campaign_templates', ['tenant_id'])

    # 5. submissions
    op.create_table(
        'submissions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('campaign_id', sa.String(36), sa.ForeignKey('campaigns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('campaign_type_snapshot', sa.String(100), nullable=True),
        sa.Column('tag_group_id_snapshot', sa.String(36), nullable=True),
        sa.Column('tags_snapshot', JSONB, nullable=True),
        sa.Column('source_channel', sa.String(50), server_default='instagram'),
        sa.Column('source_ad_id', sa.String(36), nullable=True),
        sa.Column('source_attribution_code', sa.String(200), nullable=True),
        sa.Column('submitter_handle', sa.String(200), nullable=True),
        sa.Column('responses', JSONB, nullable=True),
        sa.Column('pii_field_names', JSONB, nullable=True),
        sa.Column('attachments', JSONB, nullable=True),
        sa.Column('common_name', sa.String(500), nullable=True),
        sa.Column('common_phone', sa.String(50), nullable=True),
        sa.Column('common_email', sa.String(200), nullable=True),
        sa.Column('common_city', sa.String(200), nullable=True),
        sa.Column('common_pincode', sa.String(20), nullable=True),
        sa.Column('common_country', sa.String(2), nullable=True),
        sa.Column('score', sa.Integer, server_default='0'),
        sa.Column('score_breakdown', JSONB, nullable=True),
        sa.Column('stage', sa.String(100), server_default='new'),
        sa.Column('stage_entered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('assigned_to_user_id', sa.String(36), nullable=True),
        sa.Column('assigned_to_agent_run_id', sa.String(36), nullable=True),
        sa.Column('promoted_to_table', sa.String(100), nullable=True),
        sa.Column('promoted_to_id', sa.String(36), nullable=True),
        sa.Column('promoted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('lost_reason', sa.Text, nullable=True),
        sa.Column('lost_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('retention_class_snapshot', sa.String(50), server_default='standard'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('consent_snapshot', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_submissions_tenant_id', 'submissions', ['tenant_id'])
    op.create_index('ix_submissions_campaign_id', 'submissions', ['campaign_id'])
    op.create_index('ix_submissions_common_phone', 'submissions', ['common_phone'])
    op.create_index('ix_submissions_common_email', 'submissions', ['common_email'])
    op.create_index('ix_submissions_stage', 'submissions', ['stage'])
    op.create_index('ix_submissions_expires_at', 'submissions', ['expires_at'])
    op.create_index('ix_submissions_created_at', 'submissions', ['created_at'])
    op.create_index('ix_submissions_tenant_campaign_created', 'submissions', ['tenant_id', 'campaign_id', 'created_at'])
    op.create_index('ix_submissions_tags_snapshot_gin', 'submissions', ['tags_snapshot'], postgresql_using='gin')

    # 6. submission_events (append-only audit log)
    op.create_table(
        'submission_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('submission_id', sa.String(36), sa.ForeignKey('submissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('kind', sa.String(100), nullable=False),
        sa.Column('payload', JSONB, nullable=True),
        sa.Column('actor_id', sa.String(36), nullable=True),
        sa.Column('actor_type', sa.String(50), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_submission_events_submission_id', 'submission_events', ['submission_id'])

    # 7. submission_attachments_vault
    op.create_table(
        'submission_attachments_vault',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('submission_id', sa.String(36), sa.ForeignKey('submissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('field_id', sa.String(100), nullable=True),
        sa.Column('storage_url', sa.Text, nullable=False),
        sa.Column('filename', sa.String(500), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('size_bytes', sa.Integer, nullable=True),
        sa.Column('sensitivity', sa.String(50), server_default='standard'),
        sa.Column('access_log_count', sa.Integer, server_default='0'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_submission_attachments_vault_submission_id', 'submission_attachments_vault', ['submission_id'])


def downgrade() -> None:
    op.drop_table('submission_attachments_vault')
    op.drop_table('submission_events')
    op.drop_index('ix_submissions_tags_snapshot_gin', table_name='submissions')
    op.drop_index('ix_submissions_tenant_campaign_created', table_name='submissions')
    op.drop_index('ix_submissions_created_at', table_name='submissions')
    op.drop_index('ix_submissions_expires_at', table_name='submissions')
    op.drop_index('ix_submissions_stage', table_name='submissions')
    op.drop_index('ix_submissions_common_email', table_name='submissions')
    op.drop_index('ix_submissions_common_phone', table_name='submissions')
    op.drop_index('ix_submissions_campaign_id', table_name='submissions')
    op.drop_index('ix_submissions_tenant_id', table_name='submissions')
    op.drop_table('submissions')
    op.drop_table('campaign_templates')
    op.drop_index('ix_campaigns_tags_gin', table_name='campaigns')
    op.drop_index('ix_campaigns_tenant_status_type', table_name='campaigns')
    op.drop_index('ix_campaigns_status', table_name='campaigns')
    op.drop_index('ix_campaigns_tenant_id', table_name='campaigns')
    op.drop_table('campaigns')
    op.drop_index('ix_campaign_tag_groups_tenant_id', table_name='campaign_tag_groups')
    op.drop_table('campaign_tag_groups')
    op.drop_table('campaign_types')
