import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Wifi, WifiOff, RefreshCw, Sparkles } from 'lucide-react';
import { floorApi } from '../../services/floorApi';
import { api } from '../../services/api';
import { useFloorStore } from './store';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const STATUS_COLORS = {
  available:      { bg: '#22c55e22', border: '#22c55e', text: '#22c55e' },
  reserved:       { bg: '#f59e0b22', border: '#f59e0b', text: '#f59e0b' },
  occupied:       { bg: '#3b82f622', border: '#3b82f6', text: '#3b82f6' },
  settling:       { bg: '#8b5cf622', border: '#8b5cf6', text: '#8b5cf6' },
  cleaning:       { bg: '#06b6d422', border: '#06b6d4', text: '#06b6d4' },
  blocked:        { bg: '#6b728022', border: '#6b7280', text: '#6b7280' },
  out_of_service: { bg: '#ef444422', border: '#ef4444', text: '#ef4444' },
};

const ACTION_MAP = {
  available:      [{ to: 'occupied',  label: 'Seat Walk-in', color: '#22c55e' }, { to: 'blocked', label: 'Block', color: '#6b7280' }],
  reserved:       [{ to: 'occupied',  label: 'Seat Now',     color: '#3b82f6' }, { to: 'available', label: 'Mark No-show', color: '#ef4444' }],
  occupied:       [{ to: 'settling',  label: 'Mark Settling', color: '#8b5cf6' }],
  settling:       [{ to: 'cleaning',  label: 'Mark Cleaning', color: '#06b6d4' }],
  cleaning:       [{ to: 'available', label: 'Mark Available', color: '#22c55e' }],
  blocked:        [{ to: 'available', label: 'Mark Available', color: '#22c55e' }],
  out_of_service: [{ to: 'available', label: 'Mark Available', color: '#22c55e' }],
};

function formatElapsed(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 right-4 z-50 bg-red-500 text-white px-4 py-3 rounded-xl shadow-2xl text-sm font-medium flex items-center gap-2">
      <X size={14} onClick={onDismiss} className="cursor-pointer" />
      {message}
    </div>
  );
}

function TableTile({ table, now, onClick, isSelected }) {
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.available;
  const elapsed = table.status_since
    ? Math.floor((now - new Date(table.status_since).getTime()) / 1000)
    : 0;

  const isRound = table.shape === 'round';
  const borderRadius = isRound ? '50%' : '0.75rem';

  return (
    <div
      onClick={() => onClick(table.id)}
      style={{
        position: 'absolute',
        left: `${table.x_pct}%`,
        top: `${table.y_pct}%`,
        width: `${table.w_pct}%`,
        height: `${table.h_pct}%`,
        transform: `rotate(${table.rotation_deg || 0}deg)`,
        backgroundColor: colors.bg,
        border: `2px solid ${colors.border}`,
        borderRadius,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 200ms ease',
        boxSizing: 'border-box',
        outline: isSelected ? `2px solid #06b6d4` : 'none',
        outlineOffset: '2px',
        userSelect: 'none',
        zIndex: isSelected ? 10 : 1,
      }}
    >
      <span style={{ color: colors.text, fontWeight: 700, fontSize: 'clamp(10px, 1.2vw, 15px)', lineHeight: 1 }}>
        {table.label}
      </span>
      <span style={{ color: colors.text, fontSize: 'clamp(8px, 0.8vw, 11px)', marginTop: 2, textTransform: 'capitalize', opacity: 0.85 }}>
        {table.status}
      </span>
      {table.status === 'occupied' && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: colors.border, marginTop: 3, animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
      )}
      {elapsed > 0 && (
        <span style={{ color: colors.text, fontSize: 'clamp(7px, 0.7vw, 10px)', marginTop: 1, opacity: 0.7 }}>
          {formatElapsed(elapsed)}
        </span>
      )}
    </div>
  );
}

function ActionSheet({ table, onClose, onTransition }) {
  const now = Date.now();
  const elapsed = table.status_since
    ? Math.floor((now - new Date(table.status_since).getTime()) / 1000)
    : 0;
  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.available;
  const actions = ACTION_MAP[table.status] || [];

  // Filter by allowed_next_states if provided
  const allowedActions = table.allowed_next_states?.length
    ? actions.filter(a => table.allowed_next_states.includes(a.to))
    : actions;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl p-6 shadow-2xl border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-foreground">{table.label}</span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full capitalize"
                style={{ backgroundColor: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                {table.status}
              </span>
            </div>
            {elapsed > 0 && (
              <p className="text-sm text-foreground/50 mt-0.5">
                In this state for {formatElapsed(elapsed)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-foreground/10 text-foreground/60">
            <X size={20} />
          </button>
        </div>

        {allowedActions.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {allowedActions.map(action => (
              <button
                key={action.to}
                onClick={() => onTransition(table.id, action.to)}
                className="flex-1 min-w-[140px] py-3 px-4 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 active:opacity-75"
                style={{ backgroundColor: action.color }}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground/50">No actions available for this status.</p>
        )}
      </div>
    </>
  );
}

export default function LiveFloorView() {
  const { tables, setTables, updateTable, setZones, setOutlet, outletId } = useFloorStore();
  const [outlets, setOutlets] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [toast, setToast] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [wsStatus, setWsStatus] = useState('connected'); // 'connected' | 'reconnecting'
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  // Single interval for time tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch outlets
  useEffect(() => {
    api.getOutlets().then(res => {
      const list = res.data || [];
      setOutlets(list);
      if (list.length > 0 && !outletId) {
        setOutlet(list[0].id);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTables = useCallback(async (oId) => {
    if (!oId) return;
    try {
      const [tablesRes, zonesRes] = await Promise.all([
        floorApi.getTables({ outlet_id: oId }),
        floorApi.getZones(oId),
      ]);
      setTables(tablesRes.data || []);
      setZones(zonesRes.data || []);
    } catch (e) {
      console.error('Failed to fetch floor data', e);
    }
  }, [setTables, setZones]);

  useEffect(() => {
    if (outletId) fetchTables(outletId);
  }, [outletId, fetchTables]);

  // WebSocket
  const connectWs = useCallback(() => {
    const token = localStorage.getItem('ridn_token');
    if (!token) return;
    const wsUrl = `${BACKEND_URL.replace(/^http/, 'ws')}/api/floor/stream?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.event_type === 'table_state_changed') {
            updateTable(msg.payload);
          } else if (msg.event_type === 'layout_changed') {
            if (outletId) fetchTables(outletId);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setWsStatus('reconnecting');
        reconnectTimerRef.current = setTimeout(() => {
          connectWs();
          if (outletId) fetchTables(outletId);
        }, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {}
  }, [outletId, fetchTables, updateTable]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTransition = async (tableId, toStatus) => {
    const prev = tables[tableId];
    // Optimistic update
    updateTable({ ...prev, status: toStatus, status_since: new Date().toISOString() });
    setSelectedTableId(null);

    try {
      const res = await floorApi.transitionTable(tableId, { to_status: toStatus, source: 'manual' });
      updateTable(res.data);
    } catch (e) {
      // Roll back
      updateTable(prev);
      setToast(e?.response?.data?.detail || 'Transition failed. Please try again.');
    }
  };

  const tableList = Object.values(tables);
  const selectedTable = selectedTableId ? tables[selectedTableId] : null;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Reconnecting banner */}
      {wsStatus === 'reconnecting' && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-medium">
          <WifiOff size={14} />
          Reconnecting to live updates…
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <select
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            value={outletId || ''}
            onChange={e => {
              setOutlet(e.target.value);
            }}
          >
            {outlets.map(o => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <button
            onClick={() => outletId && fetchTables(outletId)}
            className="p-2 rounded-xl border border-border bg-card hover:bg-foreground/5 text-foreground/60 hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {wsStatus === 'connected' && (
            <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
              <Wifi size={13} />
              Live
            </span>
          )}
          <LiveClock />
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Live Service
          </span>
        </div>
      </div>

      {/* Main area */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Canvas */}
        <div className="flex-1 relative bg-card rounded-xl border border-border overflow-hidden min-h-[400px]">
          {tableList.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-foreground/30 text-sm">
              No tables found. Add tables in Designer.
            </div>
          )}
          {tableList.map(table => (
            <TableTile
              key={table.id}
              table={table}
              now={now}
              onClick={(id) => setSelectedTableId(id === selectedTableId ? null : id)}
              isSelected={selectedTableId === table.id}
            />
          ))}
        </div>

        {/* Right rail — AI placeholder */}
        <div className="w-56 flex-shrink-0 bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center">
            <Sparkles size={20} className="text-foreground/30" />
          </div>
          <p className="text-sm font-medium text-foreground/40">AI Insights</p>
          <p className="text-xs text-foreground/30">Coming soon — real-time table utilisation, predictive wait times, and server load balancing.</p>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).map(([status, colors]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.border, display: 'inline-block' }} />
            <span className="text-xs text-foreground/50 capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Action Sheet */}
      {selectedTable && (
        <ActionSheet
          table={selectedTable}
          onClose={() => setSelectedTableId(null)}
          onTransition={handleTransition}
        />
      )}
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-sm font-mono text-foreground/60">
      {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}
