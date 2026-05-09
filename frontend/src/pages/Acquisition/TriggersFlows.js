import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Zap, GitBranch, Plus, Trash2, Edit2, ToggleLeft, ToggleRight,
  Loader2, X, ChevronDown, ChevronUp, Hash, MessageSquare,
  PlayCircle, PauseCircle, ArrowRight, Save, AlertCircle,
} from 'lucide-react';
import {
  getTriggers, createTrigger, updateTrigger, deleteTrigger, toggleTrigger,
  getFlows, createFlow, updateFlow, deleteFlow, toggleFlow,
} from '../../services/acquisitionApi';

const TRIGGER_TYPES = [
  { value: 'comment_keyword', label: 'Comment Keyword', desc: 'Fires when a comment contains a keyword' },
  { value: 'story_reply', label: 'Story Reply', desc: 'Fires when someone replies to a story' },
  { value: 'story_mention', label: 'Story Mention', desc: 'Fires when someone mentions you in a story' },
  { value: 'dm_keyword', label: 'DM Keyword', desc: 'Fires when a DM contains a keyword' },
  { value: 'dm_default', label: 'DM Default', desc: 'Fires for any incoming DM with no other match' },
];

const TRIGGER_TYPE_COLOR = {
  comment_keyword: 'text-blue-400 bg-blue-500/10',
  story_reply: 'text-purple-400 bg-purple-500/10',
  story_mention: 'text-pink-400 bg-pink-500/10',
  dm_keyword: 'text-amber-400 bg-amber-500/10',
  dm_default: 'text-gray-400 bg-gray-500/10',
};

// ---------------------------------------------------------------------------
// Trigger Drawer
// ---------------------------------------------------------------------------

function TriggerDrawer({ open, trigger, flows, onClose, onSaved, isDark }) {
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'comment_keyword',
    match_rules: { keywords: [] },
    flow_id: '',
    daily_cap: '',
    hourly_cap: '',
    applies_to: 'all_posts',
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (trigger) {
      setForm({
        name: trigger.name || '',
        trigger_type: trigger.trigger_type || 'comment_keyword',
        match_rules: trigger.match_rules || { keywords: [] },
        flow_id: trigger.flow_id || '',
        daily_cap: trigger.daily_cap ?? '',
        hourly_cap: trigger.hourly_cap ?? '',
        applies_to: trigger.applies_to || 'all_posts',
      });
      setKeywordInput('');
    } else {
      setForm({ name: '', trigger_type: 'comment_keyword', match_rules: { keywords: [] }, flow_id: flows[0]?.id || '', daily_cap: '', hourly_cap: '', applies_to: 'all_posts' });
      setKeywordInput('');
    }
    setError('');
  }, [trigger, flows, open]);

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase().replace(/^#/, '');
    if (!kw) return;
    setForm((f) => ({ ...f, match_rules: { ...f.match_rules, keywords: [...(f.match_rules.keywords || []), kw] } }));
    setKeywordInput('');
  };

  const removeKeyword = (kw) => {
    setForm((f) => ({ ...f, match_rules: { ...f.match_rules, keywords: (f.match_rules.keywords || []).filter((k) => k !== kw) } }));
  };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        trigger_type: form.trigger_type,
        match_rules: form.match_rules,
        flow_id: form.flow_id || null,
        daily_cap: form.daily_cap ? parseInt(form.daily_cap) : null,
        hourly_cap: form.hourly_cap ? parseInt(form.hourly_cap) : null,
        applies_to: form.applies_to,
      };
      if (trigger) await updateTrigger(trigger.id, payload);
      else await createTrigger(payload);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const needsKeywords = ['comment_keyword', 'dm_keyword'].includes(form.trigger_type);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full w-[460px] z-[60] flex flex-col shadow-2xl border-l ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          <h2 className="font-semibold">{trigger ? 'Edit Trigger' : 'New Trigger'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Biryani Reel Comment Trigger"
              className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Trigger Type</label>
            <div className="flex flex-col gap-2">
              {TRIGGER_TYPES.map((t) => (
                <label key={t.value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${form.trigger_type === t.value ? 'border-[var(--accent)] bg-[var(--accent)]/8' : isDark ? 'border-white/8 hover:border-white/16' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="trigger_type" value={t.value} checked={form.trigger_type === t.value} onChange={() => setForm((f) => ({ ...f, trigger_type: t.value }))} className="hidden" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-gray-500">{t.desc}</p>
                  </div>
                  {form.trigger_type === t.value && <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />}
                </label>
              ))}
            </div>
          </div>

          {needsKeywords && (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5"><Hash size={12} />Match Keywords</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={keywordInput} onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  placeholder="menu, book, reservation…"
                  className={`flex-1 rounded-xl px-3 py-2 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                <button onClick={addKeyword} className="px-3 py-2 rounded-xl bg-[var(--accent)]/20 text-[var(--accent)] text-sm font-medium hover:bg-[var(--accent)]/30 transition-colors">Add</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(form.match_rules.keywords || []).map((kw) => (
                  <span key={kw} className="flex items-center gap-1 text-xs bg-[var(--accent)]/10 text-[var(--accent)] px-2 py-0.5 rounded-full">
                    {kw}
                    <button onClick={() => removeKeyword(kw)}><X size={10} /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">Linked Flow (optional)</label>
            <select value={form.flow_id} onChange={(e) => setForm((f) => ({ ...f, flow_id: e.target.value }))}
              className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
              <option value="">— No flow —</option>
              {flows.map((fl) => <option key={fl.id} value={fl.id}>{fl.name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Daily Cap</label>
              <input type="number" value={form.daily_cap} onChange={(e) => setForm((f) => ({ ...f, daily_cap: e.target.value }))}
                placeholder="Unlimited"
                className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Hourly Cap</label>
              <input type="number" value={form.hourly_cap} onChange={(e) => setForm((f) => ({ ...f, hourly_cap: e.target.value }))}
                placeholder="Unlimited"
                className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
        </div>

        <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {trigger ? 'Save Changes' : 'Create Trigger'}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Flow Drawer (simple graph editor — node list)
// ---------------------------------------------------------------------------

const NODE_TYPES = [
  { value: 'message', label: 'Send Message' },
  { value: 'prompt_quick_reply', label: 'Quick Reply Prompt' },
  { value: 'prompt_text', label: 'Text Input Prompt' },
  { value: 'capture_pii', label: 'Capture Phone/Email' },
  { value: 'deliver_lead_magnet', label: 'Deliver Lead Magnet' },
  { value: 'score', label: 'Update Score' },
  { value: 'handoff_to_inbox', label: 'Hand Off to Inbox' },
  { value: 'promote_to_customer', label: 'Promote to Customer' },
];

function FlowDrawer({ open, flow, onClose, onSaved, isDark }) {
  const [form, setForm] = useState({ name: '', qualification_threshold: 50, nodes: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (flow) {
      const nodes = (flow.graph?.nodes || []);
      setForm({ name: flow.name, qualification_threshold: flow.qualification_threshold || 50, nodes });
    } else {
      setForm({ name: '', qualification_threshold: 50, nodes: [] });
    }
    setError('');
  }, [flow, open]);

  const addNode = () => {
    const id = `node_${Date.now()}`;
    setForm((f) => ({ ...f, nodes: [...f.nodes, { id, type: 'message', config: { text: '' }, next: null }] }));
  };

  const removeNode = (id) => setForm((f) => ({ ...f, nodes: f.nodes.filter((n) => n.id !== id) }));

  const updateNode = (id, patch) => setForm((f) => ({ ...f, nodes: f.nodes.map((n) => n.id === id ? { ...n, ...patch } : n) }));

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        qualification_threshold: form.qualification_threshold,
        graph: { nodes: form.nodes, edges: form.nodes.map((n, i) => i < form.nodes.length - 1 ? { from: n.id, to: form.nodes[i + 1].id } : null).filter(Boolean) },
      };
      if (flow) await updateFlow(flow.id, payload);
      else await createFlow(payload);
      onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full w-[520px] z-[60] flex flex-col shadow-2xl border-l ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          <h2 className="font-semibold">{flow ? 'Edit Flow' : 'New Flow'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1.5 block">Flow Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Saturday Reservation Flow"
                className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Qualification Threshold</label>
              <input type="number" value={form.qualification_threshold} onChange={(e) => setForm((f) => ({ ...f, qualification_threshold: parseInt(e.target.value) || 50 }))}
                className={`w-full rounded-xl px-3 py-2.5 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
            </div>
          </div>

          {/* Node list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">Flow Steps</label>
              <button onClick={addNode} className="flex items-center gap-1 text-xs text-[var(--accent)] hover:text-[var(--accent)]/80 transition-colors">
                <Plus size={12} /> Add Step
              </button>
            </div>

            {form.nodes.length === 0 ? (
              <div className={`rounded-2xl border border-dashed p-6 text-center text-sm text-gray-600 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                No steps yet. Add your first step.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {form.nodes.map((node, i) => (
                  <div key={node.id} className={`rounded-2xl border p-4 ${isDark ? 'bg-[#0B0D10] border-white/8' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}>{i + 1}</span>
                        <select value={node.type} onChange={(e) => updateNode(node.id, { type: e.target.value })}
                          className={`rounded-lg px-2 py-1 text-xs border ${isDark ? 'bg-[#13161D] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                          {NODE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      <button onClick={() => removeNode(node.id)} className="p-1 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {['message', 'prompt_quick_reply', 'prompt_text', 'capture_pii', 'deliver_lead_magnet'].includes(node.type) && (
                      <input type="text"
                        value={node.config?.text || ''}
                        onChange={(e) => updateNode(node.id, { config: { ...node.config, text: e.target.value } })}
                        placeholder={node.type === 'deliver_lead_magnet' ? 'Lead magnet URL or code' : 'Message text…'}
                        className={`w-full rounded-xl px-3 py-2 text-sm border ${isDark ? 'bg-[#13161D] border-white/10 text-white placeholder-gray-600' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`} />
                    )}
                    {i < form.nodes.length - 1 && (
                      <div className="flex justify-center mt-2">
                        <ArrowRight size={14} className="text-gray-600 rotate-90" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
        </div>

        <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm border border-white/10 text-gray-400 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {flow ? 'Save Changes' : 'Create Flow'}
          </button>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TriggersFlows() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [tab, setTab] = useState('triggers'); // 'triggers' | 'flows'
  const [triggers, setTriggers] = useState([]);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggerDrawer, setTriggerDrawer] = useState(false);
  const [flowDrawer, setFlowDrawer] = useState(false);
  const [editTrigger, setEditTrigger] = useState(null);
  const [editFlow, setEditFlow] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, f] = await Promise.all([getTriggers(), getFlows()]);
      setTriggers(t);
      setFlows(f);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDeleteTrigger = async (id) => {
    if (!window.confirm('Delete this trigger?')) return;
    await deleteTrigger(id);
    load();
  };

  const handleDeleteFlow = async (id) => {
    if (!window.confirm('Delete this flow?')) return;
    await deleteFlow(id);
    load();
  };

  const handleToggleTrigger = async (id) => {
    await toggleTrigger(id);
    load();
  };

  const handleToggleFlow = async (id) => {
    await toggleFlow(id);
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Triggers & Flows</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure comment-to-DM automation and lead capture flows</p>
        </div>
        <button
          onClick={() => { if (tab === 'triggers') { setEditTrigger(null); setTriggerDrawer(true); } else { setEditFlow(null); setFlowDrawer(true); } }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> New {tab === 'triggers' ? 'Trigger' : 'Flow'}
        </button>
      </div>

      {/* Tabs */}
      <div className={`flex rounded-xl p-1 gap-1 w-fit ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
        <button onClick={() => setTab('triggers')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'triggers' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}>
          <Zap size={14} /> Triggers <span className="text-xs opacity-70">({triggers.length})</span>
        </button>
        <button onClick={() => setTab('flows')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'flows' ? 'bg-[var(--accent)] text-white' : 'text-gray-400 hover:text-white'}`}>
          <GitBranch size={14} /> Flows <span className="text-xs opacity-70">({flows.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-500" /></div>
      ) : tab === 'triggers' ? (
        <div className="flex flex-col gap-3">
          {triggers.length === 0 ? (
            <div className={`rounded-3xl border border-dashed p-12 text-center ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <Zap size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500 text-sm">No triggers yet. Create your first comment-to-DM trigger.</p>
            </div>
          ) : triggers.map((t) => {
            const linkedFlow = flows.find((f) => f.id === t.flow_id);
            return (
              <div key={t.id} className={`rounded-2xl border p-5 flex items-center gap-4 ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TRIGGER_TYPE_COLOR[t.trigger_type] || 'text-gray-400 bg-gray-500/10'}`}>
                      {TRIGGER_TYPES.find((x) => x.value === t.trigger_type)?.label || t.trigger_type}
                    </span>
                    <h3 className="font-medium text-sm truncate">{t.name}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {(t.match_rules?.keywords || []).length > 0 && (
                      <span className="flex items-center gap-1">
                        <Hash size={11} />
                        {t.match_rules.keywords.slice(0, 3).join(', ')}
                        {t.match_rules.keywords.length > 3 && ` +${t.match_rules.keywords.length - 3}`}
                      </span>
                    )}
                    {linkedFlow && (
                      <span className="flex items-center gap-1 text-[var(--accent)]">
                        <GitBranch size={11} /> {linkedFlow.name}
                      </span>
                    )}
                    {t.daily_cap && <span>Daily cap: {t.daily_cap}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleTrigger(t.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${t.is_active ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-gray-500 bg-gray-500/10 hover:bg-gray-500/20'}`}>
                    {t.is_active ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                    {t.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => { setEditTrigger(t); setTriggerDrawer(true); }} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteTrigger(t.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flows.length === 0 ? (
            <div className={`rounded-3xl border border-dashed p-12 text-center ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <GitBranch size={32} className="mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500 text-sm">No flows yet. Create your first in-DM capture flow.</p>
            </div>
          ) : flows.map((f) => {
            const nodeCount = (f.graph?.nodes || []).length;
            const linkedTriggers = triggers.filter((t) => t.flow_id === f.id);
            return (
              <div key={f.id} className={`rounded-2xl border p-5 flex items-center gap-4 ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm">{f.name}</h3>
                    <span className="text-xs text-gray-500">v{f.version || 1}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    <span>{nodeCount} step{nodeCount !== 1 ? 's' : ''}</span>
                    <span>Threshold: {f.qualification_threshold}</span>
                    {linkedTriggers.length > 0 && (
                      <span className="flex items-center gap-1 text-[var(--accent)]">
                        <Zap size={11} /> {linkedTriggers.length} trigger{linkedTriggers.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleFlow(f.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${f.is_active ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20' : 'text-gray-500 bg-gray-500/10 hover:bg-gray-500/20'}`}>
                    {f.is_active ? <PlayCircle size={13} /> : <PauseCircle size={13} />}
                    {f.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button onClick={() => { setEditFlow(f); setFlowDrawer(true); }} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteFlow(f.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TriggerDrawer
        open={triggerDrawer}
        trigger={editTrigger}
        flows={flows}
        isDark={isDark}
        onClose={() => { setTriggerDrawer(false); setEditTrigger(null); }}
        onSaved={() => { setTriggerDrawer(false); setEditTrigger(null); load(); }}
      />

      <FlowDrawer
        open={flowDrawer}
        flow={editFlow}
        isDark={isDark}
        onClose={() => { setFlowDrawer(false); setEditFlow(null); }}
        onSaved={() => { setFlowDrawer(false); setEditFlow(null); load(); }}
      />
    </div>
  );
}
