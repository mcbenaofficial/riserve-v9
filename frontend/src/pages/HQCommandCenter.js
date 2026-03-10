import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, TrendingUp, TrendingDown, Minus, Users, Store, BarChart3,
    AlertTriangle, AlertCircle, Info, ChevronRight, ChevronDown, ChevronUp,
    Sparkles, Target, Shield, Star, Zap, Search, Filter, ArrowUpRight,
    Brain, MessageSquare, Play, Eye, BookOpen, Lightbulb, CheckCircle2,
    ArrowDownRight, LayoutGrid, List, Sun
} from 'lucide-react';
import { api } from '../services/api';

// Helper to format currency
const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
};

const SEVERITY_CONFIG = {
    critical: { color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: AlertCircle, dot: 'bg-red-500' },
    high: { color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: AlertTriangle, dot: 'bg-orange-500' },
    medium: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Info, dot: 'bg-amber-500' },
    low: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Lightbulb, dot: 'bg-blue-500' },
};

const CATEGORY_COLORS = {
    Revenue: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Customer: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    Ops: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    People: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
    Risk: 'bg-red-500/15 text-red-400 border-red-500/20',
    Opportunity: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
};

const STATUS_CONFIG = {
    healthy: { label: 'Healthy', bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
    at_risk: { label: 'At Risk', bg: 'bg-amber-500/15', text: 'text-amber-400', ring: 'ring-amber-500/30' },
    critical: { label: 'Critical', bg: 'bg-red-500/15', text: 'text-red-400', ring: 'ring-red-500/30' },
};

// ═══════════════════════════════════════════════════════════════
// KPI Card
// ═══════════════════════════════════════════════════════════════
const KPICard = ({ title, value, delta, icon: Icon, color, prefix = '' }) => {
    const isPositive = delta > 0;
    const isNeutral = delta === 0;
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 group hover:border-white/[0.12] transition-all duration-300 overflow-hidden"
        >
            {/* Glow accent */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${color} opacity-60`} />
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                    <Icon size={18} className="text-white" />
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${isNeutral ? 'bg-gray-500/10 text-gray-400' : isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                    {isNeutral ? <Minus size={12} /> : isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(delta)}%
                </div>
            </div>
            <div className="text-2xl font-bold text-white tracking-tight mb-1">{prefix}{typeof value === 'number' && !prefix ? value.toLocaleString() : value}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">{title}</div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════
// Health Score Badge
// ═══════════════════════════════════════════════════════════════
const HealthBadge = ({ score }) => {
    let color = 'from-emerald-500 to-emerald-600';
    if (score < 45) color = 'from-red-500 to-red-600';
    else if (score < 65) color = 'from-amber-500 to-amber-600';
    return (
        <div className={`inline-flex items-center justify-center w-12 h-7 rounded-lg bg-gradient-to-r ${color} text-white text-xs font-bold shadow-md`}>
            {score.toFixed(0)}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════
// Insight Card
// ═══════════════════════════════════════════════════════════════
const InsightCard = ({ insight, onInvestigate, onApplyPlaybook }) => {
    const sev = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.medium;
    const SevIcon = sev.icon;
    const catColor = CATEGORY_COLORS[insight.category] || 'bg-gray-500/15 text-gray-400';

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-all group"
        >
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${sev.color} border`}>
                    <SevIcon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {insight.is_new && (
                            <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded uppercase tracking-wider">New</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${catColor}`}>
                            {insight.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${sev.color}`}>
                            {insight.severity}
                        </span>
                        <span className="text-[10px] text-gray-600 ml-auto font-mono">
                            {Math.round(insight.confidence * 100)}% conf
                        </span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed mb-3">{insight.message}</p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onInvestigate(insight)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                        >
                            <Eye size={12} />
                            Investigate
                        </button>
                        <span className="text-gray-700">·</span>
                        <button
                            onClick={() => onApplyPlaybook(insight)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                            <Play size={12} />
                            Apply Playbook
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

// ═══════════════════════════════════════════════════════════════
// Outlet Row
// ═══════════════════════════════════════════════════════════════
const OutletRow = ({ outlet, onOpenCopilot, onApplyPlaybook, onDrillDown }) => {
    const statusCfg = STATUS_CONFIG[outlet.status] || STATUS_CONFIG.healthy;
    const TrendIcon = outlet.trend_direction === 'up' ? ArrowUpRight : outlet.trend_direction === 'down' ? ArrowDownRight : Minus;
    const trendColor = outlet.trend_direction === 'up' ? 'text-emerald-400' : outlet.trend_direction === 'down' ? 'text-red-400' : 'text-gray-500';

    return (
        <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group cursor-pointer" onClick={() => onDrillDown(outlet)}>
            <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${statusCfg.bg.replace('/15', '')} shadow-sm shadow-current`} />
                    <div>
                        <div className="text-sm font-semibold text-white">{outlet.outlet_name}</div>
                        <div className="text-xs text-gray-500">{outlet.region} · {outlet.cluster}</div>
                    </div>
                </div>
            </td>
            <td className="py-3 px-4 text-center"><HealthBadge score={outlet.health_score} /></td>
            <td className="py-3 px-4 text-center text-sm text-gray-300">{outlet.metrics.revenue_score}</td>
            <td className="py-3 px-4 text-center text-sm text-gray-300">{outlet.metrics.utilization}%</td>
            <td className="py-3 px-4 text-center text-sm text-gray-300">{outlet.metrics.nps}</td>
            <td className="py-3 px-4 text-center text-sm text-gray-300">{outlet.metrics.churn_rate}%</td>
            <td className="py-3 px-4 text-center">
                <div className={`flex items-center justify-center gap-1 ${trendColor}`}>
                    <TrendIcon size={14} />
                    <span className="text-xs font-medium">{outlet.trend_delta > 0 ? '+' : ''}{outlet.trend_delta}</span>
                </div>
            </td>
            <td className="py-3 px-4 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider ring-1 ${statusCfg.bg} ${statusCfg.text} ${statusCfg.ring}`}>
                    {statusCfg.label}
                </span>
            </td>
            <td className="py-3 px-4">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onDrillDown(outlet); }} className="p-1.5 rounded-lg hover:bg-purple-500/20 text-purple-400 transition-colors" title="View Detail">
                        <Eye size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onOpenCopilot(outlet); }} className="p-1.5 rounded-lg hover:bg-sky-500/20 text-sky-400 transition-colors" title="Open in Copilot">
                        <MessageSquare size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onApplyPlaybook(outlet); }} className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-400 transition-colors" title="Apply Playbook">
                        <BookOpen size={14} />
                    </button>
                </div>
            </td>
        </tr>
    );
};


// ═══════════════════════════════════════════════════════════════
// Network Health Grid (mini map of outlets)
// ═══════════════════════════════════════════════════════════════
const NetworkGrid = ({ outlets }) => {
    const getColor = (score) => {
        if (score >= 75) return 'bg-emerald-500';
        if (score >= 60) return 'bg-emerald-600/70';
        if (score >= 45) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <div className="flex flex-wrap gap-1.5">
            {outlets.map((o, i) => (
                <div
                    key={i}
                    className={`w-5 h-5 rounded-md ${getColor(o.health_score)} cursor-pointer transition-transform hover:scale-150 hover:z-10 relative group/tile`}
                    title={`${o.outlet_name}: ${o.health_score.toFixed(0)}`}
                >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tile:block z-50">
                        <div className="bg-gray-900 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap shadow-xl border border-white/10">
                            <span className="font-semibold">{o.outlet_name}</span> — {o.health_score.toFixed(0)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};


// ═══════════════════════════════════════════════════════════════
// Playbook Modal
// ═══════════════════════════════════════════════════════════════
const PlaybookModal = ({ playbook, outlets, onClose, onDeploy }) => {
    const [selectedOutlets, setSelectedOutlets] = useState([]);
    const [deploying, setDeploying] = useState(false);
    const [deployed, setDeployed] = useState(false);

    const handleDeploy = async () => {
        setDeploying(true);
        try {
            const result = await api.deployPlaybook(playbook.id, { outlet_ids: selectedOutlets });
            setDeployed(true);
            setTimeout(() => { onDeploy(result.data); onClose(); }, 2000);
        } catch { setDeploying(false); }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#0f1117] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
                {deployed ? (
                    <div className="text-center py-8">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-emerald-400" />
                        </motion.div>
                        <h3 className="text-lg font-bold text-white">Playbook Deployed!</h3>
                        <p className="text-gray-400 text-sm mt-1">{selectedOutlets.length} outlet(s) affected</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                <BookOpen size={18} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{playbook.name}</h3>
                                <span className="text-xs text-gray-500">{playbook.category}</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">{playbook.description}</p>

                        <div className="space-y-3 mb-5">
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">Trigger</div>
                                <div className="text-xs text-gray-300">{playbook.trigger}</div>
                            </div>
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">Actions</div>
                                <ul className="space-y-1">
                                    {playbook.actions.map((a, i) => (
                                        <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                                            <Zap size={10} className="text-amber-400 mt-0.5 shrink-0" /> {a}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                                <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 font-semibold">Estimated Impact</div>
                                <div className="text-sm text-emerald-400 font-semibold">{playbook.estimated_impact}</div>
                            </div>
                        </div>

                        <div className="mb-5">
                            <div className="text-xs text-gray-400 mb-2 font-semibold">Select outlets to deploy:</div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {outlets.map(o => (
                                    <label key={o.outlet_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedOutlets.includes(o.outlet_id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedOutlets([...selectedOutlets, o.outlet_id]);
                                                else setSelectedOutlets(selectedOutlets.filter(id => id !== o.outlet_id));
                                            }}
                                            className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <span className="text-sm text-gray-300">{o.outlet_name}</span>
                                        <HealthBadge score={o.health_score} />
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 transition-colors">Cancel</button>
                            <button
                                onClick={handleDeploy}
                                disabled={selectedOutlets.length === 0 || deploying}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
                            >
                                {deploying ? 'Deploying...' : `Deploy to ${selectedOutlets.length} Outlet(s)`}
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
};


// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const HQCommandCenter = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [networkData, setNetworkData] = useState(null);
    const [insights, setInsights] = useState([]);
    const [playbooks, setPlaybooks] = useState([]);
    const [sortField, setSortField] = useState('health_score');
    const [sortDir, setSortDir] = useState('asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedPlaybook, setSelectedPlaybook] = useState(null);
    const [viewMode, setViewMode] = useState('table'); // table | grid

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [healthRes, insightsRes, playbooksRes] = await Promise.all([
                api.getNetworkHealth(),
                api.getHQInsights(),
                api.getPlaybooks(),
            ]);
            setNetworkData(healthRes.data);
            setInsights(insightsRes.data.insights || []);
            setPlaybooks(playbooksRes.data.playbooks || []);
        } catch (err) {
            console.error('Failed to load HQ data', err);
        } finally {
            setLoading(false);
        }
    };

    const sortedOutlets = useMemo(() => {
        if (!networkData?.outlets) return [];
        let list = [...networkData.outlets];

        // Filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(o => o.outlet_name.toLowerCase().includes(q) || o.region.toLowerCase().includes(q));
        }
        if (statusFilter !== 'all') {
            list = list.filter(o => o.status === statusFilter);
        }

        // Sort
        list.sort((a, b) => {
            let aVal = sortField === 'name' ? a.outlet_name : (sortField.includes('.') ? a.metrics[sortField.split('.')[1]] : a[sortField]);
            let bVal = sortField === 'name' ? b.outlet_name : (sortField.includes('.') ? b.metrics[sortField.split('.')[1]] : b[sortField]);
            if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        });
        return list;
    }, [networkData, sortField, sortDir, searchQuery, statusFilter]);

    const handleSort = (field) => {
        if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const handleOpenCopilot = (outlet) => {
        navigate('/hq/copilot', { state: { outletContext: outlet } });
    };

    const handleInvestigate = (insight) => {
        navigate('/hq/copilot', { state: { initialQuery: insight.message } });
    };

    const handleDrillDown = (outlet) => {
        navigate(`/hq/outlet/${outlet.outlet_id}`);
    };

    const handleApplyPlaybook = (target) => {
        // Find a relevant playbook or use the first one
        const pb = playbooks[0];
        if (pb) setSelectedPlaybook(pb);
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <ChevronDown size={12} className="text-gray-700" />;
        return sortDir === 'asc' ? <ChevronUp size={12} className="text-sky-400" /> : <ChevronDown size={12} className="text-sky-400" />;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                    <Brain size={40} className="text-sky-500" />
                </motion.div>
            </div>
        );
    }

    const kpi = networkData?.kpi_strip || {};

    return (
        <div className="min-h-screen bg-[#0a0b0f] text-white">
            {/* Header */}
            <div className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25">
                                <Brain size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">HQ Intelligence</h1>
                                <p className="text-xs text-gray-500">Network Command Center</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => navigate('/hq/briefing')}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 transition-colors"
                            >
                                <Sun size={14} />
                                Briefing
                            </button>
                            <button
                                onClick={() => navigate('/hq/playbooks')}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                            >
                                <BookOpen size={14} />
                                Playbooks
                            </button>
                            <button
                                onClick={() => navigate('/hq/alerts')}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-colors relative"
                            >
                                <AlertTriangle size={14} />
                                Alerts
                            </button>
                            <button
                                onClick={() => navigate('/hq/regions')}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold hover:bg-violet-500/20 transition-colors"
                            >
                                <LayoutGrid size={14} />
                                Regions
                            </button>
                            <button
                                onClick={() => navigate('/hq/copilot')}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500/20 to-indigo-500/20 border border-sky-500/30 text-sky-400 text-xs font-semibold hover:bg-sky-500/30 transition-colors"
                            >
                                <Sparkles size={14} />
                                Copilot
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
                {/* KPI Strip */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <KPICard title="Total Revenue" value={formatCurrency(kpi.total_revenue || 0)} delta={kpi.revenue_delta} icon={TrendingUp} color="from-emerald-500 to-green-600" />
                    <KPICard title="Avg Utilization" value={`${kpi.avg_utilization || 0}%`} delta={kpi.utilization_delta} icon={Activity} color="from-sky-500 to-blue-600" />
                    <KPICard title="Avg NPS" value={kpi.avg_nps || 0} delta={kpi.nps_delta} icon={Star} color="from-amber-500 to-orange-600" />
                    <KPICard title="Churn Rate" value={`${kpi.avg_churn_rate || 0}%`} delta={kpi.churn_delta} icon={Users} color="from-rose-500 to-red-600" />
                    <KPICard title="Active Outlets" value={kpi.active_outlets || 0} delta={0} icon={Store} color="from-violet-500 to-purple-600" />
                    <KPICard title="Bookings This Week" value={kpi.total_bookings_this_week || 0} delta={kpi.bookings_delta} icon={BarChart3} color="from-teal-500 to-cyan-600" />
                </div>

                {/* Main Content: 2-column layout */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* Left Column: Outlet Table */}
                    <div className="xl:col-span-2 space-y-5">
                        {/* Network Health Grid */}
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Target size={16} className="text-sky-400" />
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Network Health</h2>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> ≥75</span>
                                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-600/70" /> 60–74</span>
                                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> 45–59</span>
                                    <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-red-500" /> &lt;45</span>
                                </div>
                            </div>
                            <NetworkGrid outlets={sortedOutlets} />
                            {/* Region summary */}
                            {networkData?.region_summary && (
                                <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/[0.04]">
                                    {networkData.region_summary.map((r, i) => (
                                        <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center gap-3">
                                            <span className="text-xs font-semibold text-white">{r.region}</span>
                                            <HealthBadge score={r.avg_health} />
                                            <span className="text-[10px] text-gray-500">{r.outlet_count} outlets</span>
                                            {r.critical_count > 0 && (
                                                <span className="text-[10px] text-red-400 font-semibold">{r.critical_count} critical</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Search, Filters, View Toggle */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="relative flex-1 max-w-xs">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                                <input
                                    type="text"
                                    placeholder="Search outlets..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-gray-600 focus:border-sky-500/40 outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
                                {['all', 'critical', 'at_risk', 'healthy'].map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setStatusFilter(s)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                                    >
                                        {s === 'all' ? 'All' : s === 'at_risk' ? 'At Risk' : s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
                                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-white/10 text-white' : 'text-gray-600'}`}><List size={14} /></button>
                                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-600'}`}><LayoutGrid size={14} /></button>
                            </div>
                        </div>

                        {/* Outlet Table */}
                        {viewMode === 'table' ? (
                            <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                                {[
                                                    { key: 'name', label: 'Outlet' },
                                                    { key: 'health_score', label: 'Health' },
                                                    { key: 'metrics.revenue_score', label: 'Revenue' },
                                                    { key: 'metrics.utilization', label: 'Utilization' },
                                                    { key: 'metrics.nps', label: 'NPS' },
                                                    { key: 'metrics.churn_rate', label: 'Churn' },
                                                    { key: 'trend_delta', label: 'Trend' },
                                                    { key: 'status', label: 'Status' },
                                                ].map(col => (
                                                    <th
                                                        key={col.key}
                                                        onClick={() => handleSort(col.key)}
                                                        className="py-3 px-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold cursor-pointer hover:text-gray-300 select-none"
                                                    >
                                                        <div className={`flex items-center gap-1 ${col.key !== 'name' ? 'justify-center' : ''}`}>
                                                            {col.label}
                                                            <SortIcon field={col.key} />
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="py-3 px-4 w-16"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sortedOutlets.map((outlet, i) => (
                                                <OutletRow
                                                    key={outlet.outlet_id || i}
                                                    outlet={outlet}
                                                    onOpenCopilot={handleOpenCopilot}
                                                    onApplyPlaybook={handleApplyPlaybook}
                                                    onDrillDown={handleDrillDown}
                                                />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {sortedOutlets.length === 0 && (
                                    <div className="text-center py-12 text-gray-600">
                                        <Store size={32} className="mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No outlets match your filters.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Grid view */
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {sortedOutlets.map((outlet, i) => {
                                    const statusCfg = STATUS_CONFIG[outlet.status] || STATUS_CONFIG.healthy;
                                    return (
                                        <motion.div
                                            key={outlet.outlet_id || i}
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: i * 0.02 }}
                                            className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-all cursor-pointer group"
                                            onClick={() => handleOpenCopilot(outlet)}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <div className="text-sm font-semibold text-white">{outlet.outlet_name}</div>
                                                    <div className="text-[10px] text-gray-500">{outlet.region}</div>
                                                </div>
                                                <HealthBadge score={outlet.health_score} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                <div><span className="text-gray-600">Revenue</span><span className="block text-gray-300 font-semibold">{outlet.metrics.revenue_score}</span></div>
                                                <div><span className="text-gray-600">Utilization</span><span className="block text-gray-300 font-semibold">{outlet.metrics.utilization}%</span></div>
                                                <div><span className="text-gray-600">NPS</span><span className="block text-gray-300 font-semibold">{outlet.metrics.nps}</span></div>
                                                <div><span className="text-gray-600">Churn</span><span className="block text-gray-300 font-semibold">{outlet.metrics.churn_rate}%</span></div>
                                            </div>
                                            <div className="mt-3 pt-2 border-t border-white/[0.04] flex items-center justify-between">
                                                <span className={`text-[10px] font-semibold ${statusCfg.text}`}>{statusCfg.label}</span>
                                                <ChevronRight size={12} className="text-gray-600 group-hover:text-sky-400 transition-colors" />
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Insights + Playbooks */}
                    <div className="space-y-5">
                        {/* Insight Feed */}
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-amber-400" />
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">AI Insights</h2>
                                </div>
                                <span className="text-[10px] text-gray-500 font-mono">{insights.length} active</span>
                            </div>
                            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                                {insights.map(insight => (
                                    <InsightCard
                                        key={insight.id}
                                        insight={insight}
                                        onInvestigate={handleInvestigate}
                                        onApplyPlaybook={handleApplyPlaybook}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Playbooks */}
                        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <BookOpen size={16} className="text-emerald-400" />
                                    <h2 className="text-sm font-bold text-white uppercase tracking-wider">Playbooks</h2>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {playbooks.map(pb => (
                                    <div
                                        key={pb.id}
                                        onClick={() => setSelectedPlaybook(pb)}
                                        className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 hover:border-emerald-500/30 transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors">{pb.name}</div>
                                                <div className="text-[10px] text-gray-500 mt-0.5">{pb.category}</div>
                                            </div>
                                            <ChevronRight size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors mt-1" />
                                        </div>
                                        <div className="mt-2 text-xs text-gray-500 line-clamp-2">{pb.description}</div>
                                        <div className="mt-2 text-[10px] text-emerald-500 font-semibold">{pb.estimated_impact}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Playbook Deploy Modal */}
            <AnimatePresence>
                {selectedPlaybook && (
                    <PlaybookModal
                        playbook={selectedPlaybook}
                        outlets={networkData?.outlets || []}
                        onClose={() => setSelectedPlaybook(null)}
                        onDeploy={() => { }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default HQCommandCenter;
