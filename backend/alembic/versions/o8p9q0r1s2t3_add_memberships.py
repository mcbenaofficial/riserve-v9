"""add memberships tables

Revision ID: o8p9q0r1s2t3
Revises: n7o8p9q0r1s2
Create Date: 2026-05-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'o8p9q0r1s2t3'
down_revision = 'n7o8p9q0r1s2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'membership_plans',
        sa.Column('id', sa.VARCHAR(), nullable=False),
        sa.Column('company_id', sa.VARCHAR(), nullable=False),
        sa.Column('name', sa.VARCHAR(255), nullable=False),
        sa.Column('slug', sa.VARCHAR(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price_monthly', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.Column('price_yearly', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.Column('currency', sa.VARCHAR(10), nullable=True, server_default='INR'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('true')),
        sa.Column('sort_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('benefits', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('color', sa.VARCHAR(50), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_membership_plans_company_id', 'membership_plans', ['company_id'])

    op.create_table(
        'memberships',
        sa.Column('id', sa.VARCHAR(), nullable=False),
        sa.Column('company_id', sa.VARCHAR(), nullable=False),
        sa.Column('customer_id', sa.VARCHAR(), nullable=False),
        sa.Column('plan_id', sa.VARCHAR(), nullable=True),
        sa.Column('status', sa.VARCHAR(50), nullable=True, server_default='active'),
        sa.Column('enrolled_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('renewal_mode', sa.VARCHAR(20), nullable=True, server_default='manual'),
        sa.Column('cancelled_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('credits_balance', sa.Numeric(10, 2), nullable=True, server_default='0'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['plan_id'], ['membership_plans.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_memberships_company_id', 'memberships', ['company_id'])
    op.create_index('ix_memberships_customer_id', 'memberships', ['customer_id'])
    op.create_index('ix_memberships_status', 'memberships', ['status'])
    op.create_index('ix_memberships_plan_id', 'memberships', ['plan_id'])

    op.create_table(
        'membership_transactions',
        sa.Column('id', sa.VARCHAR(), nullable=False),
        sa.Column('company_id', sa.VARCHAR(), nullable=False),
        sa.Column('membership_id', sa.VARCHAR(), nullable=False),
        sa.Column('customer_id', sa.VARCHAR(), nullable=False),
        sa.Column('transaction_type', sa.VARCHAR(50), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('reference_id', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['membership_id'], ['memberships.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_membership_transactions_company_id', 'membership_transactions', ['company_id'])
    op.create_index('ix_membership_transactions_membership_id', 'membership_transactions', ['membership_id'])
    op.create_index('ix_membership_transactions_customer_id', 'membership_transactions', ['customer_id'])

    op.create_table(
        'membership_events',
        sa.Column('id', sa.VARCHAR(), nullable=False),
        sa.Column('company_id', sa.VARCHAR(), nullable=False),
        sa.Column('membership_id', sa.VARCHAR(), nullable=False),
        sa.Column('event_type', sa.VARCHAR(50), nullable=False),
        sa.Column('event_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_by', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['membership_id'], ['memberships.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_membership_events_company_id', 'membership_events', ['company_id'])
    op.create_index('ix_membership_events_membership_id', 'membership_events', ['membership_id'])


def downgrade():
    op.drop_index('ix_membership_events_membership_id', table_name='membership_events')
    op.drop_index('ix_membership_events_company_id', table_name='membership_events')
    op.drop_table('membership_events')
    op.drop_index('ix_membership_transactions_customer_id', table_name='membership_transactions')
    op.drop_index('ix_membership_transactions_membership_id', table_name='membership_transactions')
    op.drop_index('ix_membership_transactions_company_id', table_name='membership_transactions')
    op.drop_table('membership_transactions')
    op.drop_index('ix_memberships_plan_id', table_name='memberships')
    op.drop_index('ix_memberships_status', table_name='memberships')
    op.drop_index('ix_memberships_customer_id', table_name='memberships')
    op.drop_index('ix_memberships_company_id', table_name='memberships')
    op.drop_table('memberships')
    op.drop_index('ix_membership_plans_company_id', table_name='membership_plans')
    op.drop_table('membership_plans')
