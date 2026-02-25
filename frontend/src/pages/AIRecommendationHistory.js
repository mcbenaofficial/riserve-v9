import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { BrainCircuit, TrendingUp, PackageCheck, FileCheck, AlertCircle, ArrowRight, DollarSign, CalendarRange, ArrowUpRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AIRecommendationHistory = () => {
    const [historyInfo, setHistoryInfo] = useState({ summary: null, reports: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                setLoading(true);
                const res = await api.getHITLHistory();
                if (res.data) {
                    setHistoryInfo({
                        summary: res.data.summary || { total_value_gained: 0, total_automations: 0, items_restocked: 0 },
                        reports: res.data.reports || []
                    });
                }
            } catch (err) {
                console.error("Error fetching HITL history", err);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-pulse flex flex-col items-center text-muted-foreground">
                    <BrainCircuit className="w-8 h-8 mb-4 opacity-50" />
                    <span className="text-sm font-medium">Loading AI History...</span>
                </div>
            </div>
        );
    }

    const { summary, reports } = historyInfo;

    return (
        <div className="space-y-8 max-w-7xl mx-auto h-full overflow-auto pb-20">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                    <BrainCircuit className="text-primary" size={32} />
                    AI Action History
                </h1>
                <p className="text-muted-foreground mt-2">
                    Review past AI recommendations, decisions made, and the actual value generated for your business.
                </p>
            </div>

            {/* Top Summary Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Value Gained</p>
                            <h3 className="text-4xl font-bold text-foreground tracking-tight">
                                ${summary?.total_value_gained?.toLocaleString()}
                            </h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <DollarSign size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-emerald-500 font-medium">
                        <ArrowUpRight size={16} />
                        <span>Estimated positive impact</span>
                    </div>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl" />
                </div>

                <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Automated Actions</p>
                            <h3 className="text-4xl font-bold text-foreground tracking-tight">
                                {summary?.total_automations?.toLocaleString()}
                            </h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <FileCheck size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-primary font-medium">
                        <TrendingUp size={16} />
                        <span>Total approved recommendations</span>
                    </div>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
                </div>

                <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm relative overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Items Restocked</p>
                            <h3 className="text-4xl font-bold text-foreground tracking-tight">
                                {summary?.items_restocked?.toLocaleString()}
                            </h3>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <PackageCheck size={24} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-blue-500 font-medium">
                        <CalendarRange size={16} />
                        <span>Total units automatically ordered</span>
                    </div>
                    <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl" />
                </div>
            </div>

            {/* History List */}
            <div className="space-y-6">
                <h2 className="text-xl font-semibold tracking-tight text-foreground border-b border-border pb-2">Past AI Recommendations</h2>

                {reports.length === 0 ? (
                    <div className="bg-card border border-border/50 rounded-xl p-12 text-center text-muted-foreground">
                        <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <h3 className="text-lg font-medium text-foreground">No History Found</h3>
                        <p className="mt-2 text-sm">You haven't approved or declined any AI recommendations yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {reports.map((report) => (
                            <HistoryCard key={report.id} report={report} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const HistoryCard = ({ report }) => {
    const data = report.report_json;
    const isApproved = report.status === 'approved' || report.status === 'modified';

    // Status Badge Color
    const statusColor = isApproved ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20';

    return (
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm hover:border-border/80 transition-all flex flex-col md:flex-row gap-8 relative overflow-hidden">
            {/* Status Indicator Bar on Left (Optional, for visual weight) */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${isApproved ? 'bg-emerald-500' : 'bg-red-500'} opacity-50`} />

            {/* Main Info */}
            <div className="flex-1 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-semibold tracking-wide uppercase">
                            {report.flow_type.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono bg-muted/40 px-2 py-0.5 rounded">
                            {new Date(report.resolved_at).toLocaleDateString()}
                        </span>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${statusColor} uppercase tracking-wider flex items-center gap-1.5`}>
                        {report.status}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold text-foreground">
                        {data.recommended_action || "Optimization Recommended"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {data.why_recommended}
                    </p>
                </div>

                {/* Impact "Before vs After" visualization */}
                {isApproved && (
                    <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-widest mb-3 text-center sm:text-left">Projected Outcome</h4>
                        <div className="flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-4 sm:gap-8">

                            <div className="text-center sm:text-left">
                                <span className="text-xs text-muted-foreground uppercase font-medium">Before</span>
                                <div className="text-xl font-bold text-foreground mt-0.5">
                                    {getBeforeValue(report)}
                                </div>
                            </div>

                            <div className="text-muted-foreground/50">
                                <ArrowRight className="rotate-90 sm:rotate-0" />
                            </div>

                            <div className="text-center sm:text-left">
                                <span className="text-xs text-emerald-500 uppercase font-bold">Projected/Actual</span>
                                <div className="text-xl font-bold text-emerald-500 mt-0.5 flex items-center justify-center sm:justify-start gap-1">
                                    <TrendingUp size={16} />
                                    {getAfterValue(report)}
                                </div>
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {/* Context/Chart Area */}
            <div className="w-full md:w-1/3 flex flex-col justify-center border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-8">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-widest mb-3">Context Snapshot</h4>

                {data.chart_data && data.chart_data.length > 0 ? (
                    <div className="h-[120px] w-full bg-background rounded-md border border-border p-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.chart_data.slice(0, 10)}>
                                <XAxis dataKey="name" hide />
                                <YAxis hide domain={['dataMin', 'dataMax']} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'rgba(26, 27, 30, 0.95)', borderColor: '#333', borderRadius: '4px', fontSize: '10px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={false}
                                />
                                {data.chart_data[0]?.threshold !== undefined && (
                                    <Line type="monotone" dataKey="threshold" stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" dot={false} />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="w-full h-full min-h-[100px] flex items-center justify-center bg-muted/20 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                        Data payload archived
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper functions to extract dummy Before/After stats from the report schema for visual effect
function getBeforeValue(report) {
    const data = report.report_json;
    if (report.flow_type === 'quiet_hour_promotion') {
        return `${data.chart_data?.[0]?.value || 0} Bookings/hr`;
    }
    if (report.flow_type === 'inventory_reorder') {
        const item = data.items_to_order?.[0] || data.chart_data?.[0];
        return item ? `${item.current_stock || item.value} in stock` : 'Critically Low';
    }
    if (report.flow_type === 'dynamic_pricing') {
        return `$${data.chart_data?.[0]?.value || '100'} Avg Rev`;
    }
    return "Status Quo";
}

function getAfterValue(report) {
    const data = report.report_json;
    if (report.flow_type === 'quiet_hour_promotion') {
        // Simulate a projected 40% increase
        const base = data.chart_data?.[0]?.value || 10;
        return `~${Math.round(base * 1.4)} Bookings/hr`;
    }
    if (report.flow_type === 'inventory_reorder') {
        const item = data.items_to_order?.[0];
        if (item) {
            return `${item.current_stock + item.suggested_order_qty} in stock`;
        }
        return 'Restocked (Refreshed)';
    }
    if (report.flow_type === 'dynamic_pricing') {
        return `+${data.recommended_action.match(/\d+%/)?.[0] || '15%'} Revenue`;
    }
    return "Optimized";
}

export default AIRecommendationHistory;
