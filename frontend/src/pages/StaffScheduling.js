import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { AlertTriangle, ArrowRight, Check, X, Calendar, Settings, TrendingUp, Users, DollarSign, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const StaffScheduling = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isApplied, setIsApplied] = useState(false);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const token = localStorage.getItem('ridn_token');
                const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/api/analytics/staff-scheduling`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                }
            } catch (err) {
                console.error("Failed to fetch staff scheduling data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    const getHeatmapColor = (value) => {
        if (value >= 100) return 'bg-red-900/80 text-red-200 border-red-700';
        if (value >= 85) return 'bg-red-800/60 text-red-200 border-red-600';
        if (value >= 70) return 'bg-amber-700/60 text-amber-200 border-amber-600';
        if (value >= 50) return 'bg-amber-600/40 text-amber-200 border-amber-500';
        return 'bg-emerald-800/60 text-emerald-200 border-emerald-600';
    };

    const getProgressColor = (utilization) => {
        if (utilization >= 75) return 'bg-emerald-500';
        if (utilization >= 50) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const bgClass = isDark ? 'bg-[#0B0D10]' : 'bg-[#F6F7F9]';
    const cardClass = isDark ? 'bg-[#151B25] border-[#2A3441]' : 'bg-white border-[#D9DEE5]';
    const textMain = isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]';
    const textMuted = isDark ? 'text-[#8B949E]' : 'text-[#6B7280]';

    if (loading) {
        return (
            <div className={`min-h-full flex items-center justify-center p-6 ${textMain}`}>
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={32} className="animate-spin text-sky-500" />
                    <p className={textMuted}>Running CPO Agent Analysis...</p>
                </div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className={`min-h-full p-6 space-y-6 max-w-[1600px] mx-auto ${textMain}`}>
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h1 className="text-2xl font-bold">Staff Scheduling Optimization</h1>
                    <p className={`text-sm mt-1 ${textMuted}`}>AI-driven analysis of booking patterns and staff utilization.</p>
                </div>
            </div>

            {/* 1. Pipeline Flow */}
            <div className="flex items-center gap-4 w-full">
                {data.pipeline_steps.map((step, idx) => (
                    <React.Fragment key={step.id}>
                        <div className={`flex-1 p-4 rounded-xl border ${cardClass} flex flex-col justify-center`}>
                            <h3 className="font-semibold text-[15px] tracking-wide text-sky-400 mb-1">{step.title}</h3>
                            <p className={`text-[13px] ${textMuted}`}>{step.subtitle}</p>
                        </div>
                        {idx < data.pipeline_steps.length - 1 && (
                            <ArrowRight size={20} className="text-sky-500 flex-shrink-0 mx-1 opacity-70" />
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* 2. Alert Banner */}
            <div className={`w-full flex items-center justify-between p-5 rounded-xl border-l-4 border-l-amber-500 bg-[#252C3B] border-y-[#2A3441] border-r-[#2A3441] border-y border-r shadow-sm`}>
                <div className="flex items-start gap-4">
                    <AlertTriangle size={24} className="text-amber-500 mt-1 flex-shrink-0" />
                    <div>
                        <h2 className="text-lg font-bold text-amber-500 mb-1 tracking-wide">{data.alert.title}</h2>
                        <p className="text-sm text-[#A9AFB8]">{data.alert.message}</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        const el = document.getElementById('recommendations-panel');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="whitespace-nowrap ml-6 px-5 py-2.5 bg-[#38BDF8] hover:bg-[#0EA5E9] text-gray-900 font-bold text-sm rounded-lg transition-colors shadow-md"
                >
                    View Recommendations
                </button>
            </div>

            {/* 3. KPI Metrics */}
            <div className="grid grid-cols-4 gap-6">
                <div className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center ${cardClass}`}>
                    <span className="text-4xl font-bold text-red-500 mb-3 tracking-tight">{data.kpi_metrics.idle_time}</span>
                    <span className={`text-sm font-medium ${textMuted}`}>{data.kpi_metrics.idle_time_label}</span>
                </div>
                <div className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center ${cardClass}`}>
                    <span className="text-4xl font-bold text-red-500 mb-3 tracking-tight">{data.kpi_metrics.overbooking}</span>
                    <span className={`text-sm font-medium ${textMuted}`}>{data.kpi_metrics.overbooking_label}</span>
                </div>
                <div className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center ${cardClass}`}>
                    <span className="text-4xl font-bold text-emerald-500 mb-3 tracking-tight">{data.kpi_metrics.savings_potential}</span>
                    <span className={`text-sm font-medium ${textMuted}`}>Payroll Savings Potential</span>
                </div>
                <div className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center ${cardClass}`}>
                    <span className="text-4xl font-bold text-sky-400 mb-3 tracking-tight">{data.kpi_metrics.monthly_savings}</span>
                    <span className={`text-sm font-medium ${textMuted}`}>Monthly Wage Savings</span>
                </div>
            </div>

            {/* 4. Weekly Stylist Utilization Heatmap */}
            <div className={`p-6 rounded-xl border ${cardClass}`}>
                <h3 className="text-xl font-bold text-sky-400 mb-2">Weekly Stylist Utilization Heatmap</h3>
                <p className={`text-xs ${textMuted} mb-6`}>Color intensity shows booking density. Red = overbooked, Orange = optimal, Green = underutilized.</p>

                <div className="w-full">
                    {/* Header Row */}
                    <div className="flex w-full mb-1">
                        <div className="w-24 flex-shrink-0"></div>
                        <div className="flex-1 grid grid-cols-7 gap-1">
                            {data.heatmap.days.map(day => (
                                <div key={day} className={`text-[13px] font-medium text-sky-400 px-2 py-1 bg-[#1F2630] border-[#2A3441] border rounded-t`} >{day}</div>
                            ))}
                        </div>
                    </div>
                    {/* Time Rows */}
                    {data.heatmap.time_slots.map((time, rowIdx) => (
                        <div key={time} className="flex w-full mb-1">
                            <div className={`w-24 flex-shrink-0 text-[12px] font-medium pr-4 flex items-center justify-end ${textMain}`}>
                                {time}
                            </div>
                            <div className="flex-1 grid grid-cols-7 gap-1">
                                {data.heatmap.data.map((col, colIdx) => {
                                    const val = col[rowIdx];
                                    return (
                                        <div key={`${rowIdx}-${colIdx}`} className={`h-12 flex items-center justify-center text-xs font-bold border rounded-sm ${getHeatmapColor(val)}`}>
                                            {val}%
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5. Stylist Utilization Table */}
            <div className={`p-6 rounded-xl border ${cardClass}`}>
                <h3 className="text-xl font-bold text-sky-400 mb-6">Stylist Utilization: {data.outlet_name}</h3>

                <div className="w-full overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#2A3441]">
                                <th className="pb-3 text-[13px] font-bold text-sky-400 w-1/4">Stylist Name</th>
                                <th className="pb-3 text-[13px] font-bold text-sky-400 w-1/4">Avg Weekly Utilization</th>
                                <th className="pb-3 text-[13px] font-bold text-sky-400 w-[15%]">Idle Hours/Week</th>
                                <th className="pb-3 text-[13px] font-bold text-sky-400 w-[15%]">Peak Availability</th>
                                <th className="pb-3 text-[13px] font-bold text-sky-400 w-[10%]">Status</th>
                                <th className="pb-3 text-[13px] font-bold text-sky-400 w-[15%]">Recommendation</th>
                            </tr>
                        </thead>
                        <tbody className="text-[14px]">
                            {data.stylists.map((stylist, index) => (
                                <tr key={index} className="border-b border-[#2A3441]/50 last:border-0 hover:bg-white/5 transition-colors">
                                    <td className="py-4">
                                        <div className="font-bold text-[#E6E8EB]">{stylist.name}</div>
                                        <div className="text-[12px] text-[#A9AFB8] mt-0.5">{stylist.role}</div>
                                    </td>
                                    <td className="py-4 pr-12">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-bold text-[#E6E8EB]">{stylist.utilization}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-[#1F2630] rounded-full overflow-hidden">
                                            <div className={`h-full ${getProgressColor(stylist.utilization)}`} style={{ width: `${stylist.utilization}%` }}></div>
                                        </div>
                                    </td>
                                    <td className="py-4 font-medium text-[#E6E8EB]">{stylist.idle} hrs</td>
                                    <td className={`py-4 font-bold ${stylist.peakColor}`}>{stylist.peak}</td>
                                    <td className="py-4">
                                        <span className={`px-2.5 py-1 text-[11px] font-bold rounded uppercase tracking-wider border bg-black/20 ${stylist.statusColor}`}>
                                            {stylist.status}
                                        </span>
                                    </td>
                                    <td className="py-4">
                                        {stylist.actionType === 'primary' ? (
                                            <button className="px-4 py-1.5 bg-[#38BDF8] hover:bg-[#0EA5E9] text-gray-900 font-bold text-[12px] rounded uppercase tracking-wide transition-colors">
                                                {stylist.actionText}
                                            </button>
                                        ) : (
                                            <span className="text-[#A9AFB8] text-[13px]">{stylist.actionText}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 6. CPO Agent Recommendations Panel */}
            <div id="recommendations-panel" className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                <div className={`col-span-full p-6 rounded-xl border flex flex-col justify-between ${cardClass} relative overflow-hidden bg-gradient-to-br from-[#151B25] to-[#1a2333]`}>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>

                    <div className="space-y-5 relative z-10">
                        <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                            <Check size={24} strokeWidth={3} className="text-emerald-500" />
                            CPO Agent Recommendations
                        </h3>

                        <div className="space-y-4">
                            {data.recommendations.map(rec => (
                                <div key={rec.id}>
                                    <h4 className="text-[#38BDF8] font-bold text-[15px] mb-1">{rec.title}</h4>
                                    <p className="text-[13px] text-[#A9AFB8]">{rec.description}</p>
                                </div>
                            ))}
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => setIsApplied(true)}
                                disabled={isApplied}
                                className={`px-6 py-2.5 font-bold text-[14px] rounded-lg transition-colors shadow-md ${isApplied ? 'bg-emerald-500 text-white cursor-default' : 'bg-[#38BDF8] hover:bg-[#0EA5E9] text-gray-900'}`}
                            >
                                {isApplied ? 'Recommendations Applied ✓' : 'Apply Recommendations'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* State Comparisons */}
                <div className={`p-6 rounded-xl border border-[#2A3441] bg-[#1A1F2B] relative overflow-hidden`}>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                    <h3 className="text-xl font-bold text-red-500 flex items-center gap-2 mb-5">
                        <X size={24} strokeWidth={3} className="text-red-500" />
                        Current State
                    </h3>
                    <ul className="space-y-4">
                        {data.comparison_current.map((item, i) => (
                            <li key={i} className="flex gap-3 text-[#A9AFB8] text-[14px] items-start">
                                <X size={16} strokeWidth={3} className="text-[#A9AFB8] mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={`p-6 rounded-xl border border-[#2A3441] bg-[#162128] relative overflow-hidden`}>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#38BDF8]"></div>
                    <h3 className="text-xl font-bold text-emerald-400 flex items-center gap-2 mb-5">
                        <Check size={24} strokeWidth={3} className="text-emerald-500" />
                        Optimized State (CPO Agent)
                    </h3>
                    <ul className="space-y-4">
                        {data.comparison_optimized.map((item, i) => (
                            <li key={i} className="flex gap-3 text-[#E6E8EB] text-[14px] items-start">
                                <Check size={16} strokeWidth={3} className="text-[#E6E8EB] mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>

            </div>

        </div>
    );
};

export default StaffScheduling;
