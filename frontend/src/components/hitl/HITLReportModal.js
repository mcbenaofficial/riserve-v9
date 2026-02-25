import React, { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../ui/dialog';
import { Button } from '../ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle2, XCircle, Settings, Coins } from 'lucide-react';
import { api } from '../../services/api';

const HITLReportModal = ({ report, isOpen, onClose, onConfirm }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reason, setReason] = useState('');

    if (!report || !report.report_json) return null;

    const data = report.report_json;

    const handleAction = async (action) => {
        try {
            setIsSubmitting(true);
            await api.confirmHITLReport({
                report_id: report.id,
                action: action,
                reason: reason || undefined
            });
            onConfirm(report.id, action);
        } catch (err) {
            console.error("Failed to confirm report", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto bg-card text-card-foreground border-border">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium tracking-wide">
                            {report.flow_type.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-xs font-medium tracking-wide flex items-center gap-1">
                            <AlertCircle size={12} />
                            PENDING APPROVAL
                        </span>
                    </div>
                    <DialogTitle className="text-xl font-semibold tracking-tight">AI Recommendation</DialogTitle>
                    <DialogDescription className="text-muted-foreground mt-2">
                        {data.what_this_is}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">

                    {/* Why It's Recommended */}
                    <section className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground tracking-wide uppercase">Why It's Recommended</h4>
                        <div className="p-4 bg-muted/30 rounded-lg border border-border/50 shadow-sm leading-relaxed text-sm text-muted-foreground">
                            <p>{data.why_recommended}</p>
                        </div>

                        {data.chart_data && data.chart_data.length > 0 && (
                            <div className="h-[220px] w-full mt-4 bg-card border border-border/50 rounded-lg p-4 shadow-sm">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.chart_data} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} opacity={0.2} />
                                        <XAxis
                                            dataKey="name"
                                            stroke="#888"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: '#888' }}
                                        />
                                        <YAxis
                                            stroke="#888"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tickFormatter={(val) => data.chart_type === 'currency' ? `₹${val}` : val}
                                            tick={{ fill: '#888' }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'rgba(26, 27, 30, 0.95)',
                                                borderColor: '#333',
                                                borderRadius: '8px',
                                                color: '#fff',
                                                fontSize: '12px',
                                                backdropFilter: 'blur(4px)'
                                            }}
                                            itemStyle={{ color: '#fff' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="value"
                                            name={data.chart_type === 'inventory' ? 'Current Stock' : 'Actual'}
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 2 }}
                                            activeDot={{ r: 6, strokeWidth: 0 }}
                                            animationDuration={1500}
                                        />
                                        {data.chart_data[0]?.threshold !== undefined && (
                                            <Line
                                                type="monotone"
                                                dataKey="threshold"
                                                name={data.chart_type === 'inventory' ? 'Reorder Level' : 'Requirement'}
                                                stroke="#ef4444"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={false}
                                                animationDuration={1500}
                                            />
                                        )}
                                        {data.chart_data[0]?.goal !== undefined && (
                                            <Line
                                                type="monotone"
                                                dataKey="goal"
                                                name="Target"
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                strokeDasharray="3 3"
                                                dot={false}
                                                animationDuration={1500}
                                            />
                                        )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </section>

                    {/* How It Works & Who it Affects */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <section className="space-y-2">
                            <h4 className="text-sm font-semibold text-foreground tracking-wide uppercase">Who It Affects</h4>
                            <ul className="space-y-1">
                                {data.who_it_affects?.map((role, idx) => (
                                    <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-md border border-border/30">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/70" />
                                        {role}
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="space-y-2">
                            <h4 className="text-sm font-semibold text-foreground tracking-wide uppercase">How It Works</h4>
                            <ol className="space-y-2">
                                {data.how_it_works?.map((step, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-xs font-medium shrink-0">
                                            {idx + 1}
                                        </span>
                                        <span className="leading-tight">{step}</span>
                                    </li>
                                ))}
                            </ol>
                        </section>
                    </div>

                    {/* AI Info details */}
                    <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-2 text-sm text-foreground">
                            <Coins size={16} className="text-primary" />
                            <span>AI Execution Cost:</span>
                        </div>
                        <div className="text-sm font-semibold text-primary">
                            {data.cost_credits > 0 ? `${data.cost_credits} Boost Credits` : 'Free (Included)'}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-foreground tracking-wide uppercase hidden">Feedback (Optional)</h4>
                        <textarea
                            className="w-full h-20 bg-background border border-border rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder-muted-foreground"
                            placeholder="Optional: Tell the AI why you approved or declined this action to help it learn..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2 border-t border-border pt-4">
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto border-red-500/30 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                        onClick={() => handleAction('declined')}
                        disabled={isSubmitting}
                    >
                        <XCircle className="w-4 h-4 mr-2" />
                        Decline
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => handleAction('modified')}
                        disabled={isSubmitting}
                    >
                        <Settings className="w-4 h-4 mr-2" />
                        Modify
                    </Button>
                    <Button
                        className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        onClick={() => handleAction('approved')}
                        disabled={isSubmitting}
                    >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Approve Action
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default HITLReportModal;
