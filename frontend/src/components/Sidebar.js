import React, { useState, useEffect } from 'react';
import SmartAnalyticsIcon from './icons/SmartAnalyticsIcon';
import { useNavigate, useLocation } from 'react-router-dom';
import OnboardingResumeWidget from './OnboardingResumeWidget';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAssistant } from '../contexts/AssistantContext';
import { api } from '../services/api';
import { AtomicPowerIcon, SiriNewIcon } from 'hugeicons-react';
import {
  LayoutDashboard,
  Calendar,
  Store,
  Wrench,
  DollarSign,
  TrendingUp,
  Users,
  User,
  HelpCircle,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Shield,
  Building2,
  Activity,
  Crown,
  MessageSquare,
  Package,
  Atom,
  ShoppingCart,
  GitBranch,
  Briefcase,
  Truck,
  Brain,
  Bell,
  BookOpen,
  MapPin,
  Sun as SunBriefing,
  MessageCircle,
  Target,
  Crosshair,
  GitCompareArrows,
  Gauge,
  FlaskConical,
  Bot,
  UtensilsCrossed,
  ChefHat,
  Globe,
  Palette,
  Settings2,
  MonitorPlay,
  FileText,
  Receipt
} from 'lucide-react';

const Sidebar = () => {
  const { theme, toggle, mode } = useTheme();
  const { user } = useAuth();
  const { openAssistant } = useAssistant();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [enabledFeatures, setEnabledFeatures] = useState([]);
  const [companySettings, setCompanySettings] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [hqExpanded, setHqExpanded] = useState(false);
  const [showAppSwitcher, setShowAppSwitcher] = useState(false);
  const appSwitcherRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (appSwitcherRef.current && !appSwitcherRef.current.contains(event.target)) {
        setShowAppSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check if Super Admin
  const isSuperAdmin = user?.role === 'SuperAdmin';

  // Auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch enabled features for company
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (isSuperAdmin) return;
      try {
        const [featuresRes, settingsRes] = await Promise.all([
          api.getCompanyFeatures(),
          api.getCompanySettings()
        ]);
        setEnabledFeatures(featuresRes.data.features || []);
        setCompanySettings(settingsRes.data || null);
      } catch (error) {
        console.error('Failed to fetch company data:', error);
      }
    };
    fetchCompanyData();
  }, [isSuperAdmin]);

  // Fetch low stock count if inventory is enabled
  useEffect(() => {
    const fetchLowStock = async () => {
      // Check if general inventory is enabled OR retail/booking modules are enabled
      if (!enabledFeatures.includes('inventory') && !companySettings?.is_retail_enabled && !companySettings?.is_booking_enabled) return;
      try {
        const res = await api.getLowStockProducts();
        setLowStockCount(res.data?.length || 0);
      } catch (error) {
        console.error('Failed to fetch low stock count:', error);
      }
    };
    fetchLowStock();

    // Refresh every 5 minutes
    const interval = setInterval(fetchLowStock, 300000);
    return () => clearInterval(interval);
  }, [enabledFeatures, companySettings]);

  // Different navigation for Super Admin vs regular users
  const superAdminNav = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { key: 'companies', label: 'Companies', icon: Building2, path: '/super-admin/companies' },
    { key: 'users', label: 'All Users', icon: Users, path: '/super-admin/users' },
    { key: 'partner-integrations', label: 'Partner Integrations', icon: MessageCircle, path: '/super-admin/partner-integrations' },
    { key: 'audit', label: 'Audit Logs', icon: Activity, path: '/super-admin/audit' },
    { key: 'support', label: 'Support', icon: HelpCircle, path: '/support' }
  ];

  // Feature flag helpers (default to true if settings haven't loaded yet to avoid flickering)
  const isBookingActive = (companySettings?.is_booking_enabled) || enabledFeatures.includes('booking');
  const isRetailActive = (companySettings?.is_retail_enabled) || enabledFeatures.includes('retail_pos');
  const isWorkplaceActive = companySettings?.is_workplace_enabled;

  // App Definitions
  const APPS = [
    { id: 'core', name: 'Core Platform', icon: LayoutDashboard },
    { id: 'staff', name: 'Staff Management', icon: Users, feature: 'staff_management' },
    { id: 'crm', name: 'CRM & Loyalty', icon: Crown, feature: 'crm' },
    { id: 'inventory', name: 'Inventory & Procurement', icon: Package, feature: 'inventory' },
    { id: 'flow', name: 'Flows Engine', icon: SiriNewIcon, feature: 'ai_flows' },
    { id: 'restaurant', name: 'Restaurant Orders', icon: UtensilsCrossed, feature: 'restaurant_orders' },
    { id: 'hq', name: 'HQ Intelligence', icon: Brain, feature: 'hq_intelligence' },
    { id: 'reputation', name: 'Reputation Management', icon: MessageSquare, feature: 'reputation_management' },
    { id: 'portal', name: 'Omni Site Builder', icon: Globe },
  ];

  const activeAppId = React.useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/omni')) return 'portal';
    if (path.startsWith('/hq')) return 'hq';
    if (path.startsWith('/flow')) return 'flow';
    if (path.startsWith('/orders')) return 'restaurant';
    if (path.startsWith('/inventory') || path.startsWith('/suppliers')) return 'inventory';
    if (path.startsWith('/customers')) return 'crm';
    if (path.startsWith('/team') || path.startsWith('/analytics/staff-scheduling')) return 'staff';
    if (path.startsWith('/feedback') || path.startsWith('/reviews')) return 'reputation';
    return 'core';
  }, [location.pathname]);

  const activeApp = APPS.find(a => a.id === activeAppId) || APPS[0];

  // Navigation Configuration
  const allNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/', appId: 'core' },
    {
      key: 'pos',
      label: 'Point of Sale',
      icon: ShoppingCart,
      path: '/pos',
      condition: () => isRetailActive,
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User'],
      appId: 'core'
    },
    {
      key: 'bookings',
      label: 'Bookings',
      icon: Calendar,
      path: '/bookings',
      condition: () => isBookingActive,
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User'],
      appId: 'core'
    },
    {
      key: 'inventory',
      label: 'Inventory',
      icon: Package,
      path: '/inventory',
      condition: (features) => features.includes('inventory'),
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User'],
      badge: lowStockCount > 0 ? lowStockCount : null,
      appId: 'inventory'
    },
    {
      key: 'suppliers',
      label: 'Suppliers',
      icon: Truck,
      path: '/suppliers',
      condition: (features) => features.includes('inventory'),
      roles: ['SuperAdmin', 'Admin', 'Manager'],
      appId: 'inventory'
    },
    { key: 'finance', label: 'Finance', icon: DollarSign, path: '/finance', roles: ['SuperAdmin', 'Admin', 'Manager'], appId: 'core' },
    { key: 'invoices', label: 'Invoices', icon: Receipt, path: '/invoices', roles: ['Admin', 'Manager'], appId: 'core' },
    { key: 'customers', label: 'Customer Database', icon: Users, path: '/customers', condition: (features) => features.includes('crm'), roles: ['SuperAdmin', 'Admin', 'Manager', 'User'], appId: 'crm' },
    { key: 'customer-segments', label: 'Segments', icon: User, path: '/customers/segments', condition: (features) => features.includes('crm'), roles: ['SuperAdmin', 'Admin', 'Manager'], appId: 'crm' },
    {
      key: 'team',
      label: 'Staff Roster',
      icon: Users,
      path: '/team',
      condition: (features) => features.includes('staff_management'),
      roles: ['SuperAdmin', 'Admin', 'Manager'],
      appId: 'staff'
    },
    {
      key: 'staff-scheduling',
      label: 'Performance & Schedules',
      icon: Clock,
      path: '/analytics/staff-scheduling',
      condition: (features) => features.includes('staff_management'),
      roles: ['SuperAdmin', 'Admin', 'Manager'],
      appId: 'staff'
    },
    {
      key: 'feedback',
      label: 'Feedback Collections',
      icon: MessageSquare,
      path: '/feedback',
      condition: (features) => features.includes('reputation_management'),
      roles: ['SuperAdmin', 'Admin', 'Manager'],
      appId: 'reputation'
    },
    { key: 'smart-analytics', label: 'Smart Analytics', icon: SmartAnalyticsIcon, path: '/smart-analytics', roles: ['SuperAdmin', 'Admin', 'Manager'], appId: 'core' },
    {
      key: 'hq-intelligence', label: 'HQ Intelligence', icon: Brain, path: '/hq', condition: (features) => features.includes('hq_intelligence'), roles: ['SuperAdmin', 'Admin'],
      appId: 'hq',
      subItems: [
        { key: 'hq-command', label: 'Command Center', icon: Brain, path: '/hq' },
        { key: 'hq-briefing', label: 'Briefing', icon: SunBriefing, path: '/hq/briefing' },
        { key: 'hq-playbooks', label: 'Playbooks', icon: BookOpen, path: '/hq/playbooks' },
        { key: 'hq-alerts', label: 'Alerts', icon: Bell, path: '/hq/alerts' },
        { key: 'hq-regions', label: 'Regions', icon: MapPin, path: '/hq/regions' },
        { key: 'hq-goals', label: 'Goals', icon: Target, path: '/hq/goals' },
        { key: 'hq-predictions', label: 'Predictions', icon: Crosshair, path: '/hq/predictions' },
        { key: 'hq-benchmark', label: 'Benchmark', icon: GitCompareArrows, path: '/hq/benchmark' },
        { key: 'hq-kpis', label: 'Custom KPIs', icon: Gauge, path: '/hq/kpis' },
        { key: 'hq-experiments', label: 'Experiments', icon: FlaskConical, path: '/hq/experiments' },
        { key: 'hq-agent', label: 'Agent Workflows', icon: Bot, path: '/hq/agent' },
        { key: 'hq-copilot', label: 'Copilot', icon: MessageCircle, path: '/hq/copilot' },
      ]
    },
    { key: 'flow', label: 'Flow', icon: SiriNewIcon, path: '/flow', condition: (features) => features.includes('ai_flows'), roles: ['SuperAdmin', 'Admin'], appId: 'flow' },
    // Omni Portal
    { key: 'omni-design', label: 'Design Studio', icon: Palette, path: '/omni/design', roles: ['SuperAdmin', 'Admin', 'Manager'], appId: 'portal' },
    { key: 'omni-content', label: 'Content Manager', icon: FileText, path: '/omni/content', roles: ['SuperAdmin', 'Admin', 'Manager'], appId: 'portal' },
    { key: 'omni-config', label: 'Site Config & AI', icon: Settings2, path: '/omni/config', roles: ['SuperAdmin', 'Admin'], appId: 'portal' },
    { key: 'omni-preview', label: 'Live Preview', icon: MonitorPlay, path: '/omni/preview', roles: ['SuperAdmin', 'Admin', 'Manager'], appId: 'portal' },
    // Restaurant Orders App
    {
      key: 'orders-dashboard',
      label: 'Orders Dashboard',
      icon: UtensilsCrossed,
      path: '/orders',
      condition: (features) => features.includes('restaurant_orders'),
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User'],
      appId: 'restaurant'
    },
    {
      key: 'kitchen-display',
      label: 'Kitchen Display',
      icon: ChefHat,
      path: '/orders/kitchen',
      condition: (features) => features.includes('restaurant_orders'),
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User'],
      appId: 'restaurant'
    },
    {
      key: 'pickup-display',
      label: 'Pickup Counter',
      icon: Package,
      path: '/orders/pickup',
      condition: (features) => features.includes('restaurant_orders'),
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User'],
      appId: 'restaurant'
    },
    {
      key: 'my-portal',
      label: 'My Portal',
      icon: Briefcase,
      path: '/my-workspace',
      roles: ['Admin', 'Manager', 'User'],
      appId: 'core'
    },
    { key: 'admin', label: 'Admin Console', icon: Shield, path: '/admin', roles: ['SuperAdmin', 'Admin'], appId: 'core' },
    { key: 'support', label: 'Support', icon: HelpCircle, path: '/support', roles: ['SuperAdmin', 'Admin', 'Manager', 'User'], appId: 'core' }
  ];

  const regularNav = allNavItems.filter(item => {
    // Check Feature Flag
    if (item.condition && !item.condition(enabledFeatures)) return false;
    // Check Roles
    if (item.roles && !item.roles.includes(user?.role || 'User')) return false;
    // Check Active App
    if (item.appId !== activeAppId) return false;
    return true;
  });

  const nav = isSuperAdmin ? superAdminNav : regularNav;

  const isActive = (path) => location.pathname === path;
  const isHqPath = location.pathname.startsWith('/hq');

  // Auto-expand HQ sub-menu if on an HQ page
  React.useEffect(() => {
    if (isHqPath) setHqExpanded(true);
  }, [isHqPath]);

  return (
    <aside className={`${collapsed ? 'w-20' : 'w-72'} min-w-[5rem] ${collapsed ? 'max-w-[5rem]' : 'max-w-[18rem]'} flex-shrink-0 bg-white/70 dark:bg-[#0B0D10]/80 backdrop-blur-xl border-r border-white/50 dark:border-[#1F2630] p-4 flex flex-col h-screen sticky top-0 transition-all duration-300 z-50 shadow-xl dark:shadow-none`}>
      {/* Logo & Toggle */}
      <div className="flex flex-col mb-6">
        <div className="flex items-center justify-between mb-4 px-2">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
                <img
                  src={mode === 'zen' ? '/logo-zen.png' : (theme === 'dark' ? '/logo-dark.png' : '/logo-light.png')}
                  alt="Ri'Serve Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="h-6 flex items-center">
                <img
                  src={mode === 'zen' ? '/riserve-text-zen.png' : (theme === 'dark' ? '/riserve-text-dark.png' : '/riserve-text-light.png')}
                  alt="RI'SERVE"
                  className="h-full object-contain"
                />
              </div>
            </div>
          )}

          {collapsed && (
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden mx-auto">
              <img
                src={mode === 'zen' ? '/logo-zen.png' : (theme === 'dark' ? '/logo-dark.png' : '/logo-light.png')}
                alt="Ri'Serve Logo"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>

        {/* App Switcher */}
        {!collapsed && !isSuperAdmin && (
          <div className="relative px-2" ref={appSwitcherRef}>
            <button
              onClick={() => setShowAppSwitcher(!showAppSwitcher)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all border ${theme === 'dark' ? 'bg-[#171C22]/50 border-[#1F2630] hover:bg-[#1F2630]' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-white shadow-sm'}`}>
                  {activeApp.icon && React.createElement(activeApp.icon, { size: 16, className: theme === 'dark' ? 'text-gray-300' : 'text-gray-600' })}
                </div>
                <span className={`text-sm font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-gray-800'}`}>
                  {activeApp.name}
                </span>
              </div>
              <ChevronDown size={16} className={`transition-transform duration-200 ${showAppSwitcher ? 'rotate-180' : ''} ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} />
            </button>

            {/* Dropdown Menu */}
            {showAppSwitcher && (
              <div className={`absolute top-full left-2 right-2 mt-2 py-2 rounded-xl shadow-xl border z-50 overflow-hidden ${theme === 'dark' ? 'bg-[#171C22] border-[#1F2630]' : 'bg-white border-gray-200'}`}>
                <div className="px-3 py-2 border-b bg-gray-50/50 dark:bg-gray-800/20 dark:border-[#1F2630]">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    Available Modules
                  </span>
                </div>
                <div className="p-1 max-h-64 overflow-y-auto">
                  {APPS.map((app) => {
                    const isLocked = app.feature && !enabledFeatures.includes(app.feature);
                    const Icon = app.icon;
                    return (
                      <button
                        key={app.id}
                        onClick={() => {
                          if (isLocked) {
                            setShowAppSwitcher(false);
                            alert(`Upgrade Required: You need the ${app.name} license to access this module.`);
                          } else {
                            setShowAppSwitcher(false);
                            if (app.id === 'hq') navigate('/hq');
                            else if (app.id === 'crm') navigate('/customers');
                            else if (app.id === 'inventory') navigate('/inventory');
                            else if (app.id === 'flow') navigate('/flow');
                            else if (app.id === 'staff') navigate('/team');
                            else if (app.id === 'reputation') navigate('/feedback');
                            else if (app.id === 'restaurant') navigate('/orders');
                            else if (app.id === 'portal') navigate('/omni/design');
                            else navigate('/');
                          }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors ${activeApp.id === app.id
                          ? (theme === 'dark' ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600')
                          : (theme === 'dark' ? 'text-gray-300 hover:bg-[#1F2630]' : 'text-gray-700 hover:bg-gray-50')
                          } ${isLocked ? 'opacity-60 grayscale' : ''}`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className={isLocked ? 'opacity-50' : ''} />
                          <span className={`text-sm font-medium ${isLocked ? 'opacity-80' : ''}`}>
                            {app.name}
                          </span>
                        </div>
                        {isLocked && (
                          <div className={`p-1 rounded-md ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                            <Crown size={12} className="opacity-70" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-4 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0E1116] dark:hover:text-[#E6E8EB] transition-all mx-auto border border-transparent hover:border-black/5 dark:hover:border-[#1F2630]"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 overflow-y-auto">
        {nav.map((n) => {
          const IconComponent = n.icon;
          const hasSubItems = n.subItems && n.subItems.length > 0;
          const isExpanded = hasSubItems && hqExpanded;
          const isParentActive = hasSubItems
            ? isHqPath
            : isActive(n.path);

          return (
            <div key={n.key}>
              <button
                onClick={() => {
                  if (hasSubItems) {
                    if (collapsed) { navigate(n.path); }
                    else { setHqExpanded(!hqExpanded); }
                  } else {
                    navigate(n.path);
                  }
                }}
                className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl text-sm font-medium transition-all relative group ${isParentActive
                  ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-700 dark:text-[#E6E8EB] border border-purple-500/20 dark:border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]'
                  : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#0E1116] dark:hover:text-[#E6E8EB] border border-transparent'
                  }`}
                title={collapsed ? n.label : ''}
              >
                <IconComponent size={20} />
                {!collapsed && <div className="flex-1 text-left">{n.label}</div>}
                {n.badge && (
                  <span className={`${collapsed ? 'absolute -top-1 -right-1' : ''} min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold`}>
                    {n.badge}
                  </span>
                )}
                {hasSubItems && !collapsed && (
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                )}
              </button>
              {/* Sub-items */}
              {hasSubItems && isExpanded && !collapsed && (
                <div className="ml-4 mt-1 space-y-0.5 border-l-2 border-purple-500/20 pl-3">
                  {n.subItems.map((sub) => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={sub.key}
                        onClick={() => navigate(sub.path)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive(sub.path)
                          ? 'bg-purple-500/10 text-purple-400 dark:text-purple-300'
                          : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[#0E1116] dark:hover:text-[#E6E8EB]'
                          }`}
                      >
                        <SubIcon size={14} />
                        {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="mt-6 space-y-3 pt-4 border-t border-white/50 dark:border-[#1F2630]">
        {/* Onboarding Resume Widget */}
        {!collapsed && <OnboardingResumeWidget />}

        {/* AI Agent Button - Navigate to full page */}
        <button
          onClick={() => navigate('/ai-agent')}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-4 py-3 rounded-xl font-medium transition-all bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-500 dark:to-blue-500 text-white hover:opacity-90 shadow-lg shadow-purple-500/20`}
          title={collapsed ? 'Vorta' : ''}
          data-testid="ai-agent-btn"
        >
          <Atom size={20} />
          {!collapsed && <span className="text-sm">Vorta</span>}
        </button>

        <button
          onClick={toggle}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#0E1116] dark:hover:text-[#E6E8EB] transition-all border border-transparent hover:border-black/5 dark:hover:border-[#1F2630]`}
          title={collapsed ? (theme === 'dark' ? 'Dark Mode' : 'Light Mode') : ''}
        >
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
                <span className="text-sm font-medium">
                  {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>
            </>
          ) : (
            theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
