import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sparkles } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OnboardingResumeWidget = () => {
    const { user, token } = useAuth();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const isDark = theme === 'dark';
    const [progress, setProgress] = useState(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const fetchProgress = async () => {
            try {
                const res = await fetch(`${API}/onboarding/progress`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();

                // Show widget if onboarding is incomplete and not explicitly completed
                if (data.percentage < 100 && !data.completed_at) {
                    setProgress(data);
                    setVisible(true);
                } else {
                    setVisible(false);
                }
            } catch (err) {
                console.error('Resume widget error:', err);
            }
        };

        if (token && user?.company_id) {
            fetchProgress();
        }
    }, [token, user]);

    if (!visible || !progress) return null;

    const pct = progress.percentage || 0;
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;

    return (
        <div
            onClick={() => navigate('/onboarding')}
            style={{
                margin: '8px 12px',
                padding: '10px 14px',
                borderRadius: 12,
                background: isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.05)',
                border: `1px solid ${isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)'}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.08)';
                e.currentTarget.style.transform = 'translateX(2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.05)';
                e.currentTarget.style.transform = 'translateX(0)';
            }}
        >
            {/* Circular progress */}
            <svg width="36" height="36" viewBox="0 0 36 36">
                <circle
                    cx="18" cy="18" r={radius}
                    fill="none"
                    stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                    strokeWidth="3"
                />
                <circle
                    cx="18" cy="18" r={radius}
                    fill="none"
                    stroke="url(#progressGradient)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 18 18)"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
                <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#8B5CF6" />
                        <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                </defs>
                <Sparkles
                    size={14}
                    x={11}
                    y={11}
                    color={isDark ? 'rgba(139,92,246,0.7)' : 'rgba(109,40,217,0.6)'}
                />
            </svg>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isDark ? '#E6E8EB' : '#0E1116',
                    lineHeight: 1.3,
                }}>
                    Complete Setup
                </div>
                <div style={{
                    fontSize: 11,
                    color: isDark ? 'rgba(139,92,246,0.7)' : 'rgba(109,40,217,0.6)',
                }}>
                    {pct}% done
                </div>
            </div>
        </div>
    );
};

export default OnboardingResumeWidget;
