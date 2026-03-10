import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Play, Pause, StopCircle, BarChart3, ArrowLeft,
    CheckCircle2, AlertTriangle, Clock, Zap, Target, TrendingUp,
    TrendingDown, Minus, RefreshCw, ChevronRight, XCircle,
    Activity, Shield, Users, Store
} from 'lucide-react';
import { api } from '../services/api';

const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val}`;
};

const STATUS_CONFIG = {
    active: { label: 'Active', bg: 'bg-emerald-500/15', text: 'text-emerald-400', icon: Play },
    paused: { label: 'Paused', bg: 'bg-amber-500/15', text: 'text-amber-400', icon: Pause },
    completed: { label: 'Completed', bg: 'bg-sky-500/15', text: 'text-sky-400', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', bg: 'bg-gray-500/15', text: 'text-gray-400', icon: XCircle },
};

const RESULT_STATUS = {
    monitoring: { label: 'Monitoring', color: 'text-gray-400', bg: 'bg-gray-500/15' },
    improved: { label: 'Improved', color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
    declined: { label: 'Declined', color: 'text-red-400', bg: 'bg-red-500/15' },
    no_change: { label: 'No Change', color: 'text-amber-400', bg: 'bg-amber-500/15' },
};

// ═══════════ Deployment Card ═══════════
const DeploymentCard = ({ deployment, onMeasure, onStatusChange, onViewDetail }) => {
    const [measuring, setMeasuring] = useState(false);
    const cfg = STATUS_CONFIG[deployment.status] || STATUS_CONFIG.active;
    const StatusIcon = cfg.icon;

    const handleMeasure = async () => {
        setMeasuring(true);
        await onMeasure(deployment.id);
        setMeasuring(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-white/[0.12] transition-all"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                        <BookOpen size={18} className="text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">{deployment.playbook_name}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-500 font-mono">{deployment.experiment_id}</span>
                            <span className="text-gray-700">·</span>
                            <span className="text-[10px] text-gray-500">{deployment.outlet_count} outlet(s)</span>
                        </div>
                    </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${cfg.bg} ${cfg.text}`}>
                    <StatusIcon size={10} />
                    {cfg.label}
                </span>
            </div>

            {/* Timeline */}
            <div className="flex items-center gap-2 mb-4 text-[10px] text-gray-500">
                <Clock size={10} />
                <span>Deployed {deployment.deployed_at ? new Date(deployment.deployed_at).toLocaleDateString() : '—'}</span>
                <span className="text-gray-700">·</span>
                <span>{deployment.elapsed_hours}h elapsed</span>
                {deployment.completed_at && (
                    <>
                        <span className="text-gray-700">·</span>
                        <span>Completed {new Date(deployment.completed_at).toLocaleDateString()}</span>
                    </>
                )}
            </div>

            {/* Outlet Results */}
            {deployment.outlets && deployment.outlets.length > 0 && (
                <div className="space-y-1.5 mb-4">
                    {deployment.outlets.map((o, i) => {
                        const rCfg = RESULT_STATUS[o.status] || RESULT_STATUS.monitoring;
                        return (
                            <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                    <Store size={12} className="text-gray-600" />
                                    <span className="text-xs text-gray-300">{o.outlet_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-[10px] text-gray-500">
                                        Before: <span className="text-white font-semibold">{o.before_health?.toFixed(0)}</span>
                                    </div>
                                    {o.after_health !== null && o.after_health !== undefined && (
                                        <>
                                            <span className="text-gray-700">→</span>
                                            <div className="text-[10px] text-gray-500">
                                                After: <span className="text-white font-semibold">{o.after_health?.toFixed(0)}</span>
                                            </div>
                                            <span className={`text-[10px] font-semibold ${o.improvement_pct > 0 ? 'text-emerald-400' : o.improvement_pct < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                                {o.improvement_pct > 0 ? '+' : ''}{o.improvement_pct?.toFixed(1)}%
                                            </span>
                                        </>
                                    )}
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${rCfg.bg} ${rCfg.color}`}>{rCfg.label}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-3 border-t border-white/[0.04]">
                {deployment.status === 'active' && (
                    <>
                        <button
                            onClick={handleMeasure}
                            disabled={measuring}
                            className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={measuring ? 'animate-spin' : ''} />
                            {measuring ? 'Measuring…' : 'Measure Impact'}
                        </button>
                        <button
                            onClick={() => onStatusChange(deployment.id, 'paused')}
                            className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                        >
                            <Pause size={12} />
                            Pause
                        </button>
                        <button
                            onClick={() => onStatusChange(deployment.id, 'completed')}
                            className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                        >
                            <CheckCircle2 size={12} />
                            Complete
                        </button>
                    </>
                )}
                {deployment.status === 'paused' && (
                    <button
                        onClick={() => onStatusChange(deployment.id, 'active')}
                        className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                    >
                        <Play size={12} />
                        Resume
                    </button>
                )}
            </div>
        </motion.div>
    );
};

// ═══════════ Deploy Modal ═══════════
const DeployModal = ({ playbook, outlets, onClose, onDeploy }) => {
    const [selectedOutlets, setSelectedOutlets] = useState([]);
    const [deploying, setDeploying] = useState(false);
    const [deployed, setDeployed] = useState(false);

    const handleDeploy = async () => {
        setDeploying(true);
        try {
            await onDeploy(playbook.id, selectedOutlets);
            setDeployed(true);
            setTimeout(() => onClose(), 2000);
        } catch { setDeploying(false); }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#0f1117] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
                {deployed ? (
                    <div className="text-center py-8">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 size={32} className="text-emerald-400" />
                        </motion.div>
                        <h3 className="text-lg font-bold text-white">Playbook Deployed!</h3>
                        <p className="text-gray-400 text-sm mt-1">{selectedOutlets.length} outlet(s) · Tracking started</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                <BookOpen size={18} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">{playbook.name}</h3>
                                <span className="text-xs text-gray-500">{playbook.category}</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-400 mb-4">{playbook.description}</p>

                        <div className="space-y-3 mb-5">
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">Trigger</div>
                                <div className="text-xs text-gray-300">{playbook.trigger}</div>
                            </div>
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1 font-semibold">Actions</div>
                                <ul className="space-y-1">
                                    {playbook.actions?.map((a, i) => (
                                        <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                                            <Zap size={10} className="text-amber-400 mt-0.5 shrink-0" /> {a}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                                <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1 font-semibold">Estimated Impact</div>
                                <div className="text-sm text-emerald-400 font-semibold">{playbook.estimated_impact}</div>
                            </div>
                        </div>

                        <div className="mb-5">
                            <div className="text-xs text-gray-400 mb-2 font-semibold">Select outlets to deploy:</div>
                            <div className="max-h-40 overflow-y-auto space-y-1">
                                {outlets.map(o => (
                                    <label key={o.outlet_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/[0.03] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedOutlets.includes(o.outlet_id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedOutlets([...selectedOutlets, o.outlet_id]);
                                                else setSelectedOutlets(selectedOutlets.filter(id => id !== o.outlet_id));
                                            }}
                                            className="rounded border-gray-600 text-emerald-500 focus:ring-emerald-500"
                                        />
                                        <span className="text-sm text-gray-300">{o.outlet_name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 transition-colors">Cancel</button>
                            <button
                                onClick={handleDeploy}
                                disabled={selectedOutlets.length === 0 || deploying}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
                            >
                                {deploying ? 'Deploying...' : `Deploy to ${selectedOutlets.length} Outlet(s)`}
                            </button>
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
};

// ═══════════ MAIN COMPONENT ═══════════
const HQPlaybooks = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [deployments, setDeployments] = useState([]);
    const [playbooks, setPlaybooks] = useState([]);
    const [outlets, setOutlets] = useState([]);
    const [selectedPlaybook, setSelectedPlaybook] = useState(null);
    const [tab, setTab] = useState('deployments'); // deployments | catalog

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [depRes, pbRes, healthRes] = await Promise.all([
                api.getDeployments(),
                api.getPlaybooks(),
                api.getNetworkHealth(),
            ]);
            setDeployments(depRes.data.deployments || []);
            setPlaybooks(pbRes.data.playbooks || []);
            setOutlets(healthRes.data.outlets || []);
        } catch (err) {
            console.error('Failed to load playbook data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDeploy = async (playbookId, outletIds) => {
        await api.deployPlaybook(playbookId, { outlet_ids: outletIds });
        await fetchData();
    };

    const handleMeasure = async (deploymentId) => {
        await api.measureDeployment(deploymentId);
        await fetchData();
    };

    const handleStatusChange = async (deploymentId, status) => {
        await api.updateDeploymentStatus(deploymentId, { status });
        await fetchData();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0b0f] flex items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                    <BookOpen size={40} className="text-emerald-500" />
                </motion.div>
            </div>
        );
    }

    const activeCount = deployments.filter(d => d.status === 'active').length;
    const completedCount = deployments.filter(d => d.status === 'completed').length;

    return (
        <div className="min-h-screen bg-[#0a0b0f] text-white">
            {/* Header */}
            <div className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl sticky top-0 z-30">
                <div className="max-w-[1400px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate('/hq')} className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                                <ArrowLeft size={18} />
                            </button>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                <BookOpen size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight">Playbook Engine</h1>
                                <p className="text-xs text-gray-500">Deploy, track, and measure interventions</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-emerald-400 font-semibold">{activeCount} active</span>
                                <span className="text-gray-700">·</span>
                                <span className="text-gray-400">{completedCount} completed</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
                {/* Tab Switch */}
                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-0.5 w-fit">
                    <button onClick={() => setTab('deployments')} className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === 'deployments' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                        Active Deployments ({deployments.length})
                    </button>
                    <button onClick={() => setTab('catalog')} className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${tab === 'catalog' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                        Playbook Catalog ({playbooks.length})
                    </button>
                </div>

                {tab === 'deployments' ? (
                    <div className="space-y-4">
                        {deployments.length === 0 ? (
                            <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-2xl">
                                <BookOpen size={40} className="mx-auto text-gray-700 mb-3" />
                                <h3 className="text-sm font-semibold text-gray-400 mb-1">No deployments yet</h3>
                                <p className="text-xs text-gray-600 mb-4">Deploy a playbook from the catalog to start tracking experiments</p>
                                <button
                                    onClick={() => setTab('catalog')}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold hover:opacity-90"
                                >
                                    Browse Playbooks
                                </button>
                            </div>
                        ) : (
                            deployments.map(d => (
                                <DeploymentCard
                                    key={d.id}
                                    deployment={d}
                                    onMeasure={handleMeasure}
                                    onStatusChange={handleStatusChange}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {playbooks.map(pb => (
                            <motion.div
                                key={pb.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:border-emerald-500/30 transition-all cursor-pointer group"
                                onClick={() => setSelectedPlaybook(pb)}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center">
                                        <BookOpen size={18} className="text-emerald-400" />
                                    </div>
                                    <ChevronRight size={14} className="text-gray-600 group-hover:text-emerald-400 transition-colors" />
                                </div>
                                <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors mb-1">{pb.name}</h3>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{pb.category}</span>
                                <p className="text-xs text-gray-500 mt-2 line-clamp-2">{pb.description}</p>
                                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                                    <div className="text-[10px] text-emerald-500 font-semibold">{pb.estimated_impact}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence>
                {selectedPlaybook && (
                    <DeployModal
                        playbook={selectedPlaybook}
                        outlets={outlets}
                        onClose={() => setSelectedPlaybook(null)}
                        onDeploy={handleDeploy}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default HQPlaybooks;
