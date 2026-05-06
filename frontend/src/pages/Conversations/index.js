import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import * as api from '../../services/conversationsApi';

// ─── status color helpers ─────────────────────────────────────────────────────
const STATUS_STYLES = {
  open:     'bg-green-500/20 text-green-400 border border-green-500/30',
  pending:  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  resolved: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
  snoozed:  'bg-purple-500/20 text-purple-400 border border-purple-500/30',
};

const CHANNEL_ICON = {
  whatsapp:  '💬',
  instagram: '📸',
  facebook:  '💙',
  telegram:  '✈️',
  email:     '📧',
  sms:       '📱',
};

// Credential fields per channel
const CHANNEL_CRED_FIELDS = {
  whatsapp:  ['phone_number_id', 'waba_id', 'access_token'],
  instagram: ['ig_account_id', 'page_access_token'],
  facebook:  ['page_id', 'page_access_token'],
  telegram:  ['bot_token'],
  email:     ['sendgrid_api_key', 'from_email', 'from_name'],
  sms:       ['account_sid', 'auth_token', 'from_number'],
};

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString();
}

// ─── Inbox Management Drawer ──────────────────────────────────────────────────
function InboxDrawer({ open, onClose }) {
  const [inboxes, setInboxes] = useState([]);
  const [loadingInboxes, setLoadingInboxes] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [creds, setCreds] = useState({});

  const loadInboxes = useCallback(async () => {
    setLoadingInboxes(true);
    try {
      const data = await api.getInboxes();
      setInboxes(data);
    } catch (e) {
      console.error('Failed to load inboxes', e);
    } finally {
      setLoadingInboxes(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadInboxes();
  }, [open, loadInboxes]);

  // Reset credential fields when channel changes
  useEffect(() => {
    setCreds({});
  }, [channel]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setFormError('Name is required'); return; }
    setFormError('');
    setCreating(true);
    try {
      await api.createInbox({
        name: name.trim(),
        channel,
        webhook_secret: webhookSecret.trim() || undefined,
        credentials_ref: JSON.stringify(creds),
      });
      // Reset form
      setName('');
      setChannel('whatsapp');
      setWebhookSecret('');
      setCreds({});
      setShowForm(false);
      await loadInboxes();
    } catch (e) {
      setFormError(e.message || 'Failed to create inbox');
    } finally {
      setCreating(false);
    }
  };

  const credFields = CHANNEL_CRED_FIELDS[channel] || [];

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[480px] z-50 flex flex-col bg-[#0f1117] border-l border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
          <h3 className="text-base font-semibold text-white">Inbox Management</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Existing inboxes */}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Configured Inboxes</p>
            {loadingInboxes && (
              <p className="text-sm text-slate-500">Loading…</p>
            )}
            {!loadingInboxes && inboxes.length === 0 && (
              <p className="text-sm text-slate-500">No inboxes yet. Create your first one below.</p>
            )}
            <div className="space-y-2">
              {inboxes.map((inbox) => (
                <div
                  key={inbox.id}
                  className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{CHANNEL_ICON[inbox.channel] || '💬'}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{inbox.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{inbox.channel}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                      inbox.is_active
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                    }`}
                  >
                    {inbox.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* New Inbox button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2.5 rounded-lg border border-dashed border-white/20 text-slate-400 text-sm hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              + New Inbox
            </button>
          )}

          {/* Creation form */}
          {showForm && (
            <form onSubmit={handleCreate} className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">New Inbox</p>

              {formError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                  {formError}
                </p>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Name <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. WhatsApp Support"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 transition"
                />
              </div>

              {/* Channel */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 transition"
                >
                  {Object.entries(CHANNEL_ICON).map(([ch, icon]) => (
                    <option key={ch} value={ch}>
                      {icon} {ch.charAt(0).toUpperCase() + ch.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Webhook Secret */}
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Webhook Secret</label>
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Verify token / webhook secret"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 transition"
                />
              </div>

              {/* Dynamic Credentials */}
              {credFields.length > 0 && (
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Credentials
                    <span className="text-slate-600 ml-1 font-normal normal-case tracking-normal">({channel})</span>
                  </label>
                  <div className="space-y-2">
                    {credFields.map((field) => (
                      <div key={field}>
                        <label className="block text-[11px] text-slate-500 mb-1">{field}</label>
                        <input
                          type={field.includes('token') || field.includes('secret') || field.includes('key') ? 'password' : 'text'}
                          value={creds[field] || ''}
                          onChange={(e) => setCreds((prev) => ({ ...prev, [field]: e.target.value }))}
                          placeholder={field}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 transition"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition"
                >
                  {creating ? 'Creating…' : 'Create Inbox'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setFormError(''); }}
                  className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 text-sm hover:bg-white/10 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Left pane: conversation list ─────────────────────────────────────────────
function ConversationList({ conversations, activeId, onSelect, statusFilter, onStatusFilter, loading, onOpenInboxes }) {
  return (
    <div className="flex flex-col h-full border-r border-white/10">
      {/* Filter bar */}
      <div className="flex gap-1 p-3 border-b border-white/10 flex-shrink-0">
        {['open', 'pending', 'resolved'].map((s) => (
          <button
            key={s}
            onClick={() => onStatusFilter(s === statusFilter ? null : s)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all ${
              statusFilter === s
                ? 'bg-[var(--accent)] text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={onOpenInboxes}
          title="Manage Inboxes"
          className="ml-auto px-2 py-1 rounded-full text-xs text-slate-400 bg-white/5 hover:bg-white/10 transition whitespace-nowrap"
        >
          ⚙ Inboxes
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-slate-500 text-sm">Loading…</div>
        )}
        {!loading && conversations.length === 0 && (
          <div className="p-6 text-center text-slate-500 text-sm">No conversations</div>
        )}
        {conversations.map((c) => (
          <ConvRow key={c.id} conv={c} active={c.id === activeId} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function ConvRow({ conv, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(conv)}
      className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors hover:bg-white/5 ${
        active ? 'bg-white/10 border-l-2 border-l-[var(--accent)]' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-white truncate max-w-[140px]">
          {conv.customer_name || conv.customer_id?.slice(0, 8) || 'Unknown'}
        </span>
        <span className="text-xs text-slate-500">{timeAgo(conv.last_message_at)}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-slate-400 truncate flex-1">
          {CHANNEL_ICON[conv.channel] || '💬'} {conv.last_message_preview || '…'}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {conv.unread_count > 0 && (
            <span className="bg-[var(--accent)] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {conv.unread_count > 99 ? '99+' : conv.unread_count}
            </span>
          )}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_STYLES[conv.status] || ''}`}>
            {conv.status}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Centre pane: message thread ──────────────────────────────────────────────
function MessageThread({ conversation, messages, onSend, onResolve, onNote, sending, templates, loadingMsgs, typingAgents, onTyping, onApproveDraft, onDismissDraft }) {
  const [text, setText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => { setText(''); setSelectedTemplate(null); }, [conversation?.id]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const handleTextChange = (e) => {
    setText(e.target.value);
    // Debounced typing indicator — fires 300ms after last keystroke
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (onTyping) onTyping();
    }, 300);
  };

  const handleSend = async () => {
    if (!text.trim() && !selectedTemplate) return;
    if (isNote) {
      await onNote(text);
    } else if (selectedTemplate) {
      await onSend({ content_type: 'template', template_name: selectedTemplate.name, template_language: selectedTemplate.locale || 'en', text });
    } else {
      await onSend({ content_type: 'text', text });
    }
    setText('');
    setSelectedTemplate(null);
    setShowTemplates(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <div className="text-4xl mb-3">💬</div>
        <p className="text-sm">Select a conversation to get started</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-white">
            {conversation.customer_name || 'Customer'}
          </p>
          <p className="text-xs text-slate-500">
            {CHANNEL_ICON[conversation.channel] || '💬'} {conversation.channel}
            {conversation.assignee_name && ` · ${conversation.assignee_name}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[conversation.status] || ''}`}>
            {conversation.status}
          </span>
          {conversation.status !== 'resolved' && (
            <button
              onClick={onResolve}
              className="text-xs bg-green-600/20 text-green-400 border border-green-600/30 px-2.5 py-1 rounded-full hover:bg-green-600/30 transition"
            >
              Resolve ✓
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loadingMsgs && <div className="text-center text-slate-500 text-xs py-4">Loading messages…</div>}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onApproveDraft={onApproveDraft} onDismissDraft={onDismissDraft} />
        ))}
        {/* Typing indicator */}
        {typingAgents && typingAgents.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-white/10 text-slate-400 rounded-2xl rounded-bl-sm px-3 py-2 text-xs italic">
              {typingAgents.join(', ')} is typing…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-white/10 p-3 space-y-2">
        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNote(false)}
            className={`text-xs px-2.5 py-1 rounded-full transition ${!isNote ? 'bg-[var(--accent)] text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            Reply
          </button>
          <button
            onClick={() => setIsNote(true)}
            className={`text-xs px-2.5 py-1 rounded-full transition ${isNote ? 'bg-yellow-500/30 text-yellow-400 border border-yellow-500/40' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          >
            🔒 Note
          </button>
          {!isNote && (
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-xs px-2.5 py-1 rounded-full bg-white/5 text-slate-400 hover:bg-white/10 transition ml-auto"
            >
              Templates
            </button>
          )}
        </div>

        {/* Template picker */}
        {showTemplates && templates.length > 0 && (
          <div className="bg-slate-800/80 border border-white/10 rounded-lg max-h-40 overflow-y-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedTemplate(t); setShowTemplates(false); setText(t.body); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 border-b border-white/5 last:border-0"
              >
                <span className="font-medium text-white">{t.name}</span>
                <span className="text-slate-400 ml-2">{t.body?.slice(0, 60)}…</span>
              </button>
            ))}
          </div>
        )}

        {selectedTemplate && (
          <div className="text-xs bg-blue-500/10 border border-blue-500/20 rounded px-3 py-1.5 text-blue-400 flex items-center justify-between">
            <span>Template: <strong>{selectedTemplate.name}</strong></span>
            <button onClick={() => { setSelectedTemplate(null); setText(''); }} className="ml-2 hover:text-white">✕</button>
          </div>
        )}

        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder={isNote ? 'Add a private note… (@mention teammates)' : 'Type a message… (⌘↵ to send)'}
            className={`flex-1 bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 transition ${
              isNote ? 'border-yellow-500/30 focus:ring-yellow-500/50' : 'border-white/10 focus:ring-[var(--accent)]/50'
            }`}
          />
          <button
            onClick={handleSend}
            disabled={sending || (!text.trim() && !selectedTemplate)}
            className="self-end px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-40 hover:opacity-90 transition"
          >
            {sending ? '…' : '↑'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, onApproveDraft, onDismissDraft }) {
  const isOut = message.direction === 'out';
  const isNote = message.is_note;
  const isDraft = isNote && (message.content_text || '').startsWith('[DRAFT] ');
  const draftText = isDraft ? message.content_text.slice(8) : null;

  if (isDraft) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-sm">
          <p className="text-[10px] text-[var(--accent)] mb-1 font-semibold tracking-wide">AI Draft — awaiting approval</p>
          <p className="leading-relaxed whitespace-pre-wrap break-words text-slate-200">{draftText}</p>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => onApproveDraft && onApproveDraft(message, draftText)}
              className="flex-1 px-2 py-1 rounded-lg bg-[var(--accent)] text-white text-[11px] font-medium hover:opacity-90 transition"
            >
              Approve &amp; Send
            </button>
            <button
              onClick={() => onDismissDraft && onDismissDraft(message)}
              className="px-2 py-1 rounded-lg bg-white/10 text-slate-300 text-[11px] hover:bg-white/20 transition"
            >
              Dismiss
            </button>
          </div>
          <span className="text-[10px] opacity-40 mt-1 block text-right">{timeAgo(message.created_at)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
          isNote
            ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-200'
            : isOut
            ? 'bg-[var(--accent)] text-white rounded-br-sm'
            : 'bg-white/10 text-slate-200 rounded-bl-sm'
        }`}
      >
        {isNote && <p className="text-[10px] text-yellow-500 mb-1 font-medium">Internal Note</p>}
        {message.content_type === 'template' && (
          <p className="text-[10px] opacity-60 mb-1">Template message</p>
        )}
        <p className="leading-relaxed whitespace-pre-wrap break-words">{message.content_text || '📎 Attachment'}</p>
        <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] opacity-50">{timeAgo(message.created_at)}</span>
          {isOut && (
            <span className="text-[10px] opacity-60">
              {message.delivery_status === 'read' ? '✓✓' : message.delivery_status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI status badge helpers ──────────────────────────────────────────────────
const AI_STATE_STYLES = {
  ai_handling:    'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  escalated:      'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  human_takeover: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};
const AI_STATE_LABELS = {
  ai_handling:    'AI Handling',
  escalated:      'Escalated',
  human_takeover: 'Human',
};

// ─── Right pane: customer panel ───────────────────────────────────────────────
function CustomerPanel({ conversation, identities, consent, onTakeover }) {
  if (!conversation) return null;
  const aiState = conversation.ai_handling_state;

  return (
    <div className="flex flex-col h-full border-l border-white/10 overflow-y-auto">
      <div className="p-4 border-b border-white/10">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Customer</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[var(--accent)]/30 flex items-center justify-center text-lg">
            {(conversation.customer_name || 'C')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{conversation.customer_name || 'Unknown'}</p>
            <p className="text-xs text-slate-500">{conversation.customer_id?.slice(0, 12)}…</p>
          </div>
        </div>
      </div>

      {/* Channel identities */}
      {identities.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Channels</p>
          <div className="space-y-1.5">
            {identities.map((id) => (
              <div key={id.id} className="flex items-center gap-2 text-xs">
                <span>{CHANNEL_ICON[id.channel] || '💬'}</span>
                <span className="text-slate-300">{id.external_id}</span>
                {id.verified && <span className="text-green-400">✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Consent */}
      {consent.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Consent</p>
          <div className="space-y-1.5">
            {consent.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{c.channel} · {c.purpose}</span>
                <span className={c.status === 'granted' ? 'text-green-400' : 'text-red-400'}>
                  {c.status === 'granted' ? '✓ Opted in' : '✕ Opted out'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Labels */}
      {conversation.labels?.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Labels</p>
          <div className="flex flex-wrap gap-1.5">
            {conversation.labels.map((l) => (
              <span key={l} className="text-xs bg-white/10 text-slate-300 rounded-full px-2 py-0.5">{l}</span>
            ))}
          </div>
        </div>
      )}

      {/* AI Status panel — only shown when agent is active */}
      {aiState && (
        <div className="p-4 border-b border-white/10">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">AI Agent</p>
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${AI_STATE_STYLES[aiState] || 'bg-white/10 text-slate-400'}`}>
              {AI_STATE_LABELS[aiState] || aiState}
            </span>
          </div>
          {aiState === 'ai_handling' && (
            <button
              onClick={onTakeover}
              className="w-full mt-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              Take Over
            </button>
          )}
          {aiState === 'escalated' && (
            <p className="text-[11px] text-orange-400 mt-1">Escalated — awaiting human response</p>
          )}
        </div>
      )}

      {/* Conversation meta */}
      <div className="p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Details</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span className={`px-1.5 py-0.5 rounded-full ${STATUS_STYLES[conversation.status] || ''}`}>{conversation.status}</span>
          </div>
          {conversation.assignee_id && (
            <div className="flex justify-between">
              <span className="text-slate-500">Assigned to</span>
              <span className="text-slate-300">{conversation.assignee_name || conversation.assignee_id.slice(0, 8)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">Created</span>
            <span className="text-slate-300">{conversation.created_at ? new Date(conversation.created_at).toLocaleDateString() : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root page ─────────────────────────────────────────────────────────────────
export default function Conversations() {
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [consent, setConsent] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [inboxDrawerOpen, setInboxDrawerOpen] = useState(false);
  const [typingAgents, setTypingAgents] = useState([]);
  const wsRef = useRef(null);
  // Track per-agent clear timers so we can reset them on repeat events
  const typingTimersRef = useRef({});

  // Load conversation list
  const loadConversations = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await api.getConversations({ status: statusFilter || undefined, limit: 50 });
      setConversations(data);
    } catch (e) {
      console.error('Failed to load conversations', e);
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load templates once
  useEffect(() => {
    api.getTemplates('whatsapp').then(setTemplates).catch(() => {});
  }, []);

  // WebSocket realtime
  useEffect(() => {
    if (!user?.company_id) return;
    const ws = api.createInboxSocket(user.company_id, handleWsEvent);
    wsRef.current = ws;
    return () => ws.close();
  }, [user?.company_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWsEvent = useCallback((event) => {
    if (event.type === 'new_message') {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === event.conversation_id
            ? { ...c, unread_count: (c.unread_count || 0) + 1, last_message_at: new Date().toISOString() }
            : c
        )
      );
      setActiveConv((cur) => {
        if (cur?.id === event.conversation_id) {
          setMessages((msgs) => [...msgs, event.message]);
        }
        return cur;
      });
    } else if (event.type === 'assignment_change') {
      setConversations((prev) =>
        prev.map((c) => (c.id === event.conversation_id ? { ...c, assignee_id: event.assignee_id } : c))
      );
    } else if (event.type === 'ai_state_change') {
      setConversations((prev) =>
        prev.map((c) => (c.id === event.conversation_id ? { ...c, ai_handling_state: event.state } : c))
      );
      setActiveConv((cur) =>
        cur?.id === event.conversation_id ? { ...cur, ai_handling_state: event.state } : cur
      );
    } else if (event.type === 'ai_escalated') {
      setConversations((prev) =>
        prev.map((c) => (c.id === event.conversation_id ? { ...c, ai_handling_state: 'escalated' } : c))
      );
      setActiveConv((cur) =>
        cur?.id === event.conversation_id ? { ...cur, ai_handling_state: 'escalated' } : cur
      );
    } else if (event.type === 'typing') {
      // Only show indicator for other agents typing in the active conversation
      setActiveConv((cur) => {
        if (cur?.id === event.conversation_id && event.agent_id !== user?.id) {
          const agentName = event.agent_name || 'Someone';
          setTypingAgents((prev) => {
            if (!prev.includes(agentName)) return [...prev, agentName];
            return prev;
          });
          // Clear this agent after 3 seconds; reset timer if they type again
          if (typingTimersRef.current[agentName]) {
            clearTimeout(typingTimersRef.current[agentName]);
          }
          typingTimersRef.current[agentName] = setTimeout(() => {
            setTypingAgents((prev) => prev.filter((n) => n !== agentName));
            delete typingTimersRef.current[agentName];
          }, 3000);
        }
        return cur;
      });
    }
  }, [user?.id]);

  // Handler: broadcast own typing to other agents (fire-and-forget)
  const handleTyping = useCallback(() => {
    if (!activeConv) return;
    const token = localStorage.getItem('ridn_token') || '';
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
    fetch(`${backendUrl}/api/conversations/${activeConv.id}/typing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }).catch(() => {});
  }, [activeConv]);

  const selectConversation = async (conv) => {
    setActiveConv(conv);
    setMessages([]);
    setIdentities([]);
    setConsent([]);
    setTypingAgents([]);
    setLoadingMsgs(true);
    try {
      const [msgs] = await Promise.all([
        api.getMessages(conv.id, { limit: 50 }),
      ]);
      setMessages(msgs);
      if (conv.customer_id) {
        const [ids, con] = await Promise.all([
          api.getIdentities(conv.customer_id).catch(() => []),
          api.getConsent(conv.customer_id).catch(() => []),
        ]);
        setIdentities(ids);
        setConsent(con);
      }
      if (conv.unread_count > 0) {
        await api.clearUnread(conv.id).catch(() => {});
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
        );
      }
    } finally {
      setLoadingMsgs(false);
    }
  };

  const handleSend = async (payload) => {
    if (!activeConv) return;
    setSending(true);
    try {
      await api.sendMessage(activeConv.id, payload);
      const msgs = await api.getMessages(activeConv.id, { limit: 50 });
      setMessages(msgs);
    } catch (e) {
      alert('Failed to send: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleNote = async (body) => {
    if (!activeConv) return;
    await api.postNote(activeConv.id, body).catch(() => {});
    const notes = await api.getNotes(activeConv.id).catch(() => []);
    setMessages((prev) => [
      ...prev,
      ...notes
        .filter((n) => !prev.find((m) => m.id === n.id))
        .map((n) => ({ ...n, direction: 'out', is_note: true, content_text: n.body })),
    ]);
  };

  const handleResolve = async () => {
    if (!activeConv) return;
    await api.setStatus(activeConv.id, 'resolved');
    setActiveConv((c) => ({ ...c, status: 'resolved' }));
    setConversations((prev) =>
      statusFilter === 'open'
        ? prev.filter((c) => c.id !== activeConv.id)
        : prev.map((c) => (c.id === activeConv.id ? { ...c, status: 'resolved' } : c))
    );
  };

  const handleTakeover = async () => {
    if (!activeConv) return;
    await api.setAiState(activeConv.id, 'human_takeover').catch(() => {});
    setActiveConv((c) => ({ ...c, ai_handling_state: 'human_takeover' }));
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConv.id ? { ...c, ai_handling_state: 'human_takeover' } : c))
    );
  };

  const handleApproveDraft = async (noteMsg, draftText) => {
    if (!activeConv || !draftText) return;
    setSending(true);
    try {
      await api.sendMessage(activeConv.id, { body: draftText });
      // Remove the draft note from the message list
      setMessages((prev) => prev.filter((m) => m.id !== noteMsg.id));
      const msgs = await api.getMessages(activeConv.id, { limit: 50 });
      setMessages(msgs);
    } catch (e) {
      alert('Failed to send: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDismissDraft = (noteMsg) => {
    setMessages((prev) => prev.filter((m) => m.id !== noteMsg.id));
  };

  return (
    <div className="flex h-full bg-[#0f1117] text-white overflow-hidden">
      {/* ── Left pane: 280px ── */}
      <div className="w-[280px] flex-shrink-0 flex flex-col">
        <div className="px-4 pt-4 pb-2 flex-shrink-0 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Conversations</h2>
            <p className="text-xs text-slate-500 mt-0.5">{conversations.length} {statusFilter || 'all'}</p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <ConversationList
            conversations={conversations}
            activeId={activeConv?.id}
            onSelect={selectConversation}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            loading={loadingList}
            onOpenInboxes={() => setInboxDrawerOpen(true)}
          />
        </div>
      </div>

      {/* ── Centre pane: flex-1 ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <MessageThread
          conversation={activeConv}
          messages={messages}
          onSend={handleSend}
          onNote={handleNote}
          onResolve={handleResolve}
          sending={sending}
          templates={templates}
          loadingMsgs={loadingMsgs}
          typingAgents={typingAgents}
          onTyping={handleTyping}
          onApproveDraft={handleApproveDraft}
          onDismissDraft={handleDismissDraft}
        />
      </div>

      {/* ── Right pane: 260px ── */}
      <div className="w-[260px] flex-shrink-0">
        <CustomerPanel
          conversation={activeConv}
          identities={identities}
          consent={consent}
          onTakeover={handleTakeover}
        />
      </div>

      {/* ── Inbox Management Drawer ── */}
      <InboxDrawer
        open={inboxDrawerOpen}
        onClose={() => setInboxDrawerOpen(false)}
      />
    </div>
  );
}
