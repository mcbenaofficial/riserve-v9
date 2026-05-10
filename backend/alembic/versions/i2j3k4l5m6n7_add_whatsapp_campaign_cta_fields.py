"""add whatsapp campaign cta fields

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-05-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('whatsapp_campaigns', sa.Column('cta_button_text', sa.String(255), nullable=True))
    op.add_column('whatsapp_campaigns', sa.Column('cta_button_url', sa.String(500), nullable=True))


def downgrade():
    op.drop_column('whatsapp_campaigns', 'cta_button_url')
    op.drop_column('whatsapp_campaigns', 'cta_button_text')
