"""add_marketing_phase2

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-05-06 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # mkt_segments
    op.create_table(
        'mkt_segments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('rules', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('estimated_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_segments_company_id', 'mkt_segments', ['company_id'])

    # mkt_campaigns
    op.create_table(
        'mkt_campaigns',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('segment_id', sa.String(), nullable=True),
        sa.Column('inbox_id', sa.String(), nullable=True),
        sa.Column('template_id', sa.String(), nullable=True),
        sa.Column('content_type', sa.String(length=20), nullable=True, server_default='freeform'),
        sa.Column('content', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, server_default='draft'),
        sa.Column('stats', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['segment_id'], ['mkt_segments.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['inbox_id'], ['mkt_inboxes.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['template_id'], ['mkt_templates.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_campaigns_company_id', 'mkt_campaigns', ['company_id'])
    op.create_index('ix_mkt_campaigns_status', 'mkt_campaigns', ['status'])

    # mkt_campaign_recipients
    op.create_table(
        'mkt_campaign_recipients',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('campaign_id', sa.String(), nullable=False),
        sa.Column('customer_id', sa.String(), nullable=False),
        sa.Column('identity_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, server_default='pending'),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['campaign_id'], ['mkt_campaigns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['identity_id'], ['mkt_customer_identities.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_campaign_recipients_campaign_id', 'mkt_campaign_recipients', ['campaign_id'])

    # mkt_journeys
    op.create_table(
        'mkt_journeys',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('trigger_type', sa.String(length=50), nullable=False),
        sa.Column('trigger_config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('dag', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_journeys_company_id', 'mkt_journeys', ['company_id'])

    # mkt_journey_enrollments
    op.create_table(
        'mkt_journey_enrollments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('journey_id', sa.String(), nullable=False),
        sa.Column('customer_id', sa.String(), nullable=False),
        sa.Column('current_node_id', sa.String(length=255), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, server_default='active'),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['journey_id'], ['mkt_journeys.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_journey_enrollments_journey_id', 'mkt_journey_enrollments', ['journey_id'])

    # mkt_journey_step_logs
    op.create_table(
        'mkt_journey_step_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('enrollment_id', sa.String(), nullable=False),
        sa.Column('node_id', sa.String(length=255), nullable=False),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['enrollment_id'], ['mkt_journey_enrollments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_journey_step_logs_enrollment_id', 'mkt_journey_step_logs', ['enrollment_id'])


def downgrade() -> None:
    op.drop_index('ix_mkt_journey_step_logs_enrollment_id', table_name='mkt_journey_step_logs')
    op.drop_table('mkt_journey_step_logs')
    op.drop_index('ix_mkt_journey_enrollments_journey_id', table_name='mkt_journey_enrollments')
    op.drop_table('mkt_journey_enrollments')
    op.drop_index('ix_mkt_journeys_company_id', table_name='mkt_journeys')
    op.drop_table('mkt_journeys')
    op.drop_index('ix_mkt_campaign_recipients_campaign_id', table_name='mkt_campaign_recipients')
    op.drop_table('mkt_campaign_recipients')
    op.drop_index('ix_mkt_campaigns_status', table_name='mkt_campaigns')
    op.drop_index('ix_mkt_campaigns_company_id', table_name='mkt_campaigns')
    op.drop_table('mkt_campaigns')
    op.drop_index('ix_mkt_segments_company_id', table_name='mkt_segments')
    op.drop_table('mkt_segments')
