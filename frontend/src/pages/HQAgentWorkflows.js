import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Bot, Plus, X, ToggleLeft, ToggleRight, Trash2,
    CheckCircle2, XCircle, Clock, Zap, Shield, Play, History,
    AlertTriangle, RefreshCw, ChevronRight
} from 'lucide-react';
import { api } from '../services/api';

const CONDITION_LABELS = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=' };
const ACTION_LABELS = {
    deploy_playbook: '📋 Deploy Playbook',
    create_alert: '🔔 Create Alert',
    set_goal: '🎯 Set KPI Goal',
    notify: '📧 Send Notification',
};
const STATUS_STYLES = {
    pending_approval: { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: Clock, label: 'Pending' },
    approved: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: CheckCircle2, label: 'Approved' },
    executed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: CheckCircle2, label: 'Executed' },
    rejected: { bg: 'bg-red-500/10', text: 'text-red-400', icon: XCircle, label: 'Rejected' },
};

export default function HQAgentWorkflows() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('rules');
    const [rules, setRules] = useState([]);
    const [queue, setQueue] = useState([]);
    const [log, setLog] = useState([]);
    const [availableMetrics, setAvailableMetrics] = useState([]);
    const [availableActions, setAvailableActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const [form, setForm] = useState({
        name: '', description: '',
        trigger: { metric: 'health_score', condition: 'lt', value: 50 },
        action: { type: 'create_alert', severity: 'high', message: '' },
        requires_approval: true, cooldown_hours: 24,
    });

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [rulesRes, queueRes, logRes] = await Promise.all([
                api.getAgentRules(),
                api.getApprovalQueue(),
                api.getAgentLog(),
            ]);
            setRules(rulesRes.data.rules || []);
            setAvailableMetrics(rulesRes.data.available_metrics || []);
            setAvailableActions(rulesRes.data.available_actions || []);
            setQueue(queueRes.data.queue || []);
            setLog(logRes.data.executions || []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleCreate = async () => {
        if (!form.name) return;
        try {
            await api.createAgentRule(form);
            setShowCreate(false);
            await loadData();
        } catch (err) { console.error(err); }
    };

    const handleToggle = async (rule) => {
        try {
            await api.updateAgentRule(rule.id, { enabled: !rule.enabled });
            setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id) => {
        try { await api.deleteAgentRule(id); setRules(prev => prev.filter(r => r.id !== id)); }
        catch (err) { console.error(err); }
    };

    const handleApprove = async (id) => {
        try { await api.approveExecution(id); await loadData(); }
        catch (err) { console.error(err); }
    };

    const handleReject = async (id) => {
        try { await api.rejectExecution(id); await loadData(); }
        catch (err) { console.error(err); }
    };

    const handleEvaluate = async () => {
        setEvaluating(true);
        try { await api.evaluateAgentRules(); await loadData(); }
        catch (err) { console.error(err); }
        finally { setEvaluating(false); }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="animate-pulse text-gray-400 text-lg">Loading workflows...</div>
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
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                            <Bot size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">Agentic Workflows</h1>
                            <p className="text-xs text-gray-500">Automation rules with human-in-the-loop</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleEvaluate} disabled={evaluating}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                            <Play size={14} className={evaluating ? 'animate-pulse' : ''} /> Run Evaluation
                        </button>
                        <button onClick={() => setShowCreate(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-semibold hover:opacity-90 transition-opacity">
                            <Plus size={14} /> New Rule
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="max-w-7xl mx-auto px-6 flex gap-1">
                    {[
                        { id: 'rules', label: 'Rules', icon: Zap, count: rules.length },
                        { id: 'queue', label: 'Approval Queue', icon: Shield, count: queue.length },
                        { id: 'log', label: 'Execution Log', icon: History, count: log.length },
                    ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-colors ${tab === t.id ? 'bg-gray-900 text-white border-t border-x border-gray-800' : 'text-gray-500 hover:text-gray-300'}`}>
                            <t.icon size={14} /> {t.label}
                            {t.count > 0 && <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab === t.id ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-800 text-gray-500'}`}>{t.count}</span>}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
                {/* Rules Tab */}
                {tab === 'rules' && (
                    rules.length === 0 ? (
                        <div className="text-center py-20">
                            <Bot size={48} className="mx-auto text-gray-700 mb-4" />
                            <p className="text-gray-400 font-medium">No automation rules defined</p>
                            <p className="text-gray-600 text-sm mt-1">Create rules to auto-detect issues and take action</p>
                        </div>
                    ) : rules.map((rule, idx) => (
                        <motion.div key={rule.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`border rounded-xl p-5 group ${rule.enabled ? 'bg-gray-900/80 border-gray-800/60' : 'bg-gray-900/40 border-gray-800/30 opacity-60'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleToggle(rule)}>
                                        {rule.enabled ? <ToggleRight size={28} className="text-emerald-400" /> : <ToggleLeft size={28} className="text-gray-600" />}
                                    </button>
                                    <div>
                                        <h3 className="text-sm font-bold text-gray-200">{rule.name}</h3>
                                        {rule.description && <p className="text-xs text-gray-500">{rule.description}</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs">
                                <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5 text-blue-400">
                                    <AlertTriangle size={12} />
                                    When <strong>{rule.trigger?.metric}</strong> {CONDITION_LABELS[rule.trigger?.condition] || '?'} {rule.trigger?.value}
                                </div>
                                <ChevronRight size={14} className="text-gray-600" />
                                <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-1.5 text-orange-400">
                                    {ACTION_LABELS[rule.action?.type] || rule.action?.type}
                                </div>
                                {rule.requires_approval && (
                                    <span className="flex items-center gap-1 text-amber-400 text-[10px]"><Shield size={10} /> Requires approval</span>
                                )}
                            </div>

                            <div className="mt-3 flex items-center gap-4 text-[10px] text-gray-600">
                                <span>Cooldown: {rule.cooldown_hours}h</span>
                                <span>Triggered: {rule.execution_count}x</span>
                                {rule.last_triggered_at && <span>Last: {new Date(rule.last_triggered_at).toLocaleDateString()}</span>}
                            </div>
                        </motion.div>
                    ))
                )}

                {/* Approval Queue Tab */}
                {tab === 'queue' && (
                    queue.length === 0 ? (
                        <div className="text-center py-20">
                            <Shield size={48} className="mx-auto text-gray-700 mb-4" />
                            <p className="text-gray-400 font-medium">No pending approvals</p>
                            <p className="text-gray-600 text-sm mt-1">Triggered rules requiring approval will appear here</p>
                        </div>
                    ) : queue.map((exe, idx) => (
                        <motion.div key={exe.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-amber-400">{exe.rule_name}</h3>
                                    <p className="text-xs text-gray-500">Outlet: {exe.outlet_name} · {new Date(exe.created_at).toLocaleString()}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleApprove(exe.id)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-colors">
                                        <CheckCircle2 size={14} /> Approve
                                    </button>
                                    <button onClick={() => handleReject(exe.id)}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-colors">
                                        <XCircle size={14} /> Reject
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <div className="bg-gray-800/60 rounded-lg px-3 py-1.5 text-gray-300">
                                    Trigger: {exe.trigger_data?.metric} = {exe.trigger_data?.value?.toFixed?.(1)} ({exe.trigger_data?.condition} {exe.trigger_data?.threshold})
                                </div>
                                <div className="bg-gray-800/60 rounded-lg px-3 py-1.5 text-gray-300">
                                    Action: {ACTION_LABELS[exe.action_data?.type] || exe.action_data?.type}
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}

                {/* Execution Log Tab */}
                {tab === 'log' && (
                    log.length === 0 ? (
                        <div className="text-center py-20">
                            <History size={48} className="mx-auto text-gray-700 mb-4" />
                            <p className="text-gray-400 font-medium">No executions yet</p>
                            <p className="text-gray-600 text-sm mt-1">Rule evaluation results will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {log.map((exe, idx) => {
                                const st = STATUS_STYLES[exe.status] || STATUS_STYLES.pending_approval;
                                return (
                                    <motion.div key={exe.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="flex items-center gap-4 bg-gray-900/60 border border-gray-800/40 rounded-xl px-4 py-3">
                                        <div className={`p-1.5 rounded-lg ${st.bg}`}>
                                            <st.icon size={14} className={st.text} />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-medium text-gray-200">{exe.rule_name}</p>
                                            <p className="text-[10px] text-gray-500">{exe.outlet_name} · {new Date(exe.created_at).toLocaleString()}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${st.bg} ${st.text}`}>{st.label}</span>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )
                )}
            </div>

            {/* Create Rule Modal */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                        onClick={() => setShowCreate(false)}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                            className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold">New Automation Rule</h2>
                                <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-gray-800"><X size={18} className="text-gray-400" /></button>
                            </div>

                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Rule Name</label>
                                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="Auto-alert on low health score"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-orange-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="Trigger when any outlet drops below threshold"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-orange-500" />
                            </div>

                            {/* Trigger */}
                            <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">When (Trigger)</span>
                                <div className="grid grid-cols-3 gap-2">
                                    <select value={form.trigger.metric} onChange={e => setForm({ ...form, trigger: { ...form.trigger, metric: e.target.value } })}
                                        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500">
                                        {availableMetrics.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select value={form.trigger.condition} onChange={e => setForm({ ...form, trigger: { ...form.trigger, condition: e.target.value } })}
                                        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500">
                                        {Object.entries(CONDITION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                    <input type="number" value={form.trigger.value} onChange={e => setForm({ ...form, trigger: { ...form.trigger, value: +e.target.value } })}
                                        className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500" />
                                </div>
                            </div>

                            {/* Action */}
                            <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 space-y-3">
                                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Then (Action)</span>
                                <select value={form.action.type} onChange={e => setForm({ ...form, action: { ...form.action, type: e.target.value } })}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-orange-500">
                                    {availableActions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                                </select>
                                <input value={form.action.message || ''} onChange={e => setForm({ ...form, action: { ...form.action, message: e.target.value } })}
                                    placeholder="Action details / message"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-orange-500" />
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                                    <input type="checkbox" checked={form.requires_approval}
                                        onChange={e => setForm({ ...form, requires_approval: e.target.checked })} className="rounded" />
                                    Require human approval
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Cooldown</span>
                                    <input type="number" value={form.cooldown_hours}
                                        onChange={e => setForm({ ...form, cooldown_hours: +e.target.value })}
                                        className="w-16 bg-gray-800 border border-gray-700 rounded-xl px-2 py-1 text-xs text-gray-200 focus:outline-none" />
                                    <span className="text-xs text-gray-500">hrs</span>
                                </div>
                            </div>

                            <button onClick={handleCreate}
                                disabled={!form.name}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                                Create Rule
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
