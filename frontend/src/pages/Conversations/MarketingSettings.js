import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Mic2, Bot, Clock, Plus, Trash2, Loader2,
  CheckCircle, AlertCircle, ChevronDown, ChevronUp, Pencil, X,
} from 'lucide-react';
import {
  getKnowledgeSources, createKnowledgeSource, ingestContent,
  getBrandVoice, saveBrandVoice,
  getAgentConfigs, createAgentConfig, updateAgentConfig, deleteAgentConfig,
} from '../../services/marketingApi';
import { getFrequencyCap, saveFrequencyCap } from '../../services/conversationsApi';

const TABS = [
  { id: 'kb',        label: 'Knowledge Base',  icon: BookOpen },
  { id: 'voice',     label: 'Brand Voice',      icon: Mic2 },
  { id: 'agent',     label: 'Agent Config',     icon: Bot },
  { id: 'frequency', label: 'Frequency Cap',    icon: Clock },
];

const AUTONOMY_LEVELS = [
  { value: 'L0', label: 'Off',          desc: 'AI disabled — human-only responses' },
  { value: 'L1', label: 'Drafts Only',  desc: 'AI drafts replies for human approval' },
  { value: 'L2', label: 'Auto (Low)',   desc: 'Auto-send when confidence ≥ threshold' },
  { value: 'L3', label: 'Full Auto',    desc: 'Auto-send all responses, escalate on rules' },
];

const AVAILABLE_TOOLS = [
  { id: 'lookup_booking',   label: 'Lookup Booking' },
  { id: 'cancel_booking',   label: 'Cancel Booking' },
  { id: 'reschedule',       label: 'Reschedule Booking' },
  { id: 'check_availability', label: 'Check Availability' },
  { id: 'send_promo',       label: 'Send Promotion' },
  { id: 'lookup_customer',  label: 'Lookup Customer' },
];

const TONE_OPTIONS = ['warm', 'professional', 'casual', 'formal', 'friendly', 'concise'];

const STATUS_STYLES = {
  ready:      'bg-green-500/15 text-green-400 border border-green-500/30',
  pending:    'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  processing: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  error:      'bg-red-500/15 text-red-400 border border-red-500/30',
};

const SOURCE_TYPE_LABELS = {
  faqs: 'FAQs',
  policies: 'Policies',
  services: 'Services',
  promotions: 'Promotions',
  manual: 'Manual',
};

// ── Chip list input ──────────────────────────────────────────────────────────
function ChipList({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const val = draft.trim();
    if (val && !items.includes(val)) onChange([...items, val]);
    setDraft('');
  };

  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground text-xs"
          >
            {item}
            <button
              onClick={() => onChange(items.filter((i) => i !== item))}
              className="text-muted-foreground hover:text-foreground ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 bg-muted border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          onClick={add}
          className="px-3 py-1.5 rounded-lg bg-muted border border-border text-muted-foreground hover:text-foreground text-sm"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ── Save banner ──────────────────────────────────────────────────────────────
function SaveBar({ saving, saved, error, onSave }) {
  return (
    <div className="flex items-center gap-3 pt-4 mt-4 border-t border-border">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white accent-gradient-bg disabled:opacity-50"
      >
        {saving && <Loader2 size={14} className="animate-spin" />}
        Save Changes
      </button>
      {saved && !saving && (
        <span className="flex items-center gap-1.5 text-green-400 text-sm">
          <CheckCircle size={14} /> Saved
        </span>
      )}
      {error && (
        <span className="flex items-center gap-1.5 text-red-400 text-sm">
          <AlertCircle size={14} /> {error}
        </span>
      )}
    </div>
  );
}

// ── Knowledge Base tab ───────────────────────────────────────────────────────
function KBTab() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [addingTo, setAddingTo] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState('faqs');

  useEffect(() => {
    getKnowledgeSources()
      .then(setSources)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const src = await createKnowledgeSource({ type: newType });
      setSources((prev) => [...prev, src]);
      setAddingTo(src.id);
      setExpandedId(src.id);
    } catch (_) {}
    setCreating(false);
  };

  const handleIngest = async (sourceId) => {
    const text = draftText.trim();
    if (!text) return;
    setIngesting(true);
    try {
      await ingestContent(sourceId, [{ text, metadata: {} }]);
      setDraftText('');
      setAddingTo(null);
      setSources((prev) =>
        prev.map((s) => (s.id === sourceId ? { ...s, status: 'processing' } : s))
      );
    } catch (_) {}
    setIngesting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Content the concierge AI uses to answer customer questions.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className="bg-muted border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground focus:outline-none"
          >
            {Object.entries(SOURCE_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white accent-gradient-bg disabled:opacity-50"
          >
            {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            New Source
          </button>
        </div>
      </div>

      {sources.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-2xl">
          No knowledge sources yet. Create one to get started.
        </div>
      )}

      <div className="space-y-2">
        {sources.map((src) => {
          const isExpanded = expandedId === src.id;
          return (
            <div key={src.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : src.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {SOURCE_TYPE_LABELS[src.type] || src.type}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[src.status] || STATUS_STYLES.pending}`}>
                    {src.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {src.last_synced_at && (
                    <span className="text-xs">
                      Last synced {new Date(src.last_synced_at).toLocaleDateString()}
                    </span>
                  )}
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border space-y-3 pt-3">
                  {addingTo === src.id ? (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground">Paste content to add</label>
                      <textarea
                        rows={5}
                        value={draftText}
                        onChange={(e) => setDraftText(e.target.value)}
                        placeholder="e.g. Our cancellation policy is…"
                        className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleIngest(src.id)}
                          disabled={ingesting || !draftText.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white accent-gradient-bg disabled:opacity-50"
                        >
                          {ingesting && <Loader2 size={13} className="animate-spin" />}
                          Ingest
                        </button>
                        <button
                          onClick={() => { setAddingTo(null); setDraftText(''); }}
                          className="px-3 py-1.5 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTo(src.id)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <Plus size={13} /> Add content
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Brand Voice tab ──────────────────────────────────────────────────────────
function BrandVoiceTab() {
  const [form, setForm] = useState({
    tone: 'warm',
    do_phrases: [],
    dont_phrases: [],
    required_disclosures: [],
    example_messages: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getBrandVoice()
      .then((d) => setForm({
        tone: d.tone || 'warm',
        do_phrases: d.do_phrases || [],
        dont_phrases: d.dont_phrases || [],
        required_disclosures: d.required_disclosures || [],
        example_messages: d.example_messages || [],
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      await saveBrandVoice(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError('Save failed');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 size={18} className="animate-spin mr-2" /> Loading…</div>;

  return (
    <div className="space-y-6 max-w-xl">
      <p className="text-sm text-muted-foreground">Controls how the concierge AI writes replies — tone, vocabulary rules, and example exchanges.</p>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tone</label>
        <select
          value={form.tone}
          onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
          className="bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground w-full focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {TONE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
      </div>

      <ChipList
        label="Do use these phrases"
        items={form.do_phrases}
        onChange={(v) => setForm((f) => ({ ...f, do_phrases: v }))}
        placeholder="e.g. Happy to help!"
      />

      <ChipList
        label="Avoid these phrases"
        items={form.dont_phrases}
        onChange={(v) => setForm((f) => ({ ...f, dont_phrases: v }))}
        placeholder="e.g. I cannot assist with that"
      />

      <ChipList
        label="Required disclosures"
        items={form.required_disclosures}
        onChange={(v) => setForm((f) => ({ ...f, required_disclosures: v }))}
        placeholder="e.g. This is an automated reply."
      />

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Example messages</label>
        <div className="space-y-2">
          {form.example_messages.map((msg, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <textarea
                rows={2}
                value={msg}
                onChange={(e) => {
                  const next = [...form.example_messages];
                  next[idx] = e.target.value;
                  setForm((f) => ({ ...f, example_messages: next }));
                }}
                className="flex-1 bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
              <button
                onClick={() => setForm((f) => ({ ...f, example_messages: f.example_messages.filter((_, i) => i !== idx) }))}
                className="text-muted-foreground hover:text-red-400 mt-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setForm((f) => ({ ...f, example_messages: [...f.example_messages, ''] }))}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Plus size={13} /> Add example
          </button>
        </div>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={handleSave} />
    </div>
  );
}

// ── Agent Config form (shared by create + edit drawer) ───────────────────────
const BLANK_AGENT = {
  agent_name: '',
  model: 'gpt-4o-mini',
  allowed_tools: [],
  autonomy_level: 'L1',
  confidence_threshold: 0.75,
  is_active: true,
};

function AgentForm({ form, setForm }) {
  const tools = Array.isArray(form.allowed_tools) ? form.allowed_tools : [];

  const toggleTool = (toolId) => {
    setForm((f) => {
      const t = Array.isArray(f.allowed_tools) ? f.allowed_tools : [];
      return {
        ...f,
        allowed_tools: t.includes(toolId) ? t.filter((x) => x !== toolId) : [...t, toolId],
      };
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between p-3.5 bg-muted/40 rounded-2xl border border-border">
        <div>
          <p className="text-sm font-medium text-foreground">Active</p>
          <p className="text-xs text-muted-foreground mt-0.5">Disabled = human-only responses</p>
        </div>
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
          className={`relative w-10 h-5 rounded-full transition-colors ${form.is_active ? 'accent-gradient-bg' : 'bg-muted border border-border'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Agent name</label>
        <input
          value={form.agent_name}
          onChange={(e) => setForm((f) => ({ ...f, agent_name: e.target.value }))}
          placeholder="e.g. Concierge, Booking Bot"
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Model</label>
        <select
          value={form.model}
          onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="gpt-4o-mini">GPT-4o Mini (fast, cheap)</option>
          <option value="gpt-4o">GPT-4o (balanced)</option>
          <option value="claude-haiku-4-5-20251001">Claude Haiku (fast)</option>
          <option value="claude-sonnet-4-6">Claude Sonnet (balanced)</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2.5">Autonomy level</label>
        <div className="grid grid-cols-2 gap-2">
          {AUTONOMY_LEVELS.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, autonomy_level: value }))}
              className={`text-left p-3 rounded-2xl border transition-colors ${
                form.autonomy_level === value
                  ? 'border-[var(--accent)] bg-accent/10'
                  : 'border-border bg-muted/40 hover:bg-muted/70'
              }`}
            >
              <div className={`text-xs font-semibold mb-0.5 ${form.autonomy_level === value ? 'text-[var(--accent)]' : 'text-foreground'}`}>
                {value} — {label}
              </div>
              <div className="text-xs text-muted-foreground leading-tight">{desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Confidence threshold — <span className="text-foreground">{Math.round(form.confidence_threshold * 100)}%</span>
        </label>
        <input
          type="range" min="0.5" max="1" step="0.05"
          value={form.confidence_threshold}
          onChange={(e) => setForm((f) => ({ ...f, confidence_threshold: parseFloat(e.target.value) }))}
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>50% — permissive</span><span>100% — strict</span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-2">Allowed tools</label>
        <div className="grid grid-cols-2 gap-2">
          {AVAILABLE_TOOLS.map(({ id, label }) => (
            <label key={id} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tools.includes(id)}
                onChange={() => toggleTool(id)}
                className="accent-[var(--accent)] w-3.5 h-3.5"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Agent drawer ─────────────────────────────────────────────────────────────
function AgentDrawer({ open, editing, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK_AGENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(editing
        ? {
            agent_name: editing.agent_name,
            model: editing.model || 'gpt-4o-mini',
            allowed_tools: Array.isArray(editing.allowed_tools) ? editing.allowed_tools : [],
            autonomy_level: editing.autonomy_level || 'L1',
            confidence_threshold: editing.confidence_threshold ?? 0.75,
            is_active: editing.is_active ?? true,
          }
        : BLANK_AGENT
      );
      setError('');
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!form.agent_name.trim()) { setError('Agent name is required'); return; }
    setSaving(true); setError('');
    try {
      const result = editing
        ? await updateAgentConfig(editing.id, form)
        : await createAgentConfig(form);
      onSaved(result, !!editing);
    } catch (e) {
      setError('Save failed');
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-card border-l border-border z-[60] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-foreground">
            {editing ? 'Edit Agent' : 'New Agent'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <AgentForm form={form} setForm={setForm} />
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white accent-gradient-bg disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {editing ? 'Save Changes' : 'Create Agent'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border">
            Cancel
          </button>
          {error && (
            <span className="flex items-center gap-1.5 text-red-400 text-sm ml-auto">
              <AlertCircle size={13} /> {error}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

// ── Agent Config tab ─────────────────────────────────────────────────────────
const AUTONOMY_BADGE = {
  L0: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  L1: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  L2: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  L3: 'bg-green-500/15 text-green-400 border-green-500/30',
};

function AgentConfigTab() {
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    getAgentConfigs()
      .then(setConfigs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (result, isEdit) => {
    setConfigs((prev) =>
      isEdit ? prev.map((c) => (c.id === result.id ? result : c)) : [...prev, result]
    );
    setDrawerOpen(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteAgentConfig(id);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch (_) {}
    setDeletingId(null);
  };

  const openEdit = (config) => { setEditing(config); setDrawerOpen(true); };
  const openCreate = () => { setEditing(null); setDrawerOpen(true); };

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 size={18} className="animate-spin mr-2" /> Loading…
    </div>
  );

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Each agent can have a different autonomy level, model, and toolset.</p>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white accent-gradient-bg"
          >
            <Plus size={13} /> New Agent
          </button>
        </div>

        {configs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm border border-dashed border-border rounded-2xl">
            No agents configured yet.
          </div>
        )}

        <div className="space-y-2">
          {configs.map((cfg) => {
            const levelInfo = AUTONOMY_LEVELS.find((l) => l.value === cfg.autonomy_level);
            return (
              <div
                key={cfg.id}
                className="flex items-center gap-4 px-4 py-3.5 bg-card border border-border rounded-2xl"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground truncate">{cfg.agent_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${AUTONOMY_BADGE[cfg.autonomy_level] || AUTONOMY_BADGE.L1}`}>
                      {cfg.autonomy_level} — {levelInfo?.label || cfg.autonomy_level}
                    </span>
                    {!cfg.is_active && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-gray-400 border border-gray-500/30">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{cfg.model} · {Math.round((cfg.confidence_threshold ?? 0.75) * 100)}% confidence</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => openEdit(cfg)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(cfg.id)}
                    disabled={deletingId === cfg.id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {deletingId === cfg.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AgentDrawer
        open={drawerOpen}
        editing={editing}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        onSaved={handleSaved}
      />
    </>
  );
}

// ── Frequency Cap tab ────────────────────────────────────────────────────────
function FrequencyCapTab() {
  const [form, setForm] = useState({
    max_per_day: 3,
    max_per_week: 10,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getFrequencyCap()
      .then((d) => setForm({
        max_per_day: d.max_per_day ?? 3,
        max_per_week: d.max_per_week ?? 10,
        quiet_hours_start: d.quiet_hours_start || '22:00',
        quiet_hours_end: d.quiet_hours_end || '08:00',
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false); setError('');
    try {
      await saveFrequencyCap(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError('Save failed');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 size={18} className="animate-spin mr-2" /> Loading…</div>;

  return (
    <div className="space-y-6 max-w-sm">
      <p className="text-sm text-muted-foreground">Limit how often a customer receives marketing messages.</p>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max messages per day</label>
        <input
          type="number"
          min={1}
          max={20}
          value={form.max_per_day}
          onChange={(e) => setForm((f) => ({ ...f, max_per_day: parseInt(e.target.value, 10) || 1 }))}
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max messages per week</label>
        <input
          type="number"
          min={1}
          max={100}
          value={form.max_per_week}
          onChange={(e) => setForm((f) => ({ ...f, max_per_week: parseInt(e.target.value, 10) || 1 }))}
          className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quiet hours start</label>
          <input
            type="time"
            value={form.quiet_hours_start}
            onChange={(e) => setForm((f) => ({ ...f, quiet_hours_start: e.target.value }))}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quiet hours end</label>
          <input
            type="time"
            value={form.quiet_hours_end}
            onChange={(e) => setForm((f) => ({ ...f, quiet_hours_end: e.target.value }))}
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">No marketing messages will be sent during quiet hours (local time).</p>

      <SaveBar saving={saving} saved={saved} error={error} onSave={handleSave} />
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MarketingSettings() {
  const [activeTab, setActiveTab] = useState('kb');

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="px-6 pt-6 pb-0 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground mb-4">Marketing Settings</h1>
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {activeTab === 'kb'        && <KBTab />}
        {activeTab === 'voice'     && <BrandVoiceTab />}
        {activeTab === 'agent'     && <AgentConfigTab />}
        {activeTab === 'frequency' && <FrequencyCapTab />}
      </div>
    </div>
  );
}
