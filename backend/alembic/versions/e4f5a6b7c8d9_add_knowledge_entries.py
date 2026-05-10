"""add knowledge entries

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-05-10 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e4f5a6b7c8d9'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'knowledge_entries',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=True),
        sa.Column('category', sa.String(50), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_knowledge_entries_company_id', 'knowledge_entries', ['company_id'])
    op.create_index('ix_knowledge_entries_outlet_id', 'knowledge_entries', ['outlet_id'])


def downgrade():
    op.drop_index('ix_knowledge_entries_outlet_id', table_name='knowledge_entries')
    op.drop_index('ix_knowledge_entries_company_id', table_name='knowledge_entries')
    op.drop_table('knowledge_entries')
