import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Filter, ChevronDown, X, User, Phone, Mail, MapPin, Star,
  AlertCircle, Clock, CheckCircle2,
} from 'lucide-react';
import {
  getAllSubmissions,
  getSubmissionEvents,
  advanceStage,
  addNote,
  promoteSubmission,
  loseSubmission,
} from '../../services/campaignsApi';

const PAGE_SIZE = 50;

const STAGE_STYLES = {
  new:       { pill: 'bg-gray-500/20 text-gray-400',    label: 'New' },
  engaging:  { pill: 'bg-blue-500/20 text-blue-400',    label: 'Engaging' },
  qualified: { pill: 'bg-emerald-500/20 text-emerald-400', label: 'Qualified' },
  converted: { pill: 'bg-green-500/20 text-green-400',  label: 'Converted' },
  lost:      { pill: 'bg-red-500/20 text-red-400',      label: 'Lost' },
};

const STAGES = ['new', 'engaging', 'qualified', 'converted', 'lost'];

const STAGE_TRANSITIONS = {
  new:       ['engaging', 'qualified'],
  engaging:  ['qualified', 'converted', 'lost'],
  qualified: ['converted', 'lost'],
  converted: [],
  lost:      [],
};

const SOURCE_CHANNELS = ['organic', 'paid', 'referral', 'social', 'email', 'cold_outreach', 'event', 'other'];

// ─── Score bar ───────────────────────────────────────────────────────────────
function ScoreBar({ score }) {
  const pct = Math.min(100, Math.max(0, score ?? 0));
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}</span>
    </div>
  );
}

// ─── Stage badge ─────────────────────────────────────────────────────────────
function StageBadge({ stage }) {
  const s = STAGE_STYLES[stage] || STAGE_STYLES.new;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.pill}`}>
      {s.label}
    </span>
  );
}

// ─── Detail panel ────────────────────────────────────────────────────────────
function DetailPanel({ submission, onClose, onUpdated }) {
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [stageLoading, setStageLoading] = useState(false);
  const [nextStage, setNextStage] = useState('');
  const [actionError, setActionError] = useState(null);
  const [promoteReason, setPromoteReason] = useState('');
  const [loseReason, setLoseReason] = useState('');
  const [showPromoteInput, setShowPromoteInput] = useState(false);
  const [showLoseInput, setShowLoseInput] = useState(false);

  const transitions = STAGE_TRANSITIONS[submission.stage] || [];

  useEffect(() => {
    setEventsLoading(true);
    getSubmissionEvents(submission.id)
      .then((data) => setEvents(Array.isArray(data) ? data : (data?.items ?? [])))
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
    setNoteText('');
    setActionError(null);
    setShowPromoteInput(false);
    setShowLoseInput(false);
    setNextStage(transitions[0] || '');
  }, [submission.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdvance() {
    if (!nextStage) return;
    setStageLoading(true);
    setActionError(null);
    try {
      await advanceStage(submission.id, { stage: nextStage });
      onUpdated();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setStageLoading(false);
    }
  }

  async function handleNote() {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    setActionError(null);
    try {
      await addNote(submission.id, { note: noteText.trim() });
      setNoteText('');
      // Refresh events
      const data = await getSubmissionEvents(submission.id);
      setEvents(Array.isArray(data) ? data : (data?.items ?? []));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setNoteLoading(false);
    }
  }

  async function handlePromote() {
    setStageLoading(true);
    setActionError(null);
    try {
      await promoteSubmission(submission.id, { reason: promoteReason });
      setShowPromoteInput(false);
      onUpdated();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setStageLoading(false);
    }
  }

  async function handleLose() {
    setStageLoading(true);
    setActionError(null);
    try {
      await loseSubmission(submission.id, { reason: loseReason });
      setShowLoseInput(false);
      onUpdated();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setStageLoading(false);
    }
  }

  const responses = submission.responses || {};

  return (
    <div className="fixed inset-0 z-30 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Panel */}
      <div
        className="relative z-40 w-full max-w-md bg-[#13161D] border-l border-white/10 h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel header */}
        <div className="sticky top-0 bg-[#13161D] border-b border-white/8 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="font-semibold text-white text-sm">Submission Detail</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 px-5 py-5 space-y-6">
          {/* Identity */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-white font-semibold text-base">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-indigo-400" />
              </div>
              {submission.name || submission.full_name || '—'}
            </div>
            <div className="pl-11 space-y-1.5 text-sm text-gray-400">
              {submission.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={13} />
                  {submission.phone}
                </div>
              )}
              {submission.email && (
                <div className="flex items-center gap-2">
                  <Mail size={13} />
                  {submission.email}
                </div>
              )}
              {submission.city && (
                <div className="flex items-center gap-2">
                  <MapPin size={13} />
                  {submission.city}
                </div>
              )}
            </div>
          </div>

          {/* Score */}
          <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-3">
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 font-medium">
              <Star size={12} />
              Score
            </div>
            <ScoreBar score={submission.score} />
          </div>

          {/* Stage */}
          <div className="rounded-xl bg-white/4 border border-white/8 px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">Stage</span>
              <StageBadge stage={submission.stage} />
            </div>

            {transitions.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={nextStage}
                  onChange={(e) => setNextStage(e.target.value)}
                  className="flex-1 bg-white/8 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50"
                >
                  {transitions.map((s) => (
                    <option key={s} value={s} className="bg-[#1C1F2A]">
                      {STAGE_STYLES[s]?.label || s}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAdvance}
                  disabled={stageLoading || !nextStage}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                  {stageLoading ? '…' : 'Advance'}
                </button>
              </div>
            )}
          </div>

          {/* Responses */}
          {Object.keys(responses).length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-gray-500 mb-2">Responses</h4>
              <div className="rounded-xl bg-white/4 border border-white/8 divide-y divide-white/8">
                {Object.entries(responses).map(([k, v]) => (
                  <div key={k} className="px-4 py-3 flex gap-3">
                    <span className="text-xs text-gray-500 w-28 flex-shrink-0 capitalize">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-gray-300 break-words flex-1">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events timeline */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-3">Timeline</h4>
            {eventsLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 bg-white/8 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No events yet</p>
            ) : (
              <div className="relative pl-4 space-y-3">
                <div className="absolute left-1.5 top-2 bottom-2 w-px bg-white/10" />
                {events.map((ev, i) => (
                  <div key={ev.id ?? i} className="relative">
                    <div className="absolute -left-2.5 top-1 w-2 h-2 rounded-full bg-indigo-500/60 border-2 border-[#13161D]" />
                    <div className="text-xs text-gray-300">
                      <span className="font-medium capitalize">{(ev.event_type || ev.type || 'event').replace(/_/g, ' ')}</span>
                      {ev.note && <span className="text-gray-500 ml-1">— {ev.note}</span>}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5">
                      {ev.created_at
                        ? new Date(ev.created_at).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Note */}
          <div>
            <h4 className="text-xs font-medium text-gray-500 mb-2">Add Note</h4>
            <div className="flex gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Write a note…"
                rows={2}
                className="flex-1 bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 resize-none"
              />
              <button
                onClick={handleNote}
                disabled={noteLoading || !noteText.trim()}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium transition-colors self-end"
              >
                {noteLoading ? '…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Promote / Lose actions */}
          {submission.stage === 'qualified' && (
            <div className="space-y-2">
              {!showPromoteInput ? (
                <button
                  onClick={() => setShowPromoteInput(true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-sm font-medium transition-colors border border-emerald-500/20"
                >
                  Promote to Customer
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    value={promoteReason}
                    onChange={(e) => setPromoteReason(e.target.value)}
                    placeholder="Reason for promotion (optional)"
                    className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handlePromote}
                      disabled={stageLoading}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                    >
                      {stageLoading ? '…' : 'Confirm Promote'}
                    </button>
                    <button
                      onClick={() => setShowPromoteInput(false)}
                      className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-gray-400 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {submission.stage !== 'lost' && submission.stage !== 'converted' && (
            <div className="space-y-2">
              {!showLoseInput ? (
                <button
                  onClick={() => setShowLoseInput(true)}
                  className="w-full py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors border border-red-500/20"
                >
                  Mark as Lost
                </button>
              ) : (
                <div className="space-y-2">
                  <input
                    value={loseReason}
                    onChange={(e) => setLoseReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full bg-white/8 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-red-500/50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleLose}
                      disabled={stageLoading}
                      className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
                    >
                      {stageLoading ? '…' : 'Confirm Lost'}
                    </button>
                    <button
                      onClick={() => setShowLoseInput(false)}
                      className="px-4 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-gray-400 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action error */}
          {actionError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle size={13} />
              {actionError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SubmissionsView() {
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [filterStage, setFilterStage] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterMinScore, setFilterMinScore] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');

  // Detail panel
  const [selected, setSelected] = useState(null);

  // Dropdown open states
  const [stageDropOpen, setStageDropOpen] = useState(false);
  const [channelDropOpen, setChannelDropOpen] = useState(false);
  const stageRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (stageRef.current && !stageRef.current.contains(e.target)) setStageDropOpen(false);
      if (channelRef.current && !channelRef.current.contains(e.target)) setChannelDropOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: PAGE_SIZE, offset: off };
      if (filterStage) params.stage = filterStage;
      if (filterChannel) params.source_channel = filterChannel;
      if (filterMinScore) params.min_score = Number(filterMinScore);
      if (filterCampaign) params.campaign_id = filterCampaign;
      const data = await getAllSubmissions(params);
      if (Array.isArray(data)) {
        setSubmissions(data);
        setTotal(data.length + off); // fallback when no total field
      } else {
        setSubmissions(data?.items ?? []);
        setTotal(data?.total ?? 0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterStage, filterChannel, filterMinScore, filterCampaign]);

  useEffect(() => {
    setOffset(0);
    load(0);
  }, [filterStage, filterChannel, filterMinScore, filterCampaign]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePage(dir) {
    const newOffset = offset + dir * PAGE_SIZE;
    setOffset(newOffset);
    load(newOffset);
  }

  function handleUpdated() {
    setSelected(null);
    load(offset);
  }

  const hasFilters = filterStage || filterChannel || filterMinScore || filterCampaign;

  return (
    <div className="min-h-screen bg-[#0D0F17] text-white flex flex-col">
      {/* Header */}
      <div className="px-6 py-8 border-b border-white/8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-white">Submissions</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? 'Loading…' : `${total} total submissions`}
            </p>
          </div>
          {hasFilters && (
            <button
              onClick={() => {
                setFilterStage('');
                setFilterChannel('');
                setFilterMinScore('');
                setFilterCampaign('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-colors"
            >
              <X size={12} />
              Clear filters
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Stage dropdown */}
          <div className="relative" ref={stageRef}>
            <button
              onClick={() => setStageDropOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/12 text-sm text-gray-300 transition-colors"
            >
              <Filter size={13} className="text-gray-500" />
              {filterStage ? (STAGE_STYLES[filterStage]?.label || filterStage) : 'All Stages'}
              <ChevronDown size={13} className="text-gray-500" />
            </button>
            {stageDropOpen && (
              <div className="absolute left-0 top-9 z-20 w-44 rounded-xl bg-[#1C1F2A] border border-white/10 shadow-xl py-1">
                <button
                  onClick={() => { setFilterStage(''); setStageDropOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-white/8 transition-colors ${!filterStage ? 'text-white' : 'text-gray-400'}`}
                >
                  All Stages
                </button>
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setFilterStage(s); setStageDropOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/8 transition-colors ${filterStage === s ? 'text-white' : 'text-gray-400'}`}
                  >
                    {STAGE_STYLES[s]?.label || s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Channel dropdown */}
          <div className="relative" ref={channelRef}>
            <button
              onClick={() => setChannelDropOpen((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/12 text-sm text-gray-300 transition-colors"
            >
              {filterChannel
                ? filterChannel.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                : 'All Channels'}
              <ChevronDown size={13} className="text-gray-500" />
            </button>
            {channelDropOpen && (
              <div className="absolute left-0 top-9 z-20 w-48 rounded-xl bg-[#1C1F2A] border border-white/10 shadow-xl py-1">
                <button
                  onClick={() => { setFilterChannel(''); setChannelDropOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-white/8 transition-colors ${!filterChannel ? 'text-white' : 'text-gray-400'}`}
                >
                  All Channels
                </button>
                {SOURCE_CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    onClick={() => { setFilterChannel(ch); setChannelDropOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-white/8 transition-colors capitalize ${filterChannel === ch ? 'text-white' : 'text-gray-400'}`}
                  >
                    {ch.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Min score */}
          <input
            type="number"
            value={filterMinScore}
            onChange={(e) => setFilterMinScore(e.target.value)}
            placeholder="Min score"
            min={0}
            max={100}
            className="w-28 bg-white/8 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
          />

          {/* Campaign search */}
          <input
            type="text"
            value={filterCampaign}
            onChange={(e) => setFilterCampaign(e.target.value)}
            placeholder="Campaign ID…"
            className="w-36 bg-white/8 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/8">
              {['Name', 'Phone / Email', 'Stage', 'Score', 'Channel', 'Campaign', 'Date'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-white/4 animate-pulse">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-5 py-3.5">
                      <div className="h-3 bg-white/10 rounded w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : submissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/4 flex items-center justify-center">
                      <Clock size={22} className="text-gray-600" />
                    </div>
                    <p className="text-gray-500 text-sm">No submissions match your filters</p>
                  </div>
                </td>
              </tr>
            ) : (
              submissions.map((sub) => (
                <tr
                  key={sub.id}
                  onClick={() => setSelected(sub)}
                  className="border-b border-white/4 hover:bg-white/3 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5 font-medium text-white whitespace-nowrap">
                    {sub.name || sub.full_name || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    <div>{sub.phone || '—'}</div>
                    {sub.email && <div className="text-gray-600">{sub.email}</div>}
                  </td>
                  <td className="px-5 py-3.5">
                    <StageBadge stage={sub.stage} />
                  </td>
                  <td className="px-5 py-3.5 w-28">
                    <ScoreBar score={sub.score} />
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 capitalize text-xs whitespace-nowrap">
                    {sub.source_channel ? sub.source_channel.replace(/_/g, ' ') : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                    {sub.campaign_name || sub.campaign_id || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">
                    {sub.created_at
                      ? new Date(sub.created_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && submissions.length > 0 && (
        <div className="border-t border-white/8 px-6 py-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            Showing {offset + 1}–{offset + submissions.length}
            {total > 0 ? ` of ${total}` : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePage(-1)}
              disabled={offset === 0 || loading}
              className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => handlePage(1)}
              disabled={submissions.length < PAGE_SIZE || loading}
              className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/12 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          submission={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
