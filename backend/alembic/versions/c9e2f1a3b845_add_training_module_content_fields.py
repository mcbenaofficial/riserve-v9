"""add training module content and completion score fields

Revision ID: c9e2f1a3b845
Revises: b3f1e9a2d704
Create Date: 2026-05-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision = 'c9e2f1a3b845'
down_revision = 'b3f1e9a2d704'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('training_modules', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('training_modules', sa.Column('content', sa.Text(), nullable=True))
    op.add_column('training_modules', sa.Column('study_guide', sa.Text(), nullable=True))
    op.add_column('training_modules', sa.Column('flashcards', JSONB(), nullable=True))
    op.add_column('training_modules', sa.Column('quiz', JSONB(), nullable=True))
    op.add_column('training_modules', sa.Column('ai_generated', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('training_completions', sa.Column('score', sa.Integer(), nullable=True))
    op.add_column('training_completions', sa.Column('quiz_answers', JSONB(), nullable=True))


def downgrade():
    op.drop_column('training_modules', 'description')
    op.drop_column('training_modules', 'content')
    op.drop_column('training_modules', 'study_guide')
    op.drop_column('training_modules', 'flashcards')
    op.drop_column('training_modules', 'quiz')
    op.drop_column('training_modules', 'ai_generated')
    op.drop_column('training_completions', 'score')
    op.drop_column('training_completions', 'quiz_answers')
