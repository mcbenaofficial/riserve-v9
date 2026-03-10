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
  Bot
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
    { key: 'audit', label: 'Audit Logs', icon: Activity, path: '/super-admin/audit' },
    { key: 'support', label: 'Support', icon: HelpCircle, path: '/support' }
  ];

  // Feature flag helpers (default to true if settings haven't loaded yet to avoid flickering)
  const isBookingActive = companySettings ? companySettings.is_booking_enabled : true;
  const isRetailActive = companySettings ? companySettings.is_retail_enabled : true;
  const isWorkplaceActive = companySettings ? companySettings.is_workplace_enabled : true;

  // Navigation Configuration
  const allNavItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    {
      key: 'pos',
      label: 'Point of Sale',
      icon: ShoppingCart,
      path: '/pos',
      condition: () => isRetailActive,
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User']
    },
    {
      key: 'bookings',
      label: 'Bookings',
      icon: Calendar,
      path: '/bookings',
      condition: () => isBookingActive,
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User']
    },
    {
      key: 'inventory',
      label: 'Inventory',
      icon: Package,
      path: '/inventory',
      condition: (features) => features.includes('inventory') || isRetailActive || isBookingActive,
      roles: ['SuperAdmin', 'Admin', 'Manager', 'User'],
      badge: lowStockCount > 0 ? lowStockCount : null
    },
    {
      key: 'suppliers',
      label: 'Suppliers',
      icon: Truck,
      path: '/suppliers',
      condition: (features) => features.includes('inventory') || isRetailActive || isBookingActive,
      roles: ['SuperAdmin', 'Admin', 'Manager']
    },
    {
      key: 'finance',
      label: 'Finance',
      icon: DollarSign,
      path: '/finance',
      roles: ['SuperAdmin', 'Admin', 'Manager']
    },
    { key: 'customers', label: 'Customers', icon: Users, path: '/customers', roles: ['SuperAdmin', 'Admin', 'Manager', 'User'] },
    { key: 'smart-analytics', label: 'Smart Analytics', icon: SmartAnalyticsIcon, path: '/smart-analytics', roles: ['SuperAdmin', 'Admin', 'Manager'] },
    {
      key: 'hq-intelligence', label: 'HQ Intelligence', icon: Brain, path: '/hq', roles: ['SuperAdmin', 'Admin'],
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
    { key: 'flow', label: 'Flow', icon: SiriNewIcon, path: '/flow', roles: ['SuperAdmin', 'Admin'] },
    {
      key: 'my-portal',
      label: 'My Portal',
      icon: Briefcase,
      path: '/my-workspace',
      roles: ['Admin', 'Manager', 'User']
    },
    { key: 'admin', label: 'Admin Console', icon: Shield, path: '/admin', roles: ['SuperAdmin', 'Admin'] },
    { key: 'support', label: 'Support', icon: HelpCircle, path: '/support', roles: ['SuperAdmin', 'Admin', 'Manager', 'User'] }
  ];

  const regularNav = allNavItems.filter(item => {
    // Check Feature Flag
    if (item.condition && !item.condition(enabledFeatures)) return false;
    // Check Roles
    if (item.roles && !item.roles.includes(user?.role || 'User')) return false;
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
      <div className="flex items-center justify-between mb-8 px-2">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden">
              <img
                src={mode === 'zen' ? '/logo-zen.png' : (theme === 'dark' ? '/logo-dark.png' : '/logo-light.png')}
                alt="Ri'Serve Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="h-8 flex items-center">
              <img
                src={mode === 'zen' ? '/riserve-text-zen.png' : (theme === 'dark' ? '/riserve-text-dark.png' : '/riserve-text-light.png')}
                alt="RI'SERVE"
                className="h-full object-contain"
              />
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden mx-auto">
            <img
              src={mode === 'zen' ? '/logo-zen.png' : (theme === 'dark' ? '/logo-dark.png' : '/logo-light.png')}
              alt="Ri'Serve Logo"
              className="w-full h-full object-contain"
            />
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
