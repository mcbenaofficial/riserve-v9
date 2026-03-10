import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Target, Plus, RefreshCw, Trash2, TrendingUp, TrendingDown,
    ChevronDown, X, Calendar, BarChart3, Star, Users, DollarSign, Zap
} from 'lucide-react';
import { api } from '../services/api';

const METRICS = [
    { id: 'revenue', label: 'Revenue (30d)', icon: DollarSign, unit: '₹', color: 'emerald' },
    { id: 'utilization', label: 'Utilization %', icon: BarChart3, unit: '%', color: 'blue' },
    { id: 'nps', label: 'NPS Score', icon: Target, unit: '', color: 'purple' },
    { id: 'rating', label: 'Avg Rating', icon: Star, unit: '/5', color: 'amber' },
    { id: 'churn_rate', label: 'Churn Rate', icon: Users, unit: '%', color: 'red' },
];

const STATUS_STYLES = {
    exceeded: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Exceeded' },
    on_track: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-400', label: 'On Track' },
    at_risk: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', label: 'At Risk' },
    behind: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', label: 'Behind' },
};

const RadialProgress = ({ pct, size = 80, color = '#10b981' }) => {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ - (Math.min(pct, 100) / 100) * circ;
    return (
        <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1f2937" strokeWidth="6" />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6"
                strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
                className="fill-white text-sm font-bold" style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
                {Math.round(pct)}%
            </text>
        </svg>
    );
};

export default function HQGoals() {
    const navigate = useNavigate();
    const [goals, setGoals] = useState([]);
    const [outlets, setOutlets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [filter, setFilter] = useState('all');
    const [form, setForm] = useState({
        outlet_id: '', metric: 'revenue', target_value: '', period: 'monthly', deadline: ''
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [goalsRes, healthRes] = await Promise.all([
                api.getGoals(),
                api.getNetworkHealth(),
            ]);
            setGoals(goalsRes.data.goals || []);
            setOutlets(healthRes.data.outlets || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await api.refreshGoals();
            await loadData();
        } catch (err) { console.error(err); }
        finally { setRefreshing(false); }
    };

    const handleCreate = async () => {
        if (!form.outlet_id || !form.target_value) return;
        try {
            await api.createGoal({
                outlet_id: form.outlet_id,
                metric: form.metric,
                target_value: parseFloat(form.target_value),
                period: form.period,
                deadline: form.deadline || null,
            });
            setShowCreate(false);
            setForm({ outlet_id: '', metric: 'revenue', target_value: '', period: 'monthly', deadline: '' });
            await loadData();
            await api.refreshGoals();
            await loadData();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        try {
            await api.deleteGoal(id);
            setGoals(prev => prev.filter(g => g.id !== id));
        } catch (err) { console.error(err); }
    };

    const filtered = filter === 'all' ? goals : goals.filter(g => g.status === filter);

    const summary = {
        total: goals.length,
        exceeded: goals.filter(g => g.status === 'exceeded').length,
        on_track: goals.filter(g => g.status === 'on_track').length,
        at_risk: goals.filter(g => g.status === 'at_risk').length,
        behind: goals.filter(g => g.status === 'behind').length,
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="animate-pulse text-gray-400 text-lg">Loading goals...</div>
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/25">
                            <Target size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">Goal Tracker</h1>
                            <p className="text-xs text-gray-500">Set and track KPI targets per outlet</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} disabled={refreshing}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold hover:bg-sky-500/20 transition-colors disabled:opacity-50">
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                            <Plus size={14} /> New Goal
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Summary strip */}
                <div className="grid grid-cols-5 gap-3">
                    {[
                        { label: 'Total Goals', val: summary.total, color: 'text-gray-300' },
                        { label: 'Exceeded', val: summary.exceeded, color: 'text-emerald-400' },
                        { label: 'On Track', val: summary.on_track, color: 'text-sky-400' },
                        { label: 'At Risk', val: summary.at_risk, color: 'text-amber-400' },
                        { label: 'Behind', val: summary.behind, color: 'text-red-400' },
                    ].map((s, i) => (
                        <div key={i} className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-4 text-center">
                            <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex gap-2">
                    {['all', 'exceeded', 'on_track', 'at_risk', 'behind'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === f ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                            {f === 'all' ? 'All' : STATUS_STYLES[f]?.label || f}
                        </button>
                    ))}
                </div>

                {/* Goals grid */}
                {filtered.length === 0 ? (
                    <div className="text-center py-20">
                        <Target size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-400 font-medium">No goals yet</p>
                        <p className="text-gray-600 text-sm mt-1">Create your first KPI target to get started</p>
                        <button onClick={() => setShowCreate(true)}
                            className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-400 transition-colors">
                            Create Goal
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4">
                        {filtered.map((goal, i) => {
                            const st = STATUS_STYLES[goal.status] || STATUS_STYLES.on_track;
                            const metricInfo = METRICS.find(m => m.id === goal.metric) || METRICS[0];
                            const colorMap = {
                                emerald: '#10b981', blue: '#3b82f6', purple: '#8b5cf6',
                                amber: '#f59e0b', red: '#ef4444'
                            };
                            return (
                                <motion.div key={goal.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={`${st.bg} border ${st.border} rounded-xl p-5 relative group`}>
                                    <button onClick={() => handleDelete(goal.id)}
                                        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-all">
                                        <Trash2 size={14} />
                                    </button>
                                    <div className="flex items-start gap-4">
                                        <RadialProgress pct={goal.progress_pct || 0} color={colorMap[metricInfo.color]} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <metricInfo.icon size={14} className={st.text} />
                                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{metricInfo.label}</span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-200 truncate">{goal.outlet_name}</p>
                                            <div className="mt-2 space-y-1">
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">Current</span>
                                                    <span className="text-gray-300 font-semibold">
                                                        {goal.current_value != null ? `${metricInfo.unit === '₹' ? '₹' : ''}${metricInfo.unit === '₹' ? (goal.current_value / 100000).toFixed(1) + 'L' : goal.current_value.toFixed(1)}${metricInfo.unit !== '₹' ? metricInfo.unit : ''}` : '—'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between text-xs">
                                                    <span className="text-gray-500">Target</span>
                                                    <span className="text-white font-bold">
                                                        {metricInfo.unit === '₹' ? `₹${(goal.target_value / 100000).toFixed(1)}L` : `${goal.target_value}${metricInfo.unit}`}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 mt-3">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${st.bg} ${st.text} border ${st.border}`}>
                                                    {st.label}
                                                </span>
                                                <span className="text-[10px] text-gray-600">{goal.period}</span>
                                                {goal.deadline && (
                                                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        <Calendar size={9} /> {goal.deadline}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md space-y-5"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold">New Goal</h2>
                                <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-gray-800"><X size={18} className="text-gray-400" /></button>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Outlet</label>
                                <select value={form.outlet_id} onChange={e => setForm({ ...form, outlet_id: e.target.value })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500">
                                    <option value="">Select outlet...</option>
                                    {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>)}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Metric</label>
                                    <select value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500">
                                        {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Period</label>
                                    <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500">
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Target Value</label>
                                    <input type="number" value={form.target_value} onChange={e => setForm({ ...form, target_value: e.target.value })}
                                        placeholder={form.metric === 'revenue' ? '500000' : '80'}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Deadline (optional)</label>
                                    <input type="date" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-amber-500" />
                                </div>
                            </div>

                            <button onClick={handleCreate}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
                                Create Goal
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
