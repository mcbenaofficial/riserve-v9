import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    MapPin, ArrowLeft, Store, TrendingUp, TrendingDown, Minus,
    BarChart3, Star, Users, Activity, Target, ChevronRight, Brain
} from 'lucide-react';
import { api } from '../services/api';
import HQIndiaMap from '../components/HQIndiaMap';

const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${Math.round(val)}`;
};

const STATUS_CONFIG = {
    healthy: { label: 'Healthy', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
    at_risk: { label: 'At Risk', bg: 'bg-amber-500/15', text: 'text-amber-400' },
    critical: { label: 'Critical', bg: 'bg-red-500/15', text: 'text-red-400' },
};

const getScoreColor = (score) => {
    if (score >= 75) return 'from-emerald-500 to-emerald-600';
    if (score >= 60) return 'from-emerald-600/70 to-emerald-700/70';
    if (score >= 45) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
};

// ═══════════ Region Overview (list page) ═══════════
const HQRegionList = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [regions, setRegions] = useState([]);
    const [selectedRegion, setSelectedRegion] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.getRegions();
                // Sort regions by health score descending
                const sorted = (res.data.regions || []).sort((a, b) => b.avg_health - a.avg_health);
                setRegions(sorted);
                if (sorted.length > 0) {
                    setSelectedRegion(sorted[0]);
                }
            } catch (err) {
                console.error('Failed to load regions', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                    <MapPin size={40} className="text-violet-500" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0b0f] text-white overflow-hidden">
            <div className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/hq')} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <MapPin size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Geographic Performance</h1>
                            <p className="text-xs text-gray-500">City-level health and analytics</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-6 py-6 h-[calc(100vh-80px)] overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

                    {/* Left Panel: Map */}
                    <div className="lg:col-span-7 bg-[#11131a]/50 border border-white/[0.06] rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-sm">

                        {/* Map Overlay Stats */}
                        <div className="absolute top-6 left-6 flex flex-col gap-2 z-20 pointer-events-none">
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 shadow-2xl">
                                <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-1">Total Cities</div>
                                <div className="text-2xl font-bold text-white">{regions.length}</div>
                            </div>
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0b0f] pointer-events-none opacity-50" />

                        <div className="w-full h-full max-h-[700px] flex items-center justify-center">
                            <HQIndiaMap
                                regions={regions}
                                onRegionSelect={(regionName) => {
                                    const r = regions.find(x => x.region === regionName);
                                    if (r) setSelectedRegion(r);
                                }}
                                selectedRegion={selectedRegion}
                            />
                        </div>
                    </div>

                    {/* Right Panel: City List */}
                    <div className="lg:col-span-5 flex flex-col h-full bg-white/[0.01] border border-white/[0.04] rounded-3xl overflow-hidden backdrop-blur-sm">
                        <div className="p-5 border-b border-white/[0.06] bg-white/[0.02]">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Activity size={16} className="text-violet-400" />
                                City Leaderboard
                            </h3>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {regions.map((region, i) => (
                                <motion.div
                                    key={region.region}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden
                                        ${selectedRegion?.region === region.region
                                            ? 'bg-white/[0.06] border-violet-500/50 shadow-lg shadow-violet-500/10'
                                            : 'bg-white/[0.02] border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.04]'
                                        }`}
                                    onClick={() => setSelectedRegion(region)}
                                >
                                    {/* Selection Indicator */}
                                    {selectedRegion?.region === region.region && (
                                        <motion.div
                                            layoutId="city-selection"
                                            className="absolute left-0 top-0 bottom-0 w-1 bg-violet-500 rounded-r-md"
                                        />
                                    )}

                                    <div className="flex items-start justify-between mb-3 pl-2">
                                        <div>
                                            <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors flex items-center gap-2">
                                                {region.region}
                                                {selectedRegion?.region === region.region && (
                                                    <span className="text-[10px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-medium">Selected</span>
                                                )}
                                            </h3>
                                            <span className="text-xs text-gray-500">{region.outlet_count} Live Outlets</span>
                                        </div>
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getScoreColor(region.avg_health)} flex flex-col items-center justify-center text-white shadow-lg ring-1 ring-white/20`}>
                                            <span className="text-lg font-bold leading-none">{region.avg_health}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 pl-2">
                                        <div className="bg-black/20 rounded-lg p-2">
                                            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Rev (30d)</div>
                                            <div className="text-sm font-semibold text-emerald-400">{formatCurrency(region.total_revenue_30d)}</div>
                                        </div>
                                        <div className="bg-black/20 rounded-lg p-2">
                                            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Avg NPS</div>
                                            <div className="text-sm font-semibold text-amber-400 flex items-center gap-1">
                                                {region.avg_nps.toFixed(1)} <Star size={10} className="fill-current" />
                                            </div>
                                        </div>
                                        <div className="bg-black/20 rounded-lg p-2">
                                            <div className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Util</div>
                                            <div className="text-sm font-semibold text-sky-400">{region.avg_utilization}%</div>
                                        </div>
                                    </div>

                                    {/* Drilldown Button */}
                                    <div className="mt-4 pl-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/hq/region/${encodeURIComponent(region.region)}`);
                                            }}
                                            className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all
                                                ${selectedRegion?.region === region.region
                                                    ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-md'
                                                    : 'bg-white/5 hover:bg-white/10 text-gray-300 opacity-0 group-hover:opacity-100'
                                                }`}
                                        >
                                            View City Drilldown <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

// ═══════════ Region Detail ═══════════
const HQRegionDetailView = () => {
    const navigate = useNavigate();
    const { regionName } = useParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.getRegionDetail(regionName);
                setData(res.data);
            } catch (err) {
                console.error('Failed to load region detail', err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [regionName]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                    <MapPin size={40} className="text-violet-500" />
                </motion.div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center text-gray-500">
                <p>Region not found</p>
            </div>
        );
    }

    const summary = data.summary || {};
    const outlets = data.outlets || [];

    return (
        <div className="min-h-screen bg-[#0a0b0f] text-white">
            <div className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-[1400px] mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/hq/regions')} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <MapPin size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">{data.region} Region</h1>
                            <p className="text-xs text-gray-500">{summary.outlet_count} outlets</p>
                        </div>
                        <div className={`ml-auto w-14 h-8 rounded-lg bg-gradient-to-r ${getScoreColor(summary.avg_health || 0)} flex items-center justify-center text-white text-sm font-bold shadow-md`}>
                            {summary.avg_health}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
                {/* Summary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Revenue (30d)', value: formatCurrency(summary.total_revenue_30d || 0), icon: TrendingUp, color: 'from-emerald-500 to-green-600' },
                        { label: 'Avg Health', value: summary.avg_health || 0, icon: Activity, color: 'from-sky-500 to-blue-600' },
                        { label: 'Avg NPS', value: summary.avg_nps || 0, icon: Star, color: 'from-amber-500 to-orange-600' },
                        { label: 'Avg Utilization', value: `${summary.avg_utilization || 0}%`, icon: Target, color: 'from-violet-500 to-purple-600' },
                    ].map((kpi, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4"
                        >
                            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${kpi.color} flex items-center justify-center mb-2 shadow-lg`}>
                                <kpi.icon size={14} className="text-white" />
                            </div>
                            <div className="text-xl font-bold text-white">{kpi.value}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{kpi.label}</div>
                        </motion.div>
                    ))}
                </div>

                {/* Heatmap */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Target size={16} className="text-violet-400" />
                        Outlet Health Map
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {outlets.map((o, i) => (
                            <motion.div
                                key={o.outlet_id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.03 }}
                                onClick={() => navigate(`/hq/outlet/${o.outlet_id}`)}
                                className={`px-3 py-2 rounded-lg bg-gradient-to-r ${getScoreColor(o.health_score)} cursor-pointer hover:opacity-80 transition-opacity group relative`}
                            >
                                <div className="text-xs font-semibold text-white">{o.outlet_name}</div>
                                <div className="text-[10px] text-white/70">{o.health_score}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Outlet Table */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                                    <th className="py-3 px-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Outlet</th>
                                    <th className="py-3 px-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-center">Health</th>
                                    <th className="py-3 px-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-center">Revenue</th>
                                    <th className="py-3 px-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-center">NPS</th>
                                    <th className="py-3 px-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-center">Utilization</th>
                                    <th className="py-3 px-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-center">Rating</th>
                                    <th className="py-3 px-4 text-[10px] text-gray-500 uppercase tracking-wider font-semibold text-center">Status</th>
                                    <th className="py-3 px-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {outlets.map((o) => {
                                    const sCfg = STATUS_CONFIG[o.status] || STATUS_CONFIG.healthy;
                                    return (
                                        <tr
                                            key={o.outlet_id}
                                            className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer group"
                                            onClick={() => navigate(`/hq/outlet/${o.outlet_id}`)}
                                        >
                                            <td className="py-3 px-4">
                                                <div className="text-sm font-semibold text-white">{o.outlet_name}</div>
                                                <div className="text-[10px] text-gray-500">{o.cluster}</div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`inline-flex items-center justify-center w-12 h-7 rounded-lg bg-gradient-to-r ${getScoreColor(o.health_score)} text-white text-xs font-bold shadow-md`}>
                                                    {o.health_score}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center text-sm text-gray-300">{formatCurrency(o.metrics?.revenue_30d || 0)}</td>
                                            <td className="py-3 px-4 text-center text-sm text-gray-300">{o.metrics?.nps || 0}</td>
                                            <td className="py-3 px-4 text-center text-sm text-gray-300">{o.metrics?.utilization || 0}%</td>
                                            <td className="py-3 px-4 text-center text-sm text-gray-300">{o.metrics?.avg_rating || 0}/5</td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${sCfg.bg} ${sCfg.text}`}>
                                                    {sCfg.label}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <ChevronRight size={14} className="text-gray-600 group-hover:text-violet-400 transition-colors" />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════ Smart Router ═══════════
const HQRegionDetail = () => {
    const { regionName } = useParams();
    if (regionName) return <HQRegionDetailView />;
    return <HQRegionList />;
};

export default HQRegionDetail;
