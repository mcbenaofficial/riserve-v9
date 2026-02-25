import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import {
    GitBranch, Plus, Play, Pause, Search, Filter,
    MoreVertical, Clock, CheckCircle2, XCircle, AlertCircle,
    Edit3, Copy, Trash2, ChevronDown, Zap, Bot, Calendar,
    ArrowUpRight, Sparkles
} from 'lucide-react';
import { SiriNewIcon } from 'hugeicons-react';

// Sample flow data
const SAMPLE_FLOWS = [
    {
        id: 'flow-1',
        name: 'Customer Support Agent',
        description: 'Handles customer inquiries with RAG and tool calls',
        status: 'active',
        lastRun: '2 mins ago',
        runs: 1247,
        successRate: 98.5,
        createdAt: '2026-01-15',
        nodeCount: 8,
        template: 'rag'
    },
    {
        id: 'flow-2',
        name: 'Lead Qualification Bot',
        description: 'Qualifies leads based on conversation analysis',
        status: 'active',
        lastRun: '15 mins ago',
        runs: 856,
        successRate: 94.2,
        createdAt: '2026-01-20',
        nodeCount: 6,
        template: 'chat'
    },
    {
        id: 'flow-3',
        name: 'Document Processor',
        description: 'Extracts and processes document data automatically',
        status: 'paused',
        lastRun: '2 hours ago',
        runs: 432,
        successRate: 99.1,
        createdAt: '2026-01-25',
        nodeCount: 12,
        template: 'tool'
    },
    {
        id: 'flow-4',
        name: 'Booking Assistant',
        description: 'Assists with booking management and scheduling',
        status: 'active',
        lastRun: '5 mins ago',
        runs: 2103,
        successRate: 97.8,
        createdAt: '2026-02-01',
        nodeCount: 7,
        template: 'chat'
    },
    {
        id: 'flow-5',
        name: 'Analytics Reporter',
        description: 'Generates automated analytics reports',
        status: 'error',
        lastRun: '1 hour ago',
        runs: 156,
        successRate: 85.3,
        createdAt: '2026-02-05',
        nodeCount: 5,
        template: 'tool'
    },
    {
        id: 'flow-6',
        name: 'Inventory Monitor',
        description: 'Monitors inventory levels and sends alerts',
        status: 'draft',
        lastRun: null,
        runs: 0,
        successRate: 0,
        createdAt: '2026-02-08',
        nodeCount: 4,
        template: 'custom'
    }
];

const statusConfig = {
    active: { color: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2, label: 'Active' },
    paused: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', icon: Pause, label: 'Paused' },
    error: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircle, label: 'Error' },
    draft: { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: Edit3, label: 'Draft' }
};

const FlowCard = ({ flow, onOpen, onDuplicate, onDelete, isDark }) => {
    const [showMenu, setShowMenu] = useState(false);
    const status = statusConfig[flow.status];
    const StatusIcon = status.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border rounded-2xl p-5 ${isDark ? 'hover:border-purple-500/30' : 'hover:border-purple-400/40'} transition-all group`}
        >
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <GitBranch size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h3 className={`font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} group-hover:text-purple-400 transition-colors`}>
                            {flow.name}
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} mt-0.5`}>{flow.description}</p>
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className={`p-1.5 rounded-lg ${isDark ? 'text-[#7D8590] hover:bg-[#1F2630] hover:text-[#E6E8EB]' : 'text-[#6B7280] hover:bg-[#F6F7F9] hover:text-[#0E1116]'} transition-all`}
                    >
                        <MoreVertical size={16} />
                    </button>

                    <AnimatePresence>
                        {showMenu && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`absolute right-0 top-8 w-40 ${isDark ? 'bg-[#1F2630] border-[#374151]' : 'bg-white border-[#D9DEE5]'} border rounded-xl shadow-xl z-10 overflow-hidden`}
                            >
                                <button
                                    onClick={() => { onOpen(flow.id); setShowMenu(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-sm ${isDark ? 'text-[#E6E8EB] hover:bg-[#374151]' : 'text-[#0E1116] hover:bg-[#F6F7F9]'} flex items-center gap-2`}
                                >
                                    <Edit3 size={14} /> Edit
                                </button>
                                <button
                                    onClick={() => { onDuplicate(flow.id); setShowMenu(false); }}
                                    className={`w-full px-4 py-2.5 text-left text-sm ${isDark ? 'text-[#E6E8EB] hover:bg-[#374151]' : 'text-[#0E1116] hover:bg-[#F6F7F9]'} flex items-center gap-2`}
                                >
                                    <Copy size={14} /> Duplicate
                                </button>
                                <button
                                    onClick={() => { onDelete(flow.id); setShowMenu(false); }}
                                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 mb-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.color}`}>
                    <StatusIcon size={12} />
                    {status.label}
                </span>
                <span className={`text-xs ${isDark ? 'text-[#4B5563]' : 'text-[#9CA3AF]'}`}>·</span>
                <span className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>{flow.nodeCount} nodes</span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className={`${isDark ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]'} rounded-xl px-3 py-2`}>
                    <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Total Runs</p>
                    <p className={`text-lg font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{flow.runs.toLocaleString()}</p>
                </div>
                <div className={`${isDark ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]'} rounded-xl px-3 py-2`}>
                    <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Success Rate</p>
                    <p className={`text-lg font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{flow.successRate}%</p>
                </div>
                <div className={`${isDark ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]'} rounded-xl px-3 py-2`}>
                    <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Last Run</p>
                    <p className={`text-sm font-medium ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{flow.lastRun || 'Never'}</p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onOpen(flow.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all text-sm font-medium"
                >
                    <Edit3 size={14} />
                    Edit Flow
                </button>
                {flow.status !== 'draft' && (
                    <button className={`p-2 rounded-xl ${isDark ? 'bg-[#1F2630] text-[#7D8590] hover:text-[#E6E8EB]' : 'bg-[#F6F7F9] text-[#6B7280] hover:text-[#0E1116]'} transition-all`}>
                        {flow.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                )}
            </div>
        </motion.div>
    );
};

const FlowList = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const navigate = useNavigate();
    const [flows] = useState(SAMPLE_FLOWS);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showFilterMenu, setShowFilterMenu] = useState(false);

    const filteredFlows = flows.filter(flow => {
        const matchesSearch = flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            flow.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || flow.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: flows.length,
        active: flows.filter(f => f.status === 'active').length,
        paused: flows.filter(f => f.status === 'paused').length,
        error: flows.filter(f => f.status === 'error').length,
        totalRuns: flows.reduce((sum, f) => sum + f.runs, 0)
    };

    const handleOpenFlow = (flowId) => {
        navigate(`/flow/builder/${flowId}`);
    };

    const handleCreateNew = () => {
        navigate('/flow/builder');
    };

    const handleDuplicate = (flowId) => {
        console.log('Duplicate flow:', flowId);
    };

    const handleDelete = (flowId) => {
        console.log('Delete flow:', flowId);
    };

    return (
        <div className={`min-h-screen ${isDark ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]'}`}>
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} flex items-center gap-3`}>
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                                <SiriNewIcon size={20} className="text-white" />
                            </div>
                            Agent Flows
                        </h1>
                        <p className={`${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} mt-1`}>Build and manage your AI agent workflows</p>
                    </div>

                    <button
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-purple-500/20"
                    >
                        <Plus size={18} />
                        Create New Flow
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-5 gap-4 mb-6">
                    <div className={`${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border rounded-2xl p-4`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                                <GitBranch size={18} className="text-purple-400" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{stats.total}</p>
                                <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Total Flows</p>
                            </div>
                        </div>
                    </div>
                    <div className={`${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border rounded-2xl p-4`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                                <CheckCircle2 size={18} className="text-green-400" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{stats.active}</p>
                                <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Active</p>
                            </div>
                        </div>
                    </div>
                    <div className={`${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border rounded-2xl p-4`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                                <Pause size={18} className="text-yellow-400" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{stats.paused}</p>
                                <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Paused</p>
                            </div>
                        </div>
                    </div>
                    <div className={`${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border rounded-2xl p-4`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                                <XCircle size={18} className="text-red-400" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{stats.error}</p>
                                <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Errors</p>
                            </div>
                        </div>
                    </div>
                    <div className={`${isDark ? 'bg-[#12161C] border-[#1F2630]' : 'bg-white border-[#D9DEE5]'} border rounded-2xl p-4`}>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Zap size={18} className="text-blue-400" />
                            </div>
                            <div>
                                <p className={`text-2xl font-bold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>{stats.totalRuns.toLocaleString()}</p>
                                <p className={`text-xs ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>Total Runs</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                        <Search size={18} className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#4B5563]' : 'text-[#9CA3AF]'}`} />
                        <input
                            type="text"
                            placeholder="Search flows..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className={`w-full ${isDark ? 'bg-[#12161C] border-[#1F2630] text-[#E6E8EB] placeholder-[#4B5563]' : 'bg-white border-[#D9DEE5] text-[#0E1116] placeholder-[#9CA3AF]'} border rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-purple-500 transition-all`}
                        />
                    </div>

                    <div className="relative">
                        <button
                            onClick={() => setShowFilterMenu(!showFilterMenu)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${statusFilter !== 'all'
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                : isDark
                                    ? 'bg-[#12161C] border-[#1F2630] text-[#7D8590] hover:text-[#E6E8EB]'
                                    : 'bg-white border-[#D9DEE5] text-[#6B7280] hover:text-[#0E1116]'
                                }`}
                        >
                            <Filter size={16} />
                            {statusFilter === 'all' ? 'All Status' : statusConfig[statusFilter]?.label}
                            <ChevronDown size={14} />
                        </button>

                        <AnimatePresence>
                            {showFilterMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    className={`absolute right-0 top-14 w-44 ${isDark ? 'bg-[#1F2630] border-[#374151]' : 'bg-white border-[#D9DEE5]'} border rounded-xl shadow-xl z-20 overflow-hidden`}
                                >
                                    {[
                                        { value: 'all', label: 'All Status' },
                                        { value: 'active', label: 'Active' },
                                        { value: 'paused', label: 'Paused' },
                                        { value: 'error', label: 'Error' },
                                        { value: 'draft', label: 'Draft' }
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => { setStatusFilter(option.value); setShowFilterMenu(false); }}
                                            className={`w-full px-4 py-2.5 text-left text-sm transition-all flex items-center gap-2 ${statusFilter === option.value
                                                ? 'bg-purple-500/10 text-purple-400'
                                                : isDark ? 'text-[#E6E8EB] hover:bg-[#374151]' : 'text-[#0E1116] hover:bg-[#F6F7F9]'
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Flow Grid */}
            {filteredFlows.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredFlows.map((flow, index) => (
                        <motion.div
                            key={flow.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            <FlowCard
                                flow={flow}
                                onOpen={handleOpenFlow}
                                onDuplicate={handleDuplicate}
                                onDelete={handleDelete}
                                isDark={isDark}
                            />
                        </motion.div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20">
                    <div className={`w-16 h-16 rounded-2xl ${isDark ? 'bg-[#1F2630]' : 'bg-[#F6F7F9]'} flex items-center justify-center mb-4`}>
                        <GitBranch size={32} className={isDark ? 'text-[#374151]' : 'text-[#D9DEE5]'} />
                    </div>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'} mb-1`}>No flows found</h3>
                    <p className={`${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} mb-6`}>
                        {searchQuery || statusFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Create your first agent flow to get started'}
                    </p>
                    {!searchQuery && statusFilter === 'all' && (
                        <button
                            onClick={handleCreateNew}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:opacity-90 transition-all"
                        >
                            <Plus size={18} />
                            Create New Flow
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default FlowList;
