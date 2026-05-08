"""add_nutritional_value_to_menu_items

Revision ID: 2090b911866a
Revises: b2c3d4e5f6a7
Create Date: 2026-05-08 00:04:16.429139

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '2090b911866a'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('menu_items', sa.Column('nutritional_value', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('menu_items', 'nutritional_value')
