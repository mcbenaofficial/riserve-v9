"""add_marketing_conversations_module

Revision ID: d4e5f6a7b8c9
Revises: 657b54f689b6
Create Date: 2026-05-06 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = '657b54f689b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # mkt_inboxes
    op.create_table(
        'mkt_inboxes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('credentials_ref', sa.Text(), nullable=True),
        sa.Column('webhook_secret', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('auto_assignment_rule', sa.String(length=50), nullable=True, server_default='round_robin'),
        sa.Column('business_hours', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('feature_flags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_inboxes_company_id', 'mkt_inboxes', ['company_id'])

    # mkt_customer_identities
    op.create_table(
        'mkt_customer_identities',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('customer_id', sa.String(), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('external_id', sa.String(length=500), nullable=False),
        sa.Column('verified', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'channel', 'external_id',
                            name='uq_mkt_identity_company_channel_external'),
    )
    op.create_index('ix_mkt_customer_identities_company_id', 'mkt_customer_identities', ['company_id'])

    # mkt_consent_ledger
    op.create_table(
        'mkt_consent_ledger',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('customer_id', sa.String(), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('purpose', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.Column('evidence', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_consent_ledger_company_id', 'mkt_consent_ledger', ['company_id'])
    op.create_index('ix_mkt_consent_ledger_customer_id', 'mkt_consent_ledger', ['customer_id'])

    # mkt_conversations
    op.create_table(
        'mkt_conversations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('inbox_id', sa.String(), nullable=False),
        sa.Column('customer_id', sa.String(), nullable=True),
        sa.Column('customer_identity_id', sa.String(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True, server_default='open'),
        sa.Column('assignee_id', sa.String(), nullable=True),
        sa.Column('last_message_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_customer_message_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('unread_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('labels', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('snooze_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inbox_id'], ['mkt_inboxes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['customer_identity_id'], ['mkt_customer_identities.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_conversations_company_id', 'mkt_conversations', ['company_id'])
    op.create_index('ix_mkt_conversations_status', 'mkt_conversations', ['status'])
    op.create_index('ix_mkt_conversations_last_message_at', 'mkt_conversations', ['last_message_at'])

    # mkt_messages
    op.create_table(
        'mkt_messages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('direction', sa.String(length=10), nullable=False),
        sa.Column('sender_type', sa.String(length=20), nullable=False),
        sa.Column('sender_id', sa.String(length=255), nullable=True),
        sa.Column('content_type', sa.String(length=50), nullable=True, server_default='text'),
        sa.Column('content_text', sa.Text(), nullable=True),
        sa.Column('attachments', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('raw', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('channel_message_id', sa.String(length=500), nullable=True),
        sa.Column('delivery_status', sa.String(length=20), nullable=True, server_default='sent'),
        sa.Column('error_code', sa.String(length=100), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['conversation_id'], ['mkt_conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_messages_company_id', 'mkt_messages', ['company_id'])
    op.create_index('ix_mkt_messages_conversation_id', 'mkt_messages', ['conversation_id'])

    # mkt_internal_notes
    op.create_table(
        'mkt_internal_notes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('conversation_id', sa.String(), nullable=False),
        sa.Column('author_id', sa.String(), nullable=True),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('mentions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['conversation_id'], ['mkt_conversations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_internal_notes_conversation_id', 'mkt_internal_notes', ['conversation_id'])

    # mkt_templates
    op.create_table(
        'mkt_templates',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('locale', sa.String(length=20), nullable=True, server_default='en'),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('variables', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('provider_status', sa.String(length=20), nullable=True),
        sa.Column('provider_template_id', sa.String(length=255), nullable=True),
        sa.Column('version', sa.Integer(), nullable=True, server_default='1'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mkt_templates_company_id', 'mkt_templates', ['company_id'])

    # mkt_frequency_cap_configs
    op.create_table(
        'mkt_frequency_cap_configs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('max_per_day', sa.Integer(), nullable=True, server_default='3'),
        sa.Column('max_per_week', sa.Integer(), nullable=True, server_default='10'),
        sa.Column('quiet_hours_start', sa.String(length=5), nullable=True, server_default='22:00'),
        sa.Column('quiet_hours_end', sa.String(length=5), nullable=True, server_default='08:00'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', name='uq_mkt_freq_cap_company'),
    )

    # mkt_message_send_counts
    op.create_table(
        'mkt_message_send_counts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('company_id', sa.String(), nullable=False),
        sa.Column('customer_id', sa.String(), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('count', sa.Integer(), nullable=True, server_default='0'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'customer_id', 'channel', 'date',
                            name='uq_mkt_send_count_day'),
    )

    # mkt_webhook_raw_events
    op.create_table(
        'mkt_webhook_raw_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('channel', sa.String(length=50), nullable=False),
        sa.Column('inbox_id', sa.String(length=255), nullable=True),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('mkt_webhook_raw_events')
    op.drop_table('mkt_message_send_counts')
    op.drop_table('mkt_frequency_cap_configs')
    op.drop_index('ix_mkt_templates_company_id', table_name='mkt_templates')
    op.drop_table('mkt_templates')
    op.drop_index('ix_mkt_internal_notes_conversation_id', table_name='mkt_internal_notes')
    op.drop_table('mkt_internal_notes')
    op.drop_index('ix_mkt_messages_conversation_id', table_name='mkt_messages')
    op.drop_index('ix_mkt_messages_company_id', table_name='mkt_messages')
    op.drop_table('mkt_messages')
    op.drop_index('ix_mkt_conversations_last_message_at', table_name='mkt_conversations')
    op.drop_index('ix_mkt_conversations_status', table_name='mkt_conversations')
    op.drop_index('ix_mkt_conversations_company_id', table_name='mkt_conversations')
    op.drop_table('mkt_conversations')
    op.drop_index('ix_mkt_consent_ledger_customer_id', table_name='mkt_consent_ledger')
    op.drop_index('ix_mkt_consent_ledger_company_id', table_name='mkt_consent_ledger')
    op.drop_table('mkt_consent_ledger')
    op.drop_index('ix_mkt_customer_identities_company_id', table_name='mkt_customer_identities')
    op.drop_table('mkt_customer_identities')
    op.drop_index('ix_mkt_inboxes_company_id', table_name='mkt_inboxes')
    op.drop_table('mkt_inboxes')
