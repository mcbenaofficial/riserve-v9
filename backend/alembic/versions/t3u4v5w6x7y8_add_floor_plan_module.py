"""add floor plan module tables

Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-05-17

Adds 7 tables for the Restaurant Floor Plan module:
floor_zones, floor_tables, floor_table_logs, floor_sessions,
floor_servers, floor_reservations, floor_events.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 't3u4v5w6x7y8'
down_revision = 's2t3u4v5w6x7'
branch_labels = None
depends_on = None


def upgrade():
    # ------------------------------------------------------------------
    # floor_zones
    # ------------------------------------------------------------------
    op.create_table(
        'floor_zones',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('color', sa.String(20), nullable=True, server_default='#6366f1'),
        sa.Column('layout_meta', JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_floor_zones_company_id', 'floor_zones', ['company_id'])
    op.create_index('ix_floor_zones_outlet_id', 'floor_zones', ['outlet_id'])

    # ------------------------------------------------------------------
    # floor_tables
    # ------------------------------------------------------------------
    op.create_table(
        'floor_tables',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=False),
        sa.Column('zone_id', sa.String(), nullable=True),
        sa.Column('label', sa.String(20), nullable=False),
        sa.Column('seats_default', sa.Integer(), nullable=True, server_default='2'),
        sa.Column('seats_max', sa.Integer(), nullable=True, server_default='2'),
        sa.Column('shape', sa.String(20), nullable=True, server_default='rect'),
        sa.Column('x_pct', sa.Numeric(6, 3), nullable=True, server_default='0'),
        sa.Column('y_pct', sa.Numeric(6, 3), nullable=True, server_default='0'),
        sa.Column('w_pct', sa.Numeric(6, 3), nullable=True, server_default='10'),
        sa.Column('h_pct', sa.Numeric(6, 3), nullable=True, server_default='10'),
        sa.Column('rotation_deg', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_combinable', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('combine_group', sa.String(50), nullable=True),
        sa.Column('status', sa.String(30), nullable=True, server_default='available'),
        sa.Column('status_since', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_session_id', sa.String(), nullable=True),
        sa.Column('assigned_server_id', sa.String(), nullable=True),
        sa.Column('qr_token', sa.String(), nullable=True, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['zone_id'], ['floor_zones.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_floor_tables_company_id', 'floor_tables', ['company_id'])
    op.create_index('ix_floor_tables_outlet_id', 'floor_tables', ['outlet_id'])
    op.create_index('ix_floor_tables_company_outlet_status', 'floor_tables', ['company_id', 'outlet_id', 'status'])

    # ------------------------------------------------------------------
    # floor_table_logs
    # ------------------------------------------------------------------
    op.create_table(
        'floor_table_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('table_id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('from_status', sa.String(30), nullable=True),
        sa.Column('to_status', sa.String(30), nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('server_id', sa.String(), nullable=True),
        sa.Column('changed_by_user_id', sa.String(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_prev_ms', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(20), nullable=True, server_default='manual'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['table_id'], ['floor_tables.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_floor_table_logs_table_id', 'floor_table_logs', ['table_id'])
    op.create_index('ix_floor_table_logs_company_id', 'floor_table_logs', ['company_id'])

    # ------------------------------------------------------------------
    # floor_sessions
    # ------------------------------------------------------------------
    op.create_table(
        'floor_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('table_id', sa.String(), nullable=False),
        sa.Column('reservation_id', sa.String(), nullable=True),
        sa.Column('guest_id', sa.String(), nullable=True),
        sa.Column('party_size', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('seated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expected_settle_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_settle_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('phase', sa.String(20), nullable=True, server_default='seated'),
        sa.Column('merged_table_ids', JSONB(), nullable=True),
        sa.Column('pos_ticket_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['table_id'], ['floor_tables.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_floor_sessions_company_id', 'floor_sessions', ['company_id'])
    op.create_index('ix_floor_sessions_table_id', 'floor_sessions', ['table_id'])

    # ------------------------------------------------------------------
    # floor_servers
    # ------------------------------------------------------------------
    op.create_table(
        'floor_servers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=False),
        sa.Column('staff_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(20), nullable=True),
        sa.Column('active_sections', JSONB(), nullable=True),
        sa.Column('shift_start', sa.DateTime(timezone=True), nullable=True),
        sa.Column('shift_end', sa.DateTime(timezone=True), nullable=True),
        sa.Column('current_load_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_floor_servers_company_id', 'floor_servers', ['company_id'])
    op.create_index('ix_floor_servers_outlet_id', 'floor_servers', ['outlet_id'])

    # ------------------------------------------------------------------
    # floor_reservations
    # ------------------------------------------------------------------
    op.create_table(
        'floor_reservations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=False),
        sa.Column('guest_id', sa.String(), nullable=True),
        sa.Column('channel', sa.String(30), nullable=True, server_default='direct'),
        sa.Column('party_size', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('guest_name', sa.String(100), nullable=True),
        sa.Column('guest_phone', sa.String(30), nullable=True),
        sa.Column('requested_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('arrival_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expected_duration_min', sa.Integer(), nullable=True, server_default='90'),
        sa.Column('table_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(30), nullable=True, server_default='confirmed'),
        sa.Column('occasion', sa.String(50), nullable=True),
        sa.Column('special_requests', sa.Text(), nullable=True),
        sa.Column('source_meta', JSONB(), nullable=True),
        sa.Column('no_show_risk_score', sa.Numeric(5, 4), nullable=True),
        sa.Column('no_show_risk_factors', JSONB(), nullable=True),
        sa.Column('wa_lifecycle_stage', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('magic_link_token', sa.String(), nullable=True, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['table_id'], ['floor_tables.id'], ondelete='SET NULL'),
    )
    op.create_index('ix_floor_reservations_company_id', 'floor_reservations', ['company_id'])
    op.create_index('ix_floor_reservations_outlet_id', 'floor_reservations', ['outlet_id'])

    # ------------------------------------------------------------------
    # floor_events
    # ------------------------------------------------------------------
    op.create_table(
        'floor_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('event_type', sa.String(60), nullable=False),
        sa.Column('actor_type', sa.String(20), nullable=True),
        sa.Column('actor_id', sa.String(), nullable=True),
        sa.Column('payload', JSONB(), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_floor_events_company_id', 'floor_events', ['company_id'])
    op.create_index('ix_floor_events_company_occurred', 'floor_events', ['company_id', 'occurred_at'])


def downgrade():
    op.drop_index('ix_floor_events_company_occurred', table_name='floor_events')
    op.drop_index('ix_floor_events_company_id', table_name='floor_events')
    op.drop_table('floor_events')

    op.drop_index('ix_floor_reservations_outlet_id', table_name='floor_reservations')
    op.drop_index('ix_floor_reservations_company_id', table_name='floor_reservations')
    op.drop_table('floor_reservations')

    op.drop_index('ix_floor_servers_outlet_id', table_name='floor_servers')
    op.drop_index('ix_floor_servers_company_id', table_name='floor_servers')
    op.drop_table('floor_servers')

    op.drop_index('ix_floor_sessions_table_id', table_name='floor_sessions')
    op.drop_index('ix_floor_sessions_company_id', table_name='floor_sessions')
    op.drop_table('floor_sessions')

    op.drop_index('ix_floor_table_logs_company_id', table_name='floor_table_logs')
    op.drop_index('ix_floor_table_logs_table_id', table_name='floor_table_logs')
    op.drop_table('floor_table_logs')

    op.drop_index('ix_floor_tables_company_outlet_status', table_name='floor_tables')
    op.drop_index('ix_floor_tables_outlet_id', table_name='floor_tables')
    op.drop_index('ix_floor_tables_company_id', table_name='floor_tables')
    op.drop_table('floor_tables')

    op.drop_index('ix_floor_zones_outlet_id', table_name='floor_zones')
    op.drop_index('ix_floor_zones_company_id', table_name='floor_zones')
    op.drop_table('floor_zones')
