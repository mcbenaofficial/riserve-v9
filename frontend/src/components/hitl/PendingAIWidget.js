import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { BrainCircuit, ChevronRight, AlertCircle, Clock } from 'lucide-react';
import HITLReportModal from './HITLReportModal';
import { Link } from 'react-router-dom';
import { Button } from '../ui/button';

const PendingAIWidget = () => {
    const [pendingReports, setPendingReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);

    const fetchReports = async () => {
        try {
            setLoading(true);
            const res = await api.getPendingHITLReports();
            if (res.data && res.data.reports) {
                setPendingReports(res.data.reports);
            }
        } catch (err) {
            console.error("Error fetching HITL reports", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReports();

        // Polling for real-time feel (can be swapped for websockets)
        const intervalId = setInterval(fetchReports, 60000);
        return () => clearInterval(intervalId);
    }, []);

    const handleConfirm = (reportId, action) => {
        setPendingReports(prev => prev.filter(r => r.id !== reportId));
        setSelectedReport(null);
    };

    if (loading && pendingReports.length === 0) {
        return (
            <div className="bg-card w-full border border-border/50 rounded-xl p-6 shadow-sm flex items-center justify-center animate-pulse h-[160px]">
                <div className="text-muted-foreground flex flex-col items-center">
                    <BrainCircuit className="w-6 h-6 mb-2 opacity-50" />
                    <span className="text-sm">Checking AI Agents...</span>
                </div>
            </div>
        );
    }

    if (pendingReports.length === 0) {
        return null; // Don't show widget if zero pending tasks to keep quiet luxury feel
    }

    // Sort to show highest priority or just most recent
    const topReports = pendingReports.slice(0, 3);

    return (
        <div className="bg-gradient-to-br from-card to-card/50 border border-primary/20 rounded-xl p-5 shadow-sm relative overflow-hidden backdrop-blur-xl">
            {/* Background Glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/20 text-primary">
                        <BrainCircuit size={16} />
                    </div>
                    <h3 className="font-semibold text-foreground tracking-tight">AI Waiting on You</h3>
                    <span className="ml-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                        {pendingReports.length}
                    </span>
                </div>
                <Link to="/analytics/ai-reports" className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center">
                    View All <ChevronRight size={12} className="ml-0.5" />
                </Link>
            </div>

            <div className="space-y-3 relative z-10">
                {topReports.map((report) => (
                    <div
                        key={report.id}
                        className="group flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer shadow-sm"
                        onClick={() => setSelectedReport(report)}
                    >
                        <div className="flex items-start gap-3 flex-1 overflow-hidden">
                            <div className="mt-0.5 text-amber-500">
                                <AlertCircle size={14} />
                            </div>
                            <div className="flex-1 truncate">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {report.report_json?.recommended_action || "Optimization Recommended"}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                    {report.report_json?.what_this_is || report.flow_type.replace('_', ' ')}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-2 whitespace-nowrap hidden sm:flex">
                            <Clock size={12} />
                            <span>Action Req.</span>
                        </div>
                        <Button variant="ghost" size="sm" className="hidden group-hover:flex ml-2 h-7 px-2 text-xs bg-primary/10 text-primary hover:bg-primary/20">
                            Review
                        </Button>
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

export default PendingAIWidget;
