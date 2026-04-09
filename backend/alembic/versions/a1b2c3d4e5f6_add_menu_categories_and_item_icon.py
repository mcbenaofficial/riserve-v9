"""add_menu_categories_and_item_icon

Revision ID: a1b2c3d4e5f6
Revises: f6828b89831a
Create Date: 2026-04-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f6828b89831a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create menu_categories table
    op.create_table(
        'menu_categories',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('icon', sa.Text(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_menu_categories_company_id', 'menu_categories', ['company_id'])

    # Add icon column to menu_items
    op.add_column('menu_items', sa.Column('icon', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('menu_items', 'icon')
    op.drop_index('ix_menu_categories_company_id', table_name='menu_categories')
    op.drop_table('menu_categories')
