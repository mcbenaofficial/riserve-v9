import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft, GitCompareArrows, Check, X, TrendingUp, TrendingDown,
    BarChart3, Target, Star, Users, DollarSign, Activity, Award
} from 'lucide-react';
import { api } from '../services/api';

const METRIC_INFO = {
    revenue_30d: { label: 'Revenue (30d)', unit: '₹', icon: DollarSign, format: v => `₹${(v / 100000).toFixed(1)}L` },
    utilization: { label: 'Utilization', unit: '%', icon: BarChart3, format: v => `${v.toFixed(1)}%` },
    nps: { label: 'NPS', unit: '', icon: Target, format: v => v.toFixed(0) },
    avg_rating: { label: 'Avg Rating', unit: '/5', icon: Star, format: v => `${v.toFixed(1)}/5` },
    churn_rate: { label: 'Churn Rate', unit: '%', icon: Users, format: v => `${v.toFixed(1)}%` },
    bookings_this_week: { label: 'Bookings/Week', unit: '', icon: Activity, format: v => v },
};

export default function HQBenchmark() {
    const navigate = useNavigate();
    const [allOutlets, setAllOutlets] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [benchmarkData, setBenchmarkData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await api.getNetworkHealth();
                const outs = res.data.outlets || [];
                setAllOutlets(outs);
                // Pre-select first 3
                if (outs.length >= 3) {
                    setSelectedIds(outs.slice(0, 3).map(o => o.outlet_id));
                } else {
                    setSelectedIds(outs.map(o => o.outlet_id));
                }
            } catch (err) { console.error(err); }
            finally { setInitialLoading(false); }
        })();
    }, []);

    useEffect(() => {
        if (selectedIds.length >= 2) loadBenchmark();
        else setBenchmarkData(null);
    }, [selectedIds]);

    const loadBenchmark = async () => {
        setLoading(true);
        try {
            const res = await api.getBenchmark(selectedIds.join(','));
            setBenchmarkData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const toggleOutlet = (id) => {
        setSelectedIds(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id);
            if (prev.length >= 5) return prev;
            return [...prev, id];
        });
    };

    const outlets = benchmarkData?.outlets || [];
    const avgs = benchmarkData?.averages || {};
    const bestPractices = benchmarkData?.best_practices || [];

    // Color per outlet for visual distinction
    const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

    if (initialLoading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="animate-pulse text-gray-400 text-lg">Loading outlets...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-lg border-b border-gray-800/60">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/hq')} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
                            <ArrowLeft size={20} className="text-gray-400" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                            <GitCompareArrows size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">Cross-Outlet Benchmark</h1>
                            <p className="text-xs text-gray-500">Compare 2-5 outlets side by side</p>
                        </div>
                    </div>
                    <span className="text-xs text-gray-500">{selectedIds.length} of {allOutlets.length} selected</span>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Outlet selector */}
                <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-3 font-semibold uppercase tracking-wider">Select outlets to compare (2-5)</p>
                    <div className="flex flex-wrap gap-2">
                        {allOutlets.map(o => {
                            const sel = selectedIds.includes(o.outlet_id);
                            const idx = selectedIds.indexOf(o.outlet_id);
                            return (
                                <button key={o.outlet_id} onClick={() => toggleOutlet(o.outlet_id)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${sel ? 'text-white border' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 border border-transparent'}`}
                                    style={sel ? { borderColor: COLORS[idx % COLORS.length], backgroundColor: `${COLORS[idx % COLORS.length]}15` } : {}}>
                                    {sel && <span className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }}></span>}
                                    {o.name}
                                    {sel && <X size={12} />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {selectedIds.length < 2 ? (
                    <div className="text-center py-16">
                        <GitCompareArrows size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-400 font-medium">Select at least 2 outlets to compare</p>
                    </div>
                ) : loading ? (
                    <div className="text-center py-12 text-gray-500">Computing benchmark...</div>
                ) : benchmarkData && (
                    <>
                        {/* Metric comparison cards */}
                        {Object.entries(METRIC_INFO).map(([key, info]) => {
                            const values = outlets.map(o => o.metrics[key] || 0);
                            const maxVal = Math.max(...values) || 1;
                            const top = outlets.reduce((best, o) =>
                                key === 'churn_rate'
                                    ? ((o.metrics[key] || 0) < (best.metrics[key] || 0) ? o : best)
                                    : ((o.metrics[key] || 0) > (best.metrics[key] || 0) ? o : best)
                                , outlets[0]);

                            return (
                                <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                    className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <info.icon size={16} className="text-gray-400" />
                                            <h3 className="text-sm font-semibold text-gray-300">{info.label}</h3>
                                        </div>
                                        <span className="text-[10px] text-gray-600">Avg: {info.format(avgs[key] || 0)}</span>
                                    </div>
                                    <div className="space-y-3">
                                        {outlets.map((o, i) => {
                                            const val = o.metrics[key] || 0;
                                            const pct = key === 'churn_rate'
                                                ? Math.max(5, 100 - (val / maxVal) * 100)
                                                : Math.max(5, (val / maxVal) * 100);
                                            const isTop = o.outlet_id === top.outlet_id;
                                            return (
                                                <div key={o.outlet_id} className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-400 w-40 truncate flex items-center gap-1.5">
                                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[selectedIds.indexOf(o.outlet_id) % COLORS.length] }}></span>
                                                        {o.outlet_name}
                                                        {isTop && <Award size={11} className="text-amber-400" />}
                                                    </span>
                                                    <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden relative">
                                                        <motion.div initial={{ width: 0 }}
                                                            animate={{ width: `${pct}%` }}
                                                            transition={{ duration: 0.6, delay: i * 0.1 }}
                                                            className="h-full rounded-full opacity-80"
                                                            style={{ background: COLORS[selectedIds.indexOf(o.outlet_id) % COLORS.length] }}
                                                        />
                                                    </div>
                                                    <span className="text-sm font-semibold text-gray-200 w-20 text-right">{info.format(val)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            );
                        })}

                        {/* Health Score comparison */}
                        <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                                <Award size={16} className="text-amber-400" /> Overall Health Score
                            </h3>
                            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${outlets.length}, 1fr)` }}>
                                {outlets.map((o, i) => {
                                    const color = COLORS[selectedIds.indexOf(o.outlet_id) % COLORS.length];
                                    const isTop = o.health_score === Math.max(...outlets.map(x => x.health_score));
                                    return (
                                        <div key={o.outlet_id}
                                            className={`rounded-xl p-4 text-center border ${isTop ? 'border-amber-500/30 bg-amber-500/5' : 'border-gray-800/40 bg-gray-800/20'}`}>
                                            <div className="text-3xl font-bold mb-1" style={{ color }}>{o.health_score}</div>
                                            <p className="text-xs text-gray-400 truncate">{o.outlet_name}</p>
                                            <span className={`inline-block mt-2 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${o.status === 'healthy' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : o.status === 'at_risk' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                {o.status}
                                            </span>
                                            {isTop && <div className="text-[10px] text-amber-400 mt-1 font-semibold">★ Top Performer</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Best practices */}
                        {bestPractices.length > 0 && (
                            <div className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-5">
                                <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                                    <Award size={16} /> Best Practices from Top Performer
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {bestPractices.map((bp, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm text-gray-300">
                                            <Check size={14} className="text-amber-400 flex-shrink-0" />
                                            {bp}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
