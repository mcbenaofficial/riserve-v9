"""add updated_at to petpooja_menu_items

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-05-12 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'm6n7o8p9q0r1'
down_revision = 'l5m6n7o8p9q0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'petpooja_menu_items',
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column('petpooja_menu_items', 'updated_at')
