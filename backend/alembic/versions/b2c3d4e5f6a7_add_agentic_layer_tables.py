"""add_agentic_layer_tables

Revision ID: b2c3d4e5f6a7
Revises: 4b146c078362
Create Date: 2026-05-06 12:00:00.000000

"""
from __future__ import annotations
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = '4b146c078362'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        'knowledge_sources',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('source_ref', sa.Text(), nullable=True),
        sa.Column('status', sa.String(50), nullable=True, server_default='pending'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'knowledge_chunks',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('source_id', sa.String(36), nullable=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['source_id'], ['knowledge_sources.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_knowledge_chunk_source_tenant_content "
        "ON knowledge_chunks (source_id, tenant_id, md5(content))"
    )

    op.create_table(
        'brand_voice_profiles',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('tone', sa.String(100), nullable=True, server_default='warm'),
        sa.Column('do_phrases', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('dont_phrases', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('required_disclosures', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('example_messages', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', name='uq_brand_voice_tenant'),
    )

    op.create_table(
        'agents',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('agent_name', sa.String(100), nullable=False),
        sa.Column('version', sa.String(50), nullable=True, server_default='v1'),
        sa.Column('system_prompt_id', sa.String(200), nullable=True),
        sa.Column('model', sa.String(200), nullable=True),
        sa.Column('allowed_tools', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='[]'),
        sa.Column('autonomy_level', sa.String(10), nullable=True, server_default='L1'),
        sa.Column('confidence_threshold', sa.Float(), nullable=True, server_default='0.75'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'agent_runs',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('agent_id', sa.String(36), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('trigger_type', sa.String(100), nullable=True),
        sa.Column('trigger_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('conversation_id', sa.String(36), nullable=True),
        sa.Column('campaign_id', sa.String(36), nullable=True),
        sa.Column('total_tokens_in', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total_tokens_out', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('total_cost_usd', sa.Numeric(10, 6), nullable=True, server_default='0'),
        sa.Column('final_state', sa.String(50), nullable=True, server_default='running'),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('escalation_reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['conversation_id'], ['mkt_conversations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'agent_steps',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('agent_run_id', sa.String(36), nullable=False),
        sa.Column('step_index', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(50), nullable=False),
        sa.Column('input', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('output', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['agent_run_id'], ['agent_runs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'tool_call_log',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('agent_run_id', sa.String(36), nullable=True),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('tool_name', sa.String(200), nullable=False),
        sa.Column('scopes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('input', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('output', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('idempotency_key', sa.String(200), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['agent_run_id'], ['agent_runs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'prompts',
        sa.Column('id', sa.String(200), nullable=False),
        sa.Column('agent_name', sa.String(100), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('evaluation_score', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'eval_runs',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('prompt_id', sa.String(200), nullable=True),
        sa.Column('dataset_id', sa.String(200), nullable=True),
        sa.Column('score', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('regressions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('run_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['prompt_id'], ['prompts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'policy_violations',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('agent_run_id', sa.String(36), nullable=True),
        sa.Column('kind', sa.String(100), nullable=True),
        sa.Column('severity', sa.String(50), nullable=True),
        sa.Column('blocked', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['agent_run_id'], ['agent_runs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'escalations',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('conversation_id', sa.String(36), nullable=True),
        sa.Column('agent_run_id', sa.String(36), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('human_resolved_by', sa.String(36), nullable=True),
        sa.Column('post_mortem', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['mkt_conversations.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['agent_run_id'], ['agent_runs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'agent_cost_daily',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('tenant_id', sa.String(36), nullable=False),
        sa.Column('agent_name', sa.String(100), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('tokens_in', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('tokens_out', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('cost_usd', sa.Numeric(10, 6), nullable=True, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'agent_name', 'date', name='uq_agent_cost_daily'),
    )

    try:
        op.add_column(
            'mkt_conversations',
            sa.Column('ai_handling_state', sa.String(50), nullable=True),
        )
    except Exception:
        pass

    try:
        op.add_column(
            'mkt_messages',
            sa.Column('ai_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        )
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_column('mkt_messages', 'ai_metadata')
    except Exception:
        pass
    try:
        op.drop_column('mkt_conversations', 'ai_handling_state')
    except Exception:
        pass

    op.drop_table('agent_cost_daily')
    op.drop_table('escalations')
    op.drop_table('policy_violations')
    op.drop_table('eval_runs')
    op.drop_table('prompts')
    op.drop_table('tool_call_log')
    op.drop_table('agent_steps')
    op.drop_table('agent_runs')
    op.drop_table('agents')
    op.drop_table('brand_voice_profiles')
    op.drop_table('knowledge_chunks')
    op.drop_table('knowledge_sources')
