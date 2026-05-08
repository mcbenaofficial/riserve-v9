"""add is_bestseller and tags to menu_items

Revision ID: b3f1e9a2d704
Revises: ac827c5dcd11
Create Date: 2026-05-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'b3f1e9a2d704'
down_revision = 'ac827c5dcd11'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('menu_items', sa.Column('is_bestseller', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('menu_items', sa.Column('tags', JSONB(), nullable=True, server_default='[]'))


def downgrade():
    op.drop_column('menu_items', 'tags')
    op.drop_column('menu_items', 'is_bestseller')
