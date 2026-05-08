"""add pickup_pin to restaurant_orders

Revision ID: ac827c5dcd11
Revises: 2090b911866a
Create Date: 2026-05-08 02:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'ac827c5dcd11'
down_revision: Union[str, Sequence[str], None] = '2090b911866a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('restaurant_orders',
        sa.Column('pickup_pin', sa.String(6), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('restaurant_orders', 'pickup_pin')
