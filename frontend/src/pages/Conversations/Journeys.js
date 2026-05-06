import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  GitBranch, Plus, Trash2, X, Clock, MessageSquare,
  ChevronDown, ChevronUp, Users, ToggleLeft, ToggleRight,
  StopCircle, Zap, Tag, Hand, GripVertical, ArrowDown,
} from 'lucide-react';
import * as api from '../../services/marketingApi';
import { getInboxes } from '../../services/conversationsApi';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_TYPES = [
  { value: 'conversation_opened', label: 'Conversation Opened' },
  { value: 'tag_added', label: 'Tag Added' },
  { value: 'manual', label: 'Manual Enroll' },
];

const TRIGGER_BADGE = {
  conversation_opened: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  tag_added:           'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  manual:              'bg-gray-500/20 text-gray-400 border border-gray-500/30',
};

const TRIGGER_ICONS = {
  conversation_opened: <Zap size={12} />,
  tag_added:           <Tag size={12} />,
  manual:              <Hand size={12} />,
};

// ─── Node helpers ─────────────────────────────────────────────────────────────

let _nodeCounter = 100;
const newId = () => `n${++_nodeCounter}`;

function makeWaitNode() {
  return { id: newId(), type: 'wait', duration_hours: 24 };
}

function makeSendNode() {
  return {
    id: newId(),
    type: 'send_message',
    inbox_id: '',
    content_type: 'freeform',
    text: '',
    template_name: '',
    template_language: 'en',
  };
}

// Serialize nodes array → DAG
function nodesToDag(triggerType, stepNodes) {
  const triggerNode = { id: 'trigger', type: 'trigger', trigger_type: triggerType };
  const endNode = { id: 'end', type: 'end' };
  const allNodes = [triggerNode, ...stepNodes, endNode];
  const edges = allNodes.slice(0, -1).map((n, i) => ({ from: n.id, to: allNodes[i + 1].id }));
  return { nodes: allNodes, edges };
}

// Deserialize DAG → stepNodes array
function dagToStepNodes(dag) {
  if (!dag?.nodes) return [];
  return dag.nodes.filter(n => n.type !== 'trigger' && n.type !== 'end');
}

// ─── Node Dot / Icon ──────────────────────────────────────────────────────────

function NodeIcon({ type }) {
  if (type === 'trigger') return <span className="w-2.5 h-2.5 rounded-full bg-green-400 flex-shrink-0" />;
  if (type === 'wait') return <Clock size={14} className="text-orange-400 flex-shrink-0" />;
  if (type === 'send_message') return <MessageSquare size={14} className="text-[var(--accent)] flex-shrink-0" />;
  if (type === 'end') return <StopCircle size={14} className="text-red-400 flex-shrink-0" />;
  return null;
}

// ─── Flow Canvas constants ─────────────────────────────────────────────────────

const CARD_W = 220;
const CARD_H = 80;         // base card height for SVG line anchors
const STEP_Y = 110;        // vertical gap between node top edges
const START_Y = 20;        // y of first node
const CANVAS_W = 480;      // matches drawer inner width roughly

// Per-type styles
const NODE_STYLES = {
  trigger:      { border: 'border-green-500/40',  bg: 'bg-green-500/10',  dot: 'bg-green-400',    label: 'text-green-400'  },
  wait:         { border: 'border-orange-500/40', bg: 'bg-orange-500/10', dot: 'bg-orange-400',   label: 'text-orange-400' },
  send_message: { border: 'border-purple-500/40', bg: 'bg-purple-500/10', dot: 'bg-purple-400',   label: 'text-purple-400' },
  end:          { border: 'border-red-500/40',    bg: 'bg-red-500/10',    dot: 'bg-red-400',      label: 'text-red-400'    },
};

// ─── Add-step popover ─────────────────────────────────────────────────────────

function AddStepMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-6 h-6 rounded-full border border-slate-600 bg-[#0c0e14] text-slate-400 hover:border-slate-400 hover:text-slate-200 flex items-center justify-center text-sm font-bold transition-colors z-10"
        title="Add step"
      >
        +
      </button>
      {open && (
        <div className="absolute top-8 z-20 bg-[#1a1d26] border border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[160px]">
          <button
            onClick={() => { onAdd('wait'); setOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-orange-400 hover:bg-orange-500/10 transition-colors"
          >
            <Clock size={13} /> Wait
          </button>
          <button
            onClick={() => { onAdd('send_message'); setOpen(false); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-purple-400 hover:bg-purple-500/10 transition-colors"
          >
            <MessageSquare size={13} /> Send Message
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Single flow node card ─────────────────────────────────────────────────────

function FlowNodeCard({ node, triggerType, onChange, onRemove, inboxes }) {
  const s = NODE_STYLES[node.type] || NODE_STYLES.end;
  const isFixed = node.type === 'trigger' || node.type === 'end';

  return (
    <div
      className={`w-[220px] rounded-xl border ${s.border} ${s.bg} px-4 py-3 relative`}
      style={{ boxSizing: 'border-box' }}
    >
      {/* Delete button */}
      {!isFixed && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 text-slate-500 hover:text-red-400 transition-colors leading-none"
          title="Remove step"
        >
          <X size={13} />
        </button>
      )}

      {/* Card header */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
        <span className={`text-xs font-semibold ${s.label}`}>
          {node.type === 'trigger'      && 'Trigger'}
          {node.type === 'wait'         && '⏱ Wait'}
          {node.type === 'send_message' && '✉ Send Message'}
          {node.type === 'end'          && 'End'}
        </span>
      </div>

      {/* Card body */}
      {node.type === 'trigger' && (
        <p className="text-xs text-slate-400 leading-snug">
          {TRIGGER_TYPES.find(t => t.value === triggerType)?.label ?? triggerType}
        </p>
      )}

      {node.type === 'end' && (
        <p className="text-xs text-slate-500 leading-snug">Journey complete</p>
      )}

      {node.type === 'wait' && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <input
            type="number"
            min="1"
            value={node.duration_hours}
            onChange={e => onChange({ ...node, duration_hours: parseInt(e.target.value, 10) || 1 })}
            className="w-14 bg-[#0B0D10] border border-white/10 rounded-lg px-2 py-1 text-[#E6E8EB] text-xs focus:outline-none focus:border-orange-500/60"
          />
          <span className="text-xs text-slate-500">hours</span>
        </div>
      )}

      {node.type === 'send_message' && (
        <div className="space-y-1.5 mt-0.5">
          <select
            value={node.inbox_id}
            onChange={e => onChange({ ...node, inbox_id: e.target.value })}
            className="w-full bg-[#0B0D10] border border-white/10 rounded-lg px-2 py-1 text-[#E6E8EB] text-xs focus:outline-none focus:border-purple-500/60"
          >
            <option value="">Select inbox</option>
            {inboxes.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          <textarea
            rows={2}
            value={node.text}
            onChange={e => onChange({ ...node, text: e.target.value })}
            placeholder="Message text…"
            className="w-full bg-[#0B0D10] border border-white/10 rounded-lg px-2 py-1 text-[#E6E8EB] text-xs focus:outline-none focus:border-purple-500/60 resize-none"
          />
        </div>
      )}
    </div>
  );
}

// ─── Flow Canvas ───────────────────────────────────────────────────────────────

function FlowCanvas({ allNodes, triggerType, onUpdateNode, onRemoveNode, onInsertAt, inboxes }) {
  const canvasRef = useRef(null);
  const [canvasWidth, setCanvasWidth] = useState(CANVAS_W);

  useEffect(() => {
    if (!canvasRef.current) return;
    const observer = new ResizeObserver(entries => {
      setCanvasWidth(entries[0].contentRect.width || CANVAS_W);
    });
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, []);

  const nodeX = (canvasWidth - CARD_W) / 2;

  // Each visual "slot" is: node, then (if not the last node) a connector + add button
  // Total height: allNodes.length slots * STEP_Y + START_Y + CARD_H + some bottom padding
  const totalH = START_Y + allNodes.length * STEP_Y + 40;

  // SVG lines: from bottom-center of node[i] to top-center of node[i+1]
  const cx = nodeX + CARD_W / 2;
  const lines = allNodes.slice(0, -1).map((_, i) => {
    const y1 = START_Y + i * STEP_Y + CARD_H;
    const y2 = START_Y + (i + 1) * STEP_Y;
    return { x: cx, y1, y2 };
  });

  return (
    <div
      ref={canvasRef}
      className="relative h-[480px] overflow-y-auto rounded-xl overflow-hidden"
      style={{
        background: '#0c0e14',
        backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.04) 1px,transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Inner scrollable content */}
      <div className="relative" style={{ height: totalH, minWidth: CARD_W + 40 }}>
        {/* SVG connector layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%"
          height={totalH}
          style={{ zIndex: 0 }}
        >
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
              <polygon points="0 1, 8 4, 0 7" fill="#334155" />
            </marker>
          </defs>
          {lines.map((l, i) => (
            <g key={i}>
              <line
                x1={l.x} y1={l.y1}
                x2={l.x} y2={l.y2 - 2}
                stroke="#334155"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
              />
            </g>
          ))}
        </svg>

        {/* Nodes + add-step buttons */}
        {allNodes.map((node, i) => {
          const yPos = START_Y + i * STEP_Y;
          const showAddBelow = i < allNodes.length - 1;
          // midpoint Y between this card's bottom and next card's top
          const addBtnY = yPos + CARD_H + (STEP_Y - CARD_H) / 2 - 12;

          return (
            <React.Fragment key={node.id}>
              {/* Node card */}
              <div
                className="absolute"
                style={{ left: nodeX, top: yPos, zIndex: 1 }}
              >
                <FlowNodeCard
                  node={node}
                  triggerType={triggerType}
                  onChange={updated => onUpdateNode(node.id, updated)}
                  onRemove={() => onRemoveNode(node.id)}
                  inboxes={inboxes}
                />
              </div>

              {/* Add-step button between nodes */}
              {showAddBelow && (
                <div
                  className="absolute"
                  style={{ left: cx - 12, top: addBtnY, zIndex: 2 }}
                >
                  <AddStepMenu onAdd={(type) => onInsertAt(i + 1, type)} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Journey Drawer ───────────────────────────────────────────────────────────

function JourneyDrawer({ open, onClose, onSaved, editJourney, inboxes }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('conversation_opened');
  const [stepNodes, setStepNodes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editJourney) {
      setName(editJourney.name || '');
      setDescription(editJourney.description || '');
      setTriggerType(editJourney.trigger_type || 'conversation_opened');
      setStepNodes(dagToStepNodes(editJourney.dag));
    } else {
      setName('');
      setDescription('');
      setTriggerType('conversation_opened');
      setStepNodes([]);
    }
  }, [editJourney, open]);

  const updateNode = useCallback((id, updated) => {
    setStepNodes(prev => prev.map(n => n.id === id ? updated : n));
  }, []);

  const removeNode = useCallback((id) => {
    setStepNodes(prev => prev.filter(n => n.id !== id));
  }, []);

  // Insert a new node at position `pos` in the stepNodes array (0-based within stepNodes)
  const insertAt = useCallback((pos, type) => {
    const newNode = type === 'wait' ? makeWaitNode() : makeSendNode();
    setStepNodes(prev => {
      const next = [...prev];
      // pos here refers to allNodes index; subtract 1 for trigger offset
      const stepPos = pos - 1;
      next.splice(Math.max(0, stepPos), 0, newNode);
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const dag = nodesToDag(triggerType, stepNodes);
      const data = { name, description, trigger_type: triggerType, dag };
      const result = editJourney
        ? await api.updateJourney(editJourney.id, data)
        : await api.createJourney(data);
      onSaved(result);
      onClose();
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (!open) return null;

  // Build the full node list: trigger + stepNodes + end
  const triggerNode = { id: 'trigger', type: 'trigger' };
  const endNode     = { id: 'end',     type: 'end'     };
  const allNodes    = [triggerNode, ...stepNodes, endNode];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-[560px] bg-[#111318] border-l border-[#1F2630] z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1F2630]">
          <h2 className="text-[#E6E8EB] font-semibold text-base">
            {editJourney ? 'Edit Journey' : 'New Journey'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Journey Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Post-Booking Follow-up"
              className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="What does this journey do?"
              className="w-full bg-[#0B0D10] border border-[#1F2630] rounded-xl px-4 py-2.5 text-[#E6E8EB] text-sm focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>

          {/* Trigger selector */}
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Trigger</label>
            <div className="space-y-2">
              {TRIGGER_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTriggerType(t.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                    triggerType === t.value
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[#1F2630] bg-white/5 hover:border-[#2F3640]'
                  }`}
                >
                  <span className={`flex items-center justify-center w-6 h-6 rounded-lg ${triggerType === t.value ? 'bg-[var(--accent)]/20' : 'bg-white/5'}`}>
                    <span className={triggerType === t.value ? 'text-[var(--accent)]' : 'text-[#6B7280]'}>
                      {TRIGGER_ICONS[t.value]}
                    </span>
                  </span>
                  <span className={`text-sm font-medium ${triggerType === t.value ? 'text-[var(--accent)]' : 'text-[#E6E8EB]'}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Visual flow canvas */}
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-3">Journey Flow</label>
            <FlowCanvas
              allNodes={allNodes}
              triggerType={triggerType}
              onUpdateNode={updateNode}
              onRemoveNode={removeNode}
              onInsertAt={insertAt}
              inboxes={inboxes}
            />
          </div>
        </div>

        {/* Footer */}
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
            {saving ? 'Saving…' : (editJourney ? 'Update Journey' : 'Create Journey')}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Enrollments mini-table ───────────────────────────────────────────────────

function EnrollmentsPanel({ journeyId }) {
  const [enrollments, setEnrollments] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getEnrollments(journeyId)
      .then(setEnrollments)
      .catch(() => setEnrollments([]))
      .finally(() => setLoading(false));
  }, [journeyId]);

  if (loading) {
    return <div className="text-xs text-[#6B7280] py-3 px-4">Loading enrollments…</div>;
  }

  if (!enrollments?.length) {
    return <div className="text-xs text-[#6B7280] py-3 px-4">No enrollments yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#1F2630]">
            <th className="text-left px-4 py-2 text-[#6B7280] font-medium">Customer</th>
            <th className="text-left px-4 py-2 text-[#6B7280] font-medium">Status</th>
            <th className="text-left px-4 py-2 text-[#6B7280] font-medium">Current Step</th>
            <th className="text-left px-4 py-2 text-[#6B7280] font-medium">Enrolled</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map(e => (
            <tr key={e.id} className="border-b border-[#1F2630]/40 hover:bg-white/[0.02]">
              <td className="px-4 py-2 text-[#E6E8EB]">{e.customer_name || e.customer_id}</td>
              <td className="px-4 py-2">
                <span className={`px-1.5 py-0.5 rounded text-xs ${
                  e.status === 'active'    ? 'bg-green-500/20 text-green-400' :
                  e.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                  e.status === 'paused'    ? 'bg-yellow-500/20 text-yellow-400' :
                                             'bg-gray-500/20 text-gray-400'
                }`}>
                  {e.status}
                </span>
              </td>
              <td className="px-4 py-2 text-[#6B7280]">{e.current_node_id || '—'}</td>
              <td className="px-4 py-2 text-[#6B7280]">
                {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Journey Card ─────────────────────────────────────────────────────────────

function JourneyCard({ journey, onEdit, onDelete, onToggle }) {
  const [showEnrollments, setShowEnrollments] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e) => {
    e.stopPropagation();
    setToggling(true);
    await onToggle(journey.id);
    setToggling(false);
  };

  const stepCount = journey.dag?.nodes
    ? journey.dag.nodes.filter(n => n.type !== 'trigger' && n.type !== 'end').length
    : 0;

  return (
    <div className="bg-[#111318] border border-[#1F2630] rounded-2xl overflow-hidden hover:border-[var(--accent)]/20 transition-colors group">
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="text-[#E6E8EB] font-medium text-sm">{journey.name}</span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TRIGGER_BADGE[journey.trigger_type] || TRIGGER_BADGE.manual}`}>
                {TRIGGER_ICONS[journey.trigger_type]}
                {TRIGGER_TYPES.find(t => t.value === journey.trigger_type)?.label || journey.trigger_type}
              </span>
            </div>
            {journey.description && (
              <p className="text-xs text-[#6B7280] mb-2 truncate">{journey.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs text-[#6B7280]">
              <span className="flex items-center gap-1">
                <GitBranch size={11} />
                {stepCount} step{stepCount !== 1 ? 's' : ''}
              </span>
              {journey.enrolled_count != null && (
                <span className="flex items-center gap-1">
                  <Users size={11} />
                  {journey.enrolled_count} enrolled
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Active toggle */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              title={journey.is_active ? 'Pause journey' : 'Activate journey'}
              className={`transition-colors ${toggling ? 'opacity-50' : ''}`}
            >
              {journey.is_active
                ? <ToggleRight size={22} className="text-green-400" />
                : <ToggleLeft size={22} className="text-gray-600" />
              }
            </button>

            {/* Edit button (shows on hover) */}
            <button
              onClick={() => onEdit(journey)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all text-xs px-2"
            >
              Edit
            </button>

            {/* Delete button (shows on hover) */}
            <button
              onClick={() => onDelete(journey.id)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Trash2 size={14} />
            </button>

            {/* Enrollments toggle */}
            <button
              onClick={() => setShowEnrollments(e => !e)}
              className="p-1.5 rounded-lg text-gray-500 hover:text-[#E6E8EB] hover:bg-white/5 transition-colors"
              title="View enrollments"
            >
              {showEnrollments ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Active status pill */}
        <div className="mt-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
            journey.is_active
              ? 'bg-green-500/15 text-green-400'
              : 'bg-gray-500/15 text-gray-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${journey.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
            {journey.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Enrollments panel */}
      {showEnrollments && (
        <div className="border-t border-[#1F2630]">
          <div className="px-4 py-2 flex items-center gap-2">
            <Users size={12} className="text-[#6B7280]" />
            <span className="text-xs font-medium text-[#6B7280]">Enrollments</span>
          </div>
          <EnrollmentsPanel journeyId={journey.id} />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Journeys() {
  const [journeys, setJourneys] = useState([]);
  const [inboxes, setInboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editJourney, setEditJourney] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getJourneys(),
      getInboxes().catch(() => []),
    ]).then(([j, i]) => {
      setJourneys(j);
      setInboxes(i);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSaved = (journey) => {
    setJourneys(prev => {
      const idx = prev.findIndex(j => j.id === journey.id);
      return idx >= 0
        ? prev.map(j => j.id === journey.id ? journey : j)
        : [journey, ...prev];
    });
  };

  const handleEdit = (journey) => {
    setEditJourney(journey);
    setDrawerOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this journey? All enrollments will be cancelled.')) return;
    await api.deleteJourney(id);
    setJourneys(prev => prev.filter(j => j.id !== id));
  };

  const handleToggle = async (id) => {
    // Optimistic update
    setJourneys(prev => prev.map(j => j.id === id ? { ...j, is_active: !j.is_active } : j));
    try {
      const updated = await api.toggleJourney(id);
      setJourneys(prev => prev.map(j => j.id === id ? { ...j, ...updated } : j));
    } catch (e) {
      console.error(e);
      // Revert on failure
      setJourneys(prev => prev.map(j => j.id === id ? { ...j, is_active: !j.is_active } : j));
    }
  };

  const openNewDrawer = () => {
    setEditJourney(null);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#E6E8EB]">Journeys</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">Automated message sequences triggered by customer events</p>
        </div>
        <button
          onClick={openNewDrawer}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> New Journey
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-20 text-[#6B7280]">Loading…</div>
      ) : journeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <GitBranch size={22} className="text-[#6B7280]" />
          </div>
          <p className="text-[#E6E8EB] font-medium">No journeys yet</p>
          <p className="text-sm text-[#6B7280] mt-1">
            Build automated sequences to nurture customers at scale
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {journeys.map(journey => (
            <JourneyCard
              key={journey.id}
              journey={journey}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <JourneyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={handleSaved}
        editJourney={editJourney}
        inboxes={inboxes}
      />
    </div>
  );
}
