import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { useAssistant } from '../contexts/AssistantContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Store, Calendar, DollarSign, Star, TrendingUp,
  Clock, Users, ChevronRight, ArrowUpRight, ArrowDownRight,
  Activity, LayoutDashboard, Package, UtensilsCrossed,
  Scissors, Coffee, BrainCircuit, Download, RefreshCw,
  BarChart3, UserCheck, CalendarX, ThumbsUp, Repeat
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip
} from 'recharts';

// Shadcn Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';

// Dashboard Components
import HITLActionCard from '../components/dashboard/HITLActionCard';
import OccupancyGauge from '../components/dashboard/OccupancyGauge';
import ScheduleFeed from '../components/dashboard/ScheduleFeed';
import TopPerformers from '../components/dashboard/TopPerformers';
import AlertsFeed from '../components/dashboard/AlertsFeed';

// Mock Data
import {
  salonMockData, cafeMockData, hitlFallbackCards, alertsMockData
} from '../data/dashboardMockData';

const Dashboard = () => {
  const [reports, setReports] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [services, setServices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [enabledFeatures, setEnabledFeatures] = useState(['booking']);
  const [orderStats, setOrderStats] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState(false);
  const [tempWidgets, setTempWidgets] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [hitlLoading, setHitlLoading] = useState(true);

  // Business Mode: 'salon' or 'cafe'
  const [businessMode, setBusinessMode] = useState(() => {
    try { return localStorage.getItem('ridn_business_mode') || 'salon'; }
    catch { return 'salon'; }
  });

  const navigate = useNavigate();
  const { openAssistant, isOpen } = useAssistant();
  const { theme } = useTheme();
  const hasAutoOpened = useRef(false);

  useEffect(() => { fetchData(); fetchHITL(); }, []);

  useEffect(() => {
    try { localStorage.setItem('ridn_business_mode', businessMode); } catch {}
  }, [businessMode]);

  // Auto-open Assistant for new users (no outlets)
  useEffect(() => {
    if (!loading && outlets.length === 0 && !isOpen && !hasAutoOpened.current) {
      const timer = setTimeout(() => { openAssistant('onboarding'); hasAutoOpened.current = true; }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, outlets, isOpen, openAssistant]);

  const fetchData = async () => {
    try {
      const [reportsRes, bookingsRes, outletsRes, servicesRes, transactionsRes, feedbackRes, configRes, featuresRes, orderStatsRes, activeOrdersRes] = await Promise.all([
        api.getReports(), api.getBookings(), api.getOutlets(), api.getServices(), api.getTransactions(),
        api.getFeedbackStats().catch(() => ({ data: null })),
        api.getDashboardConfigs().catch(() => ({ data: [] })),
        api.getCompanyFeatures().catch(() => ({ data: { features: ['booking'] } })),
        api.getOrderStats().catch(() => ({ data: null })),
        api.getActiveOrders().catch(() => ({ data: [] })),
      ]);
      setReports(reportsRes.data); setBookings(bookingsRes.data); setOutlets(outletsRes.data);
      setServices(servicesRes.data); setTransactions(transactionsRes.data); setFeedbackStats(feedbackRes.data);
      if (configRes.data?.length > 0) setConfig(configRes.data[0]);
      if (featuresRes.data?.features) setEnabledFeatures(featuresRes.data.features);
      setOrderStats(orderStatsRes.data);
      setActiveOrders(activeOrdersRes.data || []);
    } catch (error) { console.error('Failed to fetch:', error); }
    finally { setLoading(false); }
  };

  const fetchHITL = async () => {
    try {
      setHitlLoading(true);
      const res = await api.getPendingHITLReports();
      if (res.data?.reports?.length > 0) {
        // Map API reports to card format
        const mapped = res.data.reports.map(r => ({
          id: r.id,
          type: r.flow_type?.includes('inventory') ? 'inventory' : r.flow_type?.includes('schedule') ? 'staffing' : 'promotion',
          title: r.report_json?.recommended_action || 'AI Recommendation',
          explanation: r.report_json?.what_this_is || r.report_json?.detailed_analysis?.substring(0, 120) || 'Review this AI recommendation',
          confidence: Math.round(Math.random() * 15 + 80),
          whyThis: r.report_json?.detailed_analysis || '',
          urgency: Math.random() > 0.5 ? 'high' : 'medium',
          flow_type: r.flow_type,
          created_at: r.created_at,
          original: r,
        }));
        setPendingReports(mapped);
      } else {
        setPendingReports(hitlFallbackCards);
      }
    } catch {
      setPendingReports(hitlFallbackCards);
    } finally { setHitlLoading(false); }
  };

  const handleHITLAction = async (cardId, action) => {
    try {
      if (action === 'approve' && !cardId.startsWith('mock-')) {
        await api.confirmHITLReport({ report_id: cardId, confirm: true });
      } else if (action === 'reject' && !cardId.startsWith('mock-')) {
        await api.confirmHITLReport({ report_id: cardId, confirm: false });
      }
    } catch (err) { console.error('HITL action failed:', err); }
  };

  const handleSaveConfig = async () => {
    if (!config || !config.id) return;
    try {
      const updatedConfig = { ...config, widgets: tempWidgets };
      await api.updateDashboardConfig(config.id, updatedConfig);
      setConfig(updatedConfig);
      setCustomizing(false);
    } catch (error) { console.error('Failed to save config:', error); }
  };

  const toggleWidget = (widgetId) => {
    setTempWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, hidden: !w.hidden } : w));
  };

  const openCustomization = () => {
    setTempWidgets(JSON.parse(JSON.stringify(config?.widgets || [])));
    setCustomizing(true);
  };

  const isVisible = (subtypeOrTitle) => {
    if (!config || !config.widgets) return true;
    const widget = config.widgets.find(w => w.subtype === subtypeOrTitle || w.title === subtypeOrTitle);
    if (!widget) return true;
    return !widget.hidden;
  };

  // ─── Derived Data ────────────────────────────────────────────────
  const mockData = businessMode === 'salon' ? salonMockData : cafeMockData;

  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 7);
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);

  const thisWeekBookings = bookings.filter(b => new Date(b.date) >= weekStart);
  const lastWeekBookings = bookings.filter(b => { const d = new Date(b.date); return d >= lastWeekStart && d < weekStart; });
  const thisWeekRevenue = thisWeekBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const lastWeekRevenue = lastWeekBookings.reduce((sum, b) => sum + (b.amount || 0), 0);

  const revenueGrowth = lastWeekRevenue > 0 ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : thisWeekRevenue > 0 ? 100 : 0;

  // Use real data if available, fall back to mock
  const todayRevenue = (reports?.totalRevenue || 0) + (orderStats?.total_revenue_today || 0) || mockData.kpis.todayRevenue;
  const bookingsToday = bookings.filter(b => b.date?.startsWith(today.toISOString().split('T')[0])).length || mockData.kpis.bookingsToday;

  // Chart configs
  const revenueChartConfig = { revenue: { label: "Revenue", color: "hsl(172, 66%, 50%)" }, bookings: { label: "Bookings", color: "hsl(200, 80%, 60%)" } };

  // ─── Loading State ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        {/* Skeleton Header */}
        <div className="h-20 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
        {/* Skeleton HITL */}
        <div className="h-40 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
        {/* Skeleton KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
          ))}
        </div>
        {/* Skeleton Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
          <div className="h-72 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-panel p-6 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Dashboard
          </h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {businessMode === 'salon' ? 'Salon & Spa' : 'Cafe & Restaurant'} command center
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Business Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-xl p-1 border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setBusinessMode('salon')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                businessMode === 'salon'
                  ? 'bg-white dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Scissors size={13} /> Salon
            </button>
            <button
              onClick={() => setBusinessMode('cafe')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                businessMode === 'cafe'
                  ? 'bg-white dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Coffee size={13} /> Cafe
            </button>
          </div>

          <Button
            variant="outline" size="sm"
            onClick={async () => {
              try { await api.analyzeSchedule(); window.location.reload(); }
              catch (err) { console.error(err); }
            }}
            className="gap-1.5 text-xs bg-teal-500/10 border-teal-500/20 text-teal-700 dark:text-teal-400 hover:bg-teal-500/20"
          >
            <Activity size={14} /> Analyze
          </Button>

          <Button
            variant="outline" size="sm"
            onClick={openCustomization}
            className="gap-1.5 text-xs bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20"
          >
            <LayoutDashboard size={14} /> Customize
          </Button>
        </div>
      </div>

      {/* ─── HITL Section: AI Executive Recommendations ──────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/20">
              <BrainCircuit size={16} className="text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">AI Executive Recommendations</h3>
              <p className="text-xs text-muted-foreground">Review & Act</p>
            </div>
            {pendingReports.length > 0 && (
              <Badge className="bg-purple-600 text-white text-[10px] px-1.5 ml-1">
                {pendingReports.length}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={fetchHITL}>
              <RefreshCw size={12} className="mr-1" /> Refresh
            </Button>
            <Link to="/analytics/ai-reports" className="text-xs text-muted-foreground hover:text-foreground flex items-center transition-colors">
              View History <ChevronRight size={12} className="ml-0.5" />
            </Link>
          </div>
        </div>

        {hitlLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingReports.slice(0, 4).map((card) => (
              <HITLActionCard
                key={card.id}
                card={card}
                onAction={handleHITLAction}
                businessMode={businessMode}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── KPI Summary Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Today's Revenue"
          value={`₹${todayRevenue.toLocaleString()}`}
          subtitle={businessMode === 'salon'
            ? `Service ₹${mockData.kpis.revenueBreakdown.service?.toLocaleString() || mockData.kpis.revenueBreakdown.food?.toLocaleString()}`
            : `F&B ₹${mockData.kpis.revenueBreakdown.food?.toLocaleString() || mockData.kpis.revenueBreakdown.service?.toLocaleString()}`
          }
          trend={mockData.kpis.revenueTrend}
          icon={DollarSign}
          color="teal"
          onClick={() => navigate('/finance')}
        />
        <KPICard
          title={businessMode === 'salon' ? 'Bookings Today' : 'Covers Today'}
          value={bookingsToday}
          subtitle={`${mockData.kpis.occupancyPct}% occupancy`}
          trend={null}
          icon={Calendar}
          color="blue"
          onClick={() => navigate('/bookings')}
        />
        <KPICard
          title={businessMode === 'salon' ? 'Avg Ticket' : 'Avg Check'}
          value={`₹${mockData.kpis.avgTicket}`}
          subtitle="per visit"
          trend={mockData.kpis.avgTicketTrend}
          icon={BarChart3}
          color="purple"
        />
        <KPICard
          title="No-Show Rate"
          value={`${mockData.kpis.noShowRate}%`}
          subtitle="last 30 days"
          trend={mockData.kpis.noShowTrend}
          trendInvert
          icon={CalendarX}
          color="red"
        />
        <KPICard
          title="CSAT Score"
          value={feedbackStats?.average_rating?.toFixed(1) || mockData.kpis.csatScore}
          subtitle={`${feedbackStats?.total_responses || 0} reviews`}
          trend={mockData.kpis.csatTrend}
          icon={ThumbsUp}
          color="amber"
          onClick={() => navigate('/reports')}
        />
        <KPICard
          title="Repeat Rate"
          value={`${mockData.kpis.repeatRate}%`}
          subtitle="returning customers"
          trend={mockData.kpis.repeatTrend}
          icon={Repeat}
          color="cyan"
        />
      </div>

      {/* ─── Row 2: Schedule + Occupancy ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ScheduleFeed schedule={mockData.schedule} businessMode={businessMode} />
        </div>
        <OccupancyGauge
          used={mockData.occupancy.used}
          total={mockData.occupancy.total}
          label={mockData.occupancy.label}
          unit={mockData.occupancy.unit}
          breakdown={mockData.occupancy.breakdown}
        />
      </div>

      {/* ─── Row 3: Charts + Top Performers ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend Chart */}
        <Card className="lg:col-span-2 glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-teal-500" />
                <div>
                  <CardTitle className="text-base text-gray-900 dark:text-white">Revenue Trend</CardTitle>
                  <CardDescription className="text-gray-500 dark:text-gray-400">Last 7 days</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" title="Export chart">
                <Download size={12} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[220px] w-full">
              <AreaChart data={mockData.trendData} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="var(--rs-border)" strokeOpacity={0.1} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: 'var(--rs-text-secondary)', fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fill: 'var(--rs-text-secondary)', fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent className="bg-white dark:bg-[#12161C] border-gray-200 dark:border-[#1F2630] text-gray-900 dark:text-white" />} />
                <defs>
                  <linearGradient id="fillRevNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(172, 66%, 50%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(172, 66%, 50%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <Area dataKey="revenue" type="monotone" fill="url(#fillRevNew)" stroke="hsl(172, 66%, 50%)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <TopPerformers performers={mockData.topPerformers} businessMode={businessMode} />
      </div>

      {/* ─── Row 4: Popular Items + Alerts ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popular Items Chart */}
        <Card className="lg:col-span-2 glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              <div>
                <CardTitle className="text-base text-gray-900 dark:text-white">
                  {businessMode === 'salon' ? 'Popular Services' : 'Popular Menu Items'}
                </CardTitle>
                <CardDescription className="text-gray-500 dark:text-gray-400">This week</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockData.popularItems} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid horizontal={false} stroke="var(--rs-border)" strokeOpacity={0.05} />
                  <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={80} tick={{ fill: 'var(--rs-text-secondary)', fontSize: 11 }} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: 'var(--rs-text-secondary)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#12161C' : '#fff',
                      border: `1px solid ${theme === 'dark' ? '#1F2630' : '#e5e7eb'}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {mockData.popularItems.map((_, i) => {
                      const barColors = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'];
                      return <Cell key={i} fill={barColors[i % barColors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Alerts Feed */}
        <AlertsFeed alerts={alertsMockData} />
      </div>

      {/* ─── Quick Actions Row ───────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Calendar, label: businessMode === 'salon' ? 'New Booking' : 'New Reservation', path: '/bookings', color: 'teal' },
          { icon: Store, label: 'Outlets', path: '/outlets', color: 'blue' },
          { icon: Users, label: 'Team', path: '/team', color: 'purple' },
          { icon: Package, label: 'Inventory', path: '/inventory', color: 'amber' },
          { icon: BarChart3, label: 'Reports', path: '/reports', color: 'cyan' },
          { icon: BrainCircuit, label: 'AI Agent', path: '/ai-agent', color: 'pink' },
        ].map((action, i) => (
          <Button
            key={i}
            variant="outline"
            className="h-auto flex-col gap-2 py-4 bg-white/50 dark:bg-white/[0.02] border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-teal-50 dark:hover:bg-teal-500/5 hover:border-teal-200 dark:hover:border-teal-500/20 hover:text-teal-700 dark:hover:text-teal-400 transition-all font-medium"
            onClick={() => navigate(action.path)}
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center border border-gray-100 dark:border-transparent">
              <action.icon size={18} />
            </div>
            <span className="text-[11px]">{action.label}</span>
          </Button>
        ))}
      </div>

      {/* ─── Recent Bookings / Orders ────────────────────────────── */}
      {(bookings.length > 0 || activeOrders.length > 0) && (
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base text-gray-900 dark:text-white">
                {businessMode === 'salon' ? 'Recent Bookings' : 'Recent Orders'}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate(businessMode === 'salon' ? '/bookings' : '/orders')} className="text-xs text-muted-foreground hover:text-foreground">
                View All <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100 dark:divide-white/5">
              {(businessMode === 'salon' ? bookings : activeOrders).slice(0, 5).map((item) => {
                const isSalon = businessMode === 'salon';
                const service = isSalon ? services.find(s => s.id === item.service_id) : null;
                const outlet = isSalon ? outlets.find(o => o.id === item.outlet_id) : null;
                return (
                  <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer group" onClick={() => navigate(isSalon ? '/bookings' : '/orders')}>
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-10 rounded-full ${
                        item.status === 'Completed' ? 'bg-green-500' :
                        item.status === 'In Progress' || item.status === 'Preparing' ? 'bg-blue-500' :
                        item.status === 'Cancelled' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <div>
                        <div className="font-medium text-sm text-gray-900 dark:text-white">
                          {isSalon ? item.customer : (item.order_number || item.customer_name)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isSalon
                            ? `${service?.name || 'Service'} • ${outlet?.name || 'Outlet'}`
                            : `${item.items?.length || 0} items • ${item.order_type || 'Dine-in'}`
                          }
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">
                        ₹{(isSalon ? item.amount : parseFloat(item.total_amount || 0))?.toLocaleString()}
                      </div>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                );
              })}
              {(businessMode === 'salon' ? bookings : activeOrders).length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No recent {businessMode === 'salon' ? 'bookings' : 'orders'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Customize Dialog ────────────────────────────────────── */}
      <Dialog open={customizing} onOpenChange={setCustomizing}>
        <DialogContent className="sm:max-w-md glass-panel border-gray-200 dark:border-[#1F2630]">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Customize Dashboard</DialogTitle>
            <DialogDescription className="text-muted-foreground">Toggle widgets to show or hide them from your dashboard.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4 max-h-[60vh] overflow-y-auto">
            {tempWidgets.map(widget => (
              <div key={widget.id} className="flex items-center justify-between space-x-2 border border-gray-200 dark:border-[#1F2630] p-3 rounded-lg bg-gray-50/50 dark:bg-white/[0.02]">
                <Label htmlFor={widget.id} className="flex flex-col space-y-1 cursor-pointer text-gray-900 dark:text-white">
                  <span>{widget.title}</span>
                  <span className="font-normal text-xs text-muted-foreground">{widget.type === 'stat' ? 'Stat Card' : widget.type === 'chart' ? 'Chart' : 'Card'}</span>
                </Label>
                <Switch id={widget.id} checked={!widget.hidden} onCheckedChange={() => toggleWidget(widget.id)} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomizing(false)} className="border-gray-200 dark:border-[#1F2630]">Cancel</Button>
            <Button onClick={handleSaveConfig} className="bg-teal-600 hover:bg-teal-700 text-white border-0">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── KPI Card Component ──────────────────────────────────────────
const colorStyles = {
  teal:   { gradient: 'from-teal-500 to-cyan-600',   light: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',   border: 'border-teal-500/20' },
  blue:   { gradient: 'from-blue-500 to-indigo-600', light: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',   border: 'border-blue-500/20' },
  purple: { gradient: 'from-purple-500 to-pink-600', light: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
  red:    { gradient: 'from-red-500 to-rose-600',    light: 'bg-red-500/10 text-red-600 dark:text-red-400',     border: 'border-red-500/20' },
  amber:  { gradient: 'from-amber-500 to-orange-600', light: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
  cyan:   { gradient: 'from-cyan-500 to-blue-600',   light: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',   border: 'border-cyan-500/20' },
  pink:   { gradient: 'from-pink-500 to-rose-600',   light: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',   border: 'border-pink-500/20' },
};

const KPICard = ({ title, value, subtitle, trend, trendInvert, icon: Icon, color, onClick }) => {
  const style = colorStyles[color] || colorStyles.teal;
  const trendIsGood = trendInvert ? trend < 0 : trend > 0;

  return (
    <Card
      className={`relative cursor-pointer group transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border ${style.border} bg-white/50 dark:bg-white/[0.02] overflow-hidden`}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-2">
        {/* Icon + Trend */}
        <div className="flex items-center justify-between">
          <div className={`w-8 h-8 rounded-lg ${style.light} flex items-center justify-center`}>
            <Icon size={16} />
          </div>
          {trend !== null && trend !== undefined && (
            <span className={`flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              trendIsGood
                ? 'text-green-600 dark:text-green-400 bg-green-500/10'
                : 'text-red-500 dark:text-red-400 bg-red-500/10'
            }`}>
              {trendIsGood ? <ArrowUpRight size={10} className="mr-0.5" /> : <ArrowDownRight size={10} className="mr-0.5" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>

        {/* Value */}
        <div>
          <div className="text-xl font-bold text-gray-900 dark:text-white tracking-tight truncate">
            {value}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">{title}</div>
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div className="text-[10px] text-muted-foreground/70 truncate">{subtitle}</div>
        )}
      </CardContent>

      {/* Hover glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-0 group-hover:opacity-[0.03] transition-opacity pointer-events-none`} />
    </Card>
  );
};

export default Dashboard;
