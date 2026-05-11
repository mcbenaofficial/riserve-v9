import React, { useState, useEffect } from 'react';
import {
  Puzzle, Plus, Settings, ExternalLink, CheckCircle, AlertCircle, MessageCircle,
  Calendar, CreditCard, Users, TrendingUp, Mail, Hash, UtensilsCrossed, Loader2
} from 'lucide-react';
import { api } from '../../services/api';
import AdminWhatsApp from './AdminWhatsApp';
import AdminRazorpay from './AdminRazorpay';
import AdminPetPooja from './AdminPetPooja';

// Integrations that have a real config screen — always show Configure, not just Connect
const CONFIGURABLE = new Set(['WhatsApp Business', 'Razorpay', 'PetPooja']);

const STATIC_INTEGRATIONS = [
  { id: 1,  name: 'Google Calendar',   icon: Calendar,        iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',   description: 'Sync bookings with Google Calendar',            connected: true,  status: 'healthy' },
  { id: 2,  name: 'Stripe',            icon: CreditCard,      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400', description: 'Payment processing',                        connected: true,  status: 'healthy' },
  { id: 3,  name: 'Razorpay',          icon: CreditCard,      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400', description: 'Payment gateway for India',                  connected: false, status: 'disconnected' },
  { id: 4,  name: 'WhatsApp Business', icon: MessageCircle,   iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',  description: 'Send WhatsApp notifications',                  connected: true,  status: 'healthy' },
  { id: 5,  name: 'Zoho CRM',          icon: Users,           iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',  description: 'Customer relationship management',              connected: false, status: 'disconnected' },
  { id: 6,  name: 'Google Analytics',  icon: TrendingUp,      iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400', description: 'Track website analytics',                   connected: true,  status: 'warning' },
  { id: 7,  name: 'Mailchimp',         icon: Mail,            iconBg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400', description: 'Email marketing automation',                  connected: false, status: 'disconnected' },
  { id: 8,  name: 'Slack',             icon: Hash,            iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400', description: 'Team notifications',                         connected: true,  status: 'healthy' },
  { id: 9,  name: 'PetPooja',          icon: UtensilsCrossed, iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400', description: 'Sync POS menu and orders from PetPooja terminals', connected: false, status: 'disconnected' },
];

const AdminIntegrations = ({ onNavigateToTab }) => {
  const [activeIntegration, setActiveIntegration] = useState(null);
  const [integrations, setIntegrations] = useState(STATIC_INTEGRATIONS);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Load real PetPooja connection status from the API on mount
  useEffect(() => {
    api.getPetPoojaConfigs()
      .then(r => {
        const configs = r.data || [];
        // Connected = at least one outlet is in "connected" state
        // Error = at least one is in "error" state but none connected
        let ppStatus = 'disconnected';
        for (const cfg of configs) {
          if (cfg.status === 'connected') { ppStatus = 'healthy'; break; }
          if (cfg.status === 'error')     ppStatus = 'warning';
        }
        const ppConnected = ppStatus === 'healthy';
        setIntegrations(prev =>
          prev.map(i => i.name === 'PetPooja' ? { ...i, connected: ppConnected, status: ppStatus } : i)
        );
      })
      .catch(() => { /* leave default disconnected state */ })
      .finally(() => setLoadingStatus(false));
  }, []);

  const handleNavigate = (name) => {
    if (name === 'WhatsApp Business') setActiveIntegration('whatsapp');
    else if (name === 'Razorpay')     setActiveIntegration('razorpay');
    else if (name === 'PetPooja')     setActiveIntegration('petpooja');
  };

  const getStatusBadge = (status) => {
    if (status === 'healthy') return (
      <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
        <CheckCircle size={12} /> Connected
      </span>
    );
    if (status === 'warning') return (
      <span className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold">
        <AlertCircle size={12} /> Needs Attention
      </span>
    );
    return (
      <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-semibold">
        Not Connected
      </span>
    );
  };

  if (activeIntegration === 'whatsapp')  return <AdminWhatsApp onBack={() => setActiveIntegration(null)} />;
  if (activeIntegration === 'razorpay')  return <AdminRazorpay onBack={() => setActiveIntegration(null)} />;
  if (activeIntegration === 'petpooja')  return <AdminPetPooja onBack={() => { setActiveIntegration(null); /* refresh status on return */ api.getPetPoojaConfigs().then(r => { const configs = r.data || []; let ppStatus = 'disconnected'; for (const cfg of configs) { if (cfg.status === 'connected') { ppStatus = 'healthy'; break; } if (cfg.status === 'error') ppStatus = 'warning'; } setIntegrations(prev => prev.map(i => i.name === 'PetPooja' ? { ...i, connected: ppStatus === 'healthy', status: ppStatus } : i)); }).catch(() => {}); }} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#E6E8EB]">External Integrations</h2>
          <p className="text-sm text-gray-600 dark:text-[#7D8590]">Connect with third-party services</p>
        </div>
        <button
          className="px-4 py-2 rounded-xl font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] flex items-center gap-2 shadow accent-gradient-bg"
        >
          <Plus size={18} />
          Browse Integrations
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Connected',       value: integrations.filter(i => i.connected).length,          color: 'text-green-600 dark:text-green-400' },
          { label: 'Available',       value: integrations.length,                                    color: 'text-gray-900 dark:text-[#E6E8EB]' },
          { label: 'Needs Attention', value: integrations.filter(i => i.status === 'warning').length, color: 'text-yellow-600 dark:text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-[#1F2630] p-4">
            <div className="text-sm text-gray-600 dark:text-[#7D8590] mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>
              {loadingStatus && s.label === 'Connected' ? <Loader2 size={20} className="animate-spin" /> : s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => {
          const IconComponent = integration.icon;
          const isConfigurable = CONFIGURABLE.has(integration.name);

          return (
            <div
              key={integration.id}
              className={`flex flex-col relative overflow-hidden bg-white/90 dark:bg-[#171C22] backdrop-blur-xl rounded-2xl border p-6 transition-all hover:shadow-lg ${
                integration.connected
                  ? 'border-gray-200 dark:border-[#1F2630]'
                  : 'border-dashed border-gray-300 dark:border-[#1F2630] opacity-80 hover:opacity-100'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${integration.iconBg}`}>
                  <IconComponent size={24} />
                </div>
                {getStatusBadge(integration.status)}
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-[#E6E8EB] mb-2">{integration.name}</h3>
              <p className="text-sm text-gray-600 dark:text-[#7D8590] mb-5">{integration.description}</p>

              <div className="flex gap-2 mt-auto pt-2">
                {/* Configurable integrations always show Configure (not gated on connected state) */}
                {isConfigurable ? (
                  <button
                    onClick={() => handleNavigate(integration.name)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#1F2630] rounded-lg text-sm font-medium text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-[#1F2630]/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Settings size={14} /> Configure
                  </button>
                ) : integration.connected ? (
                  <>
                    <button
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-[#1F2630] rounded-lg text-sm font-medium text-gray-700 dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-[#1F2630]/50 transition-all flex items-center justify-center gap-2"
                    >
                      <Settings size={14} /> Configure
                    </button>
                    <button
                      onClick={() => setIntegrations(integrations.map(i => i.id === integration.id ? { ...i, connected: false, status: 'disconnected' } : i))}
                      className="px-3 py-2 border border-red-300 dark:border-red-400/30 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIntegrations(integrations.map(i => i.id === integration.id ? { ...i, connected: true, status: 'healthy' } : i))}
                    className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.02] flex items-center justify-center gap-2 accent-gradient-bg shadow"
                  >
                    <ExternalLink size={14} /> Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminIntegrations;
