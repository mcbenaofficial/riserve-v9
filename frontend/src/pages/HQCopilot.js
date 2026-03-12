import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain, Send, Sparkles, ArrowLeft, BarChart3, TrendingUp,
    ChevronRight, BookOpen, AlertCircle, MessageSquare, Loader2,
    Activity, Target
} from 'lucide-react';
import { api } from '../services/api';

// ═══════════════════════════════════════════════
// Simple inline bar / line chart renderer
// ═══════════════════════════════════════════════
const MiniChart = ({ chart }) => {
    if (!chart) return null;
    const maxVal = Math.max(...chart.values);

    if (chart.type === 'bar') {
        return (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mt-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-semibold">{chart.label}</div>
                <div className="flex items-end gap-1.5 h-28">
                    {chart.values.map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${(v / maxVal) * 100}%` }}
                                transition={{ delay: i * 0.05, duration: 0.4 }}
                                className="w-full rounded-t-md bg-gradient-to-t from-sky-600 to-sky-400 min-h-[4px]"
                            />
                            <span className="text-[8px] text-gray-600 truncate w-full text-center">{chart.labels?.[i] || i}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (chart.type === 'line' || chart.type === 'area') {
        const w = 100;
        const h = 40;
        const points = chart.values.map((v, i) => ({
            x: (i / (chart.values.length - 1)) * w,
            y: h - (v / maxVal) * h,
        }));
        const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
        const areaD = `${pathD} L${w},${h} L0,${h} Z`;

        return (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mt-3">
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-semibold">{chart.label}</div>
                <svg viewBox={`-2 -2 ${w + 4} ${h + 14}`} className="w-full h-28">
                    {chart.type === 'area' && <path d={areaD} fill="url(#areaGrad)" opacity={0.3} />}
                    <motion.path
                        d={pathD}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1 }}
                    />
                    {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={2} fill="#38bdf8" />
                    ))}
                    {chart.labels?.map((label, i) => (
                        <text
                            key={i}
                            x={points[i]?.x || 0}
                            y={h + 10}
                            textAnchor="middle"
                            className="fill-gray-600"
                            fontSize={3.5}
                        >
                            {label}
                        </text>
                    ))}
                    <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
        );
    }
    return null;
};


// ═══════════════════════════════════════════════
// Chat Message Bubble
// ═══════════════════════════════════════════════
const ChatMessage = ({ message, onActionClick }) => {
    if (message.role === 'user') {
        return (
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end mb-4"
            >
                <div className="max-w-[80%] bg-sky-600/20 border border-sky-500/30 rounded-2xl rounded-br-md px-4 py-3">
                    <p className="text-sm text-sky-100">{message.content}</p>
                </div>
            </motion.div>
        );
    }

    // AI response
    const data = message.data;
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start mb-6"
        >
            <div className="max-w-[85%]">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
                        <Brain size={12} className="text-white" />
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">HQ Copilot</span>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-tl-md px-5 py-4">
                    {/* Narrative with markdown-light rendering */}
                    <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {data?.narrative?.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                                return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
                            }
                            return <span key={i}>{part}</span>;
                        })}
                    </div>

                    {/* Chart */}
                    {data?.chart && <MiniChart chart={data.chart} />}

                    {/* Suggested Actions */}
                    {data?.suggested_actions && data.suggested_actions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/[0.06]">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Suggested Actions</div>
                            <div className="flex flex-wrap gap-2">
                                {data.suggested_actions.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => onActionClick(action)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-300 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400 transition-all"
                                    >
                                        <ChevronRight size={10} />
                                        {action}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Proactive Insights */}
                    {data?.proactive_insights && data.proactive_insights.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-amber-500/10">
                            {data.proactive_insights.map((insight, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/5 rounded-lg px-3 py-2 mb-1">
                                    <AlertCircle size={12} /> {insight}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};


// ═══════════════════════════════════════════════
// MAIN COPILOT COMPONENT
// ═══════════════════════════════════════════════
const HQCopilot = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const outletContext = location.state?.outletContext;
    const initialQuery = location.state?.initialQuery;

    const QUICK_QUESTIONS = [
        "Show me underperforming outlets",
        "Why did revenue change this week?",
        "What are our churn patterns?",
        "What's our NPS looking like?",
        "What playbooks can I deploy?",
    ];

    useEffect(() => {
        // Send welcome message
        const welcome = {
            role: 'assistant',
            data: {
                narrative: outletContext
                    ? `I'm ready to help you analyze **${outletContext.outlet_name}** (${outletContext.region}). This outlet has a health score of **${outletContext.health_score?.toFixed(0)}**.\n\nWhat would you like to know?`
                    : "Welcome to **HQ Copilot** — your AI-powered command interface for Ri'Serve network intelligence.\n\nI can help you understand network health, diagnose issues, and recommend actions. Ask me anything about your outlets, revenue, churn, NPS, or playbooks.\n\n_Try one of the quick questions below to get started._",
                suggested_actions: outletContext
                    ? ["Why is this outlet underperforming?", "What playbooks apply here?", "Compare to peer outlets"]
                    : [],
            },
        };
        setMessages([welcome]);

        // Auto-send initial query if provided
        if (initialQuery) {
            setTimeout(() => sendMessage(initialQuery), 500);
        }
    }, []);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text) => {
        const query = text || input;
        if (!query.trim()) return;

        const userMsg = { role: 'user', content: query };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const res = await api.askCopilot(query, outletContext ? { outlet_id: outletContext.outlet_id } : null);
            const aiMsg = { role: 'assistant', data: res.data.response };
            setMessages(prev => [...prev, aiMsg]);
        } catch (err) {
            const errorMsg = {
                role: 'assistant',
                data: {
                    narrative: "I encountered an error processing your query. Please try again or rephrase your question.",
                    suggested_actions: ["Try a different question", "Show network overview"],
                },
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage();
    };

    const handleActionClick = (action) => {
        sendMessage(action);
    };

    return (
        <div className="h-full bg-[#0a0b0f] text-white flex flex-col rounded-3xl overflow-hidden border border-white/[0.06]">
            {/* Header */}
            <div className="border-b border-white/[0.06] bg-white/[0.02] backdrop-blur-xl shrink-0">
                <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/hq')} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
                            <ArrowLeft size={18} className="text-gray-400" />
                        </button>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg">
                            <Brain size={16} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold">HQ Copilot</h1>
                            {outletContext && (
                                <p className="text-[10px] text-gray-500">Context: {outletContext.outlet_name}</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    {messages.map((msg, i) => (
                        <ChatMessage key={i} message={msg} onActionClick={handleActionClick} />
                    ))}

                    {/* Loading indicator */}
                    <AnimatePresence>
                        {loading && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="flex items-center gap-3 mb-4"
                            >
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center">
                                    <Brain size={12} className="text-white" />
                                </div>
                                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
                                    <Loader2 size={14} className="text-sky-400 animate-spin" />
                                    <span className="text-xs text-gray-500">Analyzing network data...</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* Quick Questions (show when no user messages yet) */}
            {messages.length <= 1 && !loading && (
                <div className="max-w-4xl mx-auto px-6 pb-4 w-full">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {QUICK_QUESTIONS.map((q, i) => (
                            <motion.button
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + i * 0.08 }}
                                onClick={() => sendMessage(q)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs text-gray-400 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400 transition-all"
                            >
                                <Sparkles size={12} />
                                {q}
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Bar */}
            <div className="border-t border-white/[0.06] bg-white/[0.02] backdrop-blur-xl shrink-0">
                <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Ask about network health, revenue, churn, NPS..."
                                disabled={loading}
                                className="w-full pl-4 pr-12 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-gray-600 focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/20 outline-none disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={loading || !input.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors disabled:opacity-30 disabled:hover:bg-sky-500"
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                    <p className="text-center text-[10px] text-gray-600 mt-2">
                        Copilot uses your network data to provide insights. Phase 0 responses are pattern-matched.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default HQCopilot;
