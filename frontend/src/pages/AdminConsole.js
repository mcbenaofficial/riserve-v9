import React, { useState, useEffect } from 'react';
import {
  Settings, Users, Store, Wrench, Mail, MessageSquare, MessageCircle,
  Webhook, Zap, Puzzle, ChevronRight, Shield, Calendar, Building2, Star, Package, UserCog, FileText,
  UtensilsCrossed, Palette
} from 'lucide-react';
import { api } from '../services/api';

// Import sub-components
import AdminUsers from '../components/admin/AdminUsers';
import AdminServices from '../components/admin/AdminServices';
import AdminOutlets from '../components/admin/AdminOutlets';
import AdminEmail from '../components/admin/AdminEmail';
import AdminSMS from '../components/admin/AdminSMS';
import AdminWebhooks from '../components/admin/AdminWebhooks';
import AdminAutomations from '../components/admin/AdminAutomations';
import AdminIntegrations from '../components/admin/AdminIntegrations';
import AdminSlotBooking from '../components/admin/AdminSlotBooking';
import AdminCompanySettings from '../components/admin/AdminCompanySettings';
import AdminFeedback from '../components/admin/AdminFeedback';
import AdminInventory from '../components/admin/AdminInventory';
import AdminStaff from '../components/admin/AdminStaff';
import AdminPromotions from '../components/admin/AdminPromotions';
import AdminBookingForm from '../components/admin/AdminBookingForm';
import AdminMenuManagement from '../components/admin/AdminMenuManagement';
import AdminPortalDesign from '../components/admin/AdminPortalDesign';
import AdminWhatsApp from '../components/admin/AdminWhatsApp';

const AdminConsole = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [enabledFeatures, setEnabledFeatures] = useState([]);
  const [licensedModules, setLicensedModules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      const res = await api.getCompanyFeatures();
      setEnabledFeatures(res.data.features || []);
      setLicensedModules(res.data.licensed_modules || []);
    } catch (error) {
      console.error('Failed to fetch company features:', error);
    } finally {
      setLoading(false);
    }
  };

  const baseTabs = [
    { id: 'company', label: 'Company Settings', icon: Building2, component: AdminCompanySettings },
    { id: 'portal-design', label: 'Portal Design', icon: Palette, component: AdminPortalDesign },
    { id: 'users', label: 'User Management', icon: Users, component: AdminUsers },
    { id: 'staff', label: 'Staff Management', icon: UserCog, component: AdminStaff },
    { id: 'promotions', label: 'Promotions', icon: Star, component: AdminPromotions },
    { id: 'outlets', label: 'Outlets / Locations', icon: Store, component: AdminOutlets },
    { id: 'feedback', label: 'Customer Feedback', icon: MessageSquare, component: AdminFeedback },
  ];

  const featureTabs = [];

  if (enabledFeatures.includes('restaurant_orders') || licensedModules.includes('restaurant_orders')) {
    featureTabs.push(
      { id: 'menu-management', label: 'Menu Management', icon: UtensilsCrossed, component: AdminMenuManagement }
    );
  }
  
  if (enabledFeatures.includes('booking') || licensedModules.includes('booking')) {
    featureTabs.push(
      { id: 'services', label: 'Services', icon: Wrench, component: AdminServices },
      { id: 'slot-booking', label: 'Slot Booking', icon: Calendar, component: AdminSlotBooking },
      { id: 'booking-form', label: 'Booking Form', icon: FileText, component: AdminBookingForm }
    );
  }

  if (enabledFeatures.includes('inventory') || licensedModules.includes('inventory')) {
    featureTabs.push({ id: 'inventory', label: 'Inventory', icon: Package, component: AdminInventory });
  }

  const integrationTabs = [
    { id: 'email', label: 'Email Notifications', icon: Mail, component: AdminEmail },
    { id: 'sms', label: 'SMS Notifications', icon: MessageSquare, component: AdminSMS },
    { id: 'whatsapp', label: 'WhatsApp Notifications', icon: MessageCircle, component: AdminWhatsApp },
    { id: 'webhooks', label: 'Webhooks', icon: Webhook, component: AdminWebhooks },
    { id: 'automations', label: 'Automations', icon: Zap, component: AdminAutomations },
    { id: 'integrations', label: 'External Integrations', icon: Puzzle, component: AdminIntegrations },
  ];

  const tabs = [...baseTabs, ...featureTabs, ...integrationTabs];

  const activeTabData = tabs.find(t => t.id === activeTab);
  const ActiveComponent = activeTabData?.component;

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-lg text-[#4B5563] dark:text-[#7D8590]">Loading admin console...</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl p-6 border border-[#D9DEE5] dark:border-[#1F2630] mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center shadow-lg">
            <Shield size={24} className="text-[#222]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Admin Console</h1>
            <p className="text-sm text-[#4B5563] dark:text-[#7D8590]">
              Manage your business settings, users, and integrations
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white/90 dark:bg-white/5 backdrop-blur-xl rounded-3xl border border-[#D9DEE5] dark:border-[#1F2630] overflow-hidden sticky top-6">
            <div className="p-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
              <h3 className="text-sm font-semibold text-[#6B7280] dark:text-[#E6E8EB]/50 uppercase tracking-wider">
                Settings
              </h3>
            </div>
            <nav className="p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    data-testid={`admin-tab-${tab.id}`}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1 transition-all ${isActive
                      ? 'bg-gradient-to-r from-[#5FA8D3] to-[#4A95C0] text-[#222] font-semibold shadow-lg'
                      : 'text-[#4B5563] dark:text-[#E6E8EB]/70 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630]'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} />
                      <span className="text-sm">{tab.label}</span>
                    </div>
                    {isActive && <ChevronRight size={16} />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {ActiveComponent && (
            activeTab === 'integrations'
              ? <AdminIntegrations onNavigateToTab={setActiveTab} />
              : <ActiveComponent />
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminConsole;
