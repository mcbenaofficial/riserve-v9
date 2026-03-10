import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Sun, TrendingUp, TrendingDown, Minus, Calendar, DollarSign,
    Star, AlertTriangle, ArrowRight, Target, BarChart3, Clock,
    CheckCircle2, ArrowLeft, Zap, ChevronRight, Settings, X, Bell, Mail, ToggleLeft, ToggleRight
} from 'lucide-react';
import { api } from '../services/api';

const DeltaBadge = ({ value, suffix = '%' }) => {
    if (value === 0 || value === null || value === undefined) {
        return <span className="inline-flex items-center gap-1 text-xs text-gray-400"><Minus size={12} /> flat</span>;
    }
    const positive = value > 0;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${positive ? 'text-green-400' : 'text-red-400'}`}>
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {positive ? '+' : ''}{value.toFixed(1)}{suffix}
        </span>
    );
};

const formatCurrency = (val) => {
    if (!val && val !== 0) return '₹0';
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val.toFixed(0)}`;
};

export default function HQBriefing() {
    const navigate = useNavigate();
    const [briefing, setBriefing] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showSchedule, setShowSchedule] = useState(false);
    const [schedule, setSchedule] = useState({ frequency: 'daily', delivery_time: '08:00', channels: { in_app: true, email: false }, enabled: false });
    const [savingSchedule, setSavingSchedule] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const [bRes, sRes] = await Promise.all([
                    api.getBriefing(),
                    api.getBriefingSchedule(),
                ]);
                setBriefing(bRes.data);
                setSchedule(sRes.data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const saveSchedule = async () => {
        setSavingSchedule(true);
        try {
            await api.updateBriefingSchedule({
                frequency: schedule.frequency,
                delivery_time: schedule.delivery_time,
                channels: schedule.channels,
                enabled: schedule.enabled,
            });
            setShowSchedule(false);
        } catch (err) { console.error(err); }
        finally { setSavingSchedule(false); }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="animate-pulse text-gray-400 text-lg flex items-center gap-3">
                <Sun className="animate-spin" size={20} /> Generating your briefing...
            </div>
        </div>
    );

    if (error || !briefing) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <div className="text-red-400">{error || 'Failed to generate briefing'}</div>
        </div>
    );

    const { summary, alerts, action_items, forecast, briefing_date } = briefing;
    const dayName = forecast?.day_of_week || 'Today';
    const vsLW = summary?.vs_last_week || {};

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-950/50 via-purple-950/30 to-gray-950 border-b border-gray-800/60">
                <div className="max-w-5xl mx-auto px-6 py-8">
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={() => navigate('/hq')} className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors">
                            <ArrowLeft size={20} className="text-gray-400" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/10">
                                    <Sun size={24} className="text-amber-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-white">Morning Briefing</h1>
                                    <p className="text-sm text-gray-400">
                                        {briefing_date ? new Date(briefing_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Yesterday'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowSchedule(!showSchedule)}
                                className={`p-2.5 rounded-xl transition-colors ${showSchedule ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-gray-800/50 text-gray-400'}`}
                                title="Schedule Settings">
                                <Settings size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        {[
                            { label: 'Bookings', value: summary?.yesterday_bookings, delta: vsLW.bookings_change, icon: Calendar, color: 'from-blue-500/20 to-blue-600/10', iconColor: 'text-blue-400' },
                            { label: 'Revenue', value: formatCurrency(summary?.yesterday_revenue), delta: vsLW.revenue_change, icon: DollarSign, color: 'from-green-500/20 to-green-600/10', iconColor: 'text-green-400' },
                            { label: 'Avg Rating', value: summary?.yesterday_avg_rating ? `${summary.yesterday_avg_rating}/5` : 'N/A', delta: null, icon: Star, color: 'from-yellow-500/20 to-amber-600/10', iconColor: 'text-yellow-400' },
                            { label: `Forecast (${dayName})`, value: `~${forecast?.expected_bookings_today || 0} bookings`, delta: null, icon: Target, color: 'from-purple-500/20 to-indigo-600/10', iconColor: 'text-purple-400', subtitle: 'Based on 4-week avg' },
                        ].map((card, i) => (
                            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                className={`bg-gradient-to-br ${card.color} border border-gray-700/40 rounded-xl p-5`}>
                                <div className="flex items-center justify-between mb-3">
                                    <card.icon size={18} className={card.iconColor} />
                                    {card.delta !== null && card.delta !== undefined && <DeltaBadge value={card.delta} />}
                                </div>
                                <div className="text-2xl font-bold text-white">{card.value}</div>
                                <div className="text-xs text-gray-400 mt-1">{card.subtitle || card.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
                {/* Action Items */}
                {action_items?.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        className="bg-gradient-to-r from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-5">
                        <h2 className="text-sm font-semibold text-amber-400 mb-4 flex items-center gap-2">
                            <Zap size={16} /> Recommended Actions
                        </h2>
                        <div className="space-y-3">
                            {action_items.map((item, i) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.4 + i * 0.1 }}
                                    className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3 hover:bg-gray-900/80 cursor-pointer transition-colors group"
                                    onClick={() => item.outlet_id && navigate(`/hq/outlet/${item.outlet_id}`)}>
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.priority === 'high' ? 'bg-red-400' : 'bg-blue-400'}`} />
                                    <span className="text-sm text-gray-200 flex-1">{item.action}</span>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-300 transition-colors" />
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Top Movers / Alerts */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                        <BarChart3 size={16} /> Biggest Movers (vs Same Day Last Week)
                    </h2>
                    <div className="space-y-2">
                        {alerts?.map((alert, i) => {
                            const isUp = alert.direction === 'up';
                            const isDown = alert.direction === 'down';
                            return (
                                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    transition={{ delay: 0.55 + i * 0.06 }}
                                    className="flex items-center gap-4 bg-gray-800/40 rounded-lg p-3 hover:bg-gray-800/70 cursor-pointer transition-colors group"
                                    onClick={() => navigate(`/hq/outlet/${alert.outlet_id}`)}>
                                    <div className={`p-1.5 rounded-lg ${isUp ? 'bg-green-500/10' : isDown ? 'bg-red-500/10' : 'bg-gray-700/50'}`}>
                                        {isUp ? <TrendingUp size={16} className="text-green-400" /> : isDown ? <TrendingDown size={16} className="text-red-400" /> : <Minus size={16} className="text-gray-400" />}
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-gray-200">{alert.outlet_name}</span>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-gray-300">{formatCurrency(alert.yesterday_revenue)}</div>
                                        <div className="text-xs text-gray-500">vs {formatCurrency(alert.last_week_revenue)}</div>
                                    </div>
                                    <div className={`text-sm font-semibold w-16 text-right ${isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-gray-400'}`}>
                                        {alert.change_pct > 0 ? '+' : ''}{alert.change_pct}%
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-gray-300 transition-colors" />
                                </motion.div>
                            );
                        })}
                        {(!alerts || alerts.length === 0) && (
                            <p className="text-gray-500 text-sm text-center py-6">No significant movers yesterday</p>
                        )}
                    </div>
                </motion.div>

                {/* Last Week Comparison */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                    className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-5">
                    <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                        <Clock size={16} /> Week-over-Week Comparison
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-800/40 rounded-lg p-4">
                            <span className="text-xs text-gray-400">Yesterday's Bookings</span>
                            <div className="text-lg font-bold text-white mt-1">{summary?.yesterday_bookings}</div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">Same day last week: {vsLW.lw_bookings}</span>
                                <DeltaBadge value={vsLW.bookings_change} />
                            </div>
                        </div>
                        <div className="bg-gray-800/40 rounded-lg p-4">
                            <span className="text-xs text-gray-400">Yesterday's Revenue</span>
                            <div className="text-lg font-bold text-white mt-1">{formatCurrency(summary?.yesterday_revenue)}</div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-gray-500">Same day last week: {formatCurrency(vsLW.lw_revenue)}</span>
                                <DeltaBadge value={vsLW.revenue_change} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Schedule Settings Panel */}
            {showSchedule && (
                <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }}
                    className="fixed top-0 right-0 h-full w-96 bg-gray-900 border-l border-gray-800 z-50 shadow-2xl">
                    <div className="p-6 space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold flex items-center gap-2"><Settings size={18} /> Briefing Schedule</h2>
                            <button onClick={() => setShowSchedule(false)} className="p-1 rounded-lg hover:bg-gray-800"><X size={18} className="text-gray-400" /></button>
                        </div>

                        {/* Enable toggle */}
                        <div className="flex items-center justify-between bg-gray-800/50 rounded-xl p-4">
                            <div>
                                <p className="text-sm font-semibold text-gray-200">Automated Briefings</p>
                                <p className="text-xs text-gray-500 mt-1">Receive scheduled briefings automatically</p>
                            </div>
                            <button onClick={() => setSchedule(s => ({ ...s, enabled: !s.enabled }))} className="text-2xl">
                                {schedule.enabled ? <ToggleRight size={36} className="text-emerald-400" /> : <ToggleLeft size={36} className="text-gray-600" />}
                            </button>
                        </div>

                        {/* Frequency */}
                        <div>
                            <label className="text-xs text-gray-400 mb-2 block font-semibold uppercase tracking-wider">Frequency</label>
                            <div className="flex gap-2">
                                {['daily', 'weekly'].map(f => (
                                    <button key={f} onClick={() => setSchedule(s => ({ ...s, frequency: f }))}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${schedule.frequency === f ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'}`}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Delivery time */}
                        <div>
                            <label className="text-xs text-gray-400 mb-2 block font-semibold uppercase tracking-wider">Delivery Time</label>
                            <input type="time" value={schedule.delivery_time} onChange={e => setSchedule(s => ({ ...s, delivery_time: e.target.value }))}
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-indigo-500" />
                        </div>

                        {/* Channels */}
                        <div>
                            <label className="text-xs text-gray-400 mb-2 block font-semibold uppercase tracking-wider">Channels</label>
                            <div className="space-y-2">
                                <button onClick={() => setSchedule(s => ({ ...s, channels: { ...s.channels, in_app: !s.channels.in_app } }))}
                                    className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${schedule.channels?.in_app ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'}`}>
                                    <Bell size={16} /> In-App Notification
                                    {schedule.channels?.in_app && <CheckCircle2 size={14} className="ml-auto" />}
                                </button>
                                <button onClick={() => setSchedule(s => ({ ...s, channels: { ...s.channels, email: !s.channels.email } }))}
                                    className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${schedule.channels?.email ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-gray-800 text-gray-400 border border-transparent hover:bg-gray-700'}`}>
                                    <Mail size={16} /> Email
                                    {schedule.channels?.email && <CheckCircle2 size={14} className="ml-auto" />}
                                </button>
                            </div>
                        </div>

                        <button onClick={saveSchedule} disabled={savingSchedule}
                            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                            {savingSchedule ? 'Saving...' : 'Save Schedule'}
                        </button>
                    </div>
                </motion.div>
            )}
        </div>
    );
}
