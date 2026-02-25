
import React, { useState, useEffect, useRef } from 'react';
import {
    Send, Sparkles, X, ChevronRight, ChevronLeft,
    BarChart2, Zap, MoreHorizontal, Maximize2, Minimize2, TrendingUp, PieChart, Activity, Atom
} from 'lucide-react';
import { AtomicPowerIcon } from 'hugeicons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAnalytics } from '../../contexts/AnalyticsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { api } from '../../services/api';
import ThinkingProcess from '../ThinkingProcess';

// Chart suggestion templates
const CHART_SUGGESTIONS = [
    { type: 'revenue-trend', label: 'Revenue Trend', icon: TrendingUp, color: '#8b5cf6' },
    { type: 'bookings-trend', label: 'Bookings Trend', icon: Activity, color: '#ec4899' },
    { type: 'outlet-performance', label: 'Outlet Performance', icon: BarChart2, color: '#3b82f6' },
    { type: 'service-breakdown', label: 'Service Breakdown', icon: PieChart, color: '#10b981' }
];

const AgentSidebar = ({ isOpen, toggleSidebar }) => {
    const { addWidget, analyticsData, getMonthlyTrends } = useAnalytics();
    const { theme, mode } = useTheme();
    const isDark = theme === 'dark';
    const isZen = mode === 'zen';
    const [messages, setMessages] = useState([
        { id: 1, role: 'assistant', content: 'Hello! I am Kyntra. How can I assist you with your analytics today?' }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Determine which chart to suggest based on user input
    const getSuggestion = (query) => {
        const q = query.toLowerCase();
        if (q.includes('revenue') || q.includes('money') || q.includes('earning')) {
            return CHART_SUGGESTIONS[0];
        } else if (q.includes('booking') || q.includes('appointment') || q.includes('reservation')) {
            return CHART_SUGGESTIONS[1];
        } else if (q.includes('outlet') || q.includes('location') || q.includes('branch')) {
            return CHART_SUGGESTIONS[2];
        } else if (q.includes('service') || q.includes('product') || q.includes('offering')) {
            return CHART_SUGGESTIONS[3];
        }
        // Default suggestion
        return CHART_SUGGESTIONS[Math.floor(Math.random() * CHART_SUGGESTIONS.length)];
    };

    const [conversationId, setConversationId] = useState(null);

    const handleSend = async () => {
        if (!input.trim() || isTyping) return;

        const userMsg = { id: Date.now(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        const query = input;
        setInput('');
        setIsTyping(true);

        try {
            const res = await api.sendChatMessage(query, conversationId);

            if (!conversationId) {
                setConversationId(res.data.conversation_id);
            }

            const aiMsg = {
                ...res.data.message,
                uiBlock: false // Backend doesn't support uiBlock yet, but we can enhance this later
            };

            // Check for chart suggestions in the response content or thinking process
            // For now, we'll rely on text response, but we can parse for keywords to suggest charts
            // If the agent suggests a chart, we can construct the uiBlock manually if needed
            // But for now, let's just show the text response and thinking process

            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleUseChart = (suggestion) => {
        const success = addWidget(suggestion.type, suggestion.label);
        if (success) {
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                content: `✓ Added "${suggestion.label}" to your AI Analytics dashboard. You can view it there now!`
            }]);
        }
    };

    return (
        <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: isOpen ? (isExpanded ? 600 : 320) : 0, opacity: isOpen ? 1 : 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={`h-full backdrop-blur-xl border-l flex flex-col overflow-hidden ${isDark ? 'bg-[#12161C]/50 border-[#1F2630]' : 'bg-white/70 border-[#D9DEE5]'}`}
        >
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isZen ? 'bg-[#687988]' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
                        <AtomicPowerIcon size={16} className="text-white" />
                    </div>
                    <div>
                        <h3 className={`text-sm font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>Vorta</h3>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`p-1 rounded-md transition-colors ${isDark ? 'hover:bg-[#1F2630] text-[#7D8590]' : 'hover:bg-[#ECEFF3] text-[#6B7280]'}`}
                        title={isExpanded ? "Collapse width" : "Expand width"}
                    >
                        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button onClick={toggleSidebar} className={`p-1 rounded-md transition-colors ${isDark ? 'hover:bg-[#1F2630] text-[#7D8590]' : 'hover:bg-[#ECEFF3] text-[#6B7280]'}`}>
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${msg.role === 'user'
                            ? isZen ? 'bg-[#687988] text-white shadow-lg shadow-[#687988]/20' : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/20'
                            : isDark ? 'bg-[#1F2630] text-[#E6E8EB] border border-[#374151]' : 'bg-[#ECEFF3] text-[#0E1116] border border-[#D9DEE5]'
                            }`}>
                            {msg.thinking_process && msg.thinking_process.length > 0 && (
                                <ThinkingProcess steps={msg.thinking_process} isDark={isDark} />
                            )}
                            {msg.content}
                            {msg.uiBlock && msg.suggestion && (
                                <div className={`mt-3 rounded-xl p-3 border ${isDark ? 'bg-[#111827] border-[#374151]' : 'bg-white border-[#D9DEE5]'}`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <msg.suggestion.icon size={14} style={{ color: msg.suggestion.color }} />
                                        <span className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{msg.suggestion.label}</span>
                                    </div>
                                    {/* Mini preview with real data */}
                                    <div className="h-16 bg-[#1F2937]/50 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                                        {msg.previewData ? (
                                            <div className="flex items-end gap-1 h-full px-2 py-2">
                                                {msg.previewData.map((d, i) => (
                                                    <div key={i} className="flex flex-col items-center gap-1">
                                                        <div
                                                            className="w-6 rounded-t"
                                                            style={{
                                                                height: `${Math.max(8, (d.revenue / 1000) * 3)}px`,
                                                                backgroundColor: msg.suggestion.color,
                                                                opacity: 0.7
                                                            }}
                                                        />
                                                        <span className="text-[8px] text-gray-500">{d.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <BarChart2 size={20} style={{ color: msg.suggestion.color }} />
                                                <span className="text-xs">Chart Preview</span>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleUseChart(msg.suggestion)}
                                        className={`w-full py-1.5 rounded-lg text-xs font-medium text-white transition-all shadow-md ${isZen ? 'bg-[#687988] shadow-[#687988]/20 hover:bg-[#586978]' : 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-purple-500/20 hover:opacity-90'}`}
                                    >
                                        Use this Chart
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className={`rounded-2xl p-3 flex gap-1 items-center border ${isDark ? 'bg-[#1F2630] text-[#E6E8EB] border-[#374151]' : 'bg-[#ECEFF3] text-[#0E1116] border-[#D9DEE5]'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isZen ? 'bg-stone-400' : 'bg-gray-400'}`} style={{ animationDelay: '0ms' }} />
                            <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isZen ? 'bg-stone-400' : 'bg-gray-400'}`} style={{ animationDelay: '150ms' }} />
                            <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isZen ? 'bg-stone-400' : 'bg-gray-400'}`} style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={`p-4 border-t ${isDark ? 'border-[#1F2630] bg-[#12161C]/80' : 'border-[#D9DEE5] bg-white'}`}>
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about revenue, bookings, outlets..."
                        className={`w-full text-sm rounded-full pl-4 pr-10 py-2.5 focus:outline-none transition-all placeholder:text-gray-500 border ${isDark ? 'bg-[#1F2630] border-[#374151] text-[#E6E8EB] focus:border-purple-500 focus:ring-1 focus:ring-purple-500' : 'bg-[#F6F7F9] border-[#D9DEE5] text-[#0E1116] focus:border-[#5FA8D3] focus:ring-1 focus:ring-[#5FA8D3]'}`}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        className={`absolute right-1.5 top-1.5 p-1.5 rounded-full text-white transition-all shadow-md ${isZen ? 'bg-[#687988] shadow-[#687988]/20 hover:bg-[#586978]' : 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-purple-500/20 hover:opacity-90'} disabled:opacity-50`}
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default AgentSidebar;
