"""add training module audio fields

Revision ID: d1f2e3b4a5c6
Revises: c9e2f1a3b845
Create Date: 2026-05-09

"""
from alembic import op
import sqlalchemy as sa


revision = 'd1f2e3b4a5c6'
down_revision = 'c9e2f1a3b845'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('training_modules', sa.Column('audio_script', sa.Text(), nullable=True))
    op.add_column('training_modules', sa.Column('audio_url', sa.String(500), nullable=True))
    op.add_column('training_modules', sa.Column('audio_approved', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('training_modules', 'audio_script')
    op.drop_column('training_modules', 'audio_url')
    op.drop_column('training_modules', 'audio_approved')
