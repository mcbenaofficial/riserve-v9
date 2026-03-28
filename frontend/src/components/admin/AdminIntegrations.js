import React, { useState } from 'react';
import { Puzzle, Plus, Settings, ExternalLink, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';

const AdminIntegrations = ({ onNavigateToTab }) => {
  const [integrations, setIntegrations] = useState([
    { id: 1, name: 'Google Calendar', icon: '📅', description: 'Sync bookings with Google Calendar', connected: true, status: 'healthy' },
    { id: 2, name: 'Stripe', icon: '💳', description: 'Payment processing', connected: true, status: 'healthy' },
    { id: 3, name: 'Razorpay', icon: '💰', description: 'Payment gateway for India', connected: false, status: 'disconnected' },
    { id: 4, name: 'WhatsApp Business', icon: '💬', description: 'Send WhatsApp notifications', connected: true, status: 'healthy' },
    { id: 5, name: 'Zoho CRM', icon: '📊', description: 'Customer relationship management', connected: false, status: 'disconnected' },
    { id: 6, name: 'Google Analytics', icon: '📈', description: 'Track website analytics', connected: true, status: 'warning' },
    { id: 7, name: 'Mailchimp', icon: '📧', description: 'Email marketing automation', connected: false, status: 'disconnected' },
    { id: 8, name: 'Slack', icon: '💼', description: 'Team notifications', connected: true, status: 'healthy' },
  ]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'healthy':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
            <CheckCircle size={12} />
            Connected
          </span>
        );
      case 'warning':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold">
            <AlertCircle size={12} />
            Needs Attention
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-semibold">
            Not Connected
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">External Integrations</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">Connect with third-party services</p>
        </div>
        <button
          className="px-4 py-2 rounded-xl font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center gap-2 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
        >
          <Plus size={18} />
          Browse Integrations
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-4">
          <div className="text-sm text-gray-600 dark:text-[#7D8590] mb-1">Connected</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{integrations.filter(i => i.connected).length}</div>
        </div>
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-4">
          <div className="text-sm text-gray-600 dark:text-[#7D8590] mb-1">Available</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-[#E6E8EB]">{integrations.length}</div>
        </div>
        <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-4">
          <div className="text-sm text-gray-600 dark:text-[#7D8590] mb-1">Needs Attention</div>
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{integrations.filter(i => i.status === 'warning').length}</div>
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <div 
            key={integration.id} 
            className={`bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border p-4 transition-all hover:shadow-lg ${
              integration.connected 
                ? 'border-gray-200 dark:border-[#1F2630]' 
                : 'border-dashed border-gray-300 dark:border-[#1F2630]'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center text-2xl">
                  {integration.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-[#E6E8EB]">{integration.name}</div>
                  <div className="text-xs text-gray-500 dark:text-[#E6E8EB]/50">{integration.description}</div>
                </div>
              </div>
              {getStatusBadge(integration.status)}
            </div>
            <div className="flex gap-2">
              {integration.connected ? (
                <>
                  <button
                    onClick={() => integration.name === 'WhatsApp Business' && onNavigateToTab?.('whatsapp')}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#1F2630] rounded-lg text-sm font-medium text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-[#1F2630]/50 transition-all flex items-center justify-center gap-2"
                  >
                    {integration.name === 'WhatsApp Business'
                      ? <><MessageCircle size={14} className="text-green-500" /> Configure</>
                      : <><Settings size={14} /> Configure</>
                    }
                  </button>
                  <button
                    onClick={() => setIntegrations(integrations.map(i => i.id === integration.id ? { ...i, connected: false, status: 'disconnected' } : i))}
                    className="px-3 py-2 border border-red-300 dark:border-red-400/30 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    if (integration.name === 'WhatsApp Business') {
                      setIntegrations(integrations.map(i => i.id === integration.id ? { ...i, connected: true, status: 'healthy' } : i));
                      onNavigateToTab?.('whatsapp');
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-[#222] transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #5FA8D3 0%, #4A95C0 100%)' }}
                >
                  <ExternalLink size={14} />
                  Connect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminIntegrations;
