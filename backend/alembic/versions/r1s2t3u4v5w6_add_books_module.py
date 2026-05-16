"""add books module

Revision ID: r1s2t3u4v5w6
Revises: q0r1s2t3u4v5
Create Date: 2026-05-16

Tables: books_settings, books_accounts, books_tax_codes, books_journal_entries,
        books_journal_lines, books_account_balances, books_bank_accounts,
        books_budgets, books_bills
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'r1s2t3u4v5w6'
down_revision = 'q0r1s2t3u4v5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'books_settings',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fiscal_year_start_month', sa.Integer(), nullable=True, server_default='4'),
        sa.Column('default_currency', sa.String(10), nullable=True, server_default='INR'),
        sa.Column('gstin', sa.String(50), nullable=True),
        sa.Column('pan', sa.String(20), nullable=True),
        sa.Column('tax_scheme', sa.String(20), nullable=True, server_default='GST'),
        sa.Column('auto_post_bookings', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('auto_post_memberships', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('auto_post_marketplace', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('auto_post_inventory', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', name='uq_books_settings_company'),
    )

    op.create_table(
        'books_accounts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('account_type', sa.String(50), nullable=False),
        sa.Column('account_subtype', sa.String(50), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('parent_id', sa.String(), sa.ForeignKey('books_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('currency', sa.String(10), nullable=True, server_default='INR'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'code', name='uq_books_accounts_company_code'),
    )
    op.create_index('ix_books_accounts_company_type', 'books_accounts', ['company_id', 'account_type'])

    op.create_table(
        'books_tax_codes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('rate', sa.Numeric(6, 3), nullable=True, server_default='0'),
        sa.Column('tax_type', sa.String(20), nullable=True, server_default='gst'),
        sa.Column('component_cgst', sa.Numeric(6, 3), nullable=True, server_default='0'),
        sa.Column('component_sgst', sa.Numeric(6, 3), nullable=True, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('is_system', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'code', name='uq_books_tax_codes_company_code'),
    )

    op.create_table(
        'books_journal_entries',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('entry_number', sa.String(30), nullable=True),
        sa.Column('entry_date', sa.Date(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('source_module', sa.String(50), nullable=True),
        sa.Column('source_id', sa.String(), nullable=True),
        sa.Column('source_type', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='posted'),
        sa.Column('voided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('voided_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('void_reason', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_auto_posted', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_books_journal_entries_company_date', 'books_journal_entries', ['company_id', 'entry_date'])
    op.create_index('ix_books_journal_entries_source', 'books_journal_entries', ['company_id', 'source_module', 'source_id'])
    op.create_index('ix_books_journal_entries_status', 'books_journal_entries', ['company_id', 'status'])

    op.create_table(
        'books_journal_lines',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('entry_id', sa.String(), sa.ForeignKey('books_journal_entries.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_id', sa.String(), sa.ForeignKey('books_accounts.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('debit', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('credit', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tax_code_id', sa.String(), sa.ForeignKey('books_tax_codes.id', ondelete='SET NULL'), nullable=True),
        sa.Column('tax_amount', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('currency', sa.String(10), nullable=True, server_default='INR'),
        sa.Column('line_order', sa.Integer(), nullable=True, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_books_journal_lines_entry', 'books_journal_lines', ['entry_id'])
    op.create_index('ix_books_journal_lines_account', 'books_journal_lines', ['account_id'])
    op.create_index('ix_books_journal_lines_company', 'books_journal_lines', ['company_id'])

    op.create_table(
        'books_account_balances',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_id', sa.String(), sa.ForeignKey('books_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fiscal_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=False),
        sa.Column('opening_balance', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('total_debits', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('total_credits', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('closing_balance', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'account_id', 'fiscal_year', 'period_month',
                            name='uq_books_account_balances'),
    )

    op.create_table(
        'books_bank_accounts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('account_name', sa.String(255), nullable=False),
        sa.Column('account_type', sa.String(20), nullable=True, server_default='bank'),
        sa.Column('bank_name', sa.String(255), nullable=True),
        sa.Column('account_number_last4', sa.String(4), nullable=True),
        sa.Column('ifsc_code', sa.String(20), nullable=True),
        sa.Column('currency', sa.String(10), nullable=True, server_default='INR'),
        sa.Column('opening_balance', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('current_balance', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('is_default', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('books_account_id', sa.String(), sa.ForeignKey('books_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'books_budgets',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('fiscal_year', sa.Integer(), nullable=False),
        sa.Column('period_month', sa.Integer(), nullable=True),
        sa.Column('account_id', sa.String(), sa.ForeignKey('books_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('budgeted_amount', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'fiscal_year', 'period_month', 'account_id',
                            name='uq_books_budgets'),
    )

    op.create_table(
        'books_bills',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
        sa.Column('outlet_id', sa.String(), sa.ForeignKey('outlets.id', ondelete='SET NULL'), nullable=True),
        sa.Column('bill_number', sa.String(50), nullable=True),
        sa.Column('vendor_name', sa.String(255), nullable=False),
        sa.Column('vendor_id', sa.String(), sa.ForeignKey('suppliers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('items', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('subtotal', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('tax_amount', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('total_amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('currency', sa.String(10), nullable=True, server_default='INR'),
        sa.Column('bill_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), nullable=True, server_default='unpaid'),
        sa.Column('paid_amount', sa.Numeric(14, 2), nullable=True, server_default='0'),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('payment_reference', sa.String(255), nullable=True),
        sa.Column('expense_account_id', sa.String(), sa.ForeignKey('books_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('attachment_url', sa.String(500), nullable=True),
        sa.Column('created_by', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('journal_entry_id', sa.String(), sa.ForeignKey('books_journal_entries.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_books_bills_company_status', 'books_bills', ['company_id', 'status'])
    op.create_index('ix_books_bills_company_date', 'books_bills', ['company_id', 'bill_date'])


def downgrade():
    op.drop_table('books_bills')
    op.drop_table('books_budgets')
    op.drop_table('books_bank_accounts')
    op.drop_table('books_account_balances')
    op.drop_table('books_journal_lines')
    op.drop_table('books_journal_entries')
    op.drop_table('books_tax_codes')
    op.drop_table('books_accounts')
    op.drop_table('books_settings')
