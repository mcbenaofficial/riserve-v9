"""add atomic counter columns to books_settings and fix invoice_settings sequence

Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-05-16

Replaces COUNT(*)-based sequence generation with per-company counter columns
that can be incremented atomically via UPDATE ... RETURNING.
"""
from alembic import op
import sqlalchemy as sa

revision = 's2t3u4v5w6x7'
down_revision = 'r1s2t3u4v5w6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('books_settings',
        sa.Column('next_entry_number', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('books_settings',
        sa.Column('next_bill_number', sa.Integer(), nullable=True, server_default='1'))


def downgrade():
    op.drop_column('books_settings', 'next_bill_number')
    op.drop_column('books_settings', 'next_entry_number')
