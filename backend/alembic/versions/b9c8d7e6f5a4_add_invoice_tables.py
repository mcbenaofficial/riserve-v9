"""add_invoice_tables

Revision ID: b9c8d7e6f5a4
Revises: a1b2c3d4e5f6
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'b9c8d7e6f5a4'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'invoice_settings',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('prefix', sa.String(20), nullable=True, server_default='INV'),
        sa.Column('next_number', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('default_payment_terms', sa.String(50), nullable=True, server_default='net_30'),
        sa.Column('tax_name', sa.String(50), nullable=True, server_default='GST'),
        sa.Column('default_tax_rate', sa.Numeric(5, 2), nullable=True, server_default='0'),
        sa.Column('show_tax_breakdown', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('default_notes', sa.Text(), nullable=True),
        sa.Column('default_footer', sa.Text(), nullable=True),
        sa.Column('auto_generate_from_booking', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('auto_send_on_generate', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('email_subject', sa.String(255), nullable=True),
        sa.Column('email_body', sa.Text(), nullable=True),
        sa.Column('invoice_company_name', sa.String(255), nullable=True),
        sa.Column('invoice_company_address', sa.Text(), nullable=True),
        sa.Column('invoice_company_phone', sa.String(50), nullable=True),
        sa.Column('invoice_company_email', sa.String(255), nullable=True),
        sa.Column('invoice_company_website', sa.String(255), nullable=True),
        sa.Column('invoice_company_gstin', sa.String(50), nullable=True),
        sa.Column('currency', sa.String(10), nullable=True, server_default='INR'),
        sa.Column('currency_symbol', sa.String(5), nullable=True, server_default='₹'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id'),
    )

    op.create_table(
        'invoices',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=True),
        sa.Column('booking_id', sa.String(), nullable=True),
        sa.Column('customer_id', sa.String(), nullable=True),
        sa.Column('invoice_number', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=True, server_default='draft'),
        sa.Column('customer_name', sa.String(255), nullable=False),
        sa.Column('customer_email', sa.String(255), nullable=True),
        sa.Column('customer_phone', sa.String(50), nullable=True),
        sa.Column('billing_address', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('items', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('subtotal', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('discount_amount', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('total_amount', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('paid_amount', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('currency', sa.String(10), nullable=True, server_default='INR'),
        sa.Column('currency_symbol', sa.String(5), nullable=True, server_default='₹'),
        sa.Column('issue_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('payment_terms', sa.String(50), nullable=True, server_default='net_30'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('footer', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_invoices_invoice_number', 'invoices', ['invoice_number'])
    op.create_index('ix_invoices_status', 'invoices', ['status'])

    op.create_table(
        'invoice_payments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('invoice_id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('payment_method', sa.String(50), nullable=True, server_default='cash'),
        sa.Column('reference', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('invoice_payments')
    op.drop_index('ix_invoices_status', 'invoices')
    op.drop_index('ix_invoices_invoice_number', 'invoices')
    op.drop_table('invoices')
    op.drop_table('invoice_settings')
