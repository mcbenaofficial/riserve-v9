import React, { useState } from 'react';
import { Webhook, Plus, ToggleLeft, ToggleRight, Pencil, Trash2, ExternalLink, Copy, CheckCircle } from 'lucide-react';

const AdminWebhooks = () => {
  const [webhooks, setWebhooks] = useState([
    { id: 1, name: 'CRM Integration', url: 'https://crm.example.com/webhooks/ridn', events: ['booking.created', 'booking.completed'], active: true, lastTriggered: '2 hours ago' },
    { id: 2, name: 'Analytics Platform', url: 'https://analytics.example.com/ingest', events: ['booking.created', 'payment.success'], active: true, lastTriggered: '5 mins ago' },
    { id: 3, name: 'Slack Notifications', url: 'https://hooks.slack.com/services/xxx', events: ['booking.cancelled'], active: false, lastTriggered: 'Never' },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [copied, setCopied] = useState(null);

  const toggleWebhook = (id) => {
    setWebhooks(webhooks.map(w => w.id === id ? { ...w, active: !w.active } : w));
  };

  const copyUrl = (id, url) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const availableEvents = [
    'booking.created', 'booking.updated', 'booking.completed', 'booking.cancelled',
    'payment.success', 'payment.failed', 'outlet.status_changed', 'user.created'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">Webhooks</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">Send real-time events to external services</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
        >
          <Plus size={18} />
          Add Webhook
        </button>
      </div>

      {/* Available Events */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E6E8EB] mb-4">Available Events</h3>
        <div className="flex flex-wrap gap-2">
          {availableEvents.map((event) => (
            <span key={event} className="px-3 py-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-[#1F2630] rounded-lg text-sm text-gray-700 dark:text-[#E6E8EB]/70 font-mono">
              {event}
            </span>
          ))}
        </div>
      </div>

      {/* Webhooks List */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-[#1F2630]">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#E6E8EB]">Configured Webhooks</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-white/10">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="p-4 hover:bg-[#5FA8D3]/5 dark:hover:bg-[#5FA8D3]/10 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    webhook.active ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-gray-100 dark:bg-white/5'
                  }`}>
                    <Webhook size={20} className={webhook.active ? 'text-orange-600 dark:text-orange-400' : 'text-gray-400'} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB]">{webhook.name}</div>
                    <div className="text-xs text-gray-500 dark:text-[#E6E8EB]/50">Last triggered: {webhook.lastTriggered}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleWebhook(webhook.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      webhook.active
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {webhook.active ? 'Active' : 'Inactive'}
                  </button>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg">
                    <Pencil size={16} className="text-gray-500 dark:text-[#E6E8EB]/50" />
                  </button>
                  <button className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-white/5 rounded-lg mb-2">
                <code className="flex-1 text-sm text-gray-600 dark:text-[#7D8590] font-mono truncate">{webhook.url}</code>
                <button onClick={() => copyUrl(webhook.id, webhook.url)} className="p-1 hover:bg-gray-200 dark:hover:bg-[#1F2630] rounded">
                  {copied === webhook.id ? <CheckCircle size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-400" />}
                </button>
                <a href={webhook.url} target="_blank" rel="noopener noreferrer" className="p-1 hover:bg-gray-200 dark:hover:bg-[#1F2630] rounded">
                  <ExternalLink size={16} className="text-gray-400" />
                </a>
              </div>
              <div className="flex flex-wrap gap-2">
                {webhook.events.map((event) => (
                  <span key={event} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-mono">
                    {event}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminWebhooks;
