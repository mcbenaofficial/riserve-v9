"""add virtual team marketplace

Revision ID: q0r1s2t3u4v5
Revises: p9q0r1s2t3u4
Create Date: 2026-05-16

Tables: flows, agent_categories, virtual_agents, company_agent_tiers,
        company_agent_subscriptions, agent_runs
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'q0r1s2t3u4v5'
down_revision = 'p9q0r1s2t3u4'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'flows',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='draft'),
        sa.Column('nodes', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('edges', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('viewport', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_flows_company_id', 'flows', ['company_id'])
    op.create_index('ix_flows_status', 'flows', ['status'])

    op.create_table(
        'agent_categories',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('key', sa.String(20), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('icon_key', sa.String(50), nullable=True),
        sa.Column('accent_color', sa.String(20), nullable=True),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key', name='uq_agent_categories_key'),
    )

    op.create_table(
        'virtual_agents',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('category_id', sa.String(), sa.ForeignKey('agent_categories.id', ondelete='SET NULL'), nullable=True),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=True),
        sa.Column('flow_id', sa.String(), sa.ForeignKey('flows.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('tagline', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('capabilities', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('system_prompt', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('agent_tier', sa.String(20), server_default='basic'),
        sa.Column('tier_required', sa.String(20), server_default='indie'),
        sa.Column('value_metric_type', sa.String(50), nullable=True),
        sa.Column('price_per_1k_tokens', sa.Numeric(10, 6), server_default='0'),
        sa.Column('base_token_estimate', sa.Integer(), server_default='500'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_featured', sa.Boolean(), server_default='false'),
        sa.Column('is_free_eligible', sa.Boolean(), server_default='false'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('accent_color', sa.String(20), nullable=True),
        sa.Column('thumbnail_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', 'company_id', name='uq_virtual_agents_slug_company'),
    )
    op.create_index('ix_virtual_agents_category_id', 'virtual_agents', ['category_id'])
    op.create_index('ix_virtual_agents_company_id', 'virtual_agents', ['company_id'])
    op.create_index('ix_virtual_agents_is_active', 'virtual_agents', ['is_active'])

    op.create_table(
        'company_agent_tiers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tier_key', sa.String(20), nullable=False, server_default='indie'),
        sa.Column('total_agent_limit', sa.Integer(), server_default='3'),
        sa.Column('allows_custom_agents', sa.Boolean(), server_default='false'),
        sa.Column('token_allowance_monthly', sa.Integer(), server_default='500000'),
        sa.Column('token_used_this_cycle', sa.Integer(), server_default='0'),
        sa.Column('billing_cycle_start', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('next_billing_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('price_monthly', sa.Numeric(10, 2), server_default='0'),
        sa.Column('currency', sa.String(10), server_default='INR'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', name='uq_company_agent_tiers_company'),
    )
    op.create_index('ix_company_agent_tiers_company_id', 'company_agent_tiers', ['company_id'])

    op.create_table(
        'company_agent_subscriptions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_id', sa.String(), sa.ForeignKey('virtual_agents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tier_id', sa.String(), sa.ForeignKey('company_agent_tiers.id', ondelete='CASCADE'), nullable=True),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('is_free_pick', sa.Boolean(), server_default='false'),
        sa.Column('subscribed_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'agent_id', name='uq_company_agent_subscriptions'),
    )
    op.create_index('ix_company_agent_subscriptions_company_id', 'company_agent_subscriptions', ['company_id'])
    op.create_index('ix_company_agent_subscriptions_agent_id', 'company_agent_subscriptions', ['agent_id'])
    op.create_index('ix_company_agent_subscriptions_status', 'company_agent_subscriptions', ['status'])

    op.create_table(
        'marketplace_agent_runs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_id', sa.String(), sa.ForeignKey('virtual_agents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('subscription_id', sa.String(), sa.ForeignKey('company_agent_subscriptions.id', ondelete='SET NULL'), nullable=True),
        sa.Column('triggered_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('trigger_type', sa.String(20), server_default='manual'),
        sa.Column('status', sa.String(20), server_default='running'),
        sa.Column('input_payload', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('output_payload', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('tokens_in', sa.Integer(), server_default='0'),
        sa.Column('tokens_out', sa.Integer(), server_default='0'),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('estimated_cost_usd', sa.Numeric(10, 6), server_default='0'),
        sa.Column('value_metric_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_marketplace_agent_runs_company_id', 'marketplace_agent_runs', ['company_id'])
    op.create_index('ix_marketplace_agent_runs_agent_id', 'marketplace_agent_runs', ['agent_id'])
    op.create_index('ix_marketplace_agent_runs_status', 'marketplace_agent_runs', ['status'])
    op.create_index('ix_marketplace_agent_runs_started_at', 'marketplace_agent_runs', ['started_at'])


def downgrade():
    op.drop_table('marketplace_agent_runs')
    op.drop_table('company_agent_subscriptions')
    op.drop_table('company_agent_tiers')
    op.drop_table('virtual_agents')
    op.drop_table('agent_categories')
    op.drop_table('flows')
