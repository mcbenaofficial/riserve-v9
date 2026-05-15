"""add membership constraints: slug uniqueness and transaction customer FK

Revision ID: p9q0r1s2t3u4
Revises: o8p9q0r1s2t3
Create Date: 2026-05-15 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'p9q0r1s2t3u4'
down_revision = 'o8p9q0r1s2t3'
branch_labels = None
depends_on = None


def upgrade():
    # Unique constraint on (company_id, slug) for membership_plans
    op.create_index(
        'uq_membership_plans_company_slug',
        'membership_plans',
        ['company_id', 'slug'],
        unique=True,
    )

    # FK from membership_transactions.customer_id -> customers.id
    op.create_foreign_key(
        'fk_membership_transactions_customer_id',
        'membership_transactions',
        'customers',
        ['customer_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade():
    op.drop_constraint('fk_membership_transactions_customer_id', 'membership_transactions', type_='foreignkey')
    op.drop_index('uq_membership_plans_company_slug', table_name='membership_plans')
