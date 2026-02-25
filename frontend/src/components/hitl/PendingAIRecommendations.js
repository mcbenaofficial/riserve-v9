import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BrainCircuit, Filter, Clock, Activity, CheckCircle2, ChevronDown } from 'lucide-react';
import HITLReportModal from './HITLReportModal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

const PendingAIRecommendations = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [filter, setFilter] = useState('all'); // all, high-priority, revenue

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await api.getPendingHITLReports();
            if (res.data && res.data.reports) {
                setReports(res.data.reports);
            }
        } catch (err) {
            console.error("Error fetching HITL reports", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    const handleConfirm = (reportId, action) => {
        setReports(prev => prev.filter(r => r.id !== reportId));
        setSelectedReport(null);
    };

    const getPriorityColor = (flowType) => {
        if (flowType.includes('revenue') || flowType.includes('pricing')) return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
        if (flowType.includes('no_show') || flowType.includes('booking')) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    };

    const filteredReports = reports.filter(r => {
        if (filter === 'all') return true;
        if (filter === 'revenue') return r.flow_type.includes('revenue') || r.flow_type.includes('pricing');
        return true;
    });

    if (loading) {
        return (
            <div className="w-full h-48 flex items-center justify-center border border-border/50 rounded-xl bg-card">
                <div className="animate-pulse flex flex-col items-center">
                    <BrainCircuit className="w-8 h-8 text-primary/50 mb-3" />
                    <p className="text-muted-foreground font-medium tracking-tight mt-2 text-sm">Fetching Agent Insights...</p>
                </div>
            </div>
        );
    }

    if (reports.length === 0) {
        return (
            <div className="w-full h-48 flex flex-col items-center justify-center border border-border border-dashed rounded-xl bg-card border-border/50">
                <CheckCircle2 className="w-10 h-10 text-emerald-500/50 mb-3" />
                <h3 className="text-lg font-medium tracking-tight text-foreground">All Caught Up</h3>
                <p className="text-muted-foreground text-sm mt-1">No pending AI actions require your review right now.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
                        <BrainCircuit className="text-primary" />
                        Pending AI Recommendations
                        <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary border border-primary/30">
                            {reports.length}
                        </Badge>
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Review high-value actions proposed by the Vorta swarm before execution.
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg border border-border/50">
                    <Button
                        variant={filter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('all')}
                        className="h-8 shadow-sm"
                    >
                        All
                    </Button>
                    <Button
                        variant={filter === 'revenue' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setFilter('revenue')}
                        className="h-8 shadow-sm flex items-center gap-1.5"
                    >
                        <Activity className="w-3.5 h-3.5" />
                        Revenue Impact
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredReports.map(report => (
                    <div
                        key={report.id}
                        className="group flex flex-col p-5 rounded-xl border border-border/50 bg-card hover:bg-muted/10 hover:border-primary/40 transition-all cursor-pointer shadow-sm relative overflow-hidden"
                        onClick={() => setSelectedReport(report)}
                    >
                        {/* Status bar left */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary/50 to-primary/10 rounded-l-xl opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Badge className={`px-2 py-0.5 border ${getPriorityColor(report.flow_type)}`}>
                                    {report.flow_type.replace('_', ' ').toUpperCase()}
                                </Badge>
                                <span className="flex items-center text-xs text-muted-foreground font-medium">
                                    <Clock className="w-3.5 h-3.5 mr-1" />
                                    {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-xs font-medium bg-primary/5 hover:bg-primary border-primary/20 hover:text-primary-foreground transition-colors hidden sm:flex">
                                Review Details
                            </Button>
                        </div>

                        <h3 className="font-medium text-foreground text-lg tracking-tight mb-2">
                            {report.report_json?.recommended_action || "Optimization Recommended"}
                        </h3>

                        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                            {report.report_json?.what_this_is || report.flow_type}
                        </p>

                        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground font-medium">
                            <span>Requires Manual Approval</span>
                            <span className="flex items-center gap-1">
                                {report.report_json?.cost_credits || 0} AI Credits
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {selectedReport && (
                <HITLReportModal
                    isOpen={!!selectedReport}
                    onClose={() => setSelectedReport(null)}
                    report={selectedReport}
                    onConfirm={handleConfirm}
                />
            )}
        </div>
    );
};

export default PendingAIRecommendations;
