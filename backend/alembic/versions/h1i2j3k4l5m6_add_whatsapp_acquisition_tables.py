"""add whatsapp acquisition tables

Revision ID: h1i2j3k4l5m6
Revises: g5h6i7j8k9l0
Create Date: 2026-05-10 16:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'h1i2j3k4l5m6'
down_revision = 'g5h6i7j8k9l0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'whatsapp_subscribers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=True),
        sa.Column('phone', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=True),
        sa.Column('source', sa.String(50), nullable=False, server_default='organic'),
        sa.Column('tags', JSONB, nullable=True, server_default='[]'),
        sa.Column('opted_in_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('opted_out_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_whatsapp_subscribers_company_id', 'whatsapp_subscribers', ['company_id'])
    op.create_index('ix_whatsapp_subscribers_outlet_id', 'whatsapp_subscribers', ['outlet_id'])

    op.create_table(
        'whatsapp_campaigns',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('template_name', sa.String(255), nullable=False),
        sa.Column('template_params', JSONB, nullable=True, server_default='[]'),
        sa.Column('segment_tags', JSONB, nullable=True, server_default='[]'),
        sa.Column('status', sa.String(50), nullable=False, server_default='draft'),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('total_recipients', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('sent_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('delivered_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('read_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_whatsapp_campaigns_company_id', 'whatsapp_campaigns', ['company_id'])

    op.create_table(
        'whatsapp_campaign_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('campaign_id', sa.String(), nullable=False),
        sa.Column('subscriber_id', sa.String(), nullable=True),
        sa.Column('phone', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('wa_message_id', sa.String(255), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['campaign_id'], ['whatsapp_campaigns.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['subscriber_id'], ['whatsapp_subscribers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_whatsapp_campaign_messages_campaign_id', 'whatsapp_campaign_messages', ['campaign_id'])
    op.create_index('ix_whatsapp_campaign_messages_subscriber_id', 'whatsapp_campaign_messages', ['subscriber_id'])


def downgrade():
    op.drop_table('whatsapp_campaign_messages')
    op.drop_table('whatsapp_campaigns')
    op.drop_table('whatsapp_subscribers')
