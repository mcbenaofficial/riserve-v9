"""invoice_order_trigger_and_branding

Revision ID: c3d4e5f6a7b8
Revises: b9c8d7e6f5a4
Create Date: 2026-04-24 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b9c8d7e6f5a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('invoice_settings',
        sa.Column('auto_generate_from_order', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('invoice_settings',
        sa.Column('brand_color', sa.String(20), nullable=True, server_default='#5FA8D3'))
    op.add_column('invoices',
        sa.Column('order_id', sa.String(), nullable=True))
    op.create_foreign_key(
        'fk_invoices_order_id', 'invoices', 'restaurant_orders',
        ['order_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_invoices_order_id', 'invoices', type_='foreignkey')
    op.drop_column('invoices', 'order_id')
    op.drop_column('invoice_settings', 'brand_color')
    op.drop_column('invoice_settings', 'auto_generate_from_order')
