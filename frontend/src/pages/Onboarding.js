import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import OnboardingMilestones from '../components/OnboardingMilestones';
import {
    Send, Sparkles, Bot, User, ArrowRight, SkipForward, Loader2,
    CheckCircle2, Zap, Building2, MapPin, Star, ChevronRight,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ─── Fallback Form (when LLM is unavailable) ────────────────
const FallbackForm = ({ onComplete, theme }) => {
    const isDark = theme === 'dark';
    const [step, setStep] = useState(0);
    const [formData, setFormData] = useState({
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        hours_start: '09:00',
        hours_end: '18:00',
        working_days: 'Monday,Tuesday,Wednesday,Thursday,Friday,Saturday',
        city: '',
        outlet_name: '',
        resources: '3',
        service_1_name: '',
        service_1_price: '',
    });

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        borderRadius: 12,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
        color: isDark ? '#E6E8EB' : '#0E1116',
        fontSize: 14,
        outline: 'none',
        transition: 'border-color 0.2s',
    };

    const buttonStyle = {
        padding: '12px 24px',
        borderRadius: 12,
        border: 'none',
        background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    };

    const steps = [
        {
            title: 'Company Details',
            fields: [
                { key: 'city', label: 'City', placeholder: 'e.g. Mumbai' },
                { key: 'hours_start', label: 'Opening Time', placeholder: '09:00' },
                { key: 'hours_end', label: 'Closing Time', placeholder: '18:00' },
            ],
        },
        {
            title: 'First Outlet',
            fields: [
                { key: 'outlet_name', label: 'Outlet Name', placeholder: 'e.g. Main Branch' },
                { key: 'resources', label: 'Number of Resources', placeholder: '3' },
            ],
        },
        {
            title: 'First Service',
            fields: [
                { key: 'service_1_name', label: 'Service Name', placeholder: 'e.g. Haircut' },
                { key: 'service_1_price', label: 'Price', placeholder: '500' },
            ],
        },
    ];

    const handleSubmit = async () => {
        // Submit via standard API calls
        const token = localStorage.getItem('ridn_token');
        const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

        try {
            // This is a simplified fallback — full API calls for each step
            // Step 1: Company profile
            await fetch(`${API}/onboarding/chat`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message: `Set up my company profile: city ${formData.city}, hours ${formData.hours_start} to ${formData.hours_end}, timezone ${formData.timezone}, currency ${formData.currency}`,
                }),
            });

            onComplete();
        } catch (err) {
            console.error('Fallback form error:', err);
        }
    };

    const currentStep = steps[step];

    return (
        <div style={{ padding: 32, maxWidth: 480, margin: '0 auto' }}>
            <div style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: isDark ? 'rgba(139,92,246,0.8)' : 'rgba(109,40,217,0.8)',
                marginBottom: 8,
            }}>
                Step {step + 1} of {steps.length}
            </div>
            <h2 style={{
                fontSize: 24,
                fontWeight: 700,
                color: isDark ? '#E6E8EB' : '#0E1116',
                marginBottom: 24,
            }}>
                {currentStep.title}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {currentStep.fields.map((field) => (
                    <div key={field.key}>
                        <label style={{
                            display: 'block',
                            fontSize: 13,
                            fontWeight: 500,
                            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                            marginBottom: 6,
                        }}>
                            {field.label}
                        </label>
                        <input
                            style={inputStyle}
                            placeholder={field.placeholder}
                            value={formData[field.key]}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        />
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 32, justifyContent: 'flex-end' }}>
                {step > 0 && (
                    <button
                        onClick={() => setStep(step - 1)}
                        style={{ ...buttonStyle, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: isDark ? '#E6E8EB' : '#0E1116' }}
                    >
                        Back
                    </button>
                )}
                {step < steps.length - 1 ? (
                    <button onClick={() => setStep(step + 1)} style={buttonStyle}>
                        Next <ChevronRight size={16} />
                    </button>
                ) : (
                    <button onClick={handleSubmit} style={buttonStyle}>
                        Complete Setup <CheckCircle2 size={16} />
                    </button>
                )}
            </div>
        </div>
    );
};


// ─── Main Onboarding Page ────────────────────────────────────
const Onboarding = () => {
    const { user, token } = useAuth();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const isDark = theme === 'dark';

    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [progress, setProgress] = useState({ percentage: 0, completed_steps: [], pending_steps: [] });
    const [agentState, setAgentState] = useState('idle'); // idle, thinking, answering
    const [activeAgent, setActiveAgent] = useState('');
    const [useFallback, setUseFallback] = useState(false);
    const hasStarted = useRef(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // ... scroll logic ...

    // Scroll to bottom
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Fetch initial progress
    useEffect(() => {
        const fetchProgress = async () => {
            try {
                const res = await fetch(`${API}/onboarding/progress`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                setProgress(data);
                if (data.conversation_id) {
                    setConversationId(data.conversation_id);
                }
                if (data.percentage >= 100) {
                    navigate('/');
                    return;
                }
            } catch (err) {
                console.error('Failed to fetch progress:', err);
            }
        };
        if (token) fetchProgress();
    }, [token, navigate]);

    // Auto-start conversation
    useEffect(() => {
        if (token && !hasStarted.current && messages.length === 0) {
            hasStarted.current = true;
            sendMessage("Hi, I'd like to set up my business.");
        }
    }, [token]);

    // Get active step for milestone tracker
    const getActiveStep = () => {
        const steps = ['company_profile', 'first_outlet', 'services'];
        for (const step of steps) {
            if (!progress.completed_steps?.includes(step)) return step;
        }
        return null;
    };

    // ─── Send Message ──────────────────────────────────────────
    const sendMessage = async (msg) => {
        const messageText = msg || inputMessage.trim();
        if (!messageText || isLoading) return;
        setInputMessage('');

        // Add user message (skip the auto-start message from display)
        const isAutoStart = messageText === "Hi, I'd like to set up my business." && messages.length === 0;
        if (!isAutoStart) {
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'user',
                content: messageText,
            }]);
        }

        setIsLoading(true);
        setAgentState('thinking');

        try {
            const res = await fetch(`${API}/onboarding/chat`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: messageText,
                    conversation_id: conversationId,
                }),
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let currentResponse = '';
            let buffer = '';

            // Add assistant placeholder
            const assistantMsgId = Date.now() + 1;
            setMessages(prev => [...prev, {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                thinking: [],
                agent: '',
            }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const event = JSON.parse(jsonStr);

                        switch (event.type) {
                            case 'conversation_id':
                                setConversationId(event.conversation_id);
                                break;

                            case 'thinking_step':
                                setAgentState('thinking');
                                if (event.step?.type === 'agent_handoff') {
                                    setActiveAgent(event.step.agent);
                                }
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId
                                        ? { ...m, thinking: [...(m.thinking || []), event.step] }
                                        : m
                                ));
                                break;

                            case 'token':
                                setAgentState('answering');
                                currentResponse += event.content;
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId
                                        ? { ...m, content: currentResponse }
                                        : m
                                ));
                                break;

                            case 'answer':
                                currentResponse = event.content;
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId
                                        ? { ...m, content: event.content }
                                        : m
                                ));
                                break;

                            case 'progress':
                                setProgress(event.progress);
                                // If complete, show celebration and redirect after delay
                                if (event.progress.percentage >= 100) {
                                    setTimeout(() => navigate('/'), 4000);
                                }
                                break;

                            case 'done':
                                if (event.progress) setProgress(event.progress);
                                if (event.progress?.percentage >= 100) {
                                    setTimeout(() => navigate('/'), 4000);
                                }
                                break;

                            case 'error':
                                if (event.content?.includes('API Key missing')) {
                                    setUseFallback(true);
                                }
                                setMessages(prev => prev.map(m =>
                                    m.id === assistantMsgId
                                        ? { ...m, content: event.content || 'An error occurred. Please try again.' }
                                        : m
                                ));
                                break;

                            default:
                                break;
                        }
                    } catch (parseErr) {
                        // Skip unparseable chunks
                    }
                }
            }
        } catch (err) {
            console.error('Chat error:', err);
            setMessages(prev => [...prev, {
                id: Date.now() + 2,
                role: 'assistant',
                content: 'I had trouble connecting. Please try again in a moment.',
            }]);
        } finally {
            setIsLoading(false);
            setAgentState('idle');
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleSkip = async () => {
        try {
            await fetch(`${API}/onboarding/skip`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            navigate('/');
        } catch (err) {
            console.error('Skip error:', err);
            navigate('/');
        }
    };

    // ─── Agent name display ─────────────────────────────────────
    const agentDisplayName = {
        'OnboardingTriageAgent': 'Onboarding Assistant',
        'CompanySetupAgent': 'Company Setup',
        'OutletConfigAgent': 'Location Setup',
        'ServiceSetupAgent': 'Service Setup',
        'DataImportAgent': 'Data Import',
    };

    // ─── Render ─────────────────────────────────────────────────
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            background: isDark
                ? 'radial-gradient(ellipse at 20% 20%, rgba(139,92,246,0.08) 0%, #0A0A0F 50%), #0A0A0F'
                : 'radial-gradient(ellipse at 20% 20%, rgba(139,92,246,0.05) 0%, #F8F9FA 50%), #F8F9FA',
            fontFamily: "'Inter', -apple-system, sans-serif",
        }}>
            {/* Left Panel — Milestones */}
            <div style={{
                width: 320,
                flexShrink: 0,
                borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.8)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Logo */}
                <div style={{
                    padding: '24px 24px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                }}>
                    <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Zap size={16} color="#fff" />
                    </div>
                    <span style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: isDark ? '#E6E8EB' : '#0E1116',
                        letterSpacing: '-0.02em',
                    }}>
                        Ri'Serve
                    </span>
                </div>

                <OnboardingMilestones
                    progress={progress}
                    activeStep={getActiveStep()}
                />
            </div>

            {/* Right Panel — Chat */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Top Bar */}
                <div style={{
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.6)',
                    backdropFilter: 'blur(12px)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {/* Agent avatar */}
                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: agentState !== 'idle'
                                ? '0 0 20px rgba(139,92,246,0.4)'
                                : 'none',
                            transition: 'box-shadow 0.3s ease',
                        }}>
                            <Bot size={18} color="#fff" />
                        </div>
                        <div>
                            <div style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: isDark ? '#E6E8EB' : '#0E1116',
                            }}>
                                {activeAgent ? agentDisplayName[activeAgent] || 'Setup Agent' : 'Onboarding Assistant'}
                            </div>
                            <div style={{
                                fontSize: 12,
                                color: agentState === 'thinking'
                                    ? '#8B5CF6'
                                    : agentState === 'answering'
                                        ? '#06B6D4'
                                        : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                                transition: 'color 0.3s ease',
                            }}>
                                {agentState === 'thinking' ? '● Thinking...'
                                    : agentState === 'answering' ? '● Typing...'
                                        : '● Online'}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSkip}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            background: 'transparent',
                            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                            fontSize: 13,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
                        }}
                    >
                        <SkipForward size={14} /> Skip for now
                    </button>
                </div>

                {/* Messages Area */}
                {useFallback ? (
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <FallbackForm
                            onComplete={() => navigate('/')}
                            theme={theme}
                        />
                    </div>
                ) : (
                    <div style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '24px 24px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                    }}>
                        {messages.map((msg) => (
                            <div key={msg.id} style={{
                                display: 'flex',
                                gap: 12,
                                alignItems: 'flex-start',
                                maxWidth: msg.role === 'user' ? '70%' : '85%',
                                marginLeft: msg.role === 'user' ? 'auto' : 0,
                                animation: 'messageIn 0.3s ease',
                            }}>
                                {msg.role === 'assistant' && (
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        marginTop: 2,
                                    }}>
                                        <Sparkles size={14} color="#fff" />
                                    </div>
                                )}

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {/* Thinking steps */}
                                    {msg.thinking?.length > 0 && (
                                        <div style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 4,
                                            marginBottom: 4,
                                        }}>
                                            {msg.thinking
                                                .filter(s => s.type === 'tool_call' || s.type === 'agent_handoff')
                                                .slice(-3)
                                                .map((step, i) => (
                                                    <div key={i} style={{
                                                        fontSize: 11,
                                                        color: isDark ? 'rgba(139,92,246,0.6)' : 'rgba(109,40,217,0.5)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        padding: '4px 10px',
                                                        borderRadius: 6,
                                                        background: isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.04)',
                                                    }}>
                                                        {step.type === 'agent_handoff' ? (
                                                            <><ArrowRight size={10} /> Switched to {agentDisplayName[step.agent] || step.agent}</>
                                                        ) : (
                                                            <><Zap size={10} /> {step.name?.replace(/_/g, ' ')}</>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    )}

                                    {/* Message bubble */}
                                    <div style={{
                                        padding: '12px 16px',
                                        borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        background: msg.role === 'user'
                                            ? 'linear-gradient(135deg, #8B5CF6, #7C3AED)'
                                            : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                        border: msg.role === 'assistant'
                                            ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                                            : 'none',
                                        color: msg.role === 'user'
                                            ? '#fff'
                                            : isDark ? '#E6E8EB' : '#0E1116',
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                    }}>
                                        {msg.content || (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
                                                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                                                Thinking...
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {msg.role === 'user' && (
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        marginTop: 2,
                                    }}>
                                        <User size={14} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'} />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Completion celebration */}
                        {progress.percentage >= 100 && (
                            <div style={{
                                textAlign: 'center',
                                padding: 32,
                                animation: 'fadeIn 0.5s ease',
                            }}>
                                <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
                                <div style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: isDark ? '#E6E8EB' : '#0E1116',
                                    marginBottom: 8,
                                }}>
                                    You're all set!
                                </div>
                                <div style={{
                                    fontSize: 14,
                                    color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
                                }}>
                                    Redirecting you to your dashboard...
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}

                {/* Input Area */}
                {!useFallback && (
                    <div style={{
                        padding: '16px 24px 24px',
                        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}>
                        {/* Quick suggestions */}
                        {messages.length <= 2 && (
                            <div style={{
                                display: 'flex',
                                gap: 8,
                                marginBottom: 12,
                                flexWrap: 'wrap',
                            }}>
                                {[
                                    "Let's set up my business",
                                    "I'd like to use the defaults",
                                    "What do you need from me?",
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => sendMessage(suggestion)}
                                        disabled={isLoading}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: 20,
                                            border: `1px solid ${isDark ? 'rgba(139,92,246,0.2)' : 'rgba(139,92,246,0.15)'}`,
                                            background: isDark ? 'rgba(139,92,246,0.06)' : 'rgba(139,92,246,0.04)',
                                            color: isDark ? 'rgba(139,92,246,0.8)' : 'rgba(109,40,217,0.7)',
                                            fontSize: 12,
                                            cursor: isLoading ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            opacity: isLoading ? 0.5 : 1,
                                        }}
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'flex-end',
                        }}>
                            <div style={{
                                flex: 1,
                                borderRadius: 16,
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'border-color 0.2s, box-shadow 0.2s',
                            }}>
                                <textarea
                                    ref={inputRef}
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your response..."
                                    disabled={isLoading}
                                    rows={1}
                                    style={{
                                        width: '100%',
                                        border: 'none',
                                        outline: 'none',
                                        background: 'transparent',
                                        color: isDark ? '#E6E8EB' : '#0E1116',
                                        fontSize: 14,
                                        resize: 'none',
                                        lineHeight: 1.5,
                                        maxHeight: 120,
                                        fontFamily: "'Inter', -apple-system, sans-serif",
                                    }}
                                />
                            </div>

                            <button
                                onClick={() => sendMessage()}
                                disabled={!inputMessage.trim() || isLoading}
                                style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    border: 'none',
                                    background: inputMessage.trim() && !isLoading
                                        ? 'linear-gradient(135deg, #8B5CF6, #06B6D4)'
                                        : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                    cursor: inputMessage.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                    boxShadow: inputMessage.trim() && !isLoading
                                        ? '0 4px 16px rgba(139,92,246,0.3)'
                                        : 'none',
                                    flexShrink: 0,
                                }}
                            >
                                {isLoading ? (
                                    <Loader2 size={18} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} style={{ animation: 'spin 1s linear infinite' }} />
                                ) : (
                                    <Send size={18} color={inputMessage.trim() ? '#fff' : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        @keyframes messageIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
        </div>
    );
};

export default Onboarding;
