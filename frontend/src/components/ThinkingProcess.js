
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, database, BarChart3, Box, Activity } from 'lucide-react';

import { useTheme } from '../contexts/ThemeContext';

const ThinkingProcess = ({ steps, isDark, isStreaming }) => {
    const { mode } = useTheme();
    const isZen = mode === 'zen';
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-expand when streaming starts
    React.useEffect(() => {
        if (isStreaming && steps && steps.length > 0) {
            setIsExpanded(true);
        }
    }, [isStreaming, steps?.length]);

    if (!steps || steps.length === 0) {
        if (isStreaming) {
            return (
                <div className={`mb-3 rounded-xl overflow-hidden border ${isDark ? 'border-[#1F2630] bg-[#12161C]' : 'border-[#D9DEE5] bg-white'}`}>
                    <div className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${isZen ? 'bg-stone-400' : 'bg-purple-500'}`} />
                        <Activity size={14} className={isDark ? (isZen ? 'text-[#687988]' : 'text-[#5FA8D3]') : (isZen ? 'text-[#687988]' : 'text-[#4A95C0]')} />
                        <span>Thinking...</span>
                    </div>
                </div>
            );
        }
        return null;
    }

    // Helper to get icon based on tool name
    const getToolIcon = (name) => {
        if (name.includes('booking')) return <database size={14} />;
        if (name.includes('revenue') || name.includes('stats')) return <BarChart3 size={14} />;
        if (name.includes('inventory') || name.includes('product')) return <Box size={14} />;
        return <Terminal size={14} />;
    };

    // Helper to format arguments for display
    const formatArgs = (args) => {
        try {
            return JSON.stringify(args, null, 2);
        } catch (e) {
            return String(args);
        }
    };

    return (
        <div className={`mb-3 rounded-xl overflow-hidden border ${isDark ? 'border-[#1F2630] bg-[#12161C]' : 'border-[#D9DEE5] bg-white'
            }`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${isDark
                    ? 'text-[#7D8590] hover:bg-[#1F2630]'
                    : 'text-[#6B7280] hover:bg-[#F6F7F9]'
                    }`}
            >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {isStreaming && <div className={`w-2 h-2 rounded-full animate-pulse ${isZen ? 'bg-stone-400' : 'bg-purple-500'}`} />}
                <Activity size={14} className={isDark ? (isZen ? 'text-[#687988]' : 'text-[#5FA8D3]') : (isZen ? 'text-[#687988]' : 'text-[#4A95C0]')} />
                <span>{isStreaming ? `Thinking... (${steps.length} steps)` : `Thinking Process (${steps.length} steps)`}</span>
            </button>

            {isExpanded && (
                <div className={`px-3 py-2 space-y-3 border-t ${isDark ? 'border-[#1F2630] bg-[#0B0D10]' : 'border-[#D9DEE5] bg-[#F6F7F9]'
                    }`}>
                    {steps.map((step, index) => (
                        <div key={index} className="text-xs">
                            {step.type === 'agent_handoff' ? (
                                <div className={`flex items-center gap-2 py-1.5 px-2 rounded-lg ${isDark
                                    ? isZen ? 'bg-[#687988]/10 text-stone-300' : 'bg-purple-500/10 text-purple-300'
                                    : isZen ? 'bg-stone-100 text-stone-700' : 'bg-purple-50 text-purple-700'}`}>
                                    <span className="text-sm">🔀</span>
                                    <span className="font-medium">Handed off to <span className="font-bold">{step.agent?.replace('Agent', ' Agent')}</span></span>
                                </div>
                            ) : step.type === 'tool_call' ? (
                                <div className="flex flex-col gap-1">
                                    <div className={`flex items-center gap-2 font-mono ${isDark ? 'text-[#A9AFB8]' : 'text-[#4B5563]'
                                        }`}>
                                        {getToolIcon(step.name)}
                                        <span className="font-semibold">{step.name}</span>
                                        {step.agent && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? 'bg-[#1F2630] text-[#7D8590]' : 'bg-[#ECEFF3] text-[#6B7280]'}`}>
                                                {step.agent.replace('Agent', '')}
                                            </span>
                                        )}
                                    </div>
                                    <pre className={`mt-1 p-2 rounded-lg overflow-x-auto font-mono ${isDark ? 'bg-[#1F2630] text-[#E6E8EB]' : 'bg-[#ECEFF3] text-[#0E1116]'
                                        }`}>
                                        {formatArgs(step.args)}
                                    </pre>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 pl-4 border-l-2 border-[#5FA8D3]/30">
                                    <span className={`italic ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                                        Result:
                                    </span>
                                    <div className={`p-2 rounded-lg ${isDark ? 'bg-[#1F2630]/50 text-[#A9AFB8]' : 'bg-white text-[#4B5563]'
                                        }`}>
                                        <code className="break-words whitespace-pre-wrap font-mono">
                                            {step.content}
                                        </code>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {isStreaming && (
                        <div className="flex items-center gap-2 text-xs py-1">
                            <div className="flex gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isZen ? 'bg-stone-400' : 'bg-purple-400'}`} style={{ animationDelay: '0ms' }} />
                                <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isZen ? 'bg-stone-400' : 'bg-purple-400'}`} style={{ animationDelay: '150ms' }} />
                                <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isZen ? 'bg-stone-400' : 'bg-purple-400'}`} style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}>Processing...</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ThinkingProcess;
