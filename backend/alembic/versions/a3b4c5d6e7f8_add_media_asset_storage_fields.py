"""add media asset storage fields

Revision ID: a3b4c5d6e7f8
Revises: f8a9b0c1d2e3
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'a3b4c5d6e7f8'
down_revision = 'f8a9b0c1d2e3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('media_assets', sa.Column('storage_path', sa.Text(), nullable=True))
    op.add_column('media_assets', sa.Column('storage_backend', sa.String(20), nullable=True, server_default='local'))
    op.add_column('media_assets', sa.Column('file_size', sa.Integer(), nullable=True))
    op.add_column('media_assets', sa.Column('mime_type', sa.String(100), nullable=True))
    op.add_column('media_assets', sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_media_assets_expires_at', 'media_assets', ['expires_at'])


def downgrade():
    op.drop_index('ix_media_assets_expires_at', 'media_assets')
    op.drop_column('media_assets', 'expires_at')
    op.drop_column('media_assets', 'mime_type')
    op.drop_column('media_assets', 'file_size')
    op.drop_column('media_assets', 'storage_backend')
    op.drop_column('media_assets', 'storage_path')
