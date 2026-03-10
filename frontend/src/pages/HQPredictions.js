import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ArrowLeft, Brain, Users, AlertTriangle, TrendingUp, TrendingDown,
    RefreshCw, BarChart3, Calendar, ShieldAlert, UserMinus, Activity,
    ChevronDown, Clock, Zap
} from 'lucide-react';
import { api } from '../services/api';

const RISK_STYLES = {
    critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', bar: 'bg-red-500' },
    high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', bar: 'bg-orange-500' },
    medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', bar: 'bg-amber-500' },
    low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400', bar: 'bg-green-500' },
};

const SparkLine = ({ data, width = 300, height = 100, color = '#10b981', secondaryData, secondaryColor = '#6366f1' }) => {
    if (!data?.length) return null;
    const allVals = [...data.map(d => d.value), ...(secondaryData || []).map(d => d.value)].filter(v => v != null);
    const max = Math.max(...allVals) || 1;
    const min = Math.min(...allVals);
    const range = max - min || 1;

    const toPoints = (arr) => arr.map((d, i) => {
        const x = (i / (arr.length - 1 || 1)) * width;
        const y = height - ((d.value - min) / range) * (height - 8);
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible">
            <polyline fill="none" stroke={color} strokeWidth="2" points={toPoints(data)} />
            {secondaryData && secondaryData.length > 0 && (
                <polyline fill="none" stroke={secondaryColor} strokeWidth="2" strokeDasharray="4,3" points={toPoints(secondaryData)} />
            )}
        </svg>
    );
};

export default function HQPredictions() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('churn');
    const [churnData, setChurnData] = useState({ predictions: [], summary: {} });
    const [demandData, setDemandData] = useState({ forecasts: [] });
    const [outlets, setOutlets] = useState([]);
    const [selectedOutlet, setSelectedOutlet] = useState('');
    const [loading, setLoading] = useState(true);
    const [computing, setComputing] = useState(false);
    const [churnFilter, setChurnFilter] = useState('all');

    useEffect(() => { loadOutlets(); }, []);
    useEffect(() => { if (tab === 'churn') loadChurn(); }, [tab, churnFilter]);
    useEffect(() => { if (tab === 'demand' && selectedOutlet) loadDemand(); }, [tab, selectedOutlet]);

    const loadOutlets = async () => {
        try {
            const res = await api.getNetworkHealth();
            const outs = res.data.outlets || [];
            setOutlets(outs);
            if (outs.length > 0) setSelectedOutlet(outs[0].outlet_id);
        } catch (err) { console.error(err); }
    };

    const loadChurn = async () => {
        try {
            setLoading(true);
            const params = {};
            if (churnFilter !== 'all') params.risk_level = churnFilter;
            const res = await api.getChurnPredictions(params);
            setChurnData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const loadDemand = async () => {
        try {
            setLoading(true);
            const res = await api.getDemandForecast(selectedOutlet, '14d');
            setDemandData(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleCompute = async () => {
        setComputing(true);
        try {
            if (tab === 'churn') {
                await api.computeChurn();
                await loadChurn();
            } else {
                await api.computeDemand(selectedOutlet);
                await loadDemand();
            }
        } catch (err) { console.error(err); }
        finally { setComputing(false); }
    };

    const summ = churnData.summary || {};

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-gray-950/90 backdrop-blur-lg border-b border-gray-800/60">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/hq')} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
                            <ArrowLeft size={20} className="text-gray-400" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                            <Brain size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">Predictive Intelligence</h1>
                            <p className="text-xs text-gray-500">Churn risk & demand forecasting</p>
                        </div>
                    </div>
                    <button onClick={handleCompute} disabled={computing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                        <Zap size={14} className={computing ? 'animate-pulse' : ''} />
                        {computing ? 'Computing...' : `Compute ${tab === 'churn' ? 'Churn' : 'Demand'}`}
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                {/* Tabs */}
                <div className="flex gap-2">
                    <button onClick={() => setTab('churn')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'churn' ? 'bg-red-500/20 border border-red-500/30 text-red-400' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'}`}>
                        <UserMinus size={16} /> Churn Risk
                    </button>
                    <button onClick={() => setTab('demand')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === 'demand' ? 'bg-blue-500/20 border border-blue-500/30 text-blue-400' : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800'}`}>
                        <Activity size={16} /> Demand Forecast
                    </button>
                </div>

                {tab === 'churn' ? (
                    <>
                        {/* Churn summary */}
                        <div className="grid grid-cols-5 gap-3">
                            {[
                                { label: 'Total Analyzed', val: summ.total || 0, color: 'text-gray-300' },
                                { label: 'Critical', val: summ.critical || 0, color: 'text-red-400' },
                                { label: 'High', val: summ.high || 0, color: 'text-orange-400' },
                                { label: 'Medium', val: summ.medium || 0, color: 'text-amber-400' },
                                { label: 'Low', val: summ.low || 0, color: 'text-green-400' },
                            ].map((s, i) => (
                                <div key={i} className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-4 text-center">
                                    <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                                    <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Filter */}
                        <div className="flex gap-2">
                            {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                                <button key={f} onClick={() => setChurnFilter(f)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${churnFilter === f ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}>
                                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>

                        {/* Churn list */}
                        {loading ? (
                            <div className="text-center py-12 text-gray-500">Loading...</div>
                        ) : churnData.predictions.length === 0 ? (
                            <div className="text-center py-16">
                                <UserMinus size={48} className="mx-auto text-gray-700 mb-4" />
                                <p className="text-gray-400 font-medium">No churn predictions yet</p>
                                <p className="text-gray-600 text-sm mt-1">Click "Compute Churn" to analyze customer booking patterns</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {churnData.predictions.map((p, i) => {
                                    const st = RISK_STYLES[p.risk_level] || RISK_STYLES.low;
                                    return (
                                        <motion.div key={p.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: i * 0.02 }}
                                            className={`${st.bg} border ${st.border} rounded-xl p-4 flex items-center gap-4`}>
                                            {/* Risk gauge */}
                                            <div className="w-14 h-14 rounded-full border-2 flex items-center justify-center relative"
                                                style={{ borderColor: st.bar.replace('bg-', '').includes('red') ? '#ef4444' : st.bar.includes('orange') ? '#f97316' : st.bar.includes('amber') ? '#f59e0b' : '#22c55e' }}>
                                                <span className={`text-sm font-bold ${st.text}`}>{Math.round(p.risk_score)}</span>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-sm text-gray-200">{p.customer_name}</span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${st.bg} ${st.text} border ${st.border}`}>
                                                        {p.risk_level}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-500">{p.outlet_name}</p>
                                                <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1"><Clock size={11} /> {p.factors?.days_since_last_visit}d since last visit</span>
                                                    <span>{p.factors?.total_bookings} bookings</span>
                                                    <span>₹{p.factors?.avg_spend?.toLocaleString()} avg spend</span>
                                                </div>
                                            </div>

                                            <div className="text-right min-w-[200px]">
                                                <p className="text-xs text-gray-400 mb-1">{p.recommended_action}</p>
                                                {p.predicted_churn_date && (
                                                    <span className="text-[10px] text-gray-600">Est. churn: {p.predicted_churn_date}</span>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {/* Outlet selector for demand */}
                        <div className="flex items-center gap-3">
                            <label className="text-sm text-gray-400">Outlet:</label>
                            <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)}
                                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-violet-500">
                                {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>)}
                            </select>
                        </div>

                        {loading ? (
                            <div className="text-center py-12 text-gray-500">Loading...</div>
                        ) : demandData.forecasts.length === 0 ? (
                            <div className="text-center py-16">
                                <Activity size={48} className="mx-auto text-gray-700 mb-4" />
                                <p className="text-gray-400 font-medium">No demand forecasts yet</p>
                                <p className="text-gray-600 text-sm mt-1">Click "Compute Demand" to generate predictions from booking history</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Chart */}
                                <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl p-6">
                                    <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
                                        <BarChart3 size={16} className="text-blue-400" /> 14-Day Booking Forecast
                                    </h3>
                                    <div className="flex flex-col items-center">
                                        <SparkLine
                                            data={demandData.forecasts.map(f => ({ value: f.predicted_bookings }))}
                                            secondaryData={demandData.forecasts.filter(f => f.actual_bookings != null).map(f => ({ value: f.actual_bookings }))}
                                            width={700} height={200}
                                            color="#3b82f6" secondaryColor="#10b981"
                                        />
                                        <div className="flex items-center gap-6 mt-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-500 rounded"></span> Predicted</span>
                                            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-emerald-500 rounded" style={{ borderTop: '2px dashed #10b981' }}></span> Actual</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="bg-gray-900/80 border border-gray-800/60 rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-800">
                                                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Predicted Bookings</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Predicted Revenue</th>
                                                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Confidence</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {demandData.forecasts.map((f, i) => (
                                                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                                    <td className="px-4 py-3 text-sm text-gray-300">{f.date}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-blue-400 font-semibold">{f.predicted_bookings}</td>
                                                    <td className="px-4 py-3 text-sm text-right text-gray-300">₹{f.predicted_revenue?.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-sm text-right">
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                            {f.confidence}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
