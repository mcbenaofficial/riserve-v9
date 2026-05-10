"""add aggregator tables

Revision ID: g5h6i7j8k9l0
Revises: f8a9b0c1d2e3
Create Date: 2026-05-10 15:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'g5h6i7j8k9l0'
down_revision = 'e4f5a6b7c8d9'
branch_labels = None
depends_on = None


def upgrade():
    # Add aggregator_handles to customers
    op.add_column(
        'customers',
        sa.Column('aggregator_handles', JSONB, nullable=True, server_default='{}')
    )

    # aggregator_connections
    op.create_table(
        'aggregator_connections',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=True),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='manual'),
        sa.Column('api_key', sa.String(500), nullable=True),
        sa.Column('meta', JSONB, nullable=True, server_default='{}'),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('order_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_aggregator_connections_company_id', 'aggregator_connections', ['company_id'])
    op.create_index('ix_aggregator_connections_outlet_id', 'aggregator_connections', ['outlet_id'])

    # aggregator_orders
    op.create_table(
        'aggregator_orders',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=True),
        sa.Column('connection_id', sa.String(), nullable=True),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('external_order_id', sa.String(200), nullable=False),
        sa.Column('external_customer_id', sa.String(200), nullable=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('customer_phone', sa.String(50), nullable=True),
        sa.Column('customer_email', sa.String(255), nullable=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('items', JSONB, nullable=True, server_default='[]'),
        sa.Column('status', sa.String(50), nullable=False, server_default='delivered'),
        sa.Column('ordered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_customer_id', sa.String(), nullable=True),
        sa.Column('resolution_confidence', sa.Numeric(3, 2), nullable=True),
        sa.Column('first_party_bridge_sent', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['connection_id'], ['aggregator_connections.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['resolved_customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_aggregator_orders_company_id', 'aggregator_orders', ['company_id'])
    op.create_index('ix_aggregator_orders_outlet_id', 'aggregator_orders', ['outlet_id'])
    op.create_index('ix_aggregator_orders_connection_id', 'aggregator_orders', ['connection_id'])
    op.create_index('ix_aggregator_orders_platform', 'aggregator_orders', ['platform'])
    op.create_index('ix_aggregator_orders_resolved_customer_id', 'aggregator_orders', ['resolved_customer_id'])


def downgrade():
    op.drop_table('aggregator_orders')
    op.drop_table('aggregator_connections')
    op.drop_column('customers', 'aggregator_handles')
