import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, FlaskConical, Plus, RefreshCw, X, Play, Square,
    TrendingUp, TrendingDown, ChevronRight, Clock, CheckCircle2, AlertCircle, BarChart3
} from 'lucide-react';
import { api } from '../services/api';

const METRICS = [
    { id: 'revenue_30d', label: 'Revenue (30d)' },
    { id: 'nps', label: 'NPS' },
    { id: 'utilization', label: 'Utilization %' },
    { id: 'bookings_30d', label: 'Bookings' },
    { id: 'avg_rating', label: 'Avg Rating' },
    { id: 'churn_rate', label: 'Churn Rate' },
];

const RESULT_BADGE = {
    pending: { bg: 'bg-gray-700', text: 'text-gray-300', label: 'Pending' },
    winner_test: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Test Wins' },
    winner_control: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Control Wins' },
    likely_test: { bg: 'bg-emerald-500/10', text: 'text-emerald-300', label: 'Likely Test' },
    likely_control: { bg: 'bg-red-500/10', text: 'text-red-300', label: 'Likely Control' },
    inconclusive: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Inconclusive' },
};

export default function HQExperiments() {
    const navigate = useNavigate();
    const [experiments, setExperiments] = useState([]);
    const [outlets, setOutlets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        name: '', playbook_id: '', playbook_name: '', metric: 'revenue_30d',
        test_outlet_ids: [], control_outlet_ids: [], min_duration_days: 14,
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [expRes, outRes] = await Promise.all([
                api.getExperiments(),
                api.getOutlets(),
            ]);
            setExperiments(expRes.data.experiments || []);
            setOutlets(outRes.data.outlets || outRes.data || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleCreate = async () => {
        if (!form.name || form.test_outlet_ids.length === 0 || form.control_outlet_ids.length === 0) return;
        try {
            await api.createExperiment({
                ...form,
                playbook_id: form.playbook_id || 'custom',
                playbook_name: form.playbook_name || form.name,
            });
            setShowCreate(false);
            await loadData();
        } catch (err) { console.error(err); }
    };

    const handleMeasure = async (id) => {
        try { await api.measureExperiment(id); await loadData(); }
        catch (err) { console.error(err); }
    };

    const handleConclude = async (id) => {
        try { await api.concludeExperiment(id); await loadData(); }
        catch (err) { console.error(err); }
    };

    const toggleOutlet = (list, setList, id) => {
        setForm(prev => ({
            ...prev,
            [list]: prev[list].includes(id) ? prev[list].filter(x => x !== id) : [...prev[list], id],
        }));
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="animate-pulse text-gray-400 text-lg">Loading experiments...</div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-lg border-b border-gray-800/60">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/hq')} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
                            <ArrowLeft size={20} className="text-gray-400" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                            <FlaskConical size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">A/B Experiments</h1>
                            <p className="text-xs text-gray-500">Test playbook effectiveness with control groups</p>
                        </div>
                    </div>
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                        <Plus size={14} /> New Experiment
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
                {experiments.length === 0 ? (
                    <div className="text-center py-20">
                        <FlaskConical size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-400 font-medium">No experiments yet</p>
                        <p className="text-gray-600 text-sm mt-1">Run A/B tests to validate playbook impact</p>
                    </div>
                ) : (
                    experiments.map((exp, idx) => {
                        const rb = RESULT_BADGE[exp.result] || RESULT_BADGE.pending;
                        const isRunning = exp.status === 'running';
                        return (
                            <motion.div key={exp.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                            {isRunning && <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />}
                                            {exp.name}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                                            <span>Playbook: {exp.playbook_name}</span>
                                            <span>·</span>
                                            <span>Metric: {exp.metric}</span>
                                            <span>·</span>
                                            <Clock size={10} /> {exp.days_running}d running
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${rb.bg} ${rb.text}`}>{rb.label}</span>
                                        {isRunning && (
                                            <>
                                                <button onClick={() => handleMeasure(exp.id)}
                                                    className="p-1.5 rounded-lg hover:bg-sky-500/20 text-sky-400 transition-colors" title="Measure">
                                                    <RefreshCw size={14} />
                                                </button>
                                                <button onClick={() => handleConclude(exp.id)}
                                                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Conclude">
                                                    <Square size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Comparison bars */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4">
                                        <div className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider mb-2">Test Group ({(exp.test_outlet_ids || []).length} outlets)</div>
                                        <div className="flex items-end gap-3">
                                            <div>
                                                <span className="text-xs text-gray-500">Baseline</span>
                                                <p className="text-lg font-bold text-gray-300">{exp.baseline_test?.avg?.toFixed?.(1) || 0}</p>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-600 mb-2" />
                                            <div>
                                                <span className="text-xs text-gray-500">Current</span>
                                                <p className="text-lg font-bold text-violet-400">{exp.current_test?.avg?.toFixed?.(1) || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-800/50 border border-gray-700/40 rounded-xl p-4">
                                        <div className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-2">Control Group ({(exp.control_outlet_ids || []).length} outlets)</div>
                                        <div className="flex items-end gap-3">
                                            <div>
                                                <span className="text-xs text-gray-500">Baseline</span>
                                                <p className="text-lg font-bold text-gray-300">{exp.baseline_control?.avg?.toFixed?.(1) || 0}</p>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-600 mb-2" />
                                            <div>
                                                <span className="text-xs text-gray-500">Current</span>
                                                <p className="text-lg font-bold text-gray-300">{exp.current_control?.avg?.toFixed?.(1) || 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Metrics row */}
                                <div className="mt-3 flex items-center gap-6 text-xs">
                                    <div className="flex items-center gap-1.5">
                                        <BarChart3 size={12} className="text-gray-500" />
                                        <span className="text-gray-400">Lift:</span>
                                        <span className={`font-bold ${(exp.lift_pct || 0) > 0 ? 'text-emerald-400' : (exp.lift_pct || 0) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                            {exp.lift_pct !== null ? `${exp.lift_pct > 0 ? '+' : ''}${exp.lift_pct}%` : '—'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-gray-400">Significance:</span>
                                        <span className={`font-bold ${(exp.significance || 0) > 0.95 ? 'text-emerald-400' : (exp.significance || 0) > 0.8 ? 'text-amber-400' : 'text-gray-400'}`}>
                                            {exp.significance !== null ? `${(exp.significance * 100).toFixed(1)}%` : '—'}
                                        </span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>

            {/* Create Modal */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold">New A/B Experiment</h2>
                                <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-gray-800"><X size={18} className="text-gray-400" /></button>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Experiment Name</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Test upselling playbook"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500" />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Metric to Track</label>
                                    <select value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500">
                                        {METRICS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Min Duration (days)</label>
                                    <input type="number" value={form.min_duration_days} onChange={e => setForm({ ...form, min_duration_days: +e.target.value })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-violet-500" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-violet-400 mb-2 block font-semibold">Test Group (receives treatment)</label>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                    {outlets.map(o => (
                                        <button key={o.id} onClick={() => toggleOutlet('test_outlet_ids', null, o.id)}
                                            disabled={form.control_outlet_ids.includes(o.id)}
                                            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${form.test_outlet_ids.includes(o.id)
                                                ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                                : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'} disabled:opacity-30`}>
                                            {o.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 mb-2 block font-semibold">Control Group (no treatment)</label>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                    {outlets.map(o => (
                                        <button key={o.id} onClick={() => toggleOutlet('control_outlet_ids', null, o.id)}
                                            disabled={form.test_outlet_ids.includes(o.id)}
                                            className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${form.control_outlet_ids.includes(o.id)
                                                ? 'bg-gray-600/40 text-gray-300 border border-gray-500/30'
                                                : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'} disabled:opacity-30`}>
                                            {o.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button onClick={handleCreate}
                                disabled={!form.name || form.test_outlet_ids.length === 0 || form.control_outlet_ids.length === 0}
                                className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                                Start Experiment
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
