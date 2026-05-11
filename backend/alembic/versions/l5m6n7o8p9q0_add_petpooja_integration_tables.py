"""add petpooja integration tables

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-05-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'l5m6n7o8p9q0'
down_revision = 'k4l5m6n7o8p9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'petpooja_configs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=False),
        sa.Column('app_key', sa.String(255), nullable=True),
        sa.Column('app_secret', sa.String(255), nullable=True),
        sa.Column('access_token', sa.String(255), nullable=True),
        sa.Column('pos_restaurant_id', sa.String(255), nullable=True),
        sa.Column('base_url', sa.String(255), nullable=True, server_default='https://api.petpooja.com'),
        sa.Column('sync_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sync_orders', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sync_menu', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('poll_interval_seconds', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('last_order_state_version', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_menu_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_order_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='disconnected'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE', name='fk_petpooja_configs_company'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE', name='fk_petpooja_configs_outlet'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('outlet_id', name='uq_petpooja_configs_outlet'),
    )
    op.create_index('ix_petpooja_configs_company_id', 'petpooja_configs', ['company_id'])

    op.create_table(
        'petpooja_sync_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=False),
        sa.Column('sync_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('items_processed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('items_upserted', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('items_skipped', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE', name='fk_petpooja_sync_logs_company'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE', name='fk_petpooja_sync_logs_outlet'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_petpooja_sync_logs_company_id', 'petpooja_sync_logs', ['company_id'])
    op.create_index('ix_petpooja_sync_logs_outlet_id', 'petpooja_sync_logs', ['outlet_id'])

    op.create_table(
        'petpooja_orders',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=False),
        sa.Column('external_id', sa.String(255), nullable=False),
        sa.Column('state', sa.String(50), nullable=False),
        sa.Column('state_version', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('table_external_id', sa.String(255), nullable=True),
        sa.Column('sub_total', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('tax_total', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('discount_total', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('grand_total', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('source_fingerprint', sa.String(64), nullable=True),
        sa.Column('placed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('raw_payload', JSONB, nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE', name='fk_petpooja_orders_company'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE', name='fk_petpooja_orders_outlet'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('outlet_id', 'external_id', name='uq_petpooja_orders_outlet_external'),
    )
    op.create_index('ix_petpooja_orders_company_id', 'petpooja_orders', ['company_id'])
    op.create_index('ix_petpooja_orders_outlet_id', 'petpooja_orders', ['outlet_id'])
    op.create_index('ix_petpooja_orders_outlet_state', 'petpooja_orders', ['outlet_id', 'state'])

    op.create_table(
        'petpooja_order_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('order_id', sa.String(), nullable=False),
        sa.Column('external_id', sa.String(255), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('line_total', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['petpooja_orders.id'], ondelete='CASCADE', name='fk_petpooja_order_items_order'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_petpooja_order_items_order_id', 'petpooja_order_items', ['order_id'])

    op.create_table(
        'petpooja_menu_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=False),
        sa.Column('external_id', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('category_name', sa.String(255), nullable=True),
        sa.Column('item_type', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('raw_payload', JSONB, nullable=True, server_default='{}'),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE', name='fk_petpooja_menu_items_company'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE', name='fk_petpooja_menu_items_outlet'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('outlet_id', 'external_id', name='uq_petpooja_menu_items_outlet_external'),
    )
    op.create_index('ix_petpooja_menu_items_company_id', 'petpooja_menu_items', ['company_id'])
    op.create_index('ix_petpooja_menu_items_outlet_id', 'petpooja_menu_items', ['outlet_id'])


def downgrade() -> None:
    op.drop_table('petpooja_menu_items')
    op.drop_table('petpooja_order_items')
    op.drop_table('petpooja_orders')
    op.drop_table('petpooja_sync_logs')
    op.drop_table('petpooja_configs')
