import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, AlertCircle, AlertTriangle, Info, Lightbulb,
    ArrowLeft, CheckCircle2, Eye, XCircle, Clock, Filter,
    ChevronRight, Store, Shield, MessageSquare, Users
} from 'lucide-react';
import { api } from '../services/api';

const SEVERITY_CONFIG = {
    critical: { color: 'bg-red-500/15 text-red-400 border-red-500/30', icon: AlertCircle, dot: 'bg-red-500', ring: 'ring-red-500/30' },
    high: { color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: AlertTriangle, dot: 'bg-orange-500', ring: 'ring-orange-500/30' },
    medium: { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Info, dot: 'bg-amber-500', ring: 'ring-amber-500/30' },
    low: { color: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: Lightbulb, dot: 'bg-blue-500', ring: 'ring-blue-500/30' },
};

const STATUS_STYLES = {
    open: 'bg-red-500/10 text-red-400',
    acknowledged: 'bg-amber-500/10 text-amber-400',
    resolved: 'bg-emerald-500/10 text-emerald-400',
    dismissed: 'bg-gray-500/10 text-gray-500',
};

const CATEGORY_ICONS = {
    Risk: Shield,
    Customer: Users,
    Ops: Store,
    People: Users,
    Revenue: Store,
};

// ═══════════ Alert Card ═══════════
const AlertCard = ({ alert, onAcknowledge, onResolve, onDismiss, onNavigateOutlet }) => {
    const [resolveModalOpen, setResolveModalOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
    const SevIcon = sev.icon;
    const CatIcon = CATEGORY_ICONS[alert.category] || Shield;

    const handleResolve = async () => {
        await onResolve(alert.id, notes);
        setResolveModalOpen(false);
        setNotes('');
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`bg-white/[0.03] border rounded-xl p-4 transition-all ${alert.status === 'open' ? 'border-white/[0.08]' : 'border-white/[0.04] opacity-70'}`}
        >
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sev.color} border`}>
                    <SevIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${sev.color}`}>
                            {alert.severity}
                        </span>
                        <span className="text-[10px] text-gray-600 flex items-center gap-1">
                            <CatIcon size={10} />
                            {alert.category}
                        </span>
                        <span className={`ml-auto text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-lg ${STATUS_STYLES[alert.status]}`}>
                            {alert.status}
                        </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1">{alert.title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed mb-2">{alert.message}</p>

                    <div className="flex items-center gap-2 text-[10px] text-gray-600 mb-3">
                        {alert.outlet_name && (
                            <button
                                onClick={() => onNavigateOutlet(alert.outlet_id)}
                                className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition-colors"
                            >
                                <Store size={10} />
                                {alert.outlet_name}
                            </button>
                        )}
                        <span className="text-gray-700">·</span>
                        <Clock size={10} />
                        <span>{alert.created_at ? new Date(alert.created_at).toLocaleString() : '—'}</span>
                    </div>

                    {alert.resolution_notes && (
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2 mb-3">
                            <div className="text-[10px] text-emerald-500 font-semibold mb-0.5">Resolution</div>
                            <p className="text-xs text-emerald-400">{alert.resolution_notes}</p>
                        </div>
                    )}

                    {/* Actions */}
                    {alert.status === 'open' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                            <button
                                onClick={() => onAcknowledge(alert.id)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                            >
                                <Eye size={12} />
                                Acknowledge
                            </button>
                            <button
                                onClick={() => setResolveModalOpen(true)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                            >
                                <CheckCircle2 size={12} />
                                Resolve
                            </button>
                            <button
                                onClick={() => onDismiss(alert.id)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-400 px-2 py-1 rounded-lg bg-gray-500/10 hover:bg-gray-500/20 transition-colors"
                            >
                                <XCircle size={12} />
                                Dismiss
                            </button>
                        </div>
                    )}
                    {alert.status === 'acknowledged' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.04]">
                            <button
                                onClick={() => setResolveModalOpen(true)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                            >
                                <CheckCircle2 size={12} />
                                Mark Resolved
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Resolve Modal Inline */}
            <AnimatePresence>
                {resolveModalOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-3 pt-3 border-t border-white/[0.06] overflow-hidden"
                    >
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Resolution notes (optional)..."
                            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 resize-none focus:border-emerald-500/40 outline-none"
                            rows={2}
                        />
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => setResolveModalOpen(false)} className="px-3 py-1.5 text-xs text-gray-400 border border-white/10 rounded-lg hover:bg-white/5">Cancel</button>
                            <button onClick={handleResolve} className="px-3 py-1.5 text-xs text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 font-semibold">Confirm Resolve</button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ═══════════ MAIN COMPONENT ═══════════
const HQAlerts = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [alerts, setAlerts] = useState([]);
    const [summary, setSummary] = useState({ total_open: 0, by_severity: {} });
    const [statusFilter, setStatusFilter] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('all');

    useEffect(() => { fetchData(); }, [statusFilter, severityFilter]);

    const fetchData = async () => {
        try {
            const params = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (severityFilter !== 'all') params.severity = severityFilter;

            const [alertRes, summaryRes] = await Promise.all([
                api.getAlerts(params),
                api.getAlertSummary(),
            ]);
            setAlerts(alertRes.data.alerts || []);
            setSummary(summaryRes.data || { total_open: 0, by_severity: {} });
        } catch (err) {
            console.error('Failed to load alerts', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAcknowledge = async (id) => {
        await api.acknowledgeAlert(id);
        await fetchData();
    };
    const handleResolve = async (id, notes) => {
        await api.resolveAlert(id, { notes });
        await fetchData();
    };
    const handleDismiss = async (id) => {
        await api.dismissAlert(id);
        await fetchData();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                    <Bell size={40} className="text-red-500" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0b0f] text-white">
            {/* Header */}
            <div className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-[1200px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate('/hq')} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center shadow-lg shadow-red-500/25">
                                <Bell size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">Alert Center</h1>
                                <p className="text-xs text-gray-500">Monitor and resolve network alerts</p>
                            </div>
                        </div>
                        {/* Summary badges */}
                        <div className="flex items-center gap-3">
                            {summary.by_severity && Object.entries(summary.by_severity).map(([sev, count]) => {
                                const cfg = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.medium;
                                return (
                                    <div key={sev} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${cfg.color}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                        {count} {sev}
                                    </div>
                                );
                            })}
                            <div className="text-xs text-gray-500 font-mono ml-2">
                                {summary.total_open} open
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1200px] mx-auto px-6 py-6 space-y-5">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
                        {['all', 'open', 'acknowledged', 'resolved', 'dismissed'].map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${statusFilter === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5">
                        {['all', 'critical', 'high', 'medium', 'low'].map(s => (
                            <button
                                key={s}
                                onClick={() => setSeverityFilter(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${severityFilter === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Alert List */}
                <div className="space-y-3">
                    {alerts.length === 0 ? (
                        <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                            <CheckCircle2 size={40} className="mx-auto text-emerald-500/50 mb-3" />
                            <h3 className="text-sm font-semibold text-gray-400">No alerts match your filters</h3>
                            <p className="text-xs text-gray-600 mt-1">All clear! 🎉</p>
                        </div>
                    ) : (
                        alerts.map(alert => (
                            <AlertCard
                                key={alert.id}
                                alert={alert}
                                onAcknowledge={handleAcknowledge}
                                onResolve={handleResolve}
                                onDismiss={handleDismiss}
                                onNavigateOutlet={(id) => navigate(`/hq/outlet/${id}`)}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default HQAlerts;
