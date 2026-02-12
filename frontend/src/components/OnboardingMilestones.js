import React, { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Building2, MapPin, Sparkles, Database, CheckCircle2, Loader2, Circle } from 'lucide-react';

const MILESTONE_STEPS = [
    {
        id: 'company_profile',
        title: 'Company Profile',
        subtitle: 'Timezone, hours, currency',
        icon: Building2,
    },
    {
        id: 'first_outlet',
        title: 'First Location',
        subtitle: 'Outlet, resources, slots',
        icon: MapPin,
    },
    {
        id: 'services',
        title: 'Service Menu',
        subtitle: 'Prices, durations, types',
        icon: Sparkles,
    },
];

const OnboardingMilestones = ({ progress = {}, activeStep = null }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const completedSteps = progress.completed_steps || [];
    const percentage = progress.percentage || 0;

    const getStepStatus = (stepId) => {
        if (completedSteps.includes(stepId)) return 'complete';
        if (activeStep === stepId) return 'active';
        return 'pending';
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            padding: '32px 24px',
            position: 'relative',
        }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: isDark ? 'rgba(139,92,246,0.8)' : 'rgba(109,40,217,0.8)',
                    marginBottom: 8,
                }}>
                    Setup Progress
                </div>
                <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: isDark ? '#E6E8EB' : '#0E1116',
                    lineHeight: 1.2,
                }}>
                    {percentage >= 100 ? '🎉 All Set!' : `${percentage}% Complete`}
                </div>

                {/* Progress bar */}
                <div style={{
                    marginTop: 16,
                    height: 4,
                    borderRadius: 2,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%',
                        width: `${percentage}%`,
                        borderRadius: 2,
                        background: 'linear-gradient(90deg, #8B5CF6, #06B6D4)',
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    }} />
                </div>
            </div>

            {/* Milestone Rail */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>
                {MILESTONE_STEPS.map((step, index) => {
                    const status = getStepStatus(step.id);
                    const Icon = step.icon;
                    const isLast = index === MILESTONE_STEPS.length - 1;

                    return (
                        <div key={step.id} style={{ display: 'flex', gap: 16, position: 'relative' }}>
                            {/* Vertical line */}
                            {!isLast && (
                                <div style={{
                                    position: 'absolute',
                                    left: 19,
                                    top: 40,
                                    bottom: -8,
                                    width: 2,
                                    background: status === 'complete'
                                        ? 'linear-gradient(180deg, #8B5CF6, #06B6D4)'
                                        : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                    transition: 'background 0.5s ease',
                                }} />
                            )}

                            {/* Icon circle */}
                            <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: status === 'complete'
                                    ? 'linear-gradient(135deg, #8B5CF6, #06B6D4)'
                                    : status === 'active'
                                        ? isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'
                                        : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                                border: status === 'active'
                                    ? '2px solid rgba(139,92,246,0.5)'
                                    : status === 'complete'
                                        ? 'none'
                                        : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                transition: 'all 0.4s ease',
                                boxShadow: status === 'complete'
                                    ? '0 0 20px rgba(139,92,246,0.3)'
                                    : status === 'active'
                                        ? '0 0 15px rgba(139,92,246,0.15)'
                                        : 'none',
                            }}>
                                {status === 'complete' ? (
                                    <CheckCircle2 size={20} color="#fff" />
                                ) : status === 'active' ? (
                                    <Loader2 size={18} color="#8B5CF6" style={{ animation: 'spin 1.5s linear infinite' }} />
                                ) : (
                                    <Icon size={18} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
                                )}
                            </div>

                            {/* Content */}
                            <div style={{
                                flex: 1,
                                paddingBottom: isLast ? 0 : 28,
                                opacity: status === 'pending' ? 0.4 : 1,
                                transition: 'opacity 0.4s ease',
                            }}>
                                <div style={{
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: isDark ? '#E6E8EB' : '#0E1116',
                                    lineHeight: 1.3,
                                    marginTop: 2,
                                }}>
                                    {step.title}
                                </div>
                                <div style={{
                                    fontSize: 13,
                                    color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                    marginTop: 2,
                                }}>
                                    {step.subtitle}
                                </div>

                                {/* Completed data preview */}
                                {status === 'complete' && (
                                    <div style={{
                                        marginTop: 8,
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        background: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.05)',
                                        border: `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'}`,
                                        fontSize: 12,
                                        color: isDark ? 'rgba(139,92,246,0.8)' : 'rgba(109,40,217,0.7)',
                                        animation: 'fadeIn 0.5s ease',
                                    }}>
                                        ✓ Configured
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Powered by footer */}
            <div style={{
                marginTop: 'auto',
                paddingTop: 24,
                borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                fontSize: 11,
                color: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
                textAlign: 'center',
            }}>
                Powered by Ri'Serve AI
            </div>

            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
};

export default OnboardingMilestones;
