"""add acquisition module tables

Revision ID: a1b2c3d4e5f6
Revises: d1f2e3b4a5c6
Create Date: 2026-05-10 01:10:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'f8a9b0c1d2e3'
down_revision = 'd1f2e3b4a5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'social_accounts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('external_id', sa.String(200), nullable=False),
        sa.Column('handle', sa.String(200), nullable=True),
        sa.Column('display_name', sa.String(200), nullable=True),
        sa.Column('access_token_ref', sa.Text, nullable=True),
        sa.Column('refresh_token_ref', sa.Text, nullable=True),
        sa.Column('scopes', JSONB, nullable=True),
        sa.Column('connected_by', sa.String(36), nullable=True),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_social_accounts_tenant_id', 'social_accounts', ['tenant_id'])

    op.create_table(
        'media_assets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('kind', sa.String(50), nullable=False),
        sa.Column('storage_url', sa.Text, nullable=False),
        sa.Column('thumbnail_url', sa.Text, nullable=True),
        sa.Column('duration_seconds', sa.Float, nullable=True),
        sa.Column('dimensions', JSONB, nullable=True),
        sa.Column('alt_text', sa.Text, nullable=True),
        sa.Column('tags', JSONB, nullable=True),
        sa.Column('used_in_post_ids', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_media_assets_tenant_id', 'media_assets', ['tenant_id'])

    op.create_table(
        'social_posts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('social_account_id', sa.String(36), sa.ForeignKey('social_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('kind', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), server_default='draft'),
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('caption', sa.Text, nullable=True),
        sa.Column('hashtags', JSONB, nullable=True),
        sa.Column('media_asset_ids', JSONB, nullable=True),
        sa.Column('external_post_id', sa.String(200), nullable=True),
        sa.Column('external_permalink', sa.Text, nullable=True),
        sa.Column('paid_partnership', JSONB, nullable=True),
        sa.Column('publish_error', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_social_posts_tenant_status_scheduled', 'social_posts', ['tenant_id', 'status', 'scheduled_for'])

    op.create_table(
        'post_metrics',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('social_post_id', sa.String(36), sa.ForeignKey('social_posts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('captured_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('impressions', sa.Integer, server_default='0'),
        sa.Column('reach', sa.Integer, server_default='0'),
        sa.Column('likes', sa.Integer, server_default='0'),
        sa.Column('comments', sa.Integer, server_default='0'),
        sa.Column('saves', sa.Integer, server_default='0'),
        sa.Column('shares', sa.Integer, server_default='0'),
        sa.Column('video_views', sa.Integer, server_default='0'),
        sa.Column('video_completion_rate', sa.Float, nullable=True),
        sa.Column('profile_visits', sa.Integer, server_default='0'),
        sa.Column('follows_attributed', sa.Integer, server_default='0'),
    )

    op.create_table(
        'lead_flows',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('version', sa.Integer, server_default='1'),
        sa.Column('graph', JSONB, nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('lead_magnet', JSONB, nullable=True),
        sa.Column('qualification_threshold', sa.Integer, server_default='50'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lead_flows_tenant_id', 'lead_flows', ['tenant_id'])

    op.create_table(
        'lead_triggers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('source_post_id', sa.String(36), nullable=True),
        sa.Column('trigger_type', sa.String(100), nullable=False),
        sa.Column('match_rules', JSONB, nullable=True),
        sa.Column('flow_id', sa.String(36), sa.ForeignKey('lead_flows.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('daily_cap', sa.Integer, nullable=True),
        sa.Column('hourly_cap', sa.Integer, nullable=True),
        sa.Column('applies_to', sa.String(50), server_default='all_posts'),
        sa.Column('specific_post_ids', JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lead_triggers_tenant_id', 'lead_triggers', ['tenant_id'])

    op.create_table(
        'leads',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('source_platform', sa.String(50), server_default='instagram'),
        sa.Column('source_account_id', sa.String(36), sa.ForeignKey('social_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('source_handle', sa.String(200), nullable=True),
        sa.Column('source_external_user_id', sa.String(200), nullable=True),
        sa.Column('source_post_id', sa.String(36), nullable=True),
        sa.Column('source_trigger_id', sa.String(36), sa.ForeignKey('lead_triggers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('captured_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('status', sa.String(50), server_default='new'),
        sa.Column('score', sa.Integer, server_default='0'),
        sa.Column('score_breakdown', JSONB, nullable=True),
        sa.Column('current_flow_id', sa.String(36), sa.ForeignKey('lead_flows.id', ondelete='SET NULL'), nullable=True),
        sa.Column('current_node_id', sa.String(200), nullable=True),
        sa.Column('flow_state', JSONB, nullable=True),
        sa.Column('owner_type', sa.String(50), server_default='bot'),
        sa.Column('owner_id', sa.String(36), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('attributes', JSONB, nullable=True),
        sa.Column('captured_phone', sa.String(50), nullable=True),
        sa.Column('captured_email', sa.String(200), nullable=True),
        sa.Column('captured_name', sa.String(200), nullable=True),
        sa.Column('phone_verified', sa.Boolean, server_default='false'),
        sa.Column('email_verified', sa.Boolean, server_default='false'),
        sa.Column('promoted_to_customer_id', sa.String(36), sa.ForeignKey('customers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('promoted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('conversation_id', sa.String(36), sa.ForeignKey('mkt_conversations.id', ondelete='SET NULL'), nullable=True),
    )
    op.create_index('ix_leads_tenant_id', 'leads', ['tenant_id'])
    op.create_index('ix_leads_status', 'leads', ['tenant_id', 'status'])

    op.create_table(
        'lead_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('lead_id', sa.String(36), sa.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('kind', sa.String(100), nullable=False),
        sa.Column('payload', JSONB, nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lead_events_lead_id', 'lead_events', ['lead_id'])

    op.create_table(
        'lead_qualification_rules',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('rule', JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_lead_qualification_rules_tenant_id', 'lead_qualification_rules', ['tenant_id'])

    op.create_table(
        'attribution_links',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False, unique=True),
        sa.Column('target_url', sa.Text, nullable=False),
        sa.Column('source_post_id', sa.String(36), nullable=True),
        sa.Column('source_lead_flow_id', sa.String(36), sa.ForeignKey('lead_flows.id', ondelete='SET NULL'), nullable=True),
        sa.Column('total_clicks', sa.Integer, server_default='0'),
        sa.Column('unique_clicks', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_attribution_links_tenant_id', 'attribution_links', ['tenant_id'])
    op.create_index('ix_attribution_links_slug', 'attribution_links', ['slug'])


def downgrade() -> None:
    op.drop_table('attribution_links')
    op.drop_table('lead_qualification_rules')
    op.drop_table('lead_events')
    op.drop_table('leads')
    op.drop_table('lead_triggers')
    op.drop_table('lead_flows')
    op.drop_table('post_metrics')
    op.drop_table('social_posts')
    op.drop_table('media_assets')
    op.drop_table('social_accounts')
