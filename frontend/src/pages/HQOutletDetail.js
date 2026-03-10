import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, TrendingUp, TrendingDown, Minus, Star, Users, Calendar,
    DollarSign, MessageSquare, BarChart3, Target, AlertTriangle,
    ChevronRight, ExternalLink, ThumbsUp, ThumbsDown, Clock
} from 'lucide-react';
import { api } from '../services/api';

// ─── Mini chart components ───
const SparkLine = ({ data, width = 200, height = 40, color = '#10b981' }) => {
    if (!data?.length) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
            <circle cx={(data.length - 1) / (data.length - 1) * width} cy={height - ((data[data.length - 1] - min) / range) * (height - 4)} r="3" fill={color} />
        </svg>
    );
};

const HealthRadar = ({ metrics }) => {
    if (!metrics) return null;
    const dims = [
        { key: 'revenue_score', label: 'Revenue' },
        { key: 'utilization', label: 'Utilization' },
        { key: 'nps', label: 'NPS' },
        { key: 'feedback_score', label: 'Feedback' },
    ];
    const churnInverted = Math.max(0, 100 - (metrics.churn_rate || 0));
    const values = [...dims.map(d => metrics[d.key] || 0), churnInverted];
    const labels = [...dims.map(d => d.label), 'Retention'];

    const cx = 100, cy = 100, r = 70;
    const n = values.length;
    const angleStep = (2 * Math.PI) / n;

    const getPoint = (val, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const dist = (val / 100) * r;
        return { x: cx + dist * Math.cos(angle), y: cy + dist * Math.sin(angle) };
    };

    const polygonPoints = values.map((v, i) => {
        const p = getPoint(v, i);
        return `${p.x},${p.y}`;
    }).join(' ');

    const gridLevels = [25, 50, 75, 100];

    return (
        <svg viewBox="0 0 200 200" className="w-full max-w-[240px]">
            {/* Grid */}
            {gridLevels.map(level => (
                <polygon key={level} fill="none" stroke="#374151" strokeWidth="0.5" opacity={0.4}
                    points={Array.from({ length: n }, (_, i) => {
                        const p = getPoint(level, i);
                        return `${p.x},${p.y}`;
                    }).join(' ')} />
            ))}
            {/* Axes */}
            {labels.map((_, i) => {
                const p = getPoint(100, i);
                return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#374151" strokeWidth="0.5" opacity={0.4} />;
            })}
            {/* Data */}
            <polygon fill="rgba(99,102,241,0.2)" stroke="#6366f1" strokeWidth="2" points={polygonPoints} />
            {values.map((v, i) => {
                const p = getPoint(v, i);
                return <circle key={i} cx={p.x} cy={p.y} r="3" fill="#6366f1" />;
            })}
            {/* Labels */}
            {labels.map((label, i) => {
                const p = getPoint(115, i);
                return (
                    <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                        className="fill-gray-400 text-[8px] font-medium">{label}
                    </text>
                );
            })}
        </svg>
    );
};

const BarChart = ({ data, labelKey, valueKey, color = '#6366f1' }) => {
    if (!data?.length) return <p className="text-gray-500 text-sm">No data</p>;
    const max = Math.max(...data.map(d => d[valueKey])) || 1;
    return (
        <div className="space-y-2">
            {data.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-32 truncate">{item[labelKey]}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }} animate={{ width: `${(item[valueKey] / max) * 100}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className="h-full rounded-full" style={{ background: color }}
                        />
                    </div>
                    <span className="text-xs text-gray-300 w-16 text-right">{typeof item[valueKey] === 'number' && item[valueKey] > 999 ? `₹${(item[valueKey] / 1000).toFixed(0)}K` : item[valueKey]}</span>
                </div>
            ))}
        </div>
    );
};

// ─── Feedback Card ───
const FeedbackCard = ({ fb }) => {
    const ratingColors = { 5: 'text-green-400', 4: 'text-green-400', 3: 'text-yellow-400', 2: 'text-orange-400', 1: 'text-red-400' };
    return (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">{fb.customer_name || 'Anonymous'}</span>
                    <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={12} className={s <= fb.rating ? ratingColors[fb.rating] : 'text-gray-600'} fill={s <= fb.rating ? 'currentColor' : 'none'} />
                        ))}
                    </div>
                </div>
                <span className="text-xs text-gray-500">{fb.created_at ? new Date(fb.created_at).toLocaleDateString() : ''}</span>
            </div>
            {fb.liked_most?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {fb.liked_most.map((item, i) => (
                        <span key={i} className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ThumbsUp size={9} /> {item}
                        </span>
                    ))}
                </div>
            )}
            {fb.areas_fell_short?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {fb.areas_fell_short.map((item, i) => (
                        <span key={i} className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ThumbsDown size={9} /> {item}
                        </span>
                    ))}
                </div>
            )}
            {fb.comment && <p className="text-sm text-gray-400 italic">"{fb.comment}"</p>}
            {fb.escalation_notes && (
                <div className="flex items-start gap-2 bg-red-500/10 rounded p-2">
                    <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-300">{fb.escalation_notes}</p>
                </div>
            )}
        </div>
    );
};

// ─── Main Component ───
export default function HQOutletDetail() {
    const { outletId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Trend controls
    const [trendPeriod, setTrendPeriod] = useState('30d');
    const [trendMetric, setTrendMetric] = useState('revenue');
    const [trendData, setTrendData] = useState([]);
    const [trendLoading, setTrendLoading] = useState(false);

    // Compare
    const [compareOutletId, setCompareOutletId] = useState('');
    const [compareData, setCompareData] = useState([]);
    const [allOutlets, setAllOutlets] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [res, healthRes] = await Promise.all([
                    api.getOutletDetail(outletId),
                    api.getNetworkHealth(),
                ]);
                setData(res.data);
                setAllOutlets((healthRes.data.outlets || []).filter(o => o.outlet_id !== outletId));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [outletId]);

    // Load trend data when period/metric changes
    useEffect(() => {
        if (!outletId) return;
        (async () => {
            setTrendLoading(true);
            try {
                const res = await api.getTrends(outletId, trendMetric, trendPeriod);
                setTrendData(res.data.data || []);
            } catch (err) { console.error(err); setTrendData([]); }
            finally { setTrendLoading(false); }
        })();
    }, [outletId, trendPeriod, trendMetric]);

    // Load compare data
    useEffect(() => {
        if (!compareOutletId) { setCompareData([]); return; }
        (async () => {
            try {
                const res = await api.getTrends(compareOutletId, trendMetric, trendPeriod);
                setCompareData(res.data.data || []);
            } catch (err) { console.error(err); setCompareData([]); }
        })();
    }, [compareOutletId, trendPeriod, trendMetric]);

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="animate-pulse text-gray-400 text-lg">Loading outlet data...</div>
        </div>
    );

    if (error || !data) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-red-400">{error || 'Failed to load outlet'}</div>
        </div>
    );

    const { outlet, health, daily_revenue, service_mix, feedback_timeline, staff_bookings, comparison } = data;
    const m = health?.metrics || {};
    const revData = daily_revenue?.map(d => d.revenue) || [];

    const statusColors = { healthy: 'bg-green-500', at_risk: 'bg-yellow-500', critical: 'bg-red-500' };
    const statusLabels = { healthy: 'Healthy', at_risk: 'At Risk', critical: 'Critical' };

    // Build trend chart data for SparkLine
    const trendValues = trendData.map(d => d.value);
    const compareValues = compareData.map(d => d.value);
    const compareOutletName = allOutlets.find(o => o.outlet_id === compareOutletId)?.name || '';

    const metricLabels = { revenue: 'Revenue', bookings: 'Bookings', utilization: 'Utilization', nps: 'NPS' };

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-lg border-b border-gray-800/60">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
                    <button onClick={() => navigate('/hq')} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
                        <ArrowLeft size={20} className="text-gray-400" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                            {outlet?.name}
                        </h1>
                        <p className="text-sm text-gray-500">{outlet?.location}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${statusColors[health?.status]}`}>
                            {statusLabels[health?.status]}
                        </span>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-white">{health?.health_score}</div>
                            <div className="text-xs text-gray-500">Health Score</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Top Row: Health Radar + KPI Cards */}
                <div className="grid grid-cols-12 gap-4">
                    {/* Radar */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        className="col-span-3 bg-gray-900/80 border border-gray-800/60 rounded-xl p-4 flex flex-col items-center justify-center">
                        <h3 className="text-sm font-semibold text-gray-400 mb-2">Health Breakdown</h3>
                        <HealthRadar metrics={m} />
                    </motion.div>

                    {/* KPI Cards */}
                    <div className="col-span-9 grid grid-cols-5 gap-3">
                        {[
                            { label: 'Revenue (30d)', value: `₹${(m.revenue_30d / 100000).toFixed(1)}L`, delta: m.revenue_delta, icon: DollarSign, color: 'from-green-500/10 to-emerald-500/10' },
                            { label: 'Utilization', value: `${m.utilization}%`, delta: m.utilization - 60, icon: BarChart3, color: 'from-blue-500/10 to-cyan-500/10' },
                            { label: 'NPS', value: m.nps, delta: m.nps - (comparison?.network_avg_nps || 65), icon: Target, color: 'from-purple-500/10 to-indigo-500/10' },
                            { label: 'Avg Rating', value: `${m.avg_rating}/5`, delta: (m.avg_rating - (comparison?.network_avg_rating || 4)) * 20, icon: Star, color: 'from-yellow-500/10 to-amber-500/10' },
                            { label: 'Churn Rate', value: `${m.churn_rate}%`, delta: -(m.churn_rate - 8), icon: Users, color: 'from-red-500/10 to-pink-500/10' },
                        ].map((kpi, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={`bg-gradient-to-br ${kpi.color} border border-gray-800/40 rounded-xl p-4`}>
                                <div className="flex items-center gap-2 mb-2">
                                    <kpi.icon size={16} className="text-gray-400" />
                                    <span className="text-xs text-gray-400">{kpi.label}</span>
                                </div>
                                <div className="text-xl font-bold text-white">{kpi.value}</div>
                                <div className={`flex items-center gap-1 mt-1 text-xs ${kpi.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {kpi.delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                    {Math.abs(kpi.delta).toFixed(1)}{kpi.label !== 'Avg Rating' && kpi.label !== 'NPS' ? '%' : ''} vs benchmark
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Interactive Trend Panel */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-400" />
                            {metricLabels[trendMetric]} Trend
                        </h3>
                        <div className="flex items-center gap-3">
                            {/* Metric selector */}
                            <div className="flex gap-1">
                                {['revenue', 'bookings', 'utilization', 'nps'].map(met => (
                                    <button key={met} onClick={() => setTrendMetric(met)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${trendMetric === met ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-gray-500 hover:bg-gray-800'}`}>
                                        {metricLabels[met]}
                                    </button>
                                ))}
                            </div>
                            {/* Period selector */}
                            <div className="flex gap-1 border-l border-gray-800 pl-3">
                                {['7d', '30d', '90d'].map(p => (
                                    <button key={p} onClick={() => setTrendPeriod(p)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${trendPeriod === p ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-gray-500 hover:bg-gray-800'}`}>
                                        {p}
                                    </button>
                                ))}
                            </div>
                            {/* Compare selector */}
                            <select value={compareOutletId} onChange={e => setCompareOutletId(e.target.value)}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-sky-500">
                                <option value="">Compare with…</option>
                                {allOutlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>)}
                            </select>
                        </div>
                    </div>
                    {trendLoading ? (
                        <div className="h-32 flex items-center justify-center text-gray-500 text-sm">Loading trend...</div>
                    ) : trendValues.length > 0 ? (
                        <div className="flex flex-col items-center">
                            <SparkLine data={trendValues} width={700} height={140} color="#10b981" />
                            {compareValues.length > 0 && (
                                <div className="mt-[-140px]">
                                    <SparkLine data={compareValues} width={700} height={140} color="#6366f1" />
                                </div>
                            )}
                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-500 rounded"></span> {outlet?.name}</span>
                                {compareOutletId && <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 rounded"></span> {compareOutletName}</span>}
                            </div>
                            {trendData.length > 0 && (
                                <div className="flex justify-between w-full mt-1 text-[10px] text-gray-600 px-1">
                                    <span>{trendData[0]?.date}</span>
                                    <span>{trendData[trendData.length - 1]?.date}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm text-center py-8">No trend data available for this period</p>
                    )}
                </motion.div>

                {/* Service Mix */}
                <div className="grid grid-cols-2 gap-4">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                        className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4">Top Services (30d)</h3>
                        <BarChart data={service_mix} labelKey="name" valueKey="revenue" color="#8b5cf6" />
                    </motion.div>

                    {/* Staff Performance */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                        <h3 className="text-sm font-semibold text-gray-300 mb-4">Staff Performance</h3>
                        <BarChart data={staff_bookings} labelKey="name" valueKey="bookings" color="#06b6d4" />
                    </motion.div>
                </div>

                {/* Network Comparison */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                    className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4">vs Network Average</h3>
                    {comparison && (
                        <div className="space-y-4">
                            {[
                                { label: 'Revenue (30d)', outlet: `₹${(comparison.outlet_revenue_30d / 1000).toFixed(0)}K`, network: `₹${(comparison.network_avg_revenue_30d / 1000).toFixed(0)}K`, better: comparison.outlet_revenue_30d > comparison.network_avg_revenue_30d },
                                { label: 'Avg Rating', outlet: comparison.outlet_rating, network: comparison.network_avg_rating, better: comparison.outlet_rating >= comparison.network_avg_rating },
                                { label: 'NPS', outlet: comparison.outlet_nps, network: comparison.network_avg_nps, better: comparison.outlet_nps >= comparison.network_avg_nps },
                            ].map((row, i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <span className="text-sm text-gray-400 w-28">{row.label}</span>
                                    <div className="flex-1 flex items-center gap-3">
                                        <div className={`flex-1 text-center py-2 rounded-lg text-sm font-semibold ${row.better ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {row.outlet} <span className="text-[10px] opacity-60">(this outlet)</span>
                                        </div>
                                        <span className="text-gray-600 text-xs">vs</span>
                                        <div className="flex-1 text-center py-2 rounded-lg text-sm font-medium bg-gray-800 text-gray-300">
                                            {row.network} <span className="text-[10px] opacity-60">(network avg)</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Feedback Timeline */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                        <MessageSquare size={16} /> Recent Feedback ({feedback_timeline?.length || 0})
                    </h3>
                    <div className="grid grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                        {feedback_timeline?.map((fb, i) => <FeedbackCard key={fb.id || i} fb={fb} />)}
                        {(!feedback_timeline || feedback_timeline.length === 0) && (
                            <p className="text-gray-500 text-sm col-span-2 text-center py-8">No feedback yet</p>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

