import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Gauge, Plus, RefreshCw, Trash2, X, Settings2,
    TrendingUp, DollarSign, BarChart3, Star, Users, Activity, AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';

const FORMULA_TYPES = [
    { id: 'ratio', label: 'Ratio (A ÷ B)', fields: ['numerator', 'denominator'] },
    { id: 'sum', label: 'Sum (A + B + ...)', fields: ['fields'] },
    { id: 'difference', label: 'Difference (A - B)', fields: ['field_a', 'field_b'] },
];

const STATUS_COLORS = {
    green: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
    yellow: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
    red: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
};

export default function HQCustomKPIs() {
    const navigate = useNavigate();
    const [kpis, setKpis] = useState([]);
    const [availableMetrics, setAvailableMetrics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [evaluating, setEvaluating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        name: '', description: '', formula_type: 'ratio',
        numerator: 'revenue_30d', denominator: 'staff_count',
        field_a: 'revenue_30d', field_b: 'utilization',
        fields: ['revenue_30d', 'utilization'],
        unit: '', thresholds: { green: 80, yellow: 50, red: 0 }, alert_enabled: false,
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await api.getKPIs();
            setKpis(res.data.kpis || []);
            setAvailableMetrics(res.data.available_metrics || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleEvaluate = async () => {
        setEvaluating(true);
        try { await api.evaluateKPIs(); await loadData(); }
        catch (err) { console.error(err); }
        finally { setEvaluating(false); }
    };

    const handleCreate = async () => {
        if (!form.name) return;
        let formula = { type: form.formula_type };
        if (form.formula_type === 'ratio') {
            formula.numerator = form.numerator;
            formula.denominator = form.denominator;
        } else if (form.formula_type === 'sum') {
            formula.fields = form.fields;
        } else if (form.formula_type === 'difference') {
            formula.field_a = form.field_a;
            formula.field_b = form.field_b;
        }
        try {
            await api.createKPI({
                name: form.name, description: form.description,
                formula, unit: form.unit, thresholds: form.thresholds,
                alert_enabled: form.alert_enabled,
            });
            setShowCreate(false);
            await api.evaluateKPIs();
            await loadData();
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        try { await api.deleteKPI(id); setKpis(prev => prev.filter(k => k.id !== id)); }
        catch (err) { console.error(err); }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="animate-pulse text-gray-400 text-lg">Loading KPIs...</div>
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
                            <Gauge size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">Custom KPI Builder</h1>
                            <p className="text-xs text-gray-500">Define composite metrics with thresholds</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleEvaluate} disabled={evaluating}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-semibold hover:bg-sky-500/20 transition-colors disabled:opacity-50">
                            <RefreshCw size={14} className={evaluating ? 'animate-spin' : ''} /> Evaluate All
                        </button>
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                            <Plus size={14} /> New KPI
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {kpis.length === 0 ? (
                    <div className="text-center py-20">
                        <Gauge size={48} className="mx-auto text-gray-700 mb-4" />
                        <p className="text-gray-400 font-medium">No custom KPIs defined yet</p>
                        <p className="text-gray-600 text-sm mt-1">Create your first composite metric to track across outlets</p>
                        <button onClick={() => setShowCreate(true)}
                            className="mt-4 px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-400 transition-colors">
                            Create KPI
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {kpis.map((kpi, idx) => {
                            const values = Object.entries(kpi.values || {});
                            return (
                                <motion.div key={kpi.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5 group">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                                                {kpi.name}
                                                {kpi.alert_enabled && <AlertTriangle size={12} className="text-amber-400" />}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-0.5">{kpi.description}</p>
                                        </div>
                                        <button onClick={() => handleDelete(kpi.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    {values.length > 0 ? (
                                        <div className="grid grid-cols-5 gap-2">
                                            {values.map(([oid, v]) => {
                                                const st = STATUS_COLORS[v.status] || STATUS_COLORS.green;
                                                return (
                                                    <div key={oid} className={`${st.bg} border ${st.border} rounded-xl p-3 text-center`}>
                                                        <div className={`text-lg font-bold ${st.text}`}>{v.value}{kpi.unit}</div>
                                                        <p className="text-[10px] text-gray-400 truncate mt-1">{v.outlet_name}</p>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${st.dot} inline-block mt-1`}></span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-600">Click "Evaluate All" to compute values</p>
                                    )}
                                    <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-600">
                                        <span>Formula: {kpi.formula?.type}</span>
                                        <span>Thresholds: 🟢 ≥{kpi.thresholds?.green} 🟡 ≥{kpi.thresholds?.yellow} 🔴 below</span>
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
                            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold">New Custom KPI</h2>
                                <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-gray-800"><X size={18} className="text-gray-400" /></button>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">KPI Name</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Revenue per Staff Hour"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500" />
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="How much revenue each staff generates"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500" />
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Formula Type</label>
                                <div className="flex gap-2">
                                    {FORMULA_TYPES.map(ft => (
                                        <button key={ft.id} onClick={() => setForm({ ...form, formula_type: ft.id })}
                                            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${form.formula_type === ft.id ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30' : 'bg-gray-800 text-gray-400 border border-transparent'}`}>
                                            {ft.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {form.formula_type === 'ratio' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Numerator</label>
                                        <select value={form.numerator} onChange={e => setForm({ ...form, numerator: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500">
                                            {availableMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Denominator</label>
                                        <select value={form.denominator} onChange={e => setForm({ ...form, denominator: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500">
                                            {availableMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            {form.formula_type === 'difference' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Field A</label>
                                        <select value={form.field_a} onChange={e => setForm({ ...form, field_a: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500">
                                            {availableMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-400 mb-1 block">Field B (subtracted)</label>
                                        <select value={form.field_b} onChange={e => setForm({ ...form, field_b: e.target.value })}
                                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500">
                                            {availableMetrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-3">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Unit</label>
                                    <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="₹/hr"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-emerald-400 mb-1 block">🟢 Green ≥</label>
                                    <input type="number" value={form.thresholds.green} onChange={e => setForm({ ...form, thresholds: { ...form.thresholds, green: +e.target.value } })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500" />
                                </div>
                                <div>
                                    <label className="text-xs text-amber-400 mb-1 block">🟡 Yellow ≥</label>
                                    <input type="number" value={form.thresholds.yellow} onChange={e => setForm({ ...form, thresholds: { ...form.thresholds, yellow: +e.target.value } })}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-teal-500" />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                                        <input type="checkbox" checked={form.alert_enabled} onChange={e => setForm({ ...form, alert_enabled: e.target.checked })}
                                            className="rounded" /> Alert
                                    </label>
                                </div>
                            </div>

                            <button onClick={handleCreate}
                                className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
                                Create KPI
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
