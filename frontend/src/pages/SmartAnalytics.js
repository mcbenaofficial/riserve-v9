import React, { useState, useEffect } from 'react';
import {
  Sparkles, Calendar, ChevronDown, Download, Settings,
  BarChart2, TrendingUp, Users, Package, BrainCircuit,
  LayoutDashboard, MapPin, Scissors, Coffee, FileSpreadsheet, FileText
} from 'lucide-react';
import { useAnalytics } from '../contexts/AnalyticsContext';
import { api } from '../services/api';

// Shadcn
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

// Tab Components
import AnalyticsOverview from '../components/analytics/AnalyticsOverview';
import TrendsForecasting from '../components/analytics/TrendsForecasting';
import CustomerInsights from '../components/analytics/CustomerInsights';
import OperationsAnalytics from '../components/analytics/OperationsAnalytics';
import InventoryAnalytics from '../components/analytics/InventoryAnalytics';
import AIInsightsHub from '../components/analytics/AIInsightsHub';

// Mock Data
import {
  demandHeatmapData, forecastData, comparisonData, noShowTrend,
  customerSegments, operationsData, inventoryAnalyticsData,
  aiInsightsData, aiNarratives
} from '../data/analyticsMockData';

// ─── Tab Configuration ──────────────────────────────────────────────
const TABS = [
  { id: 'overview',    label: 'Overview',             icon: LayoutDashboard },
  { id: 'trends',      label: 'Trends & Forecasting', icon: TrendingUp },
  { id: 'customers',   label: 'Customer Insights',    icon: Users },
  { id: 'operations',  label: 'Operations',           icon: BarChart2 },
  { id: 'inventory',   label: 'Inventory',            icon: Package },
  { id: 'ai',          label: 'AI Insights',          icon: BrainCircuit },
];

// ─── Date Presets ───────────────────────────────────────────────────
const DATE_PRESETS = [
  { value: 'today',   label: 'Today' },
  { value: '7days',   label: 'This Week' },
  { value: '30days',  label: 'This Month' },
  { value: '90days',  label: 'Last 90 Days' },
  { value: 'yoy',     label: 'Year over Year' },
  { value: 'custom',  label: 'Custom Range' },
];

// ─── Main Component ─────────────────────────────────────────────────
const SmartAnalytics = () => {
  const {
    dynamicWidgets, removeWidget, updateWidgetType,
    getMonthlyTrends, getOutletPerformance, getServiceBreakdown,
    filterBookings, analyticsData
  } = useAnalytics();

  // State
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30days');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [businessMode, setBusinessMode] = useState(() => {
    try { return localStorage.getItem('ridn_business_mode') || 'salon'; } catch { return 'salon'; }
  });
  const [location, setLocation] = useState('all');
  const [locDropdownOpen, setLocDropdownOpen] = useState(false);
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [outlets, setOutlets] = useState([]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [feedbackRes, outletsRes] = await Promise.all([
          api.getFeedbackStats().catch(() => ({ data: null })),
          api.getOutlets().catch(() => ({ data: [] })),
        ]);
        setFeedbackStats(feedbackRes.data);
        setOutlets(outletsRes.data || []);
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    try { localStorage.setItem('ridn_business_mode', businessMode); } catch {}
  }, [businessMode]);

  // Derived from AnalyticsContext
  const filteredBookings = filterBookings(dateRange === 'yoy' ? 'year' : dateRange, customStart, customEnd);
  const totalRevenue = filteredBookings.reduce((sum, b) => sum + parseFloat(b.total_price || b.amount || 0), 0);
  const totalBookings = filteredBookings.length;
  const avgTicket = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

  const activeDateLabel = DATE_PRESETS.find(p => p.value === dateRange)?.label || 'Last 30 Days';
  const mode = businessMode;
  const narratives = aiNarratives[mode];

  // ── KPIs (real + mock) ────────────────────────────────────────────
  const kpis = {
    totalRevenue: totalRevenue || (mode === 'salon' ? 169550 : 253300),
    revenueTrend: 12.5,
    revenueSubtitle: activeDateLabel,
    totalBookings: totalBookings || (mode === 'salon' ? 196 : 857),
    bookingsTrend: 5.2,
    avgTicket: avgTicket || (mode === 'salon' ? 887 : 248),
    avgTicketTrend: 3.1,
    noShowRate: 4.2,
    noShowTrend: -1.1,
    csatScore: feedbackStats?.average_rating?.toFixed(1) || 4.7,
    csatTrend: 0.2,
    repeatRate: 62,
    repeatTrend: 3.8,
  };

  // ── Export Stub ───────────────────────────────────────────────────
  const handleExport = (format) => {
    alert(`Export as ${format.toUpperCase()} – Coming soon!\nThis will export the current view's data.`);
  };

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6" data-testid="analytics-loading">
        <div className="h-16 rounded-2xl bg-gray-100 dark:bg-white/5 animate-pulse" />
        <div className="h-12 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
          <div className="h-72 rounded-xl bg-gray-100 dark:bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="smart-analytics" onClick={() => { setDateDropdownOpen(false); setLocDropdownOpen(false); }}>
      {/* ─── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 glass-panel p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <Sparkles size={24} className="text-purple-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Smart Analytics</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">AI-driven insights & performance metrics</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range */}
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { setDateDropdownOpen(!dateDropdownOpen); setLocDropdownOpen(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-300 dark:hover:border-purple-500/30 transition-all"
            >
              <Calendar size={13} className="text-purple-500" />
              {activeDateLabel}
              <ChevronDown size={12} className={`transition-transform ${dateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dateDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#12161C] border border-gray-200 dark:border-[#1F2630] rounded-xl shadow-xl overflow-hidden min-w-[180px]">
                <div className="p-1.5">
                  {DATE_PRESETS.map(preset => (
                    <button
                      key={preset.value}
                      onClick={() => { setDateRange(preset.value); if (preset.value !== 'custom') setDateDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left ${
                        dateRange === preset.value
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                      }`}
                    >
                      {dateRange === preset.value && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />}
                      {preset.label}
                    </button>
                  ))}
                </div>
                {dateRange === 'custom' && (
                  <div className="border-t border-gray-100 dark:border-[#1F2630] p-3 space-y-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">From</label>
                      <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-[#1F2630] border border-gray-200 dark:border-[#374151] text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground mb-1 block">To</label>
                      <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg text-xs bg-gray-50 dark:bg-[#1F2630] border border-gray-200 dark:border-[#374151] text-gray-900 dark:text-white"
                      />
                    </div>
                    <button onClick={() => setDateDropdownOpen(false)} disabled={!customStart || !customEnd}
                      className="w-full py-1.5 rounded-lg font-semibold text-xs text-white bg-purple-600 disabled:opacity-40 hover:bg-purple-700 transition-all"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Location Selector */}
          {outlets.length > 1 && (
            <div className="relative" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { setLocDropdownOpen(!locDropdownOpen); setDateDropdownOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-teal-300 dark:hover:border-teal-500/30 transition-all"
              >
                <MapPin size={13} className="text-teal-500" />
                {location === 'all' ? 'All Locations' : outlets.find(o => o.id === location)?.name || 'Location'}
                <ChevronDown size={12} />
              </button>
              {locDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-[#12161C] border border-gray-200 dark:border-[#1F2630] rounded-xl shadow-xl overflow-hidden min-w-[160px]">
                  <div className="p-1.5">
                    <button onClick={() => { setLocation('all'); setLocDropdownOpen(false); }}
                      className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left ${location === 'all' ? 'bg-teal-500/10 text-teal-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                    >All Locations</button>
                    {outlets.map(o => (
                      <button key={o.id} onClick={() => { setLocation(o.id); setLocDropdownOpen(false); }}
                        className={`w-full px-3 py-2 rounded-lg text-xs font-medium text-left ${location === o.id ? 'bg-teal-500/10 text-teal-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'}`}
                      >{o.name}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Business Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-lg p-0.5 border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setBusinessMode('salon')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                businessMode === 'salon' ? 'bg-white dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Scissors size={12} /> Salon
            </button>
            <button
              onClick={() => setBusinessMode('cafe')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                businessMode === 'cafe' ? 'bg-white dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Coffee size={12} /> Cafe
            </button>
          </div>

          {/* Export */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => handleExport('csv')} title="Export CSV">
              <FileSpreadsheet size={13} />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => handleExport('pdf')} title="Export PDF">
              <FileText size={13} />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Tab Bar ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-white/50 dark:bg-white/[0.02] border border-gray-200 dark:border-white/10 rounded-xl p-1 overflow-x-auto">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-white dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 shadow-sm border border-gray-200 dark:border-teal-500/20'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ─── Tab Content ───────────────────────────────────────────── */}
      <div key={`${activeTab}-${businessMode}`}>
        {activeTab === 'overview' && (
          <AnalyticsOverview
            businessMode={mode}
            comparisonData={comparisonData[mode]}
            noShowTrend={noShowTrend}
            kpis={kpis}
            narrative={narratives.overview}
          />
        )}

        {activeTab === 'trends' && (
          <TrendsForecasting
            businessMode={mode}
            heatmapData={demandHeatmapData[mode]}
            forecastData={forecastData[mode]}
            narrative={narratives.trends}
          />
        )}

        {activeTab === 'customers' && (
          <CustomerInsights
            segments={customerSegments}
            narrative={narratives.customers}
          />
        )}

        {activeTab === 'operations' && (
          <OperationsAnalytics
            businessMode={mode}
            opsData={operationsData[mode]}
            narrative={narratives.operations}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryAnalytics
            inventoryData={inventoryAnalyticsData}
            narrative={narratives.inventory}
          />
        )}

        {activeTab === 'ai' && (
          <AIInsightsHub
            aiData={aiInsightsData}
            narrative={narratives.ai}
          />
        )}
      </div>
    </div>
  );
};

export default SmartAnalytics;
