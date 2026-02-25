import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useAssistant } from '../contexts/AssistantContext';
import {
  Store, Calendar, DollarSign, Star, TrendingUp,
  Clock, Users, Wrench, ChevronRight, ArrowUpRight, ArrowDownRight,
  Wallet, CreditCard, BarChart3, Activity, Settings, LayoutDashboard, Package
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Cell } from 'recharts';

// Shadcn Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '../components/ui/chart';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import PendingAIWidget from '../components/hitl/PendingAIWidget';

const Dashboard = () => {
  const [reports, setReports] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [services, setServices] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customizing, setCustomizing] = useState(false);
  const [tempWidgets, setTempWidgets] = useState([]);
  const navigate = useNavigate();
  const { openAssistant, isOpen } = useAssistant();
  const hasAutoOpened = useRef(false);

  useEffect(() => { fetchData(); }, []);

  // Auto-open Assistant for new users (no outlets)
  useEffect(() => {
    if (!loading && outlets.length === 0 && !isOpen && !hasAutoOpened.current) {
      const timer = setTimeout(() => {
        openAssistant('onboarding');
        hasAutoOpened.current = true;
      }, 1500); // 1.5s delay for smooth entrance
      return () => clearTimeout(timer);
    }
  }, [loading, outlets, isOpen, openAssistant]);

  const fetchData = async () => {
    try {
      const [reportsRes, bookingsRes, outletsRes, servicesRes, transactionsRes, feedbackRes, configRes] = await Promise.all([
        api.getReports(), api.getBookings(), api.getOutlets(), api.getServices(), api.getTransactions(),
        api.getFeedbackStats().catch(() => ({ data: null })),
        api.getDashboardConfigs().catch(() => ({ data: [] }))
      ]);
      setReports(reportsRes.data); setBookings(bookingsRes.data); setOutlets(outletsRes.data);
      setServices(servicesRes.data); setTransactions(transactionsRes.data); setFeedbackStats(feedbackRes.data);

      if (configRes.data && configRes.data.length > 0) {
        setConfig(configRes.data[0]);
      }
    } catch (error) { console.error('Failed to fetch:', error); }
    finally { setLoading(false); }
  };

  const handleSaveConfig = async () => {
    if (!config || !config.id) return;
    try {
      const updatedConfig = { ...config, widgets: tempWidgets };
      await api.updateDashboardConfig(config.id, updatedConfig);
      setConfig(updatedConfig);
      setCustomizing(false);
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const toggleWidget = (widgetId) => {
    setTempWidgets(prev => {
      // If widget exists, remove it (toggle off) - Wait, we want to hiding/showing, 
      // but the backend list defines what is SHOWN. 
      // If we remove it from the list, it's hidden.
      // But we need to know it EXISTS to show it in the list to toggle back on.
      // Actually the backend `DEFAULT_WIDGETS` contains ALL available widgets.
      // The user config should ideally contain the state of all widgets (visible/hidden)
      // OR we just assume if it's in the list it's visible.
      // But if we remove it from the list, we lose the metadata (title, type) to render the toggle switch.
      // Better approach: Add a `hidden` property to the widget config in the JSON.

      // Let's assume the local `tempWidgets` state mirrors the `config.widgets` list.
      // We will toggle a `hidden` property.
      return prev.map(w => w.id === widgetId ? { ...w, hidden: !w.hidden } : w);
    });
  };

  const openCustomization = () => {
    // Ensure all widgets from default are present (in case of schema updates) or just use current config
    // For now use current config widgets
    setTempWidgets(JSON.parse(JSON.stringify(config?.widgets || [])));
    setCustomizing(true);
  };

  const isVisible = (subtypeOrTitle) => {
    if (!config) return true; // Default to visible if no config loaded yet
    const widget = config.widgets.find(w => w.subtype === subtypeOrTitle || w.title === subtypeOrTitle);
    return widget && !widget.hidden;
  };

  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 7);
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);

  const thisWeekBookings = bookings.filter(b => new Date(b.date) >= weekStart);
  const lastWeekBookings = bookings.filter(b => { const d = new Date(b.date); return d >= lastWeekStart && d < weekStart; });
  const thisWeekRevenue = thisWeekBookings.reduce((sum, b) => sum + (b.amount || 0), 0);
  const lastWeekRevenue = lastWeekBookings.reduce((sum, b) => sum + (b.amount || 0), 0);

  const bookingGrowth = lastWeekBookings.length > 0 ? Math.round(((thisWeekBookings.length - lastWeekBookings.length) / lastWeekBookings.length) * 100) : thisWeekBookings.length > 0 ? 100 : 0;
  const revenueGrowth = lastWeekRevenue > 0 ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100) : thisWeekRevenue > 0 ? 100 : 0;

  // Booking Trend Data
  const bookingTrendData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today); date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayBookings = bookings.filter(b => b.date && b.date.startsWith(dateStr));
    bookingTrendData.push({ date: date.toLocaleDateString('en-US', { weekday: 'short' }), bookings: dayBookings.length, revenue: dayBookings.reduce((sum, b) => sum + (b.amount || 0), 0) });
  }

  // Payment Data
  const heldPayments = transactions.filter(t => t.status === 'Held').reduce((sum, t) => sum + (t.gross || t.total_amount || 0), 0);
  const settledPayments = transactions.filter(t => t.status === 'Settled').reduce((sum, t) => sum + (t.gross || t.total_amount || 0), 0);
  const totalPayments = heldPayments + settledPayments;

  const paymentTrendData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today); date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayTxns = transactions.filter(t => t.date && t.date.startsWith(dateStr));
    paymentTrendData.push({
      date: date.toLocaleDateString('en-US', { weekday: 'short' }),
      total: dayTxns.reduce((sum, t) => sum + (t.gross || t.total_amount || 0), 0),
      settled: dayTxns.filter(t => t.status === 'Settled').reduce((sum, t) => sum + (t.gross || t.total_amount || 0), 0),
      held: dayTxns.filter(t => t.status === 'Held').reduce((sum, t) => sum + (t.gross || t.total_amount || 0), 0)
    });
  }

  const revenueByOutlet = outlets.map(o => ({ name: o.name.length > 12 ? o.name.substring(0, 12) + '...' : o.name, revenue: bookings.filter(b => b.outlet_id === o.id).reduce((sum, b) => sum + (b.amount || 0), 0) }))
    .filter(o => o.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Chart Configs
  const bookingChartConfig = { bookings: { label: "Bookings", color: "hsl(var(--chart-1))" } };
  const revenueChartConfig = { revenue: { label: "Revenue", color: "hsl(var(--chart-2))" } };
  const paymentChartConfig = { total: { label: "Total", color: "hsl(var(--chart-1))" }, settled: { label: "Settled", color: "hsl(var(--chart-2))" }, held: { label: "Held", color: "hsl(var(--chart-3))" } };
  const outletChartConfig = revenueByOutlet.reduce((acc, o, i) => { acc[o.name] = { label: o.name, color: `hsl(var(--chart-${(i % 5) + 1}))` }; return acc; }, { revenue: { label: "Revenue" } });

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6" data-testid="dashboard">
      <div className="flex justify-between items-center glass-panel p-6 rounded-2xl glass-panel-hover transition-all">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#E6E8EB] text-gradient-pro">Dashboard</h2>
          <p className="text-gray-500 dark:text-[#9CA3AF]">Overview of your car wash business</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await api.analyzeSchedule();
                // We should ideally reload the pending widgets here, though it might auto-refresh via sockets or manual refresh 
                window.location.reload();
              } catch (err) {
                console.error(err);
              }
            }}
            className="gap-2 bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/50 hover:text-blue-900 dark:hover:text-blue-300 backdrop-blur-md"
            title="Run Schedule Analysis"
          >
            <Activity size={16} />
            Analyze Schedule
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await api.analyzeInventory();
                window.location.reload();
              } catch (err) {
                console.error(err);
              }
            }}
            className="gap-2 bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-900 dark:hover:text-amber-300 backdrop-blur-md hidden md:flex"
            title="Run Inventory Analysis"
          >
            <Package size={16} />
            Analyze Inventory
          </Button>
          <Button variant="outline" size="sm" onClick={openCustomization} className="gap-2 bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-[#E6E8EB] hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-purple-900 dark:hover:text-purple-400 backdrop-blur-md">
            <LayoutDashboard size={16} />
            Customize
          </Button>
        </div>
      </div>

      <PendingAIWidget />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {isVisible("Total Bookings") && <StatCard title="Total Bookings" value={bookings.length} growth={bookingGrowth} icon={Calendar} color="blue" onClick={() => navigate('/bookings')} />}
        {isVisible("Total Revenue") && <StatCard title="Total Revenue" value={`₹${(reports?.totalRevenue || 0).toLocaleString()}`} growth={revenueGrowth} icon={DollarSign} color="green" onClick={() => navigate('/finance')} />}
        {isVisible("Active Outlets") && <StatCard title="Active Outlets" value={outlets.filter(o => o.status === 'Active').length} icon={Store} color="purple" onClick={() => navigate('/admin')} />}
        {isVisible("Avg Rating") && <StatCard title="Avg Rating" value={feedbackStats?.average_rating?.toFixed(1) || '—'} suffix="/5" icon={Star} color="amber" onClick={() => navigate('/reports')} />}
        {isVisible("Weekly Bookings") && <StatCard title="Weekly Bookings" value={thisWeekBookings.length} growth={bookingGrowth} icon={TrendingUp} color="cyan" />}
        {isVisible("Customers") && <StatCard title="Customers" value={new Set(bookings.map(b => b.customer)).size} icon={Users} color="pink" />}
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isVisible('bookingTrend') && (
          <Card className="lg:col-span-2 glass-panel glass-panel-hover border-0">
            <CardHeader className="pb-2"><div className="flex items-center gap-3"><Activity className="h-5 w-5 text-purple-600 dark:text-purple-400" /><div><CardTitle className="text-base text-gray-900 dark:text-[#E6E8EB]">Booking Trend</CardTitle><CardDescription className="text-gray-500 dark:text-[#9CA3AF]">Last 7 days</CardDescription></div></div></CardHeader>
            <CardContent>
              <ChartContainer config={bookingChartConfig} className="h-[250px] w-full">
                <AreaChart data={bookingTrendData} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke="var(--rs-border)" strokeOpacity={0.1} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: 'var(--rs-text-secondary)' }} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: 'var(--rs-text-secondary)' }} />
                  <ChartTooltip content={<ChartTooltipContent className="bg-white dark:bg-[#12161C] border-gray-200 dark:border-[#1F2630] text-gray-900 dark:text-[#E6E8EB]" />} />
                  <defs><linearGradient id="fillBookings" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} /><stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} /></linearGradient></defs>
                  <Area dataKey="bookings" type="natural" fill="url(#fillBookings)" stroke="hsl(var(--chart-1))" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {isVisible('totalCollected') && (
            <Card className="glass-panel glass-panel-hover border-0">
              <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardDescription className="text-gray-500 dark:text-[#9CA3AF]">Total Collected</CardDescription><CreditCard className="h-4 w-4 text-purple-600 dark:text-purple-400" /></div></CardHeader>
              <CardContent><div className="text-2xl font-bold text-gray-900 dark:text-[#E6E8EB]">₹{totalPayments.toLocaleString()}</div><Progress value={totalPayments > 0 ? (settledPayments / totalPayments) * 100 : 0} className="mt-3 h-2 bg-gray-200 dark:bg-white/10" indicatorClassName="bg-gradient-to-r from-purple-500 to-pink-500" /><div className="flex justify-between text-xs mt-2"><span className="text-green-600 dark:text-green-400">Settled: ₹{settledPayments.toLocaleString()}</span><span className="text-amber-600 dark:text-amber-400">Held: ₹{heldPayments.toLocaleString()}</span></div></CardContent>
            </Card>
          )}
          {isVisible('customerRating') && (
            <Card className="glass-panel border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 hover:border-amber-500/40 transition-all">
              <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardDescription className="text-amber-700/80 dark:text-amber-200/80">Customer Rating</CardDescription><Star className="h-4 w-4 text-amber-500 dark:text-amber-400 fill-amber-500 dark:fill-amber-400" /></div></CardHeader>
              <CardContent><div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-gray-900 dark:text-[#E6E8EB]">{feedbackStats?.average_rating?.toFixed(1) || '—'}</span><span className="text-gray-500 dark:text-muted-foreground">/5</span></div><div className="flex gap-1 mt-2">{[1, 2, 3, 4, 5].map(s => <Star key={s} size={16} className={s <= Math.round(feedbackStats?.average_rating || 0) ? 'text-amber-500 dark:text-amber-400 fill-amber-500 dark:fill-amber-400' : 'text-amber-900/20 dark:text-amber-900/40'} />)}</div><p className="text-xs text-gray-500 dark:text-muted-foreground mt-2">{feedbackStats?.total_responses || 0} reviews</p></CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isVisible('paymentTrend') && (
          <Card className="glass-panel glass-panel-hover border-0">
            <CardHeader className="pb-2"><div className="flex items-center gap-3"><Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" /><div><CardTitle className="text-base text-gray-900 dark:text-[#E6E8EB]">Payments Overview</CardTitle><CardDescription className="text-gray-500 dark:text-[#9CA3AF]">Held vs Settled</CardDescription></div></div></CardHeader>
            <CardContent>
              <ChartContainer config={paymentChartConfig} className="h-[250px] w-full">
                <LineChart data={paymentTrendData} accessibilityLayer>
                  <CartesianGrid vertical={false} stroke="var(--rs-border)" strokeOpacity={0.1} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: 'var(--rs-text-secondary)' }} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fill: 'var(--rs-text-secondary)' }} />
                  <ChartTooltip content={<ChartTooltipContent className="bg-white dark:bg-[#12161C] border-gray-200 dark:border-[#1F2630] text-gray-900 dark:text-[#E6E8EB]" />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line dataKey="total" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line dataKey="settled" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  <Line dataKey="held" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}

        {isVisible('revenueByOutlet') && (
          <Card className="glass-panel glass-panel-hover border-0">
            <CardHeader className="pb-2"><div className="flex items-center gap-3"><Store className="h-5 w-5 text-purple-600 dark:text-purple-400" /><div><CardTitle className="text-base text-gray-900 dark:text-[#E6E8EB]">Revenue by Outlet</CardTitle><CardDescription className="text-gray-500 dark:text-[#9CA3AF]">Top locations</CardDescription></div></div></CardHeader>
            <CardContent>
              {revenueByOutlet.length > 0 ? (
                <ChartContainer config={outletChartConfig} className="h-[250px] w-full">
                  <BarChart data={revenueByOutlet} layout="vertical" accessibilityLayer>
                    <CartesianGrid horizontal={false} stroke="var(--rs-border)" strokeOpacity={0.1} />
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={90} tick={{ fill: 'var(--rs-text-secondary)' }} />
                    <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fill: 'var(--rs-text-secondary)' }} />
                    <ChartTooltip content={<ChartTooltipContent className="bg-white dark:bg-[#12161C] border-gray-200 dark:border-[#1F2630] text-gray-900 dark:text-[#E6E8EB]" />} />
                    <Bar dataKey="revenue" radius={4}>{revenueByOutlet.map((_, i) => <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />)}</Bar>
                  </BarChart>
                </ChartContainer>
              ) : <div className="flex flex-col items-center justify-center h-[200px]"><Store className="h-10 w-10 text-muted-foreground/30" /><p className="text-sm text-muted-foreground mt-2">No data</p></div>}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 3 - Revenue Trend */}
      {isVisible('revenueTrend') && (
        <Card className="glass-panel glass-panel-hover border-0">
          <CardHeader className="pb-2"><div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" /><div><CardTitle className="text-base text-gray-900 dark:text-[#E6E8EB]">Revenue Trend</CardTitle><CardDescription className="text-gray-500 dark:text-[#9CA3AF]">Last 7 days</CardDescription></div></div></CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[250px] w-full">
              <AreaChart data={bookingTrendData} accessibilityLayer>
                <CartesianGrid vertical={false} stroke="var(--rs-border)" strokeOpacity={0.1} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: 'var(--rs-text-secondary)' }} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fill: 'var(--rs-text-secondary)' }} />
                <ChartTooltip content={<ChartTooltipContent className="bg-white dark:bg-[#12161C] border-gray-200 dark:border-[#1F2630] text-gray-900 dark:text-[#E6E8EB]" />} />
                <defs><linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} /><stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} /></linearGradient></defs>
                <Area dataKey="revenue" type="natural" fill="url(#fillRevenue)" stroke="hsl(var(--chart-2))" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions & Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isVisible('quickActions') && (
          <Card className="glass-panel glass-panel-hover border-0">
            <CardHeader className="pb-4"><CardTitle className="text-base text-gray-900 dark:text-[#E6E8EB]">Quick Actions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[{ icon: Calendar, label: "New Booking", path: "/bookings" }, { icon: Clock, label: "Slot Manager", path: "/slots" }, { icon: Wrench, label: "Services", path: "/admin" }, { icon: BarChart3, label: "Reports", path: "/reports" }].map(a => (
                  <Button key={a.label} variant="outline" className="h-auto flex-col gap-2 py-4 bg-white/50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#E6E8EB] hover:bg-purple-50 dark:hover:bg-purple-500/10 hover:border-purple-200 dark:hover:border-purple-500/30 hover:text-purple-600 dark:hover:text-purple-400 transition-all font-medium" onClick={() => navigate(a.path)}>
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-white dark:from-white/10 dark:to-white/5 flex items-center justify-center border border-gray-100 dark:border-transparent"><a.icon size={20} className="text-gray-700 dark:text-[#E6E8EB]" /></div>
                    <span className="text-xs">{a.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isVisible('recentBookings') && (
          <Card className="lg:col-span-2 glass-panel glass-panel-hover border-0">
            <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base text-gray-900 dark:text-[#E6E8EB]">Recent Bookings</CardTitle><Button variant="ghost" size="sm" onClick={() => navigate('/bookings')} className="text-gray-500 dark:text-[#9CA3AF] hover:text-gray-900 dark:hover:text-[#E6E8EB] hover:bg-black/5 dark:hover:bg-white/5">View All <ChevronRight size={14} className="ml-1" /></Button></div></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-200 dark:divide-[#1F2630]">
                {bookings.slice(0, 4).map(b => {
                  const service = services.find(s => s.id === b.service_id);
                  const outlet = outlets.find(o => o.id === b.outlet_id);
                  return (
                    <div key={b.id} className="flex items-center justify-between p-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group" onClick={() => navigate('/bookings')}>
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-10 rounded-full transition-all group-hover:scale-y-110 ${b.status === 'Completed' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : b.status === 'In Progress' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : b.status === 'Cancelled' ? 'bg-red-500' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'}`} />
                        <Avatar className="h-9 w-9 border border-black/5 dark:border-white/10"><AvatarFallback className="text-xs bg-gray-100 dark:bg-[#1F2630] text-gray-900 dark:text-[#E6E8EB]">{b.customer?.charAt(0)?.toUpperCase() || '?'}</AvatarFallback></Avatar>
                        <div><div className="font-medium text-sm text-gray-900 dark:text-[#E6E8EB]">{b.customer}</div><div className="text-xs text-gray-500 dark:text-[#9CA3AF]">{service?.name || 'Service'} • {outlet?.name || 'Outlet'}</div></div>
                      </div>
                      <div className="text-right"><div className="font-semibold text-sm text-gray-900 dark:text-[#E6E8EB]">₹{b.amount?.toLocaleString()}</div><div className="text-xs text-gray-500 dark:text-[#9CA3AF]">{b.date ? new Date(b.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}</div></div>
                    </div>
                  );
                })}
                {bookings.length === 0 && <div className="p-8 text-center"><Calendar className="mx-auto h-8 w-8 text-muted-foreground/30" /><p className="text-sm text-muted-foreground mt-2">No bookings yet</p></div>}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={customizing} onOpenChange={setCustomizing}>
        <DialogContent className="sm:max-w-md glass-panel border-[#1F2630] text-[#E6E8EB]">
          <DialogHeader>
            <DialogTitle>Customize Dashboard</DialogTitle>
            <DialogDescription className="text-[#9CA3AF]">Toggle widgets to show or hide them from your dashboard.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {tempWidgets.map(widget => (
              <div key={widget.id} className="flex items-center justify-between space-x-2 border border-[#1F2630] p-3 rounded-lg bg-[#12161C]/50">
                <Label htmlFor={widget.id} className="flex flex-col space-y-1 cursor-pointer">
                  <span>{widget.title}</span>
                  <span className="font-normal text-xs text-[#9CA3AF]">{widget.type === 'stat' ? 'Stat Card' : widget.type === 'chart' ? 'Chart' : 'Card'}</span>
                </Label>
                <Switch id={widget.id} checked={!widget.hidden} onCheckedChange={() => toggleWidget(widget.id)} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomizing(false)} className="border-[#1F2630] text-[#E6E8EB] hover:bg-white/5">Cancel</Button>
            <Button onClick={handleSaveConfig} className="bg-purple-600 hover:bg-purple-700 text-white border-0 shadow-[0_0_15px_rgba(147,51,234,0.3)]">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const StatCard = ({ title, value, growth, suffix, icon: Icon, color, onClick }) => {
  const colors = { blue: 'from-blue-500 to-indigo-600', green: 'from-green-500 to-emerald-600', purple: 'from-purple-500 to-pink-600', amber: 'from-amber-500 to-orange-600', cyan: 'from-cyan-500 to-blue-600', pink: 'from-pink-500 to-rose-600' };
  return (
    <Card className="relative cursor-pointer hover:scale-[1.02] transition-all border-0 shadow-lg overflow-hidden" onClick={onClick}>
      <div className={`absolute inset-0 bg-gradient-to-br ${colors[color]}`} />
      <CardContent className="relative z-10 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0"><Icon size={16} className="text-white" /></div>
          {growth !== undefined && <Badge variant="secondary" className={`bg-white/20 border-0 text-white text-[10px] px-1.5 flex-shrink-0`}>{growth >= 0 ? <ArrowUpRight size={10} className="mr-0.5" /> : <ArrowDownRight size={10} className="mr-0.5" />}{Math.abs(growth)}%</Badge>}
        </div>
        <CardDescription className="text-white/70 text-xs truncate">{title}</CardDescription>
        <div className="text-xl font-bold text-white mt-0.5 truncate">{value}{suffix && <span className="text-sm font-normal text-white/70">{suffix}</span>}</div>
      </CardContent>
    </Card>
  );
};

export default Dashboard;
