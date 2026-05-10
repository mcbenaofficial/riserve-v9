"""add visibility tables

Revision ID: c2d3e4f5a6b7
Revises: a3b4c5d6e7f8
Create Date: 2026-05-10 04:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'c2d3e4f5a6b7'
down_revision = 'a3b4c5d6e7f8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'reviews',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=True),
        sa.Column('source', sa.String(50), nullable=True, server_default='manual'),
        sa.Column('source_review_id', sa.String(255), nullable=True),
        sa.Column('author_name', sa.String(255), nullable=True),
        sa.Column('author_avatar_url', sa.String(500), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('reply_content', sa.Text(), nullable=True),
        sa.Column('reply_status', sa.String(50), nullable=True, server_default='none'),
        sa.Column('ai_draft', sa.Text(), nullable=True),
        sa.Column('sentiment', sa.String(20), nullable=True),
        sa.Column('topics', postgresql.JSONB(), nullable=True, server_default='[]'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_reviews_company_id', 'reviews', ['company_id'])
    op.create_index('ix_reviews_outlet_id', 'reviews', ['outlet_id'])

    op.create_table(
        'listing_profiles',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('outlet_id', sa.String(), nullable=True),
        sa.Column('platform', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), nullable=True, server_default='not_connected'),
        sa.Column('listing_url', sa.String(500), nullable=True),
        sa.Column('external_id', sa.String(255), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('meta', postgresql.JSONB(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['outlet_id'], ['outlets.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_listing_profiles_company_id', 'listing_profiles', ['company_id'])
    op.create_index('ix_listing_profiles_outlet_id', 'listing_profiles', ['outlet_id'])


def downgrade():
    op.drop_index('ix_listing_profiles_outlet_id', table_name='listing_profiles')
    op.drop_index('ix_listing_profiles_company_id', table_name='listing_profiles')
    op.drop_table('listing_profiles')
    op.drop_index('ix_reviews_outlet_id', table_name='reviews')
    op.drop_index('ix_reviews_company_id', table_name='reviews')
    op.drop_table('reviews')
