
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DemographicsRadar, TrendLineChart, AudienceHeatmap, DynamicChart } from '../components/analytics/AnalyticsCharts';
import { Sparkles, Settings, X, Trash2, BarChart2, TrendingUp, PieChart, Activity, LineChart as LineChartIcon } from 'lucide-react';
import { useAnalytics } from '../contexts/AnalyticsContext';

const DEFAULT_WIDGETS = [
    { id: 'trends', title: 'Revenue & Booking Trends', visible: true, chartType: 'area' },
    { id: 'demographics', title: 'Service Breakdown', visible: true, chartType: 'radar' },
    { id: 'distribution', title: 'Outlet Performance', visible: true, chartType: 'bar' },
];

const CHART_TYPES = [
    { type: 'area', label: 'Area', icon: Activity },
    { type: 'line', label: 'Line', icon: LineChartIcon },
    { type: 'bar', label: 'Bar', icon: BarChart2 },
    { type: 'radar', label: 'Radar', icon: PieChart },
];

const ChartTypeSelector = ({ currentType, onSelect, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-12 right-4 z-20 bg-[#1F2630] border border-[#374151] rounded-xl p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="text-xs text-[#7D8590] px-2 py-1 mb-1">Chart Type</div>
            <div className="flex flex-col gap-1">
                {CHART_TYPES.map((chart) => (
                    <button
                        key={chart.type}
                        onClick={() => { onSelect(chart.type); onClose(); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${currentType === chart.type
                                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                : 'hover:bg-[#2A323E] text-[#E6E8EB]'
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

const AIAnalytics = () => {
    const { dynamicWidgets, removeWidget, updateWidgetType, getMonthlyTrends, getOutletPerformance, getServiceBreakdown, analyticsData } = useAnalytics();
    const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
    const [customizing, setCustomizing] = useState(false);
    const [tempWidgets, setTempWidgets] = useState([]);
    const [activeSelector, setActiveSelector] = useState(null);

    const isVisible = (widgetId) => widgets.find(w => w.id === widgetId)?.visible ?? true;
    const getChartType = (widgetId) => widgets.find(w => w.id === widgetId)?.chartType ?? 'area';

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

    // Get real data for charts
    const trendData = getMonthlyTrends();
    const outletData = getOutletPerformance();
    const serviceData = getServiceBreakdown();

    return (
        <div className="flex h-screen bg-[#0B0D10] text-[#E6E8EB] overflow-hidden relative" onClick={() => setActiveSelector(null)}>
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative z-10 transition-all duration-300">

                {/* Header */}
                <div className="px-8 py-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 flex items-center gap-3">
                            <Sparkles size={28} className="text-purple-400" />
                            AI Analytics
                        </h1>
                        <p className="text-[#9CA3AF] mt-1 text-sm">
                            Real-time insights powered by Ri'Serve Flow • Click any widget to change chart type
                            {dynamicWidgets.length > 0 && (
                                <span className="ml-2 px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full text-xs">
                                    +{dynamicWidgets.length} from AI
                                </span>
                            )}
                        </p>
                    </div>
                    <button
                        onClick={openCustomization}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F2630] hover:bg-[#2A323E] text-[#A9AFB8] hover:text-[#E6E8EB] transition-all border border-[#1F2630] hover:border-purple-500/30"
                    >
                        <Settings size={18} />
                        <span className="text-sm font-medium">Customize</span>
                    </button>
                </div>

                {/* Dashboard Grid */}
                <div className="flex-1 p-8 pt-0 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-12 gap-6 pb-20">

                        {/* Dynamic Widgets from AI Chat */}
                        <AnimatePresence>
                            {dynamicWidgets.map((widget) => (
                                <motion.div
                                    key={widget.id}
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3 }}
                                    className="col-span-12 lg:col-span-6 bg-[#12161C]/60 backdrop-blur-md border border-purple-500/30 rounded-3xl p-6 relative group overflow-hidden cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === widget.id ? null : widget.id); }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-semibold text-[#E6E8EB]">{widget.title}</h3>
                                            <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-400 text-xs font-medium border border-purple-500/30">
                                                AI Added
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === widget.id ? null : widget.id); }}
                                                className="p-1.5 rounded-lg hover:bg-purple-500/20 text-[#7D8590] hover:text-purple-400 transition-all"
                                                title="Change chart type"
                                            >
                                                <BarChart2 size={16} />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); removeWidget(widget.id); }}
                                                className="p-1.5 rounded-lg hover:bg-red-500/20 text-[#7D8590] hover:text-red-400 transition-all"
                                                title="Remove widget"
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
                                    <div className="h-[250px] w-full relative z-10">
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

                        {/* Default: Interactive Line Chart - Trends */}
                        <AnimatePresence>
                            {isVisible('trends') && (
                                <motion.div
                                    key="trends"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                    className="col-span-12 lg:col-span-8 bg-[#12161C]/60 backdrop-blur-md border border-[#1F2630] rounded-3xl p-6 relative group overflow-hidden cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'trends' ? null : 'trends'); }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <h3 className="text-lg font-semibold text-[#E6E8EB]">Revenue & Booking Trends</h3>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'trends' ? null : 'trends'); }}
                                                className="p-1.5 rounded-lg hover:bg-purple-500/20 text-[#7D8590] hover:text-purple-400 transition-all"
                                                title="Change chart type"
                                            >
                                                <BarChart2 size={16} />
                                            </button>
                                            <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium border border-purple-500/20">
                                                {analyticsData.loading ? 'Loading...' : 'Live'}
                                            </span>
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
                                    <div className="h-[300px] w-full relative z-10">
                                        <DynamicChart type={getChartType('trends')} dataKey="revenue" color="#8b5cf6" data={trendData} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Default: Radar Chart - Demographics */}
                        <AnimatePresence>
                            {isVisible('demographics') && (
                                <motion.div
                                    key="demographics"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                    className="col-span-12 lg:col-span-4 bg-[#12161C]/60 backdrop-blur-md border border-[#1F2630] rounded-3xl p-6 relative group overflow-hidden cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'demographics' ? null : 'demographics'); }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <h3 className="text-lg font-semibold text-[#E6E8EB]">Service Breakdown</h3>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'demographics' ? null : 'demographics'); }}
                                            className="p-1.5 rounded-lg hover:bg-purple-500/20 text-[#7D8590] hover:text-purple-400 transition-all"
                                            title="Change chart type"
                                        >
                                            <BarChart2 size={16} />
                                        </button>
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

                        {/* Default: Heatmap / Distribution */}
                        <AnimatePresence>
                            {isVisible('distribution') && (
                                <motion.div
                                    key="distribution"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ duration: 0.3 }}
                                    className="col-span-12 bg-[#12161C]/60 backdrop-blur-md border border-[#1F2630] rounded-3xl p-6 relative group overflow-hidden cursor-pointer"
                                    onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'distribution' ? null : 'distribution'); }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <h3 className="text-lg font-semibold text-[#E6E8EB]">Outlet Performance</h3>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveSelector(activeSelector === 'distribution' ? null : 'distribution'); }}
                                            className="p-1.5 rounded-lg hover:bg-purple-500/20 text-[#7D8590] hover:text-purple-400 transition-all"
                                            title="Change chart type"
                                        >
                                            <BarChart2 size={16} />
                                        </button>
                                    </div>
                                    <AnimatePresence>
                                        <ChartTypeSelector
                                            currentType={getChartType('distribution')}
                                            onSelect={(type) => changeChartType('distribution', type)}
                                            isOpen={activeSelector === 'distribution'}
                                            onClose={() => setActiveSelector(null)}
                                        />
                                    </AnimatePresence>
                                    <div className="h-[250px] w-full relative z-10">
                                        <DynamicChart type={getChartType('distribution')} dataKey="value" color="#3b82f6" data={outletData.length > 0 ? outletData : undefined} />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                    </div>
                </div>
            </div>

            {/* Customization Dialog */}
            <AnimatePresence>
                {customizing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
                        onClick={() => setCustomizing(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="bg-[#12161C] border border-[#1F2630] rounded-2xl p-6 w-full max-w-md shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-[#E6E8EB]">Customize Dashboard</h2>
                                <button
                                    onClick={() => setCustomizing(false)}
                                    className="p-2 rounded-lg hover:bg-[#1F2630] text-[#7D8590] hover:text-[#E6E8EB] transition-all"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <p className="text-[#7D8590] text-sm mb-6">Toggle which widgets are visible on the AI Analytics dashboard.</p>

                            <div className="space-y-4">
                                {tempWidgets.map((widget) => (
                                    <div key={widget.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-[#1F2630]/50 border border-[#1F2630]">
                                        <span className="text-sm font-medium text-[#E6E8EB]">{widget.title}</span>
                                        <button
                                            onClick={() => toggleWidget(widget.id)}
                                            className={`w-12 h-6 rounded-full transition-all relative ${widget.visible ? 'bg-purple-500' : 'bg-[#3A424E]'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${widget.visible ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    onClick={() => setCustomizing(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-[#1F2630] text-[#A9AFB8] hover:bg-[#1F2630] transition-all font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveConfig}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-all font-medium"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AIAnalytics;
