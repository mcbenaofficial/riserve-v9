import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, UtensilsCrossed, Settings, RefreshCw, ClipboardList,
  ShoppingBag, CheckCircle, AlertCircle, Loader2, ChevronDown,
  Wifi, WifiOff, Play, KeyRound, Search, ChevronRight, Trash2, X
} from 'lucide-react';
import { api } from '../../services/api';

const ORDER_STATES = ['PLACED', 'KOT_FIRED', 'PREPARED', 'SERVED', 'SETTLED', 'CANCELLED'];

const STATE_BADGE = {
  PLACED:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  KOT_FIRED: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  PREPARED:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  SERVED:    'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  SETTLED:   'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  CANCELLED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
};

const LOG_STATUS_BADGE = {
  success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  failed:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  noop:    'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
};

const ITEM_TYPE_BADGE = {
  veg:       'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  'non-veg': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  egg:       'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
};

const TABS = [
  { id: 'setup',  label: 'Setup',     icon: Settings },
  { id: 'menu',   label: 'Menu Sync', icon: UtensilsCrossed },
  { id: 'orders', label: 'Orders',    icon: ShoppingBag },
  { id: 'logs',   label: 'Sync Logs', icon: ClipboardList },
];

const inputCls = [
  'w-full px-4 py-2.5 rounded-xl text-sm',
  'border border-gray-200 dark:border-[#1F2630]',
  'bg-white dark:bg-white/5',
  'text-gray-900 dark:text-[#E6E8EB]',
  'placeholder-gray-400 dark:placeholder-[#7D8590]',
  'focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/40',
].join(' ');

const labelCls = 'block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-1.5';

const AdminPetPooja = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('setup');
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [config, setConfig] = useState(null);
  const [savedCreds, setSavedCreds] = useState({ secret: false, token: false });
  const [form, setForm] = useState({
    app_key: '', app_secret: '', access_token: '',
    pos_restaurant_id: '', base_url: 'https://api.petpooja.com',
    sync_enabled: false, sync_orders: true, sync_menu: true,
    poll_interval_seconds: 30,
  });

  // Menu tab state
  const [menuItems, setMenuItems] = useState([]);
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCategory, setMenuCategory] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Orders tab state
  const [orders, setOrders] = useState([]);
  const [orderStateFilter, setOrderStateFilter] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);

  // Logs tab state
  const [logs, setLogs] = useState([]);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState({ menu: false, orders: false });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    api.getOutlets().then(r => {
      const list = r.data || [];
      setOutlets(list);
      if (list.length > 0) setSelectedOutlet(list[0].id);
    }).catch(() => {});
  }, []);

  const loadConfig = useCallback(async (outletId) => {
    if (!outletId) return;
    try {
      const r = await api.getPetPoojaConfig(outletId);
      const c = r.data;
      setConfig(c);
      if (c && c.status !== 'not_configured') {
        setSavedCreds({ secret: !!c.app_secret, token: !!c.access_token });
        setForm({
          app_key:              c.app_key || '',
          app_secret:           '',
          access_token:         '',
          pos_restaurant_id:    c.pos_restaurant_id || '',
          base_url:             c.base_url || 'https://api.petpooja.com',
          sync_enabled:         c.sync_enabled ?? false,
          sync_orders:          c.sync_orders ?? true,
          sync_menu:            c.sync_menu ?? true,
          poll_interval_seconds: c.poll_interval_seconds ?? 30,
        });
      } else {
        setSavedCreds({ secret: false, token: false });
      }
    } catch {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    if (selectedOutlet) loadConfig(selectedOutlet);
  }, [selectedOutlet, loadConfig]);

  // Derive unique categories from loaded menu items
  const categories = [...new Set(menuItems.map(i => i.category_name).filter(Boolean))].sort();

  const loadTabData = useCallback(async () => {
    if (!selectedOutlet) return;
    setLoading(true);
    try {
      if (activeTab === 'menu') {
        const r = await api.getPetPoojaMenuItems(
          selectedOutlet,
          menuSearch || undefined,
          menuCategory || undefined,
          showInactive ? undefined : true,
        );
        setMenuItems(r.data || []);
      } else if (activeTab === 'orders') {
        const r = await api.getPetPoojaOrders(selectedOutlet, orderStateFilter || undefined, 100);
        setOrders(r.data || []);
      } else if (activeTab === 'logs') {
        const r = await api.getPetPoojaSyncLogs(selectedOutlet, 50);
        setLogs(r.data || []);
      }
    } catch {
      /* silently handled */
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedOutlet, orderStateFilter, menuSearch, menuCategory, showInactive]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const handleSave = async () => {
    if (!selectedOutlet) return;
    setSaving(true);
    try {
      await api.savePetPoojaConfig(selectedOutlet, form);
      await loadConfig(selectedOutlet);
      showToast('Configuration saved.');
    } catch {
      showToast('Failed to save configuration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!selectedOutlet) return;
    setTesting(true);
    try {
      const r = await api.testPetPoojaConnection(selectedOutlet);
      if (r.data.ok) {
        showToast('Connection successful!');
        await loadConfig(selectedOutlet);
      } else {
        showToast(r.data.message || 'Connection failed.', 'error');
      }
    } catch {
      showToast('Connection test failed.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!selectedOutlet) return;
    setDisconnecting(true);
    try {
      await api.deletePetPoojaConfig(selectedOutlet);
      setConfirmDisconnect(false);
      setConfig(null);
      setSavedCreds({ secret: false, token: false });
      setForm({ app_key: '', app_secret: '', access_token: '', pos_restaurant_id: '', base_url: 'https://api.petpooja.com', sync_enabled: false, sync_orders: true, sync_menu: true, poll_interval_seconds: 30 });
      showToast('PetPooja disconnected.');
    } catch {
      showToast('Failed to disconnect.', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSyncMenu = async () => {
    if (!selectedOutlet) return;
    setSyncing(s => ({ ...s, menu: true }));
    try {
      const r = await api.syncPetPoojaMenu(selectedOutlet);
      showToast(`Menu sync complete — ${r.data.items_upserted} items updated.`);
      await loadTabData();
      await loadConfig(selectedOutlet);
    } catch {
      showToast('Menu sync failed.', 'error');
    } finally {
      setSyncing(s => ({ ...s, menu: false }));
    }
  };

  const handleSyncOrders = async () => {
    if (!selectedOutlet) return;
    setSyncing(s => ({ ...s, orders: true }));
    try {
      const r = await api.syncPetPoojaOrders(selectedOutlet);
      showToast(`Order sync complete — ${r.data.orders_upserted} orders updated.`);
      await loadTabData();
      await loadConfig(selectedOutlet);
    } catch {
      showToast('Order sync failed.', 'error');
    } finally {
      setSyncing(s => ({ ...s, orders: false }));
    }
  };

  const isConnected = config?.status === 'connected';
  const isError     = config?.status === 'error';
  const isConfigured = config && config.status !== 'not_configured';

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-xl border border-gray-200 dark:border-[#1F2630] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-600 dark:text-[#A9AFB8]" />
        </button>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center accent-gradient-bg shadow-lg flex-shrink-0">
          <UtensilsCrossed size={22} className="text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">PetPooja POS</h2>
          <p className="text-sm text-gray-500 dark:text-[#7D8590]">Sync menu and orders from your PetPooja terminal</p>
        </div>
        <div className="ml-auto">
          {isConnected ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
              <Wifi size={12} /> Connected
            </span>
          ) : (
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
              isError
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-[#7D8590]'
            }`}>
              <WifiOff size={12} />
              {isError ? 'Connection Error' : 'Not Connected'}
            </span>
          )}
        </div>
      </div>

      {/* Outlet selector */}
      <div className="bg-white/90 dark:bg-[#171C22] border border-gray-200 dark:border-[#1F2630] rounded-2xl p-4 flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700 dark:text-[#A9AFB8] whitespace-nowrap">Outlet</span>
        <div className="relative flex-1 max-w-xs">
          <select
            value={selectedOutlet}
            onChange={e => setSelectedOutlet(e.target.value)}
            className={`${inputCls} pr-8 appearance-none`}
          >
            {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        {config?.last_menu_sync_at && (
          <span className="text-xs text-gray-400 dark:text-[#7D8590] ml-auto">
            Menu synced {new Date(config.last_menu_sync_at).toLocaleString()}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-2xl">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === t.id
                  ? 'accent-gradient-bg text-white shadow-sm'
                  : 'text-gray-500 dark:text-[#7D8590] hover:text-gray-900 dark:hover:text-[#E6E8EB]'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Setup tab ── */}
      {activeTab === 'setup' && (
        <div className="bg-white/90 dark:bg-[#171C22] border border-gray-200 dark:border-[#1F2630] rounded-3xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB] mb-1">API Credentials</h3>
            <p className="text-sm text-gray-500 dark:text-[#7D8590]">
              Find these in your PetPooja partner dashboard under Settings → API Access.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>App Key</label>
              <input type="text" value={form.app_key} onChange={e => setForm(f => ({ ...f, app_key: e.target.value }))} placeholder="pp_app_key_..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Restaurant ID <span className="text-gray-400 dark:text-[#7D8590] font-normal">(restID)</span></label>
              <input type="text" value={form.pos_restaurant_id} onChange={e => setForm(f => ({ ...f, pos_restaurant_id: e.target.value }))} placeholder="e.g. 12345" className={inputCls} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`${labelCls} mb-0`}>App Secret</label>
                {savedCreds.secret && !form.app_secret && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium"><KeyRound size={11} /> Saved</span>
                )}
              </div>
              <input type="password" value={form.app_secret} onChange={e => setForm(f => ({ ...f, app_secret: e.target.value }))} placeholder={savedCreds.secret ? 'Leave blank to keep existing' : 'Enter app secret'} className={inputCls} autoComplete="new-password" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={`${labelCls} mb-0`}>Access Token</label>
                {savedCreds.token && !form.access_token && (
                  <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium"><KeyRound size={11} /> Saved</span>
                )}
              </div>
              <input type="password" value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} placeholder={savedCreds.token ? 'Leave blank to keep existing' : 'Enter access token'} className={inputCls} autoComplete="new-password" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Base URL</label>
              <input type="text" value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} placeholder="https://api.petpooja.com" className={inputCls} />
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-[#1F2630] pt-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB] mb-4">Sync Settings</h3>
            <div className="space-y-3">
              {[
                { key: 'sync_enabled', label: 'Enable automatic sync', desc: 'Periodically poll PetPooja for new data' },
                { key: 'sync_menu',    label: 'Sync menu items',       desc: 'Pull categories and items from PetPooja' },
                { key: 'sync_orders',  label: 'Sync orders',           desc: 'Poll for order state changes' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={!!form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-800 dark:text-[#E6E8EB]">{label}</div>
                    <div className="text-xs text-gray-500 dark:text-[#7D8590]">{desc}</div>
                  </div>
                </label>
              ))}
              <div className="flex items-center gap-3 pt-1">
                <label className="text-sm text-gray-500 dark:text-[#7D8590] whitespace-nowrap">Poll interval (seconds)</label>
                <input type="number" min={10} max={300} value={form.poll_interval_seconds} onChange={e => setForm(f => ({ ...f, poll_interval_seconds: parseInt(e.target.value, 10) }))} className="w-24 px-3 py-1.5 rounded-xl text-sm border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/40" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-200 dark:border-[#1F2630]">
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white accent-gradient-bg shadow hover:opacity-90 hover:scale-[1.01] transition-all disabled:opacity-60">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? 'Saving…' : 'Save Configuration'}
            </button>
            <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-white/10 transition-all disabled:opacity-60">
              {testing ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
              {testing ? 'Testing…' : 'Test Connection'}
            </button>
          </div>

          {/* Danger zone — only shown if a config actually exists for this outlet */}
          {isConfigured && (
            <div className="border border-red-200 dark:border-red-400/20 rounded-2xl p-4 bg-red-50/40 dark:bg-red-900/10">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-red-700 dark:text-red-400">Disconnect PetPooja</div>
                  <div className="text-xs text-red-500 dark:text-red-400/70 mt-0.5">Removes credentials and all synced data for this outlet.</div>
                </div>
                {confirmDisconnect ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 dark:text-red-400 font-medium">Are you sure?</span>
                    <button onClick={handleDisconnect} disabled={disconnecting} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-1">
                      {disconnecting ? <Loader2 size={12} className="animate-spin" /> : null}
                      {disconnecting ? 'Removing…' : 'Yes, remove'}
                    </button>
                    <button onClick={() => setConfirmDisconnect(false)} className="p-1.5 rounded-lg border border-gray-200 dark:border-[#1F2630] text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDisconnect(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-300 dark:border-red-400/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 size={13} /> Disconnect
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Menu Sync tab ── */}
      {activeTab === 'menu' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                placeholder="Search items…"
                className="w-full pl-8 pr-3 py-2 rounded-xl text-sm border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/40"
              />
            </div>
            {/* Category filter */}
            {categories.length > 0 && (
              <div className="relative">
                <select
                  value={menuCategory}
                  onChange={e => setMenuCategory(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-2 rounded-xl text-sm border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/40"
                >
                  <option value="">All categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}
            {/* Show inactive toggle */}
            <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-[#7D8590] cursor-pointer select-none">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
              Show inactive
            </label>
            <span className="text-sm text-gray-400 dark:text-[#7D8590]">{menuItems.length} items</span>
            <button
              onClick={handleSyncMenu}
              disabled={syncing.menu}
              className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white accent-gradient-bg shadow hover:opacity-90 hover:scale-[1.01] transition-all disabled:opacity-60"
            >
              {syncing.menu ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {syncing.menu ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
          ) : menuItems.length === 0 ? (
            <div className="bg-white/90 dark:bg-[#171C22] border border-gray-200 dark:border-[#1F2630] rounded-3xl p-12 text-center">
              <UtensilsCrossed size={36} className="mx-auto text-gray-300 dark:text-[#3D4450] mb-3" />
              <p className="text-sm text-gray-500 dark:text-[#7D8590]">
                {menuSearch || menuCategory ? 'No items match your filters.' : 'No menu items synced yet. Click Sync Now to pull from PetPooja.'}
              </p>
            </div>
          ) : (
            <div className="bg-white/90 dark:bg-[#171C22] border border-gray-200 dark:border-[#1F2630] rounded-3xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-[#1F2630]">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Item</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Category</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Type</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Price</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map((item, i) => (
                    <tr key={item.id} className={`border-b border-gray-100 dark:border-[#1F2630] last:border-0 ${i % 2 === 1 ? 'bg-gray-50/60 dark:bg-white/[0.02]' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900 dark:text-[#E6E8EB]">{item.name}</div>
                        {item.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{item.description}</div>}
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-[#7D8590]">{item.category_name || '—'}</td>
                      <td className="px-5 py-3">
                        {item.item_type
                          ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ITEM_TYPE_BADGE[item.item_type] || 'bg-gray-100 text-gray-600'}`}>{item.item_type}</span>
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-[#E6E8EB]">₹{parseFloat(item.price).toFixed(2)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${item.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Orders tab ── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <select value={orderStateFilter} onChange={e => setOrderStateFilter(e.target.value)} className="appearance-none pl-3 pr-7 py-2 rounded-xl text-sm border border-gray-200 dark:border-[#1F2630] bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] focus:outline-none focus:ring-2 focus:ring-[#5FA8D3]/40">
                <option value="">All states</option>
                {ORDER_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button onClick={handleSyncOrders} disabled={syncing.orders} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white accent-gradient-bg shadow hover:opacity-90 hover:scale-[1.01] transition-all disabled:opacity-60">
              {syncing.orders ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {syncing.orders ? 'Syncing…' : 'Poll Orders'}
            </button>
            <span className="text-sm text-gray-400 dark:text-[#7D8590] ml-auto">{orders.length} orders</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="bg-white/90 dark:bg-[#171C22] border border-gray-200 dark:border-[#1F2630] rounded-3xl p-12 text-center">
              <ShoppingBag size={36} className="mx-auto text-gray-300 dark:text-[#3D4450] mb-3" />
              <p className="text-sm text-gray-500 dark:text-[#7D8590]">No orders synced yet. Click Poll Orders to pull from PetPooja.</p>
            </div>
          ) : (
            <div className="bg-white/90 dark:bg-[#171C22] border border-gray-200 dark:border-[#1F2630] rounded-3xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-[#1F2630]">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590] w-6"></th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Order ID</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">State</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Table</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Items</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Total</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, i) => {
                    const isExpanded = expandedOrderId === order.id;
                    return (
                      <React.Fragment key={order.id}>
                        <tr
                          className={`border-b border-gray-100 dark:border-[#1F2630] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors ${i % 2 === 1 && !isExpanded ? 'bg-gray-50/60 dark:bg-white/[0.02]' : ''} ${isExpanded ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                        >
                          <td className="pl-4 py-3">
                            <ChevronRight size={14} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-gray-700 dark:text-[#A9AFB8]">{order.external_id}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATE_BADGE[order.state] || 'bg-gray-100 text-gray-600'}`}>{order.state}</span>
                          </td>
                          <td className="px-5 py-3 text-gray-500 dark:text-[#7D8590]">{order.table_external_id || '—'}</td>
                          <td className="px-5 py-3 text-gray-500 dark:text-[#7D8590]">{order.items?.length ?? 0}</td>
                          <td className="px-5 py-3 text-right font-medium text-gray-900 dark:text-[#E6E8EB]">₹{parseFloat(order.grand_total).toFixed(2)}</td>
                          <td className="px-5 py-3 text-xs text-gray-400 dark:text-[#7D8590]">{order.placed_at ? new Date(order.placed_at).toLocaleString() : '—'}</td>
                        </tr>

                        {/* Expandable order detail */}
                        {isExpanded && (
                          <tr className="border-b border-gray-100 dark:border-[#1F2630]">
                            <td colSpan={7} className="px-8 pb-4 pt-0 bg-blue-50/20 dark:bg-blue-900/5">
                              <div className="rounded-xl border border-gray-200 dark:border-[#1F2630] overflow-hidden mt-2">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-[#1F2630]">
                                    <tr>
                                      <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-[#7D8590]">Item</th>
                                      <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-[#7D8590]">Qty</th>
                                      <th className="px-4 py-2 text-right font-semibold text-gray-500 dark:text-[#7D8590]">Unit Price</th>
                                      <th className="px-4 py-2 text-right font-semibold text-gray-500 dark:text-[#7D8590]">Line Total</th>
                                      <th className="px-4 py-2 text-left font-semibold text-gray-500 dark:text-[#7D8590]">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(order.items || []).length === 0 ? (
                                      <tr><td colSpan={5} className="px-4 py-3 text-gray-400 italic">No line items recorded.</td></tr>
                                    ) : (order.items || []).map(item => (
                                      <tr key={item.id} className="border-t border-gray-100 dark:border-[#1F2630]">
                                        <td className="px-4 py-2 font-medium text-gray-800 dark:text-[#E6E8EB]">{item.name}</td>
                                        <td className="px-4 py-2 text-gray-500 dark:text-[#7D8590]">{item.quantity}</td>
                                        <td className="px-4 py-2 text-right text-gray-600 dark:text-[#A9AFB8]">₹{parseFloat(item.unit_price).toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-medium text-gray-800 dark:text-[#E6E8EB]">₹{parseFloat(item.line_total).toFixed(2)}</td>
                                        <td className="px-4 py-2 text-gray-400">{item.notes || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  {(order.items || []).length > 0 && (
                                    <tfoot className="border-t-2 border-gray-200 dark:border-[#1F2630] bg-gray-50/60 dark:bg-white/[0.02]">
                                      <tr>
                                        <td colSpan={3} className="px-4 py-2 text-right text-xs text-gray-500 dark:text-[#7D8590]">
                                          Sub ₹{parseFloat(order.sub_total).toFixed(2)} · Tax ₹{parseFloat(order.tax_total).toFixed(2)} · Disc −₹{parseFloat(order.discount_total).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-[#E6E8EB]">₹{parseFloat(order.grand_total).toFixed(2)}</td>
                                        <td />
                                      </tr>
                                    </tfoot>
                                  )}
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Sync Logs tab ── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-[#7D8590]">Last 50 sync runs for this outlet</p>
            <button onClick={loadTabData} className="p-2 rounded-xl border border-gray-200 dark:border-[#1F2630] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              <RefreshCw size={15} className="text-gray-500 dark:text-[#7D8590]" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
          ) : logs.length === 0 ? (
            <div className="bg-white/90 dark:bg-[#171C22] border border-gray-200 dark:border-[#1F2630] rounded-3xl p-12 text-center">
              <ClipboardList size={36} className="mx-auto text-gray-300 dark:text-[#3D4450] mb-3" />
              <p className="text-sm text-gray-500 dark:text-[#7D8590]">No sync runs recorded yet.</p>
            </div>
          ) : (
            <div className="bg-white/90 dark:bg-[#171C22] border border-gray-200 dark:border-[#1F2630] rounded-3xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-[#1F2630]">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Time</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Processed</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Upserted</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Duration</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-[#7D8590]">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} className={`border-b border-gray-100 dark:border-[#1F2630] last:border-0 ${i % 2 === 1 ? 'bg-gray-50/60 dark:bg-white/[0.02]' : ''}`}>
                      <td className="px-5 py-3 text-xs text-gray-500 dark:text-[#7D8590] whitespace-nowrap">{new Date(log.started_at).toLocaleString()}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-[#A9AFB8] capitalize">{log.sync_type}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${LOG_STATUS_BADGE[log.status] || 'bg-gray-100 text-gray-600'}`}>{log.status}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-[#7D8590]">{log.items_processed}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-[#7D8590]">{log.items_upserted}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-[#7D8590]">{log.duration_s != null ? `${log.duration_s}s` : '—'}</td>
                      <td className="px-5 py-3 text-xs text-red-500 max-w-[200px] truncate" title={log.error || ''}>{log.error || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Toast — z-[100] per design contract ladder */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium text-white transition-all ${toast.type === 'error' ? 'bg-red-600' : 'accent-gradient-bg'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default AdminPetPooja;
