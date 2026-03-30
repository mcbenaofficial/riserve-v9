import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, Plus, ToggleLeft, ToggleRight, Pencil,
  Send, CheckCircle, XCircle, Clock, Eye, EyeOff, Save,
  RefreshCw, AlertCircle, TrendingUp, Zap, ChevronRight
} from 'lucide-react';
import { api } from '../../services/api';

const TRIGGER_LABELS = {
  booking_confirmed: 'Booking Confirmation',
  booking_reminder: 'Booking Reminder',
  booking_cancelled: 'Booking Cancelled',
  booking_completed: 'Service Completed',
  order_confirmed: 'Order Confirmed',
  order_ready: 'Order Ready for Pickup',
  order_cancelled: 'Order Cancelled',
  payment_receipt: 'Payment Receipt',
};

const StatusBadge = ({ status }) => {
  const map = {
    sent:      { color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400', icon: CheckCircle },
    delivered: { color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400', icon: CheckCircle },
    failed:    { color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400', icon: XCircle },
    queued:    { color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400', icon: Clock },
  };
  const cfg = map[status] || map.queued;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${cfg.color}`}>
      <Icon size={11} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

const AdminWhatsApp = ({ onBack }) => {
  const [config, setConfig] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testTrigger, setTestTrigger] = useState('booking_confirmed');
  const [testStatus, setTestStatus] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Credentials form state
  const [creds, setCreds] = useState({
    phone_number_id: '',
    waba_id: '',
    access_token: '',
    display_phone: '',
    enabled: false,
  });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgRes, logsRes, statsRes] = await Promise.all([
        api.getWhatsAppConfig(),
        api.getWhatsAppLogs({ limit: 50 }),
        api.getWhatsAppStats(30),
      ]);

      const cfg = cfgRes.data;
      setConfig(cfg);
      setTemplates(cfg.templates || []);
      setCreds({
        phone_number_id: cfg.phone_number_id || '',
        waba_id: cfg.waba_id || '',
        access_token: '',
        display_phone: cfg.display_phone || '',
        enabled: cfg.enabled || false,
      });
      setLogs(logsRes.data.logs || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load WhatsApp config', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveCredentials = async () => {
    setSaving(true);
    try {
      // Convert templates array → trigger-keyed dict
      const tplMap = {};
      templates.forEach(t => {
        tplMap[t.trigger] = {
          template_name: t.template_name,
          active: t.active,
          language: t.language || 'en',
        };
      });
      await api.updateWhatsAppConfig({ ...creds, templates: tplMap });
      await fetchAll();
    } catch (err) {
      console.error('Failed to save config', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleTemplate = async (trigger) => {
    const updated = templates.map(t =>
      t.trigger === trigger ? { ...t, active: !t.active } : t
    );
    setTemplates(updated);
  };

  const saveTemplateEdit = (trigger, patch) => {
    setTemplates(templates.map(t => t.trigger === trigger ? { ...t, ...patch } : t));
    setEditingTemplate(null);
  };

  const sendTest = async () => {
    if (!testPhone.trim()) return;
    setTestStatus('sending');
    try {
      await api.sendWhatsAppTest({ recipient_phone: testPhone, trigger: testTrigger });
      setTestStatus('success');
    } catch (err) {
      setTestStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FA8D3]" />
      </div>
    );
  }

  const tabs = [
    { id: 'settings', label: 'Credentials' },
    { id: 'templates', label: 'Message Templates' },
    { id: 'logs', label: 'Message Logs' },
    { id: 'stats', label: 'Stats' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl transition-colors bg-white/50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-[#1F2630] text-gray-600 dark:text-[#7D8590] hover:text-gray-900 dark:hover:text-[#E6E8EB] border border-transparent dark:border-[#1F2630]"
            >
              <ChevronRight size={24} className="rotate-180" />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <MessageCircle size={20} className="text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">WhatsApp Notifications</h2>
            <p className="text-sm text-gray-600 dark:text-[#7D8590]">Utility messages via WhatsApp Business Cloud API</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCreds(c => ({ ...c, enabled: !c.enabled }))}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              creds.enabled
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-[#7D8590]'
            }`}
          >
            {creds.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
            {creds.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Sent (30d)', value: stats.total_sent, color: 'text-green-600 dark:text-green-400' },
            { label: 'Failed', value: stats.total_failed, color: 'text-red-500' },
            { label: 'Delivery Rate', value: `${stats.delivery_rate}%`, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Est. Cost', value: `$${stats.total_cost_usd}`, color: 'text-amber-600 dark:text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-4">
              <div className="text-xs text-gray-500 dark:text-[#7D8590] mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-white dark:bg-[#1F2630] text-gray-900 dark:text-[#E6E8EB] shadow-sm'
                : 'text-gray-600 dark:text-[#7D8590] hover:text-gray-900 dark:hover:text-[#E6E8EB]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Credentials Tab ── */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB] mb-5">
              WhatsApp Business Cloud API Credentials
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-2">
                  Phone Number ID
                </label>
                <input
                  type="text"
                  value={creds.phone_number_id}
                  onChange={e => setCreds(c => ({ ...c, phone_number_id: e.target.value }))}
                  placeholder="e.g. 123456789012345"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-2">
                  WhatsApp Business Account (WABA) ID
                </label>
                <input
                  type="text"
                  value={creds.waba_id}
                  onChange={e => setCreds(c => ({ ...c, waba_id: e.target.value }))}
                  placeholder="e.g. 987654321098765"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-2">
                  Display Phone Number
                </label>
                <input
                  type="text"
                  value={creds.display_phone}
                  onChange={e => setCreds(c => ({ ...c, display_phone: e.target.value }))}
                  placeholder="e.g. +1 555-123-4567"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-2">
                  Access Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={creds.access_token}
                    onChange={e => setCreds(c => ({ ...c, access_token: e.target.value }))}
                    placeholder={config?.access_token_masked || 'Enter new token to update'}
                    className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] text-sm"
                  />
                  <button
                    onClick={() => setShowToken(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {config?.access_token_masked && (
                  <p className="text-xs text-gray-500 dark:text-[#7D8590] mt-1">
                    Current: {config.access_token_masked} — leave blank to keep unchanged
                  </p>
                )}
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={saveCredentials}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-[#222] shadow-lg transition-all hover:scale-[1.02] disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
              >
                <Save size={16} />
                {saving ? 'Saving…' : 'Save Credentials'}
              </button>
            </div>
          </div>

          {/* Test message */}
          <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB] mb-4">Send Test Message</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  placeholder="+1 555 000 0000"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#A9AFB8] mb-2">Template</label>
                <select
                  value={testTrigger}
                  onChange={e => setTestTrigger(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-[#1F2630] rounded-xl bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] text-sm"
                >
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={sendTest}
                disabled={testStatus === 'sending'}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-[#222] shadow-lg hover:scale-[1.02] transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
              >
                <Send size={16} />
                {testStatus === 'sending' ? 'Sending…' : 'Send Test'}
              </button>
            </div>
            {testStatus === 'success' && (
              <div className="mt-3 flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle size={16} /> Message dispatched successfully
              </div>
            )}
            {testStatus === 'error' && (
              <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle size={16} /> Failed to send — check your credentials and template approval status
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Templates Tab ── */}
      {activeTab === 'templates' && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-[#1F2630] flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Message Templates</h3>
              <p className="text-xs text-gray-500 dark:text-[#7D8590] mt-0.5">
                Template names must match pre-approved templates in your Meta Business account
              </p>
            </div>
            <button
              onClick={saveCredentials}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[#222] shadow-lg hover:scale-[1.02] transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save All'}
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-white/10">
            {templates.map(tpl => (
              <div key={tpl.trigger} className="p-4 hover:bg-[#5FA8D3]/5 dark:hover:bg-[#5FA8D3]/10 transition-colors">
                {editingTemplate === tpl.trigger ? (
                  <TemplateEditForm
                    template={tpl}
                    onSave={patch => saveTemplateEdit(tpl.trigger, patch)}
                    onCancel={() => setEditingTemplate(null)}
                  />
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        tpl.active ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-white/5'
                      }`}>
                        <Zap size={16} className={tpl.active ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB]">
                            {tpl.label || TRIGGER_LABELS[tpl.trigger] || tpl.trigger}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-[#7D8590] mt-0.5">{tpl.description}</div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs font-mono bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded text-gray-700 dark:text-[#A9AFB8]">
                            {tpl.template_name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-[#7D8590]">
                            Variables: {(tpl.variables || []).map(v => `{${v}}`).join(', ')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleTemplate(tpl.trigger)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                          tpl.active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {tpl.active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => setEditingTemplate(tpl.trigger)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg"
                      >
                        <Pencil size={14} className="text-gray-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Logs Tab ── */}
      {activeTab === 'logs' && (
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-[#1F2630] flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900 dark:text-[#E6E8EB]">Message Log</h3>
            <button onClick={fetchAll} className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg">
              <RefreshCw size={16} className="text-gray-400" />
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="p-10 text-center text-gray-500 dark:text-[#7D8590]">
              <MessageCircle size={36} className="mx-auto mb-3 opacity-30" />
              No messages sent yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5">
                  <tr>
                    {['Trigger', 'Template', 'Recipient', 'Status', 'Cost', 'Sent At'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#7D8590] uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-[#5FA8D3]/5 dark:hover:bg-[#5FA8D3]/10 transition-colors">
                      <td className="px-4 py-3 text-gray-700 dark:text-[#E6E8EB]">
                        {TRIGGER_LABELS[log.trigger] || log.trigger}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-[#7D8590]">
                        {log.template_name}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-[#E6E8EB]">
                        <div>{log.recipient_name}</div>
                        <div className="text-xs text-gray-400">{log.recipient_phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.status} />
                        {log.error_message && (
                          <div className="text-xs text-red-500 mt-1 max-w-[160px] truncate" title={log.error_message}>
                            {log.error_message}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-[#7D8590] text-xs">
                        {log.cost_usd != null ? `$${log.cost_usd.toFixed(4)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-[#7D8590]">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Stats Tab ── */}
      {activeTab === 'stats' && stats && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Messages Sent', value: stats.total_sent, icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
              { label: 'Messages Failed', value: stats.total_failed, icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
              { label: 'Delivery Rate', value: `${stats.delivery_rate}%`, icon: TrendingUp, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
              { label: 'Estimated Cost', value: `$${stats.total_cost_usd}`, icon: Zap, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-5">
                  <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mb-3`}>
                    <Icon size={18} className={s.color} />
                  </div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-sm text-gray-500 dark:text-[#7D8590] mt-1">{s.label}</div>
                </div>
              );
            })}
          </div>

          {/* By trigger */}
          {Object.keys(stats.by_trigger || {}).length > 0 && (
            <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB] mb-4">Breakdown by Trigger</h3>
              <div className="space-y-3">
                {Object.entries(stats.by_trigger).map(([trigger, counts]) => {
                  const sent = counts.sent || 0;
                  const failed = counts.failed || 0;
                  const total = sent + failed;
                  const pct = total ? Math.round(sent / total * 100) : 0;
                  return (
                    <div key={trigger}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700 dark:text-[#E6E8EB]">{TRIGGER_LABELS[trigger] || trigger}</span>
                        <span className="text-gray-500 dark:text-[#7D8590]">{sent}/{total} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Inline template editor
const TemplateEditForm = ({ template, onSave, onCancel }) => {
  const [form, setForm] = useState({
    template_name: template.template_name || '',
    language: template.language || 'en',
  });

  return (
    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 space-y-3">
      <div className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB]">
        Edit: {template.label || template.trigger}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-[#A9AFB8] mb-1">
            Meta Template Name
          </label>
          <input
            type="text"
            value={form.template_name}
            onChange={e => setForm(f => ({ ...f, template_name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#1F2630] rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-[#A9AFB8] mb-1">Language Code</label>
          <select
            value={form.language}
            onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#1F2630] rounded-lg bg-white dark:bg-white/5 text-gray-900 dark:text-[#E6E8EB] text-sm"
          >
            <option value="en">English (en)</option>
            <option value="en_US">English US (en_US)</option>
            <option value="ar">Arabic (ar)</option>
            <option value="fr">French (fr)</option>
            <option value="es">Spanish (es)</option>
            <option value="pt_BR">Portuguese BR (pt_BR)</option>
            <option value="hi">Hindi (hi)</option>
            <option value="id">Indonesian (id)</option>
          </select>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-[#7D8590]">
        Expected variables: {(template.variables || []).map(v => `{${v}}`).join(', ')}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold text-[#222]"
          style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-[#7D8590] hover:bg-gray-100 dark:hover:bg-[#1F2630]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AdminWhatsApp;
