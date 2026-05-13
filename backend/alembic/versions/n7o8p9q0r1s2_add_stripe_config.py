"""add stripe_configs table

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-05-12 00:02:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'n7o8p9q0r1s2'
down_revision = 'm6n7o8p9q0r1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'stripe_configs',
        sa.Column('id', sa.VARCHAR(), nullable=False),
        sa.Column('company_id', sa.VARCHAR(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('connect_account_id', sa.VARCHAR(), nullable=True),
        sa.Column('connect_account_status', sa.VARCHAR(), nullable=False, server_default='not_started'),
        sa.Column('connect_details_submitted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('connect_charges_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('connect_payouts_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('platform_fee_pct', sa.Float(), nullable=False, server_default='1.5'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id'),
    )
    op.create_index('ix_stripe_configs_company_id', 'stripe_configs', ['company_id'], unique=True)


def downgrade():
    op.drop_index('ix_stripe_configs_company_id', table_name='stripe_configs')
    op.drop_table('stripe_configs')
