"""add geo tables

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-05-10 04:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'geo_queries',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('query_text', sa.Text(), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_geo_queries_company_id', 'geo_queries', ['company_id'])

    op.create_table(
        'geo_checks',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('query_id', sa.String(), nullable=False),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('simulated_response', sa.Text(), nullable=True),
        sa.Column('cited', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('citation_excerpt', sa.Text(), nullable=True),
        sa.Column('competitors_cited', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['query_id'], ['geo_queries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_geo_checks_company_id', 'geo_checks', ['company_id'])
    op.create_index('ix_geo_checks_query_id', 'geo_checks', ['query_id'])


def downgrade():
    op.drop_index('ix_geo_checks_query_id', table_name='geo_checks')
    op.drop_index('ix_geo_checks_company_id', table_name='geo_checks')
    op.drop_table('geo_checks')
    op.drop_index('ix_geo_queries_company_id', table_name='geo_queries')
    op.drop_table('geo_queries')
