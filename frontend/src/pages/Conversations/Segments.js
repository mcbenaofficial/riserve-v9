import React, { useState, useEffect } from 'react';
import { Users2, Plus, Trash2, X, RefreshCw } from 'lucide-react';
import * as api from '../../services/marketingApi';

const RULE_FIELDS = [
  { value: 'total_bookings', label: 'Total Bookings', operators: [{ value: 'gte', label: '>=' }, { value: 'lte', label: '<=' }, { value: 'eq', label: '=' }], inputType: 'number' },
  { value: 'total_revenue', label: 'Total Revenue', operators: [{ value: 'gte', label: '>=' }, { value: 'lte', label: '<=' }, { value: 'eq', label: '=' }], inputType: 'number' },
  { value: 'last_booking_date', label: 'Last Visit', operators: [{ value: 'gte', label: 'on or after' }, { value: 'lte', label: 'on or before' }], inputType: 'date' },
  { value: 'channel', label: 'Has Channel', operators: [{ value: 'has_identity', label: 'connected on' }, { value: 'no_identity', label: 'not on' }], inputType: 'channel_select' },
  { value: 'tags', label: 'Conversation Label', operators: [{ value: 'contains', label: 'contains' }], inputType: 'text' },
];

const CHANNELS = ['whatsapp', 'instagram', 'facebook', 'telegram', 'email', 'sms'];

function RuleRow({ rule, index, onChange, onRemove }) {
  const fieldDef = RULE_FIELDS.find(f => f.value === rule.field) || RULE_FIELDS[0];

  return (
    <div className="flex items-center gap-2 bg-white/5 rounded-xl p-3">
      <select
        value={rule.field}
        onChange={e => onChange(index, { field: e.target.value, operator: RULE_FIELDS.find(f => f.value === e.target.value)?.operators[0]?.value || '', value: '' })}
        className="flex-1 bg-[#0B0D10] border border-[#1F2630] rounded-lg px-3 py-2 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
      >
        {RULE_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select
        value={rule.operator}
        onChange={e => onChange(index, { ...rule, operator: e.target.value })}
        className="bg-[#0B0D10] border border-[#1F2630] rounded-lg px-3 py-2 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
      >
        {fieldDef.operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      {fieldDef.inputType === 'channel_select' ? (
        <select
          value={rule.value}
          onChange={e => onChange(index, { ...rule, value: e.target.value })}
          className="flex-1 bg-[#0B0D10] border border-[#1F2630] rounded-lg px-3 py-2 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">Select channel</option>
          {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <input
          type={fieldDef.inputType}
          value={rule.value}
          onChange={e => onChange(index, { ...rule, value: e.target.value })}
          placeholder="Value"
          className="flex-1 bg-[#0B0D10] border border-[#1F2630] rounded-lg px-3 py-2 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
        />
      )}
      <button
        onClick={() => onRemove(index)}
        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function SegmentDrawer({ open, onClose, onSaved, editSegment }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState([{ field: 'total_bookings', operator: 'gte', value: '' }]);
  const [previewCount, setPreviewCount] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editSegment) {
      setName(editSegment.name || '');
      setDescription(editSegment.description || '');
      setRules(editSegment.rules?.length ? editSegment.rules : [{ field: 'total_bookings', operator: 'gte', value: '' }]);
    } else {
      setName('');
      setDescription('');
      setRules([{ field: 'total_bookings', operator: 'gte', value: '' }]);
      setPreviewCount(null);
    }
  }, [editSegment, open]);

  useEffect(() => {
    if (!open) return;
    const validRules = rules.filter(r => r.value !== '');
    if (!validRules.length) { setPreviewCount(null); return; }
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const res = await api.previewSegmentRules(validRules);
        setPreviewCount(res.count);
      } catch (_) {}
      setPreviewing(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [rules, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = { name, description, rules: rules.filter(r => r.value !== '') };
      const result = editSegment
        ? await api.updateSegment(editSegment.id, data)
        : await api.createSegment(data);
      onSaved(result);
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[520px] bg-[#111318] border-l border-[#1F2630] z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F2630]">
          <h2 className="text-[#E6E8EB] font-semibold text-base">
            {editSegment ? 'Edit Segment' : 'New Segment'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Segment Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. VIP Customers"
              className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Who is this segment for?"
              className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#6B7280]">
                Filter Rules <span className="text-gray-600">(all must match)</span>
              </label>
              {previewCount !== null && (
                <span className="flex items-center gap-1.5 text-xs text-[var(--accent)]">
                  {previewing && <RefreshCw size={11} className="animate-spin" />}
                  ~{previewCount} customer{previewCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="space-y-2">
              {rules.map((rule, i) => (
                <RuleRow
                  key={i}
                  rule={rule}
                  index={i}
                  onChange={(idx, updated) => setRules(r => r.map((x, j) => j === idx ? updated : x))}
                  onRemove={idx => setRules(r => r.filter((_, j) => j !== idx))}
                />
              ))}
            </div>
            <button
              onClick={() => setRules(r => [...r, { field: 'total_bookings', operator: 'gte', value: '' }])}
              className="mt-2 text-xs text-[var(--accent)] hover:underline"
            >
              + Add Rule
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1F2630]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#E6E8EB] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-5 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? 'Saving…' : (editSegment ? 'Update Segment' : 'Create Segment')}
          </button>
        </div>
      </div>
    </>
  );
}

export default function Segments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editSegment, setEditSegment] = useState(null);

  useEffect(() => {
    api.getSegments()
      .then(setSegments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (seg) => {
    setSegments(prev => {
      const idx = prev.findIndex(s => s.id === seg.id);
      return idx >= 0 ? prev.map(s => s.id === seg.id ? seg : s) : [seg, ...prev];
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this segment?')) return;
    await api.deleteSegment(id);
    setSegments(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#E6E8EB]">Segments</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Group customers by behaviour or attributes</p>
        </div>
        <button
          onClick={() => { setEditSegment(null); setDrawerOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> New Segment
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#6B7280]">Loading…</div>
      ) : segments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Users2 size={22} className="text-[#6B7280]" />
          </div>
          <p className="text-[#E6E8EB] font-medium">No segments yet</p>
          <p className="text-sm text-[#6B7280] mt-1">Create your first segment to target specific customers</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {segments.map(seg => (
            <div
              key={seg.id}
              className="bg-[#111318] border border-[#1F2630] rounded-2xl p-5 hover:border-[var(--accent)]/30 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[#E6E8EB] font-medium text-sm truncate">{seg.name}</h3>
                  {seg.description && (
                    <p className="text-xs text-[#6B7280] mt-0.5 truncate">{seg.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setEditSegment(seg); setDrawerOpen(true); }}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors text-xs px-2"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(seg.id)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-2xl font-bold text-[var(--accent)]">{seg.estimated_count ?? 0}</div>
                  <div className="text-xs text-[#6B7280]">estimated customers</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-[#E6E8EB]">{(seg.rules || []).length}</div>
                  <div className="text-xs text-[#6B7280]">rule{(seg.rules || []).length !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SegmentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        editSegment={editSegment}
      />
    </div>
  );
}
