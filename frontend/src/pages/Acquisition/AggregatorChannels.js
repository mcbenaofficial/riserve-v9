import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, ArrowRight, BarChart2, CheckCircle, ChevronDown,
  ExternalLink, Link2, Link2Off, RefreshCw, Send, ShoppingBag,
  TrendingUp, Upload, Users, X, Zap,
} from 'lucide-react';
import {
  createConnection, deleteConnection, getAttribution, getConnections,
  getOrders, importOrders, markBridgeSent, resolveOrder, syncConnection,
} from '../../services/aggregatorApi';

// ---------------------------------------------------------------------------
// Platform catalogue (mirrors backend PLATFORM_META)
// ---------------------------------------------------------------------------
const PLATFORMS = [
  {
    id: 'zomato', name: 'Zomato', color: '#E23744', bgClass: 'bg-red-50 dark:bg-red-950/30',
    borderClass: 'border-red-200 dark:border-red-800',
    textClass: 'text-red-600 dark:text-red-400',
    verticals: ['restaurant'], apiStatus: 'partner_gated',
    supports: { orders: true, reviews: true, menu: true },
    description: 'India\'s largest food delivery platform.',
  },
  {
    id: 'swiggy', name: 'Swiggy', color: '#FC8019', bgClass: 'bg-orange-50 dark:bg-orange-950/30',
    borderClass: 'border-orange-200 dark:border-orange-800',
    textClass: 'text-orange-500 dark:text-orange-400',
    verticals: ['restaurant'], apiStatus: 'partner_gated',
    supports: { orders: true, reviews: false, menu: true },
    description: 'Food and grocery delivery across 500+ cities.',
  },
  {
    id: 'justdial', name: 'JustDial', color: '#2F80ED', bgClass: 'bg-blue-50 dark:bg-blue-950/30',
    borderClass: 'border-blue-200 dark:border-blue-800',
    textClass: 'text-blue-600 dark:text-blue-400',
    verticals: ['restaurant', 'salon', 'clinic', 'gym'], apiStatus: 'partner_gated',
    supports: { orders: false, reviews: true, menu: false },
    description: 'Local business search & lead generation.',
  },
  {
    id: 'practo', name: 'Practo', color: '#5DB075', bgClass: 'bg-green-50 dark:bg-green-950/30',
    borderClass: 'border-green-200 dark:border-green-800',
    textClass: 'text-green-600 dark:text-green-400',
    verticals: ['clinic'], apiStatus: 'partner_gated',
    supports: { orders: true, reviews: true, menu: false },
    description: 'Online doctor consultations and clinic discovery.',
  },
  {
    id: 'urban_company', name: 'Urban Company', color: '#7C3AED', bgClass: 'bg-purple-50 dark:bg-purple-950/30',
    borderClass: 'border-purple-200 dark:border-purple-800',
    textClass: 'text-purple-600 dark:text-purple-400',
    verticals: ['salon', 'spa', 'cleaning', 'gym'], apiStatus: 'unavailable',
    supports: { orders: true, reviews: true, menu: false },
    description: 'At-home beauty, wellness, and repair services.',
  },
  {
    id: 'tripadvisor', name: 'TripAdvisor', color: '#00AA6C', bgClass: 'bg-emerald-50 dark:bg-emerald-950/30',
    borderClass: 'border-emerald-200 dark:border-emerald-800',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    verticals: ['restaurant', 'hotel'], apiStatus: 'open',
    supports: { orders: false, reviews: true, menu: false },
    description: 'Global travel and restaurant review platform.',
  },
];

const STATUS_LABELS = {
  active: { label: 'Live API', cls: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  manual: { label: 'Manual import', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
  inactive: { label: 'Paused', cls: 'bg-muted text-muted-foreground' },
  error: { label: 'Error', cls: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

const API_STATUS_LABEL = {
  open: { label: 'API available', cls: 'text-green-600 dark:text-green-400' },
  partner_gated: { label: 'Partner API', cls: 'text-amber-600 dark:text-amber-400' },
  unavailable: { label: 'No API', cls: 'text-muted-foreground' },
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function fmt(n) {
  if (n == null) return '—';
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed ? n.toFixed(0) : n}`;
}
function pct(rate) {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(0)}%`;
}
function relTime(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

// ---------------------------------------------------------------------------
// Connect modal
// ---------------------------------------------------------------------------
function ConnectModal({ platform, onClose, onSave }) {
  const [status, setStatus] = useState('manual');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await onSave({ platform: platform.id, status, api_key: apiKey || undefined });
      onClose();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-md z-[60]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white"
              style={{ backgroundColor: platform.color }}
            >
              {platform.name[0]}
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">Connect {platform.name}</p>
              <p className="text-xs text-muted-foreground">{API_STATUS_LABEL[platform.apiStatus]?.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Import method</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'manual', label: 'Manual import', desc: 'Upload order exports from the platform dashboard' },
                { val: 'active', label: 'Live API', desc: 'Automatic sync via Partner API (requires credentials)' },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setStatus(opt.val)}
                  className={`text-left p-3 rounded-2xl border text-xs transition-colors ${
                    status === opt.val
                      ? 'border-border bg-card shadow-sm ring-2 ring-offset-1 ring-offset-background'
                      : 'border-border/50 bg-background hover:bg-muted'
                  }`}
                  style={status === opt.val ? { '--tw-ring-color': platform.color } : {}}
                >
                  <p className="font-semibold text-foreground mb-0.5">{opt.label}</p>
                  <p className="text-muted-foreground leading-tight">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {status === 'active' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">API Key / Partner Token</label>
              <input
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Paste your partner API key…"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-background"
                style={{ '--tw-ring-color': platform.color }}
              />
              {platform.apiStatus === 'partner_gated' && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} />
                  {platform.name} Partner API requires prior approval. Contact their partner team.
                </p>
              )}
            </div>
          )}

          {err && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle size={12} /> {err}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ backgroundColor: platform.color }}
            >
              {saving ? 'Connecting…' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import modal
// ---------------------------------------------------------------------------
function ImportModal({ connections, onClose, onImport }) {
  const [raw, setRaw] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const handleImport = async () => {
    setErr('');
    let orders;
    try {
      const parsed = JSON.parse(raw);
      orders = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      setErr('Invalid JSON. Paste a JSON array of order objects.');
      return;
    }
    setImporting(true);
    try {
      const res = await onImport(orders);
      setResult(res);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[59] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl z-[60] flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div>
            <p className="font-semibold text-foreground text-sm">Import Orders</p>
            <p className="text-xs text-muted-foreground">Paste a JSON array exported from your aggregator dashboard</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 overflow-y-auto">
          <div className="rounded-2xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Required fields per order:</p>
            <p><code className="bg-muted px-1 rounded">platform</code> — zomato, swiggy, justdial, practo, urban_company, tripadvisor</p>
            <p><code className="bg-muted px-1 rounded">external_order_id</code> — unique order ID from the platform</p>
            <p className="text-muted-foreground">Optional: customer_name, customer_phone, customer_email, amount, items, status, ordered_at (ISO 8601)</p>
          </div>

          {result ? (
            <div className="rounded-2xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 space-y-1">
              <p className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                <CheckCircle size={14} /> Import complete
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">{result.imported} orders imported · {result.skipped} skipped (duplicates) · {result.auto_resolved} auto-matched to customers</p>
            </div>
          ) : (
            <textarea
              value={raw}
              onChange={e => setRaw(e.target.value)}
              rows={12}
              placeholder={`[\n  {\n    "platform": "zomato",\n    "external_order_id": "ZO-12345",\n    "customer_name": "Priya S",\n    "customer_phone": "+919876543210",\n    "amount": 485,\n    "status": "delivered",\n    "ordered_at": "2026-05-01T19:30:00Z"\n  }\n]`}
              className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-border resize-none"
            />
          )}

          {err && (
            <p className="text-xs text-red-500 flex items-center gap-1.5">
              <AlertCircle size={12} /> {err}
            </p>
          )}
        </div>

        <div className="px-6 pb-5 pt-2 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={importing || !raw.trim()}
              className="flex-1 accent-gradient-bg px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {importing ? 'Importing…' : 'Import Orders'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connections tab
// ---------------------------------------------------------------------------
function ConnectionsTab({ connections, onConnect, onDisconnect, onSync, syncing }) {
  const connectedIds = new Set(connections.map(c => c.platform));

  return (
    <div className="space-y-3">
      {PLATFORMS.map(p => {
        const conn = connections.find(c => c.platform === p.id);
        const apiMeta = API_STATUS_LABEL[p.apiStatus];

        return (
          <div
            key={p.id}
            className={`rounded-2xl border p-4 flex items-center gap-4 ${
              conn ? 'bg-card border-border' : 'bg-background border-border/50'
            }`}
          >
            <div
              className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-base font-black text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.name[0]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{p.name}</p>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${apiMeta.cls}`}>
                  {apiMeta.label}
                </span>
                {conn && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_LABELS[conn.status]?.cls}`}>
                    {STATUS_LABELS[conn.status]?.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              {conn && (
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{conn.order_count} orders</span>
                  <span>·</span>
                  <span>Last sync: {relTime(conn.last_sync_at)}</span>
                </div>
              )}
              <div className="flex gap-2 mt-1 flex-wrap">
                {p.supports.orders && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Orders</span>}
                {p.supports.reviews && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Reviews</span>}
                {p.supports.menu && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Menu sync</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {conn ? (
                <>
                  <button
                    onClick={() => onSync(conn.id)}
                    disabled={syncing === conn.id}
                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
                    title="Sync now"
                  >
                    <RefreshCw size={14} className={syncing === conn.id ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => onDisconnect(conn.id)}
                    className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors"
                    title="Disconnect"
                  >
                    <Link2Off size={14} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onConnect(p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity"
                  style={{ backgroundColor: p.color }}
                >
                  <Link2 size={12} /> Connect
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Order stream tab
// ---------------------------------------------------------------------------
function OrderStreamTab({ orders, loading, onResolve, onBridge, onImportClick }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl accent-gradient-bg flex items-center justify-center mb-4">
          <ShoppingBag size={20} className="text-white" />
        </div>
        <p className="text-sm font-semibold text-foreground">No orders yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">Connect a platform and import your order history to start resolving customers.</p>
        <button
          onClick={onImportClick}
          className="mt-4 flex items-center gap-2 accent-gradient-bg px-4 py-2 rounded-xl text-xs font-semibold text-white"
        >
          <Upload size={13} /> Import Orders
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map(order => {
        const p = PLATFORMS.find(pl => pl.id === order.platform);
        return (
          <div key={order.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div
              className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-xs font-black text-white"
              style={{ backgroundColor: p?.color || '#888' }}
            >
              {(p?.name || order.platform)[0]}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {order.customer_name || 'Unknown customer'}
                </p>
                {order.resolved_customer_id ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 shrink-0">
                    Matched
                  </span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    Unmatched
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <span>{p?.name || order.platform}</span>
                <span>·</span>
                <span>#{order.external_order_id}</span>
                {order.amount != null && <><span>·</span><span>₹{order.amount}</span></>}
                {order.ordered_at && <><span>·</span><span>{relTime(order.ordered_at)}</span></>}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!order.resolved_customer_id && (
                <button
                  onClick={() => onResolve(order.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                  title="Try to match this order to a known customer"
                >
                  <Users size={11} /> Match
                </button>
              )}
              {order.resolved_customer_id && !order.first_party_bridge_sent && (
                <button
                  onClick={() => onBridge(order.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white accent-gradient-bg"
                  title="Mark first-party bridge as sent"
                >
                  <Send size={11} /> Bridge
                </button>
              )}
              {order.first_party_bridge_sent && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2">
                  <CheckCircle size={11} /> Bridged
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attribution tab
// ---------------------------------------------------------------------------
function AttributionTab({ attribution, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (!attribution || attribution.total_orders === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl accent-gradient-bg flex items-center justify-center mb-4">
          <BarChart2 size={20} className="text-white" />
        </div>
        <p className="text-sm font-semibold text-foreground">No attribution data yet</p>
        <p className="text-xs text-muted-foreground mt-1">Import orders to see your aggregator vs direct customer cohorts.</p>
      </div>
    );
  }

  const { total_orders, total_gmv, resolution_rate, bridge_sent_rate, by_platform } = attribution;

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total orders', value: total_orders.toLocaleString() },
          { label: 'Total GMV', value: fmt(total_gmv) },
          { label: 'Identity match rate', value: pct(resolution_rate) },
          { label: 'Bridge sent rate', value: pct(bridge_sent_rate) },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xl font-black text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-platform breakdown */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">By platform</p>
        <div className="space-y-2">
          {by_platform.map(row => {
            const p = PLATFORMS.find(pl => pl.id === row.platform);
            const share = total_orders > 0 ? row.order_count / total_orders : 0;
            return (
              <div key={row.platform} className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-black text-white"
                      style={{ backgroundColor: p?.color || '#888' }}
                    >
                      {(p?.name || row.platform)[0]}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{p?.name || row.platform}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground">{row.order_count} orders</p>
                </div>

                {/* Bar */}
                <div className="h-1.5 rounded-full bg-muted mb-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${(share * 100).toFixed(1)}%`, backgroundColor: p?.color || '#888' }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">GMV</p>
                    <p className="font-semibold text-foreground">{fmt(row.gmv)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Identity match</p>
                    <p className="font-semibold text-foreground">{pct(row.resolution_rate)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Repeat customers</p>
                    <p className="font-semibold text-foreground">{row.repeat_customer_count}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Bridge sent</p>
                    <p className="font-semibold text-foreground">{pct(row.bridge_sent_rate)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// First-party bridge tab
// ---------------------------------------------------------------------------
function FirstPartyBridgeTab({ orders, onBridge }) {
  const pending = orders.filter(o => o.resolved_customer_id && !o.first_party_bridge_sent);
  const sent = orders.filter(o => o.first_party_bridge_sent);

  return (
    <div className="space-y-5">
      {/* Explainer */}
      <div className="rounded-2xl border border-border bg-card p-4 flex gap-3">
        <div className="w-9 h-9 shrink-0 rounded-xl accent-gradient-bg flex items-center justify-center">
          <Zap size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">First-party bridge</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            When an aggregator customer is matched to a known contact, you can send them a direct offer — turning their next order into a first-party relationship. Track which matched orders have been bridged here.
          </p>
        </div>
      </div>

      {/* Pending bridges */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Ready to bridge ({pending.length})
          </p>
          {pending.length > 0 && (
            <button
              onClick={() => pending.forEach(o => onBridge(o.id))}
              className="flex items-center gap-1.5 text-xs font-medium accent-gradient-bg text-white px-3 py-1.5 rounded-xl"
            >
              <Send size={11} /> Mark all sent
            </button>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="rounded-2xl border border-border bg-background p-6 text-center">
            <p className="text-xs text-muted-foreground">No orders waiting to bridge. Import more orders and run identity resolution.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.slice(0, 20).map(order => {
              const p = PLATFORMS.find(pl => pl.id === order.platform);
              return (
                <div key={order.id} className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-black text-white"
                    style={{ backgroundColor: p?.color || '#888' }}
                  >
                    {(p?.name || order.platform)[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{order.customer_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{p?.name} · #{order.external_order_id}</p>
                  </div>
                  <button
                    onClick={() => onBridge(order.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-white accent-gradient-bg shrink-0"
                  >
                    <Send size={11} /> Bridge
                  </button>
                </div>
              );
            })}
            {pending.length > 20 && (
              <p className="text-xs text-muted-foreground text-center pt-1">+{pending.length - 20} more</p>
            )}
          </div>
        )}
      </div>

      {/* Already bridged */}
      {sent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Already bridged ({sent.length})
          </p>
          <div className="space-y-1.5">
            {sent.slice(0, 10).map(order => {
              const p = PLATFORMS.find(pl => pl.id === order.platform);
              return (
                <div key={order.id} className="bg-background border border-border/50 rounded-xl px-4 py-2.5 flex items-center gap-3 opacity-70">
                  <div
                    className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-xs font-black text-white"
                    style={{ backgroundColor: p?.color || '#888' }}
                  >
                    {(p?.name || order.platform)[0]}
                  </div>
                  <p className="text-xs text-foreground flex-1 truncate">{order.customer_name || 'Unknown'} · #{order.external_order_id}</p>
                  <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                    <CheckCircle size={10} /> Bridged
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const TABS = [
  { id: 'connections', label: 'Connections', icon: Link2 },
  { id: 'orders', label: 'Order Stream', icon: ShoppingBag },
  { id: 'attribution', label: 'Attribution', icon: BarChart2 },
  { id: 'bridge', label: 'First-Party Bridge', icon: ArrowRight },
];

export default function AggregatorChannels() {
  const [tab, setTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [orders, setOrders] = useState([]);
  const [attribution, setAttribution] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingAttribution, setLoadingAttribution] = useState(false);
  const [connectPlatform, setConnectPlatform] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [syncing, setSyncing] = useState(null);
  const [err, setErr] = useState('');

  const loadConnections = useCallback(async () => {
    try {
      const data = await getConnections();
      setConnections(Array.isArray(data) ? data : []);
    } catch (ex) {
      setErr(ex.message);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const data = await getOrders({ limit: 100 });
      setOrders(data.items || []);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadAttribution = useCallback(async () => {
    setLoadingAttribution(true);
    try {
      const data = await getAttribution();
      setAttribution(data);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setLoadingAttribution(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  useEffect(() => {
    if (tab === 'orders' || tab === 'bridge') loadOrders();
    if (tab === 'attribution') loadAttribution();
  }, [tab, loadOrders, loadAttribution]);

  const handleConnect = async (data) => {
    const conn = await createConnection(data);
    setConnections(prev => [...prev, conn]);
  };

  const handleDisconnect = async (id) => {
    await deleteConnection(id);
    setConnections(prev => prev.filter(c => c.id !== id));
  };

  const handleSync = async (id) => {
    setSyncing(id);
    try {
      await syncConnection(id);
      await loadConnections();
    } finally {
      setSyncing(null);
    }
  };

  const handleImport = async (orders) => {
    const res = await importOrders(orders);
    await loadOrders();
    await loadConnections();
    await loadAttribution();
    return res;
  };

  const handleResolve = async (orderId) => {
    const updated = await resolveOrder(orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? updated : o));
  };

  const handleBridge = async (orderId) => {
    await markBridgeSent(orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, first_party_bridge_sent: true } : o));
  };

  const connectedCount = connections.length;
  const totalOrders = connections.reduce((s, c) => s + (c.order_count || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl accent-gradient-bg flex items-center justify-center">
              <TrendingUp size={17} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-foreground">Aggregator Channels</h1>
              <p className="text-xs text-muted-foreground">
                {connectedCount} platform{connectedCount !== 1 ? 's' : ''} connected · {totalOrders.toLocaleString()} orders imported
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 accent-gradient-bg px-4 py-2 rounded-xl text-sm font-semibold text-white"
          >
            <Upload size={14} /> Import Orders
          </button>
        </div>

        {err && (
          <div className="mt-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={12} />
            {err}
            <button onClick={() => setErr('')} className="ml-auto"><X size={12} /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-muted rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'accent-gradient-bg text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-5">
        {tab === 'connections' && (
          <ConnectionsTab
            connections={connections}
            onConnect={setConnectPlatform}
            onDisconnect={handleDisconnect}
            onSync={handleSync}
            syncing={syncing}
          />
        )}
        {tab === 'orders' && (
          <OrderStreamTab
            orders={orders}
            loading={loadingOrders}
            onResolve={handleResolve}
            onBridge={handleBridge}
            onImportClick={() => setShowImport(true)}
          />
        )}
        {tab === 'attribution' && (
          <AttributionTab attribution={attribution} loading={loadingAttribution} />
        )}
        {tab === 'bridge' && (
          <FirstPartyBridgeTab orders={orders} onBridge={handleBridge} />
        )}
      </div>

      {/* Modals */}
      {connectPlatform && (
        <ConnectModal
          platform={connectPlatform}
          onClose={() => setConnectPlatform(null)}
          onSave={handleConnect}
        />
      )}
      {showImport && (
        <ImportModal
          connections={connections}
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}
    </div>
  );
}
