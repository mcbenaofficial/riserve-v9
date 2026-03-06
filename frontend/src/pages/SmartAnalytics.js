import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Settings, X, Trash2, BarChart2, TrendingUp, PieChart, Activity,
    LineChart as LineChartIcon, Calendar, DollarSign, Star, Users, ArrowUpRight,
    ArrowDownRight, Zap, ChevronDown
} from 'lucide-react';
import { useAnalytics, getDateBounds } from '../contexts/AnalyticsContext';
import { api } from '../services/api';
import { DynamicChart } from '../components/analytics/AnalyticsCharts';
import PendingAIRecommendations from '../components/hitl/PendingAIRecommendations';

// --- Widget Configuration ---
const DEFAULT_WIDGETS = [
    { id: 'trends', title: 'Revenue & Booking Trends', visible: true, chartType: 'area', colSpan: 'lg:col-span-8' },
    { id: 'demographics', title: 'Service Distribution', visible: true, chartType: 'radar', colSpan: 'lg:col-span-4' },
    { id: 'satisfaction', title: 'Customer Sentiment', visible: true, chartType: 'custom', colSpan: 'lg:col-span-6' },
    { id: 'distribution', title: 'Outlet Performance', visible: true, chartType: 'bar', colSpan: 'lg:col-span-6' },
];

const DATE_PRESETS = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
];

const CHART_TYPES = [
    { type: 'area', label: 'Area', icon: Activity },
    { type: 'line', label: 'Line', icon: LineChartIcon },
    { type: 'bar', label: 'Bar', icon: BarChart2 },
    { type: 'radar', label: 'Radar', icon: PieChart },
];

// --- Sub-components ---

// Zen mode icon tone map — matches the quiet luxury palette
const ZEN_METRIC_TONES = {
    'from-green-500 to-emerald-600': 'bg-[#8B9E7E]/15 text-[#8B9E7E] dark:text-[#A3B596] border-[#8B9E7E]/20',
    'from-blue-500 to-indigo-600': 'bg-[#8899A8]/15 text-[#8899A8] dark:text-[#98A9B8] border-[#8899A8]/20',
    'from-purple-500 to-pink-600': 'bg-[#C68A7A]/15 text-[#C68A7A] dark:text-[#D4A89A] border-[#C68A7A]/20',
    'from-amber-500 to-orange-600': 'bg-[#B89860]/15 text-[#B89860] dark:text-[#C8A870] border-[#B89860]/20',
};

const MetricCard = ({ title, value, icon: Icon, color, subtitle, trend }) => {
    const isZen = typeof document !== 'undefined' && document.documentElement.classList.contains('zen');
    const zenTone = ZEN_METRIC_TONES[color] || 'bg-[#C68A7A]/15 text-[#C68A7A] dark:text-[#D4A89A] border-[#C68A7A]/20';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-3xl p-6 glass-panel border-0 group transition-all duration-300 hover:scale-[1.02]`}
        >
            {!isZen && <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-10 group-hover:opacity-20 transition-opacity`} />}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-gradient-to-br from-white/5 to-white/0 blur-2xl" />

            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <p className="text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-[#0E1116] dark:text-[#E6E8EB] tracking-tight">{value}</h3>

                    {subtitle && (
                        <div className="flex items-center gap-2 mt-2">
                            {trend && (
                                <span className={`flex items-center text-xs font-semibold ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {trend > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                    {Math.abs(trend)}%
                                </span>
                            )}
                            <span className="text-xs text-[#6B7280] dark:text-[#7D8590]">{subtitle}</span>
                        </div>
                    )}
                </div>

                {isZen ? (
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${zenTone}`}>
                        <Icon size={20} />
                    </div>
                ) : (
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg shadow-${color.split('-')[1]}-500/20`}>
                        <Icon size={24} className="text-white" />
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const ChartTypeSelector = ({ currentType, onSelect, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-12 right-4 z-20 bg-white dark:bg-[#1F2630] border border-gray-200 dark:border-[#374151] rounded-xl p-2 shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] px-2 py-1 mb-1 uppercase tracking-wider">Chart Type</div>
            <div className="flex flex-col gap-1">
                {CHART_TYPES.map((chart) => (
                    <button
                        key={chart.type}
                        onClick={() => { onSelect(chart.type); onClose(); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${currentType === chart.type
                            ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                            : 'hover:bg-gray-100 dark:hover:bg-[#2A323E] text-[#4B5563] dark:text-[#E6E8EB]'
                            }`}
                    >
                        <chart.icon size={16} />
                        <span>{chart.label}</span>
                    </button>
                ))}
            </div>
        </motion.div>
    );
};

// --- Date Range Picker Dropdown ---
const DateRangePicker = ({ dateRange, customStart, customEnd, onChange, onCustomChange }) => {
    const [open, setOpen] = useState(false);
    const selectedLabel = DATE_PRESETS.find(p => p.value === dateRange)?.label || 'Last 30 Days';

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent text-[#0E1116] dark:text-[#E6E8EB] font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
                <Calendar size={15} className="text-purple-500 dark:text-purple-400 flex-shrink-0" />
                <span>{selectedLabel}</span>
                <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 z-50 bg-white dark:bg-[#12161C] border border-gray-200 dark:border-[#1F2630] rounded-2xl shadow-2xl overflow-hidden min-w-[220px]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-2">
                            {DATE_PRESETS.map(preset => (
                                <button
                                    key={preset.value}
                                    onClick={() => { onChange(preset.value); if (preset.value !== 'custom') setOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${dateRange === preset.value
                                        ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 dark:bg-purple-500/15'
                                        : 'text-[#4B5563] dark:text-[#E6E8EB] hover:bg-gray-50 dark:hover:bg-white/5'
                                        }`}
                                >
                                    {dateRange === preset.value && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />}
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Custom range inputs */}
                        {dateRange === 'custom' && (
                            <div className="border-t border-gray-100 dark:border-[#1F2630] p-3 space-y-2">
                                <div className="text-xs font-semibold text-[#6B7280] dark:text-[#7D8590] uppercase tracking-wider mb-2">Custom Range</div>
                                <div className="flex flex-col gap-2">
                                    <div>
                                        <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">From</label>
                                        <input
                                            type="date"
                                            value={customStart}
                                            onChange={e => onCustomChange('start', e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg text-sm bg-gray-50 dark:bg-[#1F2630] border border-gray-200 dark:border-[#374151] text-[#0E1116] dark:text-[#E6E8EB] focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">To</label>
                                        <input
                                            type="date"
                                            value={customEnd}
                                            onChange={e => onCustomChange('end', e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg text-sm bg-gray-50 dark:bg-[#1F2630] border border-gray-200 dark:border-[#374151] text-[#0E1116] dark:text-[#E6E8EB] focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setOpen(false)}
                                        disabled={!customStart || !customEnd}
                                        className="w-full mt-1 py-2 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-blue-600 disabled:opacity-40 hover:shadow-lg hover:shadow-purple-500/20 transition-all"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Main Component ---

const SmartAnalytics = () => {
    const {
        dynamicWidgets, removeWidget, updateWidgetType,
        getMonthlyTrends, getOutletPerformance, getServiceBreakdown,
        filterBookings, analyticsData
    } = useAnalytics();

    const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
    const [customizing, setCustomizing] = useState(false);
    const [tempWidgets, setTempWidgets] = useState([]);
    const [activeSelector, setActiveSelector] = useState(null);
    const [dateRange, setDateRange] = useState('30days');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Real Data State
    const [feedbackStats, setFeedbackStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Derived Data — all pass the current dateRange + custom bounds
    const trendData = getMonthlyTrends(dateRange, customStart, customEnd);
    const outletData = getOutletPerformance(dateRange, customStart, customEnd);
    const serviceData = getServiceBreakdown(dateRange, customStart, customEnd);

    // KPI totals derived from the filtered bookings
    const filteredBookings = filterBookings(dateRange, customStart, customEnd);
    const totalRevenue = filteredBookings.reduce((sum, b) => sum + parseFloat(b.total_price || b.amount || 0), 0);
    const totalBookings = filteredBookings.length;
    const avgRevenue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    const isVisible = (widgetId) => widgets.find(w => w.id === widgetId)?.visible ?? true;
    const getChartType = (widgetId) => widgets.find(w => w.id === widgetId)?.chartType ?? 'area';
    const getColSpan = (widgetId) => widgets.find(w => w.id === widgetId)?.colSpan ?? 'col-span-12';

    // Fetch Feedback Stats independently since it's not in context yet
    useEffect(() => {
        const fetchData = async () => {
            try {
                const feedbackRes = await api.getFeedbackStats().catch(() => ({ data: null }));
                setFeedbackStats(feedbackRes.data);
            } catch (error) {
                console.error('Failed to fetch analytics additions:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const openCustomization = () => {
        setTempWidgets(JSON.parse(JSON.stringify(widgets)));
        setCustomizing(true);
    };

    const toggleWidget = (widgetId) => {
        setTempWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, visible: !w.visible } : w));
    };

    const saveConfig = () => {
        setWidgets(tempWidgets);
        setCustomizing(false);
    };

    const changeChartType = (widgetId, newType) => {
        setWidgets(prev => prev.map(w => w.id === widgetId ? { ...w, chartType: newType } : w));
    };

    const handleDateChange = (newRange) => {
        setDateRange(newRange);
        if (newRange !== 'custom') {
            setCustomStart('');
            setCustomEnd('');
        }
    };

    const handleCustomDateChange = (field, value) => {
        if (field === 'start') setCustomStart(value);
        else setCustomEnd(value);
    };

    // Friendly label for the active range in the header
    const activeDateLabel = dateRange === 'custom' && customStart && customEnd
        ? `${customStart} → ${customEnd}`
        : DATE_PRESETS.find(p => p.value === dateRange)?.label || 'Last 30 Days';

    return (
        <div className="min-h-screen bg-[#F6F7F9] dark:bg-[#0B0D10] text-[#0E1116] dark:text-[#E6E8EB] font-sans" onClick={() => setActiveSelector(null)}>

            {/* --- Header Section --- */}
            <div className="px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 border border-purple-200 dark:border-purple-500/30">
                            <Sparkles size={32} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        Smart Analytics
                    </h1>
                    <p className="text-[#6B7280] dark:text-[#9CA3AF] mt-2 text-lg font-medium">
                        AI-driven insights &amp; performance metrics
                        {dynamicWidgets.length > 0 && (
                            <span className="ml-3 px-3 py-1 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-full text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
                                {dynamicWidgets.length} AI Widgets Active
                            </span>
                        )}
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-white dark:bg-[#12161C] p-1.5 rounded-2xl border border-gray-200 dark:border-[#1F2630] shadow-sm">
                    <DateRangePicker
                        dateRange={dateRange}
                        customStart={customStart}
                        customEnd={customEnd}
                        onChange={handleDateChange}
                        onCustomChange={handleCustomDateChange}
                    />
                    <div className="w-px h-6 bg-gray-200 dark:bg-[#1F2630]" />
                    <button
                        onClick={openCustomization}
                        className="p-2.5 rounded-xl text-[#6B7280] dark:text-[#9CA3AF] hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-all"
                        title="Customize Dashboard"
                    >
                        <Settings size={20} />
                    </button>
                </div>
            </div>

            <div className="px-8 pb-12 space-y-8">

                {/* --- KPI Cards --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <MetricCard
                        title="Total Revenue"
                        value={`₹${totalRevenue.toLocaleString()}`}
                        icon={DollarSign}
                        color="from-green-500 to-emerald-600"
                        subtitle={activeDateLabel}
                        trend={12}
                    />
                    <MetricCard
                        title="Total Bookings"
                        value={totalBookings}
                        icon={Calendar}
                        color="from-blue-500 to-indigo-600"
                        subtitle={activeDateLabel}
                        trend={5}
                    />
                    <MetricCard
                        title="Avg. Value"
                        value={`₹${avgRevenue.toFixed(0)}`}
                        icon={TrendingUp}
                        color="from-purple-500 to-pink-600"
                        subtitle="Per booking"
                        trend={-2.5}
                    />
                    <MetricCard
                        title="Satisfaction"
                        value={feedbackStats?.average_rating || "4.9"}
                        icon={Star}
                        color="from-amber-500 to-orange-600"
                        subtitle={`${feedbackStats?.total_responses || 24} reviews`}
                        trend={0.5}
                    />
                </div>

                {/* --- HITL Recommendations --- */}
                <div className="w-full">
                    <PendingAIRecommendations />
                </div>

                {/* --- Main Dashboard Grid --- */}
                <div className="grid grid-cols-12 gap-6 mt-8">

                    {/* 1. Dynamic AI Widgets */}
                    <AnimatePresence>
                        {dynamicWidgets.map((widget) => (
                            <motion.div
                                key={widget.id}
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.4, type: "spring" }}
                                className="col-span-12 lg:col-span-6 glass-panel p-6 rounded-3xl relative group overflow-hidden cursor-pointer border-0 shadow-lg shadow-purple-500/5 hover:shadow-purple-500/10"
                                onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === widget.id ? null : widget.id); }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                                            <Sparkles size={16} />
                                        </span>
                                        <div>
                                            <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">{widget.title}</h3>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">AI Generated Insight</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                                        <button className="p-1.5 rounded-md hover:bg-white dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-all">
                                            <BarChart2 size={16} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
                                            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 transition-all"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    <ChartTypeSelector
                                        currentType={widget.chartType || widget.type}
                                        onSelect={(type) => updateWidgetType(widget.id, type)}
                                        isOpen={activeSelector === widget.id}
                                        onClose={() => setActiveSelector(null)}
                                    />
                                </AnimatePresence>

                                <div className="h-[280px] w-full relative z-10">
                                    <DynamicChart
                                        type={widget.chartType || widget.type}
                                        dataKey={widget.dataKey}
                                        color={widget.color}
                                        data={trendData}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* 2. Revenue Trends (Area Chart) */}
                    <AnimatePresence>
                        {isVisible('trends') && (
                            <motion.div
                                key="trends"
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`${getColSpan('trends')} glass-panel p-6 rounded-3xl relative group min-h-[400px] border-0`}
                                onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'trends' ? null : 'trends'); }}
                            >
                                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl opacity-30 group-hover:bg-purple-500/10 group-hover:opacity-100 transition-all duration-500" />

                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                            <Activity size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Growth Trends</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Revenue vs Booking Volume · {activeDateLabel}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-bold border border-green-500/20">
                                            <Zap size={12} fill="currentColor" />
                                            Live
                                        </span>
                                        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-purple-500 transition-colors">
                                            <BarChart2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    <ChartTypeSelector
                                        currentType={getChartType('trends')}
                                        onSelect={(type) => changeChartType('trends', type)}
                                        isOpen={activeSelector === 'trends'}
                                        onClose={() => setActiveSelector(null)}
                                    />
                                </AnimatePresence>

                                <div className="h-[320px] w-full relative z-10">
                                    <DynamicChart type={getChartType('trends')} dataKey="revenue" color="#8b5cf6" data={trendData} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 3. Service Breakdown (Radar) */}
                    <AnimatePresence>
                        {isVisible('demographics') && (
                            <motion.div
                                key="demographics"
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`${getColSpan('demographics')} glass-panel p-6 rounded-3xl border-0`}
                                onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'demographics' ? null : 'demographics'); }}
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400">
                                            <PieChart size={20} />
                                        </div>
                                        <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Service Mix</h3>
                                    </div>
                                    <button className="text-gray-400 hover:text-pink-500"><Settings size={16} /></button>
                                </div>

                                <AnimatePresence>
                                    <ChartTypeSelector
                                        currentType={getChartType('demographics')}
                                        onSelect={(type) => changeChartType('demographics', type)}
                                        isOpen={activeSelector === 'demographics'}
                                        onClose={() => setActiveSelector(null)}
                                    />
                                </AnimatePresence>

                                <div className="h-[300px] w-full relative z-10">
                                    <DynamicChart type={getChartType('demographics')} dataKey="A" color="#ec4899" data={serviceData.length > 0 ? serviceData : undefined} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 4. Customer Sentiment (Custom UI) */}
                    <AnimatePresence>
                        {isVisible('satisfaction') && (
                            <motion.div
                                key="satisfaction"
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`${getColSpan('satisfaction')} glass-panel p-6 rounded-3xl border-0`}
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                        <Star size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Customer Sentiment</h3>
                                        <p className="text-xs text-gray-500">Based on recent feedback</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-[#12161C] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                                        <div className="text-4xl font-black text-[#0E1116] dark:text-[#E6E8EB] mb-1">{feedbackStats?.average_rating || 4.9}</div>
                                        <div className="flex gap-0.5 mb-2">
                                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} className="text-amber-400 fill-amber-400" />)}
                                        </div>
                                        <div className="text-xs text-gray-500">Average Rating</div>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-[#12161C] rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                                        <div className="text-4xl font-black text-green-500 mb-1">{feedbackStats?.satisfaction_score || 98}%</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 font-bold mb-2">Excellent</div>
                                        <div className="text-xs text-gray-500">Satisfaction Score</div>
                                    </div>
                                </div>

                                {/* Recent Feedback Ticker */}
                                <div className="mt-4 space-y-3">
                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Latest Reviews</div>
                                    {feedbackStats?.recent_feedback?.slice(0, 2).map((fb, i) => (
                                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-white/5 border border-gray-100 dark:border-[#1F2630]">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center text-white text-xs font-bold">
                                                {fb.customer_name?.[0] || 'C'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-bold text-[#0E1116] dark:text-[#E6E8EB]">{fb.customer_name || 'Customer'}</span>
                                                    <div className="flex gap-0.5">
                                                        {[...Array(fb.rating)].map((_, i) => <Star key={i} size={10} className="text-amber-400 fill-amber-400" />)}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">"{fb.comment}"</p>
                                            </div>
                                        </div>
                                    )) || (
                                            <div className="text-center py-4 text-sm text-gray-500 italic">No recent reviews</div>
                                        )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* 5. Outlet Performance */}
                    <AnimatePresence>
                        {isVisible('distribution') && (
                            <motion.div
                                key="distribution"
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`${getColSpan('distribution')} glass-panel p-6 rounded-3xl border-0`}
                                onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'distribution' ? null : 'distribution'); }}
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-[#0E1116] dark:text-[#E6E8EB]">Outlet Performance</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{activeDateLabel}</p>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    <ChartTypeSelector
                                        currentType={getChartType('distribution')}
                                        onSelect={(type) => changeChartType('distribution', type)}
                                        isOpen={activeSelector === 'distribution'}
                                        onClose={() => setActiveSelector(null)}
                                    />
                                </AnimatePresence>

                                <div className="h-[280px] w-full relative z-10">
                                    <DynamicChart type={getChartType('distribution')} dataKey="value" color="#06b6d4" data={outletData.length > 0 ? outletData : undefined} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>
            </div>

            {/* Customization Modal */}
            <AnimatePresence>
                {customizing && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-[#12161C] rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-[#374151]"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-[#0E1116] dark:text-[#E6E8EB]">Customize Dashboard</h2>
                                <button onClick={() => setCustomizing(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-[#1F2630] rounded-lg transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <div className="space-y-3 mb-8">
                                {tempWidgets.map((widget) => (
                                    <div key={widget.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-[#1F2630] border border-gray-100 dark:border-[#374151]">
                                        <span className="font-medium text-[#0E1116] dark:text-[#E6E8EB]">{widget.title}</span>
                                        <button
                                            onClick={() => toggleWidget(widget.id)}
                                            className={`w-12 h-6 rounded-full relative transition-colors ${widget.visible ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${widget.visible ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setCustomizing(false)} className="flex-1 py-3 rounded-xl font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-[#1F2630] transition-colors">
                                    Cancel
                                </button>
                                <button onClick={saveConfig} className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/20 transition-all">
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SmartAnalytics;
