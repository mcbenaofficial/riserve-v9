import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import {
  User, Star, Instagram, ChevronRight, MessageSquare,
  Loader2, X, CheckCircle2, Ban, ExternalLink, Clock,
  ArrowUpRight, Tag, Phone, Mail, RefreshCw,
} from 'lucide-react';
import {
  getLeads, getLeadCounts, getLead, updateLead,
  promoteLead, blockLead, getLeadEvents, addLeadEvent,
} from '../../services/acquisitionApi';

const COLUMNS = [
  { key: 'new', label: 'New', color: 'text-gray-400', bg: 'bg-gray-500/10', dot: 'bg-gray-400' },
  { key: 'engaging', label: 'Engaging', color: 'text-blue-400', bg: 'bg-blue-500/10', dot: 'bg-blue-400' },
  { key: 'qualified', label: 'Qualified', color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-400' },
  { key: 'converted', label: 'Converted', color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400' },
];

const SCORE_COLOR = (score) => {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-gray-500';
};

function ScoreBadge({ score }) {
  return (
    <span className={`text-xs font-bold tabular-nums ${SCORE_COLOR(score)}`}>
      {score}
    </span>
  );
}

function LeadCard({ lead, onClick, isDark }) {
  const since = lead.captured_at
    ? Math.floor((Date.now() - new Date(lead.captured_at).getTime()) / 3600000)
    : null;

  return (
    <div
      onClick={() => onClick(lead)}
      className={`rounded-2xl border p-4 flex flex-col gap-3 cursor-pointer hover:border-[var(--accent)]/40 transition-all ${isDark ? 'bg-[#13161D] border-white/8 hover:bg-[#181B23]' : 'bg-white border-gray-200 hover:border-blue-300'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isDark ? 'bg-white/8' : 'bg-gray-100'}`}>
            {(lead.source_handle || lead.captured_name || '?')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium leading-tight">
              {lead.captured_name || (lead.source_handle ? `@${lead.source_handle}` : 'Unknown')}
            </p>
            {lead.source_handle && lead.captured_name && (
              <p className="text-xs text-gray-500">@{lead.source_handle}</p>
            )}
          </div>
        </div>
        <ScoreBadge score={lead.score || 0} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {lead.captured_phone && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
            <Phone size={10} /> {lead.phone_verified ? 'Verified' : 'Phone'}
          </span>
        )}
        {lead.captured_email && (
          <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
            <Mail size={10} /> {lead.email_verified ? 'Verified' : 'Email'}
          </span>
        )}
        {lead.source_post_id && (
          <span className="flex items-center gap-1 text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
            <Instagram size={10} /> From Reel
          </span>
        )}
      </div>

      {since !== null && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock size={10} />
          {since < 1 ? 'Just now' : since < 24 ? `${since}h ago` : `${Math.floor(since / 24)}d ago`}
        </div>
      )}
    </div>
  );
}

function LeadDetailPanel({ lead, onClose, onRefresh, isDark }) {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!lead) return;
    setLoadingEvents(true);
    getLeadEvents(lead.id)
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoadingEvents(false));
  }, [lead]);

  const handlePromote = async () => {
    setError('');
    setPromoting(true);
    try {
      await promoteLead(lead.id, 'manual_promotion');
      onRefresh();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setPromoting(false);
    }
  };

  const handleBlock = async () => {
    if (!window.confirm('Block this lead? They will no longer receive automated messages.')) return;
    setBlocking(true);
    try {
      await blockLead(lead.id);
      onRefresh();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBlocking(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      await addLeadEvent(lead.id, { kind: 'operator_note', payload: { text: note } });
      setNote('');
      const ev = await getLeadEvents(lead.id);
      setEvents(ev);
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingNote(false);
    }
  };

  if (!lead) return null;

  const attrs = lead.attributes || {};

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59]" onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full w-[480px] z-[60] flex flex-col shadow-2xl border-l ${isDark ? 'bg-[#13161D] border-white/8' : 'bg-white border-gray-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${isDark ? 'bg-white/8' : 'bg-gray-100'}`}>
              {(lead.source_handle || lead.captured_name || '?')[0].toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold text-base">{lead.captured_name || `@${lead.source_handle}` || 'Unknown Lead'}</h2>
              {lead.source_handle && lead.captured_name && (
                <p className="text-xs text-gray-500">@{lead.source_handle}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {/* Score & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-2xl p-4 border ${isDark ? 'border-white/8 bg-white/4' : 'border-gray-100 bg-gray-50'}`}>
              <p className="text-xs text-gray-500 mb-1">Lead Score</p>
              <p className={`text-3xl font-bold ${SCORE_COLOR(lead.score || 0)}`}>{lead.score || 0}</p>
            </div>
            <div className={`rounded-2xl p-4 border ${isDark ? 'border-white/8 bg-white/4' : 'border-gray-100 bg-gray-50'}`}>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <p className="text-base font-semibold capitalize">{lead.status}</p>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Contact</h3>
            <div className="flex flex-col gap-2">
              {lead.captured_phone ? (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-gray-500" />
                  <span>{lead.captured_phone}</span>
                  {lead.phone_verified && <CheckCircle2 size={13} className="text-emerald-400" />}
                </div>
              ) : null}
              {lead.captured_email ? (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-gray-500" />
                  <span>{lead.captured_email}</span>
                  {lead.email_verified && <CheckCircle2 size={13} className="text-emerald-400" />}
                </div>
              ) : null}
              {!lead.captured_phone && !lead.captured_email && (
                <p className="text-sm text-gray-500">No contact captured yet</p>
              )}
            </div>
          </div>

          {/* Attributes */}
          {Object.keys(attrs).length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Captured Answers</h3>
              <div className="flex flex-col gap-1.5">
                {Object.entries(attrs).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source */}
          {lead.source_post_id && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Source</h3>
              <div className="flex items-center gap-2 text-sm">
                <Instagram size={14} className="text-purple-400" />
                <span className="text-gray-400">Post ID:</span>
                <span className="font-mono text-xs">{lead.source_post_id}</span>
              </div>
            </div>
          )}

          {/* Score Breakdown */}
          {Object.keys(lead.score_breakdown || {}).length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Score Breakdown</h3>
              <div className="flex flex-col gap-1">
                {Object.entries(lead.score_breakdown).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500 capitalize">{k.replace(/_/g, ' ')}</span>
                    <span className="text-emerald-400 font-medium">+{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Note input */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Add Note</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="Type a note…"
                className={`flex-1 rounded-xl px-3 py-2 text-sm border ${isDark ? 'bg-[#0B0D10] border-white/10 text-white placeholder-gray-600' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
              />
              <button
                onClick={handleAddNote}
                disabled={addingNote || !note.trim()}
                className="px-3 py-2 rounded-xl bg-[var(--accent)] text-white text-sm disabled:opacity-50"
              >
                {addingNote ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
              </button>
            </div>
          </div>

          {/* Event timeline */}
          <div>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Timeline</h3>
            {loadingEvents ? (
              <Loader2 size={16} className="animate-spin text-gray-500" />
            ) : events.length === 0 ? (
              <p className="text-sm text-gray-600">No events yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {[...events].reverse().map((ev) => (
                  <div key={ev.id} className={`rounded-xl p-3 text-sm ${isDark ? 'bg-white/4' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize">{ev.kind.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-gray-500">{new Date(ev.occurred_at).toLocaleString()}</span>
                    </div>
                    {ev.payload?.text && <p className="text-gray-400 text-xs">{ev.payload.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-red-400 text-sm bg-red-500/10 px-3 py-2 rounded-xl">{error}</p>}
        </div>

        {/* Actions */}
        {lead.status !== 'converted' && lead.status !== 'blocked' && (
          <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-white/8' : 'border-gray-100'}`}>
            <button
              onClick={handleBlock}
              disabled={blocking}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Ban size={14} /> Block
            </button>
            <button
              onClick={handlePromote}
              disabled={promoting || (!lead.captured_phone && !lead.captured_email)}
              className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
              title={(!lead.captured_phone && !lead.captured_email) ? 'Requires phone or email' : ''}
            >
              {promoting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
              Promote to Customer
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function LeadsPipeline() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [leads, setLeads] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, c] = await Promise.all([getLeads(), getLeadCounts()]);
      setLeads(l);
      setCounts(c);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const leadsByStatus = {};
  leads.forEach((l) => {
    if (!leadsByStatus[l.status]) leadsByStatus[l.status] = [];
    leadsByStatus[l.status].push(l);
  });

  const handleMoveStatus = async (lead, newStatus) => {
    await updateLead(lead.id, { status: newStatus });
    load();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">Capture, qualify, and convert Instagram leads</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-500 flex items-center gap-1.5">
            <User size={14} /> {leads.length} total leads
          </div>
          <button onClick={load} className={`p-2 rounded-xl border text-gray-400 hover:text-white transition-colors ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-50'}`}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colLeads = leadsByStatus[col.key] || [];
            return (
              <div key={col.key} className="flex flex-col gap-3 min-w-[260px]">
                {/* Column header */}
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${col.bg}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${col.color}`}>{counts[col.key] || 0}</span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3">
                  {colLeads.length === 0 ? (
                    <div className={`rounded-2xl border border-dashed p-6 text-center text-sm text-gray-600 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                      No leads
                    </div>
                  ) : colLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      isDark={isDark}
                      onClick={setSelectedLead}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadDetailPanel
        lead={selectedLead}
        isDark={isDark}
        onClose={() => setSelectedLead(null)}
        onRefresh={load}
      />
    </div>
  );
}
