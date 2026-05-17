import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DndContext, useDraggable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  MousePointer2, Circle, Square, AlignJustify, Plus, Undo2, Redo2,
  Grid3x3, Download, Upload, Trash2, RefreshCw, Check, Loader2, Copy, Layers,
} from 'lucide-react';
import { floorApi } from '../../services/floorApi';
import { api } from '../../services/api';
import { useFloorStore } from './store';

// ─── Constants ────────────────────────────────────────────────────────────────
function snapPct(val) { return Math.round(val / 2) * 2; }

const MIN_TABLE = 4;
const MIN_ZONE  = 5;

const HANDLE_DEFS = [
  { id: 'nw', cx: 0,   cy: 0,   cursor: 'nw-resize' },
  { id: 'n',  cx: 0.5, cy: 0,   cursor: 'n-resize'  },
  { id: 'ne', cx: 1,   cy: 0,   cursor: 'ne-resize' },
  { id: 'e',  cx: 1,   cy: 0.5, cursor: 'e-resize'  },
  { id: 'se', cx: 1,   cy: 1,   cursor: 'se-resize' },
  { id: 's',  cx: 0.5, cy: 1,   cursor: 's-resize'  },
  { id: 'sw', cx: 0,   cy: 1,   cursor: 'sw-resize' },
  { id: 'w',  cx: 0,   cy: 0.5, cursor: 'w-resize'  },
];

const ZONE_COLORS = ['#06b6d4','#8b5cf6','#f59e0b','#10b981','#f43f5e','#3b82f6','#ec4899','#14b8a6'];

const TOOLS = [
  { id: 'pointer', label: 'Select  (V)',     icon: MousePointer2 },
  { id: 'rect',    label: 'Add Rectangle',   icon: Square },
  { id: 'round',   label: 'Add Round Table', icon: Circle },
  { id: 'booth',   label: 'Add Booth',       icon: AlignJustify },
  { id: 'zone',    label: 'Draw Zone',       icon: Plus },
];

// ─── Form helpers ─────────────────────────────────────────────────────────────
function makeTableForm(t) {
  if (!t) return {};
  return {
    label: t.label ?? '',
    seats_default: t.seats_default ?? 4,
    seats_max: t.seats_max ?? 6,
    x_pct: Math.round(t.x_pct ?? 0),
    y_pct: Math.round(t.y_pct ?? 0),
    w_pct: Math.round(t.w_pct ?? 12),
    h_pct: Math.round(t.h_pct ?? 10),
    rotation_deg: t.rotation_deg ?? 0,
    zone_id: t.zone_id ?? '',
    is_combinable: !!t.is_combinable,
    shape: t.shape ?? 'rect',
  };
}

function makeZoneForm(z) {
  if (!z) return {};
  return {
    name: z.name ?? '',
    color: z.color ?? ZONE_COLORS[0],
    x_pct: Math.round(z.layout_meta?.x_pct ?? 0),
    y_pct: Math.round(z.layout_meta?.y_pct ?? 0),
    w_pct: Math.round(z.layout_meta?.w_pct ?? 20),
    h_pct: Math.round(z.layout_meta?.h_pct ?? 20),
  };
}

// ─── Tooltip-wrapped toolbar button ───────────────────────────────────────────
function ToolBtn({ id, label, icon: Icon, active, onClick, children }) {
  return (
    <div className="relative group w-full">
      <button
        onClick={() => onClick(id)}
        className={`w-full aspect-square flex flex-col items-center justify-center rounded-lg transition-colors ${
          active
            ? 'bg-foreground text-background'
            : 'text-foreground/50 hover:text-foreground hover:bg-foreground/5'
        }`}
      >
        <Icon size={16} />
        {children}
      </button>
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[300] opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-popover border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground whitespace-nowrap shadow-xl">
        {label}
      </div>
    </div>
  );
}

// ─── Draggable + resizable table tile ─────────────────────────────────────────
function DesignerTile({ table, isSelected, onClick, onResizeStart, zoneColor }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: table.id });

  const isRound = table.shape === 'round';
  const borderRadius = isRound ? '50%' : table.shape === 'booth' ? '0.5rem 0.5rem 0 0' : '0.75rem';

  const style = {
    position: 'absolute',
    left: `${table.x_pct}%`,
    top: `${table.y_pct}%`,
    width: `${table.w_pct}%`,
    height: `${table.h_pct}%`,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    rotate: `${table.rotation_deg || 0}deg`,
    backgroundColor: zoneColor ? `${zoneColor}22` : '#1F2630',
    border: `2px solid ${isSelected ? '#06b6d4' : zoneColor ? zoneColor + '88' : '#374151'}`,
    borderRadius,
    cursor: isDragging ? 'grabbing' : 'grab',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: isDragging ? 100 : isSelected ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
    userSelect: 'none',
    boxSizing: 'border-box',
    outline: isSelected ? '2px solid #06b6d4' : 'none',
    outlineOffset: '2px',
    transition: 'border-color 0.15s, background-color 0.15s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(table.id); }}
    >
      <span style={{ color: '#c9d1d9', fontWeight: 700, fontSize: 'clamp(9px,1vw,13px)', pointerEvents: 'none' }}>
        {table.label}
      </span>
      <span style={{ color: '#8b949e', fontSize: 'clamp(7px,0.7vw,10px)', marginTop: 2, pointerEvents: 'none' }}>
        {table.seats_default}p
      </span>

      {isSelected && HANDLE_DEFS.map(h => (
        <div
          key={h.id}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(e, table, h.id); }}
          style={{
            position: 'absolute',
            left: `${h.cx * 100}%`,
            top: `${h.cy * 100}%`,
            width: 10, height: 10,
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#06b6d4',
            border: '2px solid #0e7490',
            borderRadius: '50%',
            cursor: h.cursor,
            zIndex: 200,
          }}
        />
      ))}
    </div>
  );
}

// ─── Input helper — commits on Enter ──────────────────────────────────────────
const commitOnEnter = (e) => { if (e.key === 'Enter') e.target.blur(); };

// ─── Table Properties panel ───────────────────────────────────────────────────
function PropertiesPanel({ table, zones, onChange, onDelete, onRegenQr }) {
  const [form, setForm] = useState(() => makeTableForm(table));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const focusedField = useRef(null);

  useEffect(() => {
    if (!table) return;
    const incoming = makeTableForm(table);
    setForm(prev => {
      const f = focusedField.current;
      if (f && f in incoming) return { ...incoming, [f]: prev[f] };
      return incoming;
    });
  }, [
    table?.id, table?.x_pct, table?.y_pct, table?.w_pct, table?.h_pct,
    table?.shape, table?.rotation_deg, table?.zone_id,
    table?.label, table?.seats_default, table?.seats_max, table?.is_combinable,
  ]); // eslint-disable-line

  if (!table) return null;

  const cls = 'w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/30';
  const field = (label, node) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground/50 uppercase tracking-wide">{label}</label>
      {node}
    </div>
  );

  const numInput = (key, min, max, parser = parseFloat) => (
    <input
      className={cls} type="number" min={min} max={max}
      value={form[key] ?? ''}
      onFocus={() => { focusedField.current = key; }}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      onKeyDown={commitOnEnter}
      onBlur={e => {
        focusedField.current = null;
        const val = Math.max(min, Math.min(max, parser(e.target.value) || min));
        setForm(f => ({ ...f, [key]: val }));
        onChange({ [key]: val });
      }}
    />
  );

  return (
    <div className="w-64 flex-shrink-0 bg-card border border-border rounded-xl p-4 flex flex-col gap-3 overflow-y-auto">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Square size={13} className="text-cyan-400" />Table Properties
      </h3>

      {field('Label',
        <input className={cls} value={form.label ?? ''}
          onFocus={() => { focusedField.current = 'label'; }}
          onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          onKeyDown={commitOnEnter}
          onBlur={e => { focusedField.current = null; onChange({ label: e.target.value }); }}
        />
      )}

      {field('Shape',
        <div className="flex gap-1.5">
          {['rect', 'round', 'booth'].map(s => (
            <button key={s} onClick={() => onChange({ shape: s })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                form.shape === s ? 'bg-foreground text-background border-foreground' : 'border-border text-foreground/60 hover:text-foreground'
              }`}>{s}</button>
          ))}
        </div>
      )}

      {field('Seats (default / max)',
        <div className="flex gap-2">
          {numInput('seats_default', 1, 30, parseInt)}
          {numInput('seats_max', 1, 30, parseInt)}
        </div>
      )}

      {field('Position (x% / y%)',
        <div className="flex gap-2">
          {numInput('x_pct', 0, 96)}
          {numInput('y_pct', 0, 96)}
        </div>
      )}

      {field('Size (w% / h%)',
        <div className="flex gap-2">
          {numInput('w_pct', MIN_TABLE, 60)}
          {numInput('h_pct', MIN_TABLE, 60)}
        </div>
      )}

      {field('Zone',
        <select className={cls} value={form.zone_id ?? ''}
          onChange={e => {
            const v = e.target.value || null;
            setForm(f => ({ ...f, zone_id: v ?? '' }));
            onChange({ zone_id: v });
          }}
        >
          <option value="">No Zone</option>
          {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      )}

      {field('Rotation (°)', numInput('rotation_deg', 0, 359, parseInt))}

      {field('Combinable',
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={!!form.is_combinable}
            onChange={e => { setForm(f => ({ ...f, is_combinable: e.target.checked })); onChange({ is_combinable: e.target.checked }); }}
            className="w-4 h-4 accent-cyan-400" />
          <span className="text-sm text-foreground/70">Allow combining adjacent</span>
        </label>
      )}

      {field('QR Token',
        <div className="flex gap-2">
          <input className={`${cls} flex-1 truncate`} readOnly value={table.qr_token || '—'} />
          <button onClick={async () => { setQrLoading(true); await onRegenQr(table.id); setQrLoading(false); }}
            className="p-1.5 rounded-lg border border-border hover:bg-foreground/5 text-foreground/60" title="Regenerate QR">
            {qrLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>
      )}

      <div className="border-t border-border pt-3 mt-auto">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
            <Trash2 size={14} />Delete Table
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground">Cancel</button>
            <button onClick={() => { onDelete(table.id); setConfirmDelete(false); }}
              className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">Confirm</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Zone Properties panel ────────────────────────────────────────────────────
function ZonePropertiesPanel({ zone, onChange, onDelete }) {
  const [form, setForm] = useState(() => makeZoneForm(zone));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const focusedField = useRef(null);

  useEffect(() => {
    if (!zone) return;
    const incoming = makeZoneForm(zone);
    setForm(prev => {
      const f = focusedField.current;
      if (f && f in incoming) return { ...incoming, [f]: prev[f] };
      return incoming;
    });
  }, [
    zone?.id, zone?.name, zone?.color,
    zone?.layout_meta?.x_pct, zone?.layout_meta?.y_pct,
    zone?.layout_meta?.w_pct, zone?.layout_meta?.h_pct,
  ]); // eslint-disable-line

  if (!zone) return null;

  const cls = 'w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/30';
  const field = (label, node) => (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground/50 uppercase tracking-wide">{label}</label>
      {node}
    </div>
  );

  // Compute final layout_meta from form + one override, then call onChange
  const commitLayout = (fieldKey, val) => {
    const meta = {
      x_pct: parseFloat(fieldKey === 'x_pct' ? val : form.x_pct) || 0,
      y_pct: parseFloat(fieldKey === 'y_pct' ? val : form.y_pct) || 0,
      w_pct: parseFloat(fieldKey === 'w_pct' ? val : form.w_pct) || 20,
      h_pct: parseFloat(fieldKey === 'h_pct' ? val : form.h_pct) || 20,
    };
    onChange({ layout_meta: meta });
  };

  const layoutInput = (key, min, max) => (
    <input className={cls} type="number" min={min} max={max}
      value={form[key] ?? ''}
      onFocus={() => { focusedField.current = key; }}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      onKeyDown={commitOnEnter}
      onBlur={e => {
        focusedField.current = null;
        const val = Math.max(min, Math.min(max, parseFloat(e.target.value) || min));
        setForm(f => ({ ...f, [key]: val }));
        commitLayout(key, val);
      }}
    />
  );

  return (
    <div className="w-64 flex-shrink-0 bg-card border border-border rounded-xl p-4 flex flex-col gap-3 overflow-y-auto">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Layers size={13} className="text-purple-400" />Zone Properties
      </h3>

      {field('Name',
        <input className={cls} value={form.name ?? ''}
          onFocus={() => { focusedField.current = 'name'; }}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          onKeyDown={commitOnEnter}
          onBlur={e => { focusedField.current = null; onChange({ name: e.target.value }); }}
        />
      )}

      {field('Color',
        <div className="flex flex-wrap gap-2 pt-0.5">
          {ZONE_COLORS.map(c => (
            <button key={c}
              onClick={() => { setForm(f => ({ ...f, color: c })); onChange({ color: c }); }}
              style={{
                backgroundColor: c,
                border: form.color === c ? '3px solid white' : '3px solid transparent',
                boxShadow: form.color === c ? `0 0 0 1px ${c}` : 'none',
              }}
              className="w-7 h-7 rounded-full transition-transform hover:scale-110"
            />
          ))}
        </div>
      )}

      <p className="text-xs text-foreground/35 -mt-1">Drag zone corners/edges on canvas to resize · drag body to move</p>

      {field('Position (x% / y%)',
        <div className="flex gap-2">
          {layoutInput('x_pct', 0, 96)}
          {layoutInput('y_pct', 0, 96)}
        </div>
      )}

      {field('Size (w% / h%)',
        <div className="flex gap-2">
          {layoutInput('w_pct', MIN_ZONE, 100)}
          {layoutInput('h_pct', MIN_ZONE, 100)}
        </div>
      )}

      <div className="border-t border-border pt-3 mt-auto">
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors">
            <Trash2 size={14} />Delete Zone
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground">Cancel</button>
            <button onClick={() => { onDelete(zone.id); setConfirmDelete(false); }}
              className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">Confirm</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state panel ────────────────────────────────────────────────────────
function EmptyPanel({ tableCount, zoneCount }) {
  return (
    <div className="w-64 flex-shrink-0 bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center">
      <MousePointer2 size={20} className="text-foreground/30" />
      <p className="text-sm text-foreground/40">Select a table or zone<br />to edit its properties</p>
      <p className="text-xs text-foreground/25 mt-1">Arrow keys nudge · Shift+Arrow = 5%</p>
      <div className="mt-4 w-full border-t border-border pt-4 space-y-2">
        <div className="flex justify-between text-xs text-foreground/30">
          <span>Tables</span><span className="font-semibold">{tableCount}</span>
        </div>
        <div className="flex justify-between text-xs text-foreground/30">
          <span>Zones</span><span className="font-semibold">{zoneCount}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────
function ImportModal({ tables, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-2xl p-6 w-[480px] max-h-[70vh] flex flex-col gap-4">
        <h2 className="text-lg font-bold text-foreground">Import Layout</h2>
        <p className="text-sm text-foreground/60">{tables.length} table(s) found. They will be added to existing tables.</p>
        <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border">
          {tables.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-foreground font-medium">{t.label}</span>
              <span className="text-xs text-foreground/40">{t.shape} · {t.seats_default}p</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold">Import All</button>
        </div>
      </div>
    </div>
  );
}

// ─── Zone name dialog ─────────────────────────────────────────────────────────
function ZoneNameDialog({ zoneName, onNameChange, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-2xl p-6 w-80 flex flex-col gap-4">
        <h2 className="text-base font-bold text-foreground">Name this zone</h2>
        <input autoFocus
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          value={zoneName}
          onChange={e => onNameChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onConfirm(); if (e.key === 'Escape') onCancel(); }}
          placeholder="e.g. Main Hall, Patio, Bar"
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-600">Create Zone</button>
        </div>
      </div>
    </div>
  );
}

// ─── Zone geometry helpers ────────────────────────────────────────────────────
function computeZoneResize(handle, origMeta, dx, dy) {
  let { x_pct, y_pct, w_pct, h_pct } = origMeta;
  if (handle.includes('e')) w_pct = Math.max(MIN_ZONE, origMeta.w_pct + dx);
  if (handle.includes('s')) h_pct = Math.max(MIN_ZONE, origMeta.h_pct + dy);
  if (handle.includes('w')) {
    const nw = Math.max(MIN_ZONE, origMeta.w_pct - dx);
    x_pct = origMeta.x_pct + (origMeta.w_pct - nw);
    w_pct = nw;
  }
  if (handle.includes('n')) {
    const nh = Math.max(MIN_ZONE, origMeta.h_pct - dy);
    y_pct = origMeta.y_pct + (origMeta.h_pct - nh);
    h_pct = nh;
  }
  x_pct = Math.max(0, Math.min(x_pct, 100 - w_pct));
  y_pct = Math.max(0, Math.min(y_pct, 100 - h_pct));
  return { x_pct, y_pct, w_pct, h_pct };
}

// ─── Main Designer ────────────────────────────────────────────────────────────
export default function FloorDesigner() {
  const {
    tables, zones, selectedTableId, selectedZoneId,
    setTables, setZones, addZone, updateZone, removeZone,
    setOutlet, outletId,
    updateTable, removeTable, setSelectedTable, setSelectedZone,
    pushHistory, undo, redo, historyIndex, history,
  } = useFloorStore();

  // Require 5px of movement before a drag starts — keeps clicks from triggering onDragEnd
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [outlets, setOutlets] = useState([]);
  const [activeTool, setActiveTool] = useState('pointer');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [saveState, setSaveState] = useState('saved');
  const [lastSaved, setLastSaved] = useState(Date.now());
  const [tick, setTick] = useState(0);
  const [importData, setImportData] = useState(null);

  // Zone draw state
  const [zoneDraw, setZoneDraw] = useState(null);
  const [pendingZone, setPendingZone] = useState(null);
  const [zoneNameInput, setZoneNameInput] = useState('');
  const zoneDrawRef = useRef(null);

  const canvasRef    = useRef(null);
  const saveTimerRef = useRef(null);
  const nudgeTimerRef = useRef(null);
  const fileInputRef  = useRef(null);

  // Table resize state
  const tableResizeRef = useRef(null); // { tableId, handle, origTable, canvasRect, startX, startY }

  // Zone move/resize state
  const zoneInteractionRef = useRef(null); // { type:'move'|'resize', zoneId, origZone, canvasRect, startX, startY, handle?, moved }
  const zoneDraggedRef = useRef(false); // suppress onClick after a drag

  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Live save-timer tick
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  // Fetch outlets
  useEffect(() => {
    api.getOutlets().then(res => {
      const list = res.data || [];
      setOutlets(list);
      if (list.length > 0 && !outletId) setOutlet(list[0].id);
    }).catch(() => {});
  }, []); // eslint-disable-line

  const fetchFloorData = useCallback(async (oId) => {
    if (!oId) return;
    try {
      const [tablesRes, zonesRes] = await Promise.all([
        floorApi.getTables({ outlet_id: oId }),
        floorApi.getZones(oId),
      ]);
      setTables(tablesRes.data || []);
      setZones(zonesRes.data || []);
    } catch (e) {}
  }, [setTables, setZones]);

  useEffect(() => {
    if (outletId) fetchFloorData(outletId);
  }, [outletId, fetchFloorData]);

  // ── Autosave indicator ──────────────────────────────────────────────────────
  const triggerSaving = useCallback(() => {
    setSaveState('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      setSaveState('saved');
      setLastSaved(Date.now());
    }, 1200);
  }, []);

  const persistTableUpdate = useCallback(async (id, data) => {
    try {
      const res = await floorApi.updateTable(id, data);
      updateTable(res.data);
    } catch (e) { console.error('Failed to save table', e); }
  }, [updateTable]);

  // ── Table resize (window pointer events) ───────────────────────────────────
  const handleTableResizeStart = useCallback((e, table, handle) => {
    if (!canvasRef.current) return;
    pushHistory();
    tableResizeRef.current = {
      tableId: table.id,
      handle,
      origTable: { ...table },
      canvasRect: canvasRef.current.getBoundingClientRect(),
      startX: e.clientX,
      startY: e.clientY,
    };
    document.body.style.cursor = HANDLE_DEFS.find(h => h.id === handle)?.cursor || 'default';
    document.body.style.userSelect = 'none';
  }, [pushHistory]);

  useEffect(() => {
    const computeTableGeom = (e) => {
      const { handle, origTable, canvasRect, startX, startY } = tableResizeRef.current;
      const dx = ((e.clientX - startX) / canvasRect.width)  * 100;
      const dy = ((e.clientY - startY) / canvasRect.height) * 100;
      let { x_pct, y_pct, w_pct, h_pct } = origTable;
      if (handle.includes('e')) w_pct = Math.max(MIN_TABLE, origTable.w_pct + dx);
      if (handle.includes('s')) h_pct = Math.max(MIN_TABLE, origTable.h_pct + dy);
      if (handle.includes('w')) {
        const nw = Math.max(MIN_TABLE, origTable.w_pct - dx);
        x_pct = origTable.x_pct + (origTable.w_pct - nw);
        w_pct = nw;
      }
      if (handle.includes('n')) {
        const nh = Math.max(MIN_TABLE, origTable.h_pct - dy);
        y_pct = origTable.y_pct + (origTable.h_pct - nh);
        h_pct = nh;
      }
      x_pct = Math.max(0, Math.min(x_pct, 100 - w_pct));
      y_pct = Math.max(0, Math.min(y_pct, 100 - h_pct));
      return { x_pct, y_pct, w_pct, h_pct };
    };

    const onMove = (e) => {
      if (!tableResizeRef.current) return;
      updateTable({ ...tableResizeRef.current.origTable, ...computeTableGeom(e) });
    };
    const onUp = async (e) => {
      if (!tableResizeRef.current) return;
      const { tableId } = tableResizeRef.current;
      const geom = computeTableGeom(e);
      tableResizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      triggerSaving();
      await persistTableUpdate(tableId, geom);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [updateTable, triggerSaving, persistTableUpdate]);

  // ── Zone move + resize (window pointer events) ─────────────────────────────
  const handleZoneInteractionStart = useCallback((e, zone, type, handle = null) => {
    if (!canvasRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    zoneInteractionRef.current = {
      type,
      zoneId: zone.id,
      origZone: { ...zone, layout_meta: { ...zone.layout_meta } },
      canvasRect: canvasRef.current.getBoundingClientRect(),
      startX: e.clientX,
      startY: e.clientY,
      handle,
      moved: false,
    };
    if (type === 'resize') {
      document.body.style.cursor = HANDLE_DEFS.find(h => h.id === handle)?.cursor || 'default';
    } else {
      document.body.style.cursor = 'grabbing';
    }
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!zoneInteractionRef.current) return;
      const { type, origZone, canvasRect, startX, startY, handle } = zoneInteractionRef.current;
      const dx = ((e.clientX - startX) / canvasRect.width)  * 100;
      const dy = ((e.clientY - startY) / canvasRect.height) * 100;
      const origMeta = origZone.layout_meta;

      if (type === 'move') {
        if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return;
        zoneInteractionRef.current.moved = true;
        const newMeta = {
          ...origMeta,
          x_pct: Math.max(0, Math.min(100 - origMeta.w_pct, origMeta.x_pct + dx)),
          y_pct: Math.max(0, Math.min(100 - origMeta.h_pct, origMeta.y_pct + dy)),
        };
        updateZone({ ...origZone, layout_meta: newMeta });
      } else {
        updateZone({ ...origZone, layout_meta: computeZoneResize(handle, origMeta, dx, dy) });
      }
    };

    const onUp = async (e) => {
      if (!zoneInteractionRef.current) return;
      const { type, zoneId, origZone, canvasRect, startX, startY, handle, moved } = zoneInteractionRef.current;
      zoneInteractionRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const dx = ((e.clientX - startX) / canvasRect.width)  * 100;
      const dy = ((e.clientY - startY) / canvasRect.height) * 100;
      const origMeta = origZone.layout_meta;

      let newMeta;
      if (type === 'move') {
        if (!moved) return; // was a click — let onClick handle selection
        zoneDraggedRef.current = true;
        newMeta = {
          ...origMeta,
          x_pct: Math.max(0, Math.min(100 - origMeta.w_pct, origMeta.x_pct + dx)),
          y_pct: Math.max(0, Math.min(100 - origMeta.h_pct, origMeta.y_pct + dy)),
        };
      } else {
        newMeta = computeZoneResize(handle, origMeta, dx, dy);
      }

      triggerSaving();
      try {
        const res = await floorApi.updateZone(zoneId, { layout_meta: newMeta });
        updateZone(res.data);
      } catch (err) {}
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [updateZone, triggerSaving]);

  // ── Delete / Duplicate ─────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id) => {
    pushHistory();
    removeTable(id);
    setSelectedTable(null);
    try { await floorApi.deleteTable(id); triggerSaving(); } catch (e) {}
  }, [pushHistory, removeTable, setSelectedTable, triggerSaving]);

  const handleZoneDelete = useCallback(async (id) => {
    removeZone(id);
    setSelectedZone(null);
    try { await floorApi.deleteZone(id); triggerSaving(); } catch (e) {}
  }, [removeZone, setSelectedZone, triggerSaving]);

  const handleDuplicate = useCallback(async (id) => {
    const table = tables[id];
    if (!table || !outletId) return;
    pushHistory();
    const nums = Object.values(tables).map(t => parseInt(t.label?.replace(/^T/, '') || '0')).filter(n => !isNaN(n));
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    try {
      const res = await floorApi.createTable({
        outlet_id: outletId, zone_id: table.zone_id,
        label: `T${nextNum}`, shape: table.shape,
        x_pct: Math.min(table.x_pct + 5, 100 - table.w_pct),
        y_pct: Math.min(table.y_pct + 5, 100 - table.h_pct),
        w_pct: table.w_pct, h_pct: table.h_pct,
        seats_default: table.seats_default, seats_max: table.seats_max,
      });
      updateTable(res.data);
      setSelectedTable(res.data.id);
      triggerSaving();
    } catch (e) {}
  }, [tables, outletId, pushHistory, updateTable, setSelectedTable, triggerSaving]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrl = isMac ? e.metaKey : e.ctrlKey;
      const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);

      if (ctrl && e.shiftKey && e.key === 'z') { e.preventDefault(); redo(); return; }
      if (ctrl && e.key === 'z')               { e.preventDefault(); undo(); return; }
      if (ctrl && e.key === 'd') { e.preventDefault(); if (selectedTableId) handleDuplicate(selectedTableId); return; }

      if (e.key === 'Escape') { setSelectedTable(null); setSelectedZone(null); setActiveTool('pointer'); return; }
      if (e.key === 'v' && !inInput) { setActiveTool('pointer'); return; }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
        if (selectedTableId) { if (window.confirm('Delete selected table?')) handleDelete(selectedTableId); }
        else if (selectedZoneId) { if (window.confirm('Delete selected zone?')) handleZoneDelete(selectedZoneId); }
        return;
      }

      // Arrow nudge (tables only)
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && selectedTableId && !inInput) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        const table = tables[selectedTableId];
        if (!table) return;
        let { x_pct, y_pct } = table;
        if (e.key === 'ArrowLeft')  x_pct = Math.max(0, x_pct - step);
        if (e.key === 'ArrowRight') x_pct = Math.min(100 - table.w_pct, x_pct + step);
        if (e.key === 'ArrowUp')    y_pct = Math.max(0, y_pct - step);
        if (e.key === 'ArrowDown')  y_pct = Math.min(100 - table.h_pct, y_pct + step);
        updateTable({ ...table, x_pct, y_pct });
        if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = setTimeout(() => { persistTableUpdate(selectedTableId, { x_pct, y_pct }); triggerSaving(); }, 400);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedTableId, selectedZoneId, tables, undo, redo, updateTable, handleDelete, handleZoneDelete, handleDuplicate]); // eslint-disable-line

  // ── DnD drag end ───────────────────────────────────────────────────────────
  const handleDragEnd = useCallback(async (event) => {
    const { active, delta } = event;
    if (!active || !canvasRef.current) return;
    if (Math.abs(delta.x) < 1 && Math.abs(delta.y) < 1) return; // was a click, not a drag
    const rect = canvasRef.current.getBoundingClientRect();
    const table = tables[active.id];
    if (!table) return;
    pushHistory();
    let newX = table.x_pct + (delta.x / rect.width) * 100;
    let newY = table.y_pct + (delta.y / rect.height) * 100;
    newX = Math.max(0, Math.min(newX, 100 - table.w_pct));
    newY = Math.max(0, Math.min(newY, 100 - table.h_pct));
    if (snapEnabled) { newX = snapPct(newX); newY = snapPct(newY); }
    updateTable({ ...table, x_pct: newX, y_pct: newY });
    triggerSaving();
    await persistTableUpdate(table.id, { x_pct: newX, y_pct: newY });
  }, [tables, snapEnabled, pushHistory, updateTable, triggerSaving, persistTableUpdate]);

  // ── Place table on canvas click ────────────────────────────────────────────
  // IMPORTANT: only act on direct canvas background clicks (e.target === canvas),
  // not on bubbled events from table tiles or zone divs.
  const handleCanvasClick = useCallback(async (e) => {
    const isCanvasDirect = e.target === canvasRef.current;

    if (activeTool === 'pointer' || activeTool === 'zone') {
      if (isCanvasDirect) { setSelectedTable(null); setSelectedZone(null); }
      return;
    }

    // Only place tables on direct background clicks — prevents creating a table
    // when clicking on an existing tile while a shape tool is active.
    if (!isCanvasDirect || !outletId) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let xPct = ((e.clientX - rect.left) / rect.width) * 100;
    let yPct = ((e.clientY - rect.top)  / rect.height) * 100;
    if (snapEnabled) { xPct = snapPct(xPct); yPct = snapPct(yPct); }
    const w = 12, h = 10;
    xPct = Math.max(0, Math.min(xPct - w / 2, 100 - w));
    yPct = Math.max(0, Math.min(yPct - h / 2, 100 - h));

    const nums = Object.values(tables).map(t => parseInt(t.label?.replace(/^T/, '') || '0')).filter(n => !isNaN(n));
    const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;

    try {
      pushHistory();
      const res = await floorApi.createTable({
        outlet_id: outletId, zone_id: null,
        label: `T${nextNum}`, shape: activeTool,
        x_pct: xPct, y_pct: yPct, w_pct: w, h_pct: h,
        seats_default: 4, seats_max: 6,
      });
      updateTable(res.data);
      setSelectedTable(res.data.id);
      setSelectedZone(null);
      setActiveTool('pointer');
      triggerSaving();
    } catch (e) { console.error('Failed to create table', e); }
  }, [activeTool, outletId, tables, snapEnabled, pushHistory, updateTable, setSelectedTable, setSelectedZone, triggerSaving]); // eslint-disable-line

  // ── Table property change ──────────────────────────────────────────────────
  const handlePropertyChange = useCallback(async (data) => {
    if (!selectedTableId) return;
    const table = tables[selectedTableId];
    updateTable({ ...table, ...data });
    triggerSaving();
    await persistTableUpdate(selectedTableId, data);
  }, [selectedTableId, tables, updateTable, triggerSaving, persistTableUpdate]);

  // ── Zone property change ───────────────────────────────────────────────────
  const handleZonePropertyChange = useCallback(async (data) => {
    if (!selectedZoneId) return;
    const zone = zones.find(z => z.id === selectedZoneId);
    if (!zone) return;
    updateZone({ ...zone, ...data });
    triggerSaving();
    try {
      const res = await floorApi.updateZone(selectedZoneId, data);
      updateZone(res.data);
    } catch (e) { console.error('Failed to save zone', e); }
  }, [selectedZoneId, zones, updateZone, triggerSaving]);

  // ── QR regen ───────────────────────────────────────────────────────────────
  const handleRegenQr = async (id) => {
    try {
      const res = await floorApi.regenerateQr(id);
      updateTable({ ...tables[id], qr_token: res.data.qr_token });
    } catch (e) {}
  };

  // ── Zone drawing ───────────────────────────────────────────────────────────
  const handleZonePointerDown = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x1 = ((e.clientX - rect.left) / rect.width) * 100;
    const y1 = ((e.clientY - rect.top)  / rect.height) * 100;
    zoneDrawRef.current = { canvasRect: rect };
    setZoneDraw({ x1, y1, x2: x1, y2: y1 });
  };

  const handleZonePointerMove = (e) => {
    if (!zoneDrawRef.current) return;
    const { canvasRect } = zoneDrawRef.current;
    const x2 = Math.max(0, Math.min(100, ((e.clientX - canvasRect.left) / canvasRect.width) * 100));
    const y2 = Math.max(0, Math.min(100, ((e.clientY - canvasRect.top)  / canvasRect.height) * 100));
    setZoneDraw(d => d ? { ...d, x2, y2 } : null);
  };

  const handleZonePointerUp = () => {
    if (!zoneDrawRef.current || !zoneDraw) return;
    zoneDrawRef.current = null;
    const w = Math.abs(zoneDraw.x2 - zoneDraw.x1);
    const h = Math.abs(zoneDraw.y2 - zoneDraw.y1);
    if (w < 3 || h < 3) { setZoneDraw(null); return; }
    setPendingZone(zoneDraw);
    setZoneDraw(null);
    setZoneNameInput(`Zone ${zones.length + 1}`);
  };

  const handleCreateZone = async () => {
    if (!pendingZone || !outletId) return;
    const x_pct = Math.min(pendingZone.x1, pendingZone.x2);
    const y_pct = Math.min(pendingZone.y1, pendingZone.y2);
    const w_pct = Math.abs(pendingZone.x2 - pendingZone.x1);
    const h_pct = Math.abs(pendingZone.y2 - pendingZone.y1);
    const color = ZONE_COLORS[zones.length % ZONE_COLORS.length];
    try {
      const res = await floorApi.createZone({
        outlet_id: outletId,
        name: zoneNameInput.trim() || 'New Zone',
        color,
        layout_meta: { x_pct, y_pct, w_pct, h_pct },
      });
      addZone(res.data);
      setPendingZone(null);
      setZoneNameInput('');
      setSelectedZone(res.data.id);
      setSelectedTable(null);
      setActiveTool('pointer');
    } catch (e) { console.error(e); }
  };

  // ── Export / Import ────────────────────────────────────────────────────────
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(Object.values(tables), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'floor-layout.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (Array.isArray(data)) setImportData(data);
        else alert('Invalid layout file');
      } catch { alert('Could not parse JSON'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = async () => {
    if (!importData || !outletId) return;
    for (const t of importData) {
      try {
        const res = await floorApi.createTable({
          outlet_id: outletId, label: t.label, shape: t.shape || 'rect',
          x_pct: t.x_pct || 10, y_pct: t.y_pct || 10,
          w_pct: t.w_pct || 12, h_pct: t.h_pct || 10,
          seats_default: t.seats_default || 4, seats_max: t.seats_max || 6,
          zone_id: null,
        });
        updateTable(res.data);
      } catch (e) {}
    }
    setImportData(null);
    triggerSaving();
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedTable = selectedTableId ? tables[selectedTableId] : null;
  const selectedZone  = selectedZoneId  ? zones.find(z => z.id === selectedZoneId) : null;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const tableCount = Object.values(tables).length;

  const zoneMap = {};
  zones.forEach(z => { zoneMap[z.id] = z; });

  const savedAgo = (() => {
    void tick;
    const s = Math.round((Date.now() - lastSaved) / 1000);
    if (s < 5) return 'just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.round(s / 60)}m ago`;
  })();

  if (isMobile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm text-center">
          <Grid3x3 size={32} className="text-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Desktop Only</h2>
          <p className="text-sm text-foreground/50">Floor Plan Designer requires a desktop screen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-foreground">Floor Plan Designer</h2>
          <select
            className="bg-card border border-border rounded-xl px-3 py-1.5 text-sm text-foreground focus:outline-none"
            value={outletId || ''}
            onChange={e => { setOutlet(e.target.value); setSelectedTable(null); setSelectedZone(null); }}
          >
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
            saveState === 'saving' ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'
          }`}>
            {saveState === 'saving'
              ? <><Loader2 size={11} className="animate-spin" />Saving…</>
              : <><Check size={11} />Saved {savedAgo}</>
            }
          </span>

          {selectedTableId && (
            <button onClick={() => handleDuplicate(selectedTableId)} title="Duplicate (⌘D)"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground transition-colors">
              <Copy size={13} />Duplicate
            </button>
          )}

          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground transition-colors">
            <Download size={13} />Export
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm text-foreground/60 hover:text-foreground transition-colors">
            <Upload size={13} />Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />

          <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)"
            className="p-1.5 rounded-lg border border-border text-foreground/60 hover:text-foreground disabled:opacity-30 transition-colors">
            <Undo2 size={15} />
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)"
            className="p-1.5 rounded-lg border border-border text-foreground/60 hover:text-foreground disabled:opacity-30 transition-colors">
            <Redo2 size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Left tool palette */}
        <div className="w-14 flex-shrink-0 bg-card border border-border rounded-xl p-2 flex flex-col items-center gap-1.5 overflow-visible">
          {TOOLS.map(t => (
            <ToolBtn key={t.id} {...t} active={activeTool === t.id} onClick={setActiveTool} />
          ))}
          <div className="w-full h-px bg-border my-1" />
          <div className="relative group w-full">
            <button
              onClick={() => setSnapEnabled(s => !s)}
              className={`w-full aspect-square flex flex-col items-center justify-center rounded-lg transition-colors ${
                snapEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'text-foreground/40 hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              <Grid3x3 size={15} />
              <span style={{ fontSize: 8 }}>{snapEnabled ? 'ON' : 'OFF'}</span>
            </button>
            <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[300] opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-popover border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground whitespace-nowrap shadow-xl">
              Snap to Grid (2%)
            </div>
          </div>
        </div>

        {/* Canvas */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="flex-1 relative bg-card border border-border rounded-xl overflow-hidden"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              cursor: activeTool === 'zone' ? 'crosshair' : activeTool === 'pointer' ? 'default' : 'crosshair',
            }}
          >
            {/* Zone backgrounds with move + resize handles */}
            {zones.filter(z => z.layout_meta?.x_pct !== undefined).map(z => {
              const isZoneSel = selectedZoneId === z.id;
              const meta = z.layout_meta;
              const zColor = z.color || '#06b6d4';
              return (
                <div key={z.id}
                  style={{
                    position: 'absolute',
                    left: `${meta.x_pct}%`, top: `${meta.y_pct}%`,
                    width: `${meta.w_pct}%`, height: `${meta.h_pct}%`,
                    backgroundColor: `${zColor}${isZoneSel ? '28' : '18'}`,
                    border: `${isZoneSel ? '2px' : '1.5px'} solid ${zColor}${isZoneSel ? 'cc' : '35'}`,
                    borderRadius: '0.75rem',
                    zIndex: 0,
                    pointerEvents: activeTool === 'pointer' ? 'auto' : 'none',
                    cursor: isZoneSel ? 'move' : 'pointer',
                    outline: isZoneSel ? `2px solid ${zColor}55` : 'none',
                    outlineOffset: 3,
                    transition: 'border-color 0.15s, background-color 0.15s',
                    boxSizing: 'border-box',
                  }}
                  onPointerDown={(e) => {
                    if (activeTool !== 'pointer') return;
                    // Select immediately, then start potential drag
                    setSelectedZone(z.id);
                    setSelectedTable(null);
                    handleZoneInteractionStart(e, z, 'move');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (zoneDraggedRef.current) { zoneDraggedRef.current = false; return; }
                    // Toggle deselect on clicking the already-selected zone
                    if (isZoneSel) setSelectedZone(null);
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 6, left: 10,
                    fontSize: 11, fontWeight: 700,
                    color: zColor, opacity: isZoneSel ? 0.9 : 0.6,
                    pointerEvents: 'none', userSelect: 'none',
                  }}>{z.name}</span>

                  {/* Zone resize handles — only when selected */}
                  {isZoneSel && HANDLE_DEFS.map(h => (
                    <div
                      key={h.id}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        handleZoneInteractionStart(e, z, 'resize', h.id);
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        left: `${h.cx * 100}%`, top: `${h.cy * 100}%`,
                        width: 10, height: 10,
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: zColor,
                        border: '2px solid white',
                        borderRadius: '50%',
                        cursor: h.cursor,
                        zIndex: 5,
                      }}
                    />
                  ))}
                </div>
              );
            })}

            {/* Zone draw preview */}
            {zoneDraw && (
              <div style={{
                position: 'absolute',
                left: `${Math.min(zoneDraw.x1, zoneDraw.x2)}%`,
                top: `${Math.min(zoneDraw.y1, zoneDraw.y2)}%`,
                width: `${Math.abs(zoneDraw.x2 - zoneDraw.x1)}%`,
                height: `${Math.abs(zoneDraw.y2 - zoneDraw.y1)}%`,
                backgroundColor: 'rgba(6,182,212,0.12)',
                border: '2px dashed #06b6d4',
                borderRadius: '0.5rem',
                pointerEvents: 'none',
                zIndex: 51,
              }} />
            )}

            {/* Table tiles */}
            {Object.values(tables).map(table => (
              <DesignerTile
                key={table.id}
                table={table}
                isSelected={selectedTableId === table.id}
                onResizeStart={handleTableResizeStart}
                zoneColor={table.zone_id ? zoneMap[table.zone_id]?.color : null}
                onClick={(id) => {
                  setSelectedTable(id === selectedTableId ? null : id);
                  setSelectedZone(null);
                  setActiveTool('pointer');
                }}
              />
            ))}

            {/* Zone draw overlay — captures pointer when zone tool active */}
            {activeTool === 'zone' && (
              <div
                style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: 'crosshair' }}
                onPointerDown={handleZonePointerDown}
                onPointerMove={handleZonePointerMove}
                onPointerUp={handleZonePointerUp}
              />
            )}

            {tableCount === 0 && activeTool === 'pointer' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-foreground/20 text-sm font-medium">
                  Pick a shape on the left, then click to place a table
                </p>
              </div>
            )}
          </div>
        </DndContext>

        {/* Right panel */}
        {selectedTable ? (
          <PropertiesPanel
            key={selectedTable.id}
            table={selectedTable}
            zones={zones}
            onChange={handlePropertyChange}
            onDelete={handleDelete}
            onRegenQr={handleRegenQr}
          />
        ) : selectedZone ? (
          <ZonePropertiesPanel
            key={selectedZone.id}
            zone={selectedZone}
            onChange={handleZonePropertyChange}
            onDelete={handleZoneDelete}
          />
        ) : (
          <EmptyPanel tableCount={tableCount} zoneCount={zones.length} />
        )}
      </div>

      {importData && (
        <ImportModal tables={importData} onConfirm={confirmImport} onCancel={() => setImportData(null)} />
      )}
      {pendingZone && (
        <ZoneNameDialog
          zoneName={zoneNameInput}
          onNameChange={setZoneNameInput}
          onConfirm={handleCreateZone}
          onCancel={() => { setPendingZone(null); setZoneNameInput(''); }}
        />
      )}
    </div>
  );
}
