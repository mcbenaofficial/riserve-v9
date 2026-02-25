import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Send, Paperclip, Atom, User, FileText, Lightbulb, Calendar,
  ArrowUp, X, Trash2, Plus, ChevronLeft, Image
} from 'lucide-react';
import { AtomicPowerIcon } from 'hugeicons-react';
import { useNavigate } from 'react-router-dom';
import ThinkingProcess from '../components/ThinkingProcess';

// Animated Neon Border/Glow Component for the Agent Container
const ContainerEffects = ({ state, isDark, mode }) => {
  const isZen = mode === 'zen';

  // Custom colors for Zen mode
  const zenIdleColor = 'rgba(120, 113, 108, 0.4)'; // Warm Gray/Stone
  const zenThinkingColor = 'rgba(168, 162, 158, 0.6)';
  const zenAnsweringColor = 'rgba(134, 146, 128, 0.5)'; // Muted Sage

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl" style={{ zIndex: 1 }}>



      {/* ─── IDLE STATE: Vibrant Pulsating Neon Border ─── */}
      <div
        className={`absolute inset-0 rounded-3xl transition-opacity duration-700 ${state === 'idle' ? 'opacity-100' : 'opacity-0'
          }`}
        style={{
          boxShadow: state === 'idle' ? (isZen ? [
            `inset 0 0 2px 0 ${zenIdleColor}`,
            `0 0 12px 1px ${zenIdleColor}`,
          ].join(', ') : [
            'inset 0 0 2px 0 rgba(168, 85, 247, 0.6)',
            '0 0 12px 1px rgba(168, 85, 247, 0.3)',
            '0 0 30px 2px rgba(139, 92, 246, 0.15)',
            '0 0 50px 4px rgba(124, 58, 237, 0.08)',
          ].join(', ')) : 'none',
          animation: state === 'idle' ? 'neonPulse 3s ease-in-out infinite' : 'none',
          border: isZen ? `1.5px solid ${zenIdleColor}` : '1.5px solid rgba(168, 85, 247, 0.4)',
        }}
      />

      {/* ─── THINKING STATE: Running Neon Edge Beam ─── */}
      {/* Beam layer — CSS mask shows conic gradient only on the border edge */}
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${state === 'thinking' ? 'opacity-100' : 'opacity-0'
          }`}
        style={{
          borderRadius: 'inherit',
          padding: '2.5px',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
        }}
      >
        <div
          className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2"
          style={{
            background: isZen ? `conic-gradient(
              from 0deg,
              transparent 0%,
              transparent 20%,
              #a8a29e 25%,
              #d6d3d1 30%,
              #f5f5f4 35%,
              #ffffff 42%,
              #f5f5f4 48%,
              #d6d3d1 55%,
              #a8a29e 60%,
              transparent 65%,
              transparent 100%
            )` : `conic-gradient(
              from 0deg,
              transparent 0%,
              transparent 10%,
              #7c3aed 18%,
              #a855f7 25%,
              #c084fc 32%,
              #e9d5ff 38%,
              #ffffff 42%,
              #e9d5ff 46%,
              #c084fc 52%,
              #a855f7 58%,
              #7c3aed 65%,
              transparent 72%,
              transparent 100%
            )`,
            animation: state === 'thinking' ? 'neonSpin 2s linear infinite' : 'none',
          }}
        />
      </div>

      {/* Thinking outer glow */}
      <div
        className={`absolute -inset-1 rounded-[1.75rem] transition-all duration-500 ${state === 'thinking' ? 'opacity-100' : 'opacity-0'
          }`}
        style={{
          boxShadow: state === 'thinking' ? (isZen ? [
            `0 0 20px 3px ${zenThinkingColor}`,
            `0 0 50px 8px rgba(168, 162, 158, 0.2)`,
            `inset 0 0 40px 0 rgba(168, 162, 158, 0.06)`,
          ].join(', ') : [
            '0 0 20px 3px rgba(168, 85, 247, 0.4)',
            '0 0 50px 8px rgba(139, 92, 246, 0.2)',
            '0 0 100px 16px rgba(124, 58, 237, 0.1)',
            'inset 0 0 40px 0 rgba(168, 85, 247, 0.06)',
          ].join(', ')) : 'none',
          animation: state === 'thinking' ? 'neonBreath 2s ease-in-out infinite' : 'none',
        }}
      />

      {/* ─── ANSWERING STATE: Calm Vibrant Completion Glow ─── */}
      <div
        className={`absolute inset-0 rounded-3xl transition-all duration-1000 ${state === 'answering' ? 'opacity-100' : 'opacity-0'
          }`}
        style={{
          border: isZen ? `1.5px solid ${zenAnsweringColor}` : '1.5px solid rgba(45, 212, 191, 0.45)',
          boxShadow: state === 'answering' ? (isZen ? [
            `inset 0 0 3px 0 ${zenAnsweringColor}`,
            `0 0 15px 2px ${zenAnsweringColor}`,
          ].join(', ') : [
            'inset 0 0 3px 0 rgba(45, 212, 191, 0.4)',
            '0 0 15px 2px rgba(45, 212, 191, 0.3)',
            '0 0 40px 4px rgba(20, 184, 166, 0.15)',
            '0 0 80px 8px rgba(16, 185, 129, 0.08)',
          ].join(', ')) : 'none',
          animation: state === 'answering' ? 'neonFadeCalm 2s ease-out forwards' : 'none',
        }}
      />
    </div>
  );
};

const AIAgent = () => {
  const { user } = useAuth();
  const { theme, mode } = useTheme();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [agentState, setAgentState] = useState('idle'); // idle, thinking, answering
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const res = await api.getConversations();
      setConversations(res.data);
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };

  const loadConversation = async (conversation) => {
    setActiveConversation(conversation);
    setShowSidebar(false);
    try {
      const res = await api.getConversation(conversation.id);
      setMessages(res.data.messages || []);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const startNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    setInputMessage('');
    setShowSidebar(false);
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (activeConversation?.id === conversationId) {
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      message_type: 'text',
      timestamp: new Date().toISOString()
    };

    const thinkingMsgId = (Date.now() + 1).toString();

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setAgentState('thinking');

    // Add a placeholder assistant message for live thinking
    setMessages(prev => [...prev, {
      id: thinkingMsgId,
      role: 'assistant',
      content: '',
      message_type: 'text',
      thinking_process: [],
      _isStreaming: true,
      timestamp: new Date().toISOString()
    }]);

    try {
      const token = localStorage.getItem('ridn_token');
      const API = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${API}/api/assistant/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: inputMessage,
          conversation_id: activeConversation?.id || null
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'conversation_id') {
              if (!activeConversation) {
                setActiveConversation({ id: event.conversation_id });
                fetchConversations();
              }
            } else if (event.type === 'thinking_step') {
              // Update the placeholder message's thinking_process in real-time
              setMessages(prev => prev.map(msg =>
                msg.id === thinkingMsgId
                  ? { ...msg, thinking_process: [...(msg.thinking_process || []), event.step] }
                  : msg
              ));
            } else if (event.type === 'token') {
              // Stream response text into the placeholder
              setMessages(prev => prev.map(msg =>
                msg.id === thinkingMsgId
                  ? { ...msg, content: msg.content + event.content }
                  : msg
              ));
            } else if (event.type === 'answer') {
              // Full answer (fallback if tokens didn't stream)
              setMessages(prev => prev.map(msg =>
                msg.id === thinkingMsgId
                  ? { ...msg, content: event.content }
                  : msg
              ));
            } else if (event.type === 'done') {
              // Replace placeholder with final persisted message
              setMessages(prev => prev.map(msg =>
                msg.id === thinkingMsgId
                  ? { ...event.message, _isStreaming: false }
                  : msg
              ));
              setAgentState('answering');
              setTimeout(() => setAgentState('idle'), 3000);
            } else if (event.type === 'error') {
              setMessages(prev => prev.map(msg =>
                msg.id === thinkingMsgId
                  ? { ...msg, content: `Error: ${event.content}`, _isStreaming: false }
                  : msg
              ));
              setAgentState('idle');
            }
          } catch (e) {
            // Skip malformed SSE lines
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setAgentState('idle');
      // Update placeholder with error
      setMessages(prev => prev.map(msg =>
        msg.id === thinkingMsgId
          ? { ...msg, content: 'Sorry, I encountered an error. Please try again.', _isStreaming: false }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const generateImage = async () => {
    if (!inputMessage.trim() || isGeneratingImage) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: `Generate image: ${inputMessage}`,
      message_type: 'text',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const prompt = inputMessage;
    setInputMessage('');
    setIsGeneratingImage(true);
    setAgentState('thinking');

    try {
      const res = await api.generateImage(prompt, activeConversation?.id);

      if (!activeConversation) {
        setActiveConversation({ id: res.data.conversation_id });
        fetchConversations();
      }

      setAgentState('answering');
      setTimeout(() => setAgentState('idle'), 3000);
      setMessages(prev => [...prev, res.data.message]);
    } catch (error) {
      console.error('Failed to generate image:', error);
      setAgentState('idle');
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I could not generate the image. Please try again.',
        message_type: 'text',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickActions = [
    {
      icon: FileText,
      label: 'Business Insights',
      description: 'Analyze my revenue, bookings & performance',
      color: mode === 'zen' ? 'bg-[#687988]/20 text-[#687988] border-[#687988]/30' : 'bg-[#5FA8D3]/20 text-[#5FA8D3] border-[#5FA8D3]/30'
    },
    {
      icon: Lightbulb,
      label: 'Suggestions',
      description: 'Get ideas to grow my business',
      color: mode === 'zen' ? 'bg-[#6E9890]/20 text-[#6E9890] border-[#6E9890]/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    },
    {
      icon: Calendar,
      label: 'Schedule Help',
      description: 'Review bookings & scheduling conflicts',
      color: mode === 'zen' ? 'bg-[#A4884E]/20 text-[#A4884E] border-[#A4884E]/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    }
  ];

  const firstName = user?.name?.split(' ')[0] || 'there';
  const isDark = theme === 'dark';

  return (
    <div
      className={`relative h-full flex overflow-hidden rounded-3xl border ${isDark ? 'bg-[#0B0D10] border-[#1F2630]' : 'bg-[#F6F7F9] border-[#D9DEE5]'}`}
      data-testid="ai-agent-page"
    >
      {/* Animated Background Removed. Effects applied to container below. */}

      {/* Left Sidebar - Conversations */}
      <div className={`absolute md:relative z-20 h-full w-72 flex flex-col transition-transform duration-300 ${isDark ? 'bg-[#12161C]/50 backdrop-blur-xl border-r border-[#1F2630]' : 'bg-white/50 backdrop-blur-xl border-r border-[#D9DEE5]'
        } ${showSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0 md:hidden lg:flex lg:translate-x-0'}`}>
        <div className={`p-4 border-b ${isDark ? 'border-[#1F2630]' : 'border-[#D9DEE5]'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'zen' ? 'bg-[#687988]' : 'bg-gradient-to-br from-purple-500 to-blue-500'}`}>
                <AtomicPowerIcon size={16} className="text-white" />
              </div>
              <span className={`font-semibold ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>Vorta</span>
            </div>
            <button
              onClick={() => setShowSidebar(false)}
              className={`lg:hidden p-2 rounded-lg ${isDark ? 'hover:bg-[#1F2630]' : 'hover:bg-[#ECEFF3]'}`}
            >
              <X size={18} className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
            </button>
          </div>
          <button
            onClick={startNewConversation}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-medium transition-all shadow-lg ${mode === 'zen'
              ? 'bg-[#687988] shadow-[#687988]/20 hover:bg-[#586978]'
              : 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-purple-500/20 hover:opacity-90'
              }`}
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {conversations.length === 0 ? (
            <div className={`text-center py-8 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
              <AtomicPowerIcon size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeConversation?.id === conv.id
                  ? mode === 'zen'
                    ? 'bg-[#687988]/10 text-[#687988] border border-[#687988]/20'
                    : 'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                  : isDark
                    ? 'hover:bg-[#1F2630] text-[#A9AFB8]'
                    : 'hover:bg-[#ECEFF3] text-[#4B5563]'
                  }`}
              >
                <AtomicPowerIcon size={14} className="flex-shrink-0" />
                <span className="flex-1 text-sm truncate">{conv.title}</span>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
                >
                  <Trash2 size={12} className="text-red-400" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col relative z-10 min-w-0 transition-all duration-500 rounded-3xl overflow-hidden ml-4 my-2 mr-2 ${isDark ? 'bg-[#12161C]' : 'bg-white'
        }`}>
        {/* Container Effects Overlay */}
        <ContainerEffects state={agentState} isDark={isDark} mode={mode} />

        {/* Top Bar */}
        <div className={`flex items-center justify-between px-6 py-4 relative z-20 ${isDark ? 'border-b border-[#1F2630]/50' : 'border-b border-[#D9DEE5]/50'}`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`md:hidden p-2 rounded-lg transition-all ${isDark ? 'hover:bg-[#1F2630]' : 'hover:bg-[#ECEFF3]'}`}
            >
              <AtomicPowerIcon size={20} className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            {/* User Display Removed */}
          </div>
        </div>

        {/* Messages or Welcome */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center px-6 py-12">
              {/* Greeting - positioned below the blob */}
              <div className="mt-[20px] md:mt-[60px]">
                <h1 className={`text-4xl md:text-5xl font-bold mb-2 text-center ${isDark ? 'text-[#E6E8EB]' : 'text-[#0E1116]'}`}>
                  Hey! {firstName}
                </h1>
                <p className={`text-xl md:text-2xl text-center mb-12 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                  What can I help with?
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap justify-center gap-4 mb-12 max-w-3xl">
                {quickActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => setInputMessage(action.description)}
                      className={`group relative flex flex-col items-start p-5 rounded-2xl border transition-all w-64 ${isDark
                        ? `bg-[#12161C]/60 border-[#1F2630] ${mode === 'zen' ? 'hover:border-[#687988]/40 hover:bg-[#1F2630]/80' : 'hover:border-purple-500/40 hover:bg-[#1F2630]/80'} backdrop-blur-sm`
                        : `bg-white/60 border-[#D9DEE5] ${mode === 'zen' ? 'hover:border-[#687988]/40 hover:bg-[#F6F7F9]' : 'hover:border-purple-500/40 hover:bg-[#F6F7F9]'} backdrop-blur-sm`
                        }`}
                      data-testid={`quick-action-${action.label.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold mb-3 border ${action.color}`}>
                        {action.label}
                      </span>
                      <span className={`text-sm text-left leading-relaxed ${isDark ? 'text-[#A9AFB8]' : 'text-[#4B5563]'}`}>
                        {action.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Main Input */}
              <div className="w-full max-w-2xl">
                <div className={`relative rounded-2xl border p-4 backdrop-blur-md shadow-lg ${isDark
                  ? 'bg-[#12161C]/80 border-[#1F2630]'
                  : 'bg-white/80 border-[#D9DEE5]'
                  }`}>
                  <div className={`flex items-center gap-2 mb-3 ${mode === 'zen' ? 'text-[#687988]' : 'text-purple-500'}`}>
                    <AtomicPowerIcon size={18} />
                  </div>
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything......."
                    rows={1}
                    className={`w-full bg-transparent border-none outline-none resize-none text-base ${isDark
                      ? 'text-[#E6E8EB] placeholder-[#7D8590]'
                      : 'text-[#0E1116] placeholder-[#6B7280]'
                      }`}
                    data-testid="ai-agent-input"
                  />
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isDark
                        ? mode === 'zen' ? 'bg-[#687988]/10 text-[#687988] hover:bg-[#687988]/20' : 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'
                        : mode === 'zen' ? 'bg-[#687988]/10 text-[#687988] hover:bg-[#687988]/20' : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
                        }`}
                    >
                      <Paperclip size={16} />
                      Attach file
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => console.log('File:', e.target.files)}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${mode === 'zen'
                        ? 'bg-[#687988] shadow-[#687988]/20 hover:bg-[#586978]'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-purple-500/20 hover:opacity-90'
                        }`}
                      data-testid="ai-send-btn"
                    >
                      <ArrowUp size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isDark={isDark} />
              ))}
              {(isLoading || isGeneratingImage) && (
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse ${mode === 'zen' ? 'bg-[#687988]' : 'bg-gradient-to-br from-purple-500 to-blue-500'}`}>
                    <AtomicPowerIcon size={18} className="text-white" />
                  </div>
                  <div className={`rounded-2xl px-5 py-4 border ${isDark ? 'bg-[#171C22] border-[#1F2630]' : 'bg-[#ECEFF3] border-[#D9DEE5]'
                    }`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-medium ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                        Super Agent is thinking
                      </span>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${mode === 'zen' ? 'bg-[#687988]' : 'bg-purple-500'}`} style={{ animationDelay: '0ms' }} />
                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${mode === 'zen' ? 'bg-[#687988]' : 'bg-purple-500'}`} style={{ animationDelay: '150ms' }} />
                        <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${mode === 'zen' ? 'bg-[#687988]' : 'bg-purple-500'}`} style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input (when in conversation) */}
        {messages.length > 0 && (
          <div className={`p-4 ${isDark ? 'border-t border-[#1F2630]/50' : 'border-t border-[#D9DEE5]/50'}`}>
            <div className="max-w-3xl mx-auto">
              <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 border backdrop-blur-md ${isDark ? 'bg-[#171C22]/80 border-[#1F2630]' : 'bg-white/80 border-[#D9DEE5]'
                }`}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-lg transition-all ${isDark ? 'hover:bg-[#1F2630]' : 'hover:bg-[#ECEFF3]'}`}
                >
                  <Paperclip size={18} className={isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'} />
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  className={`flex-1 bg-transparent border-none outline-none ${isDark ? 'text-[#E6E8EB] placeholder-[#7D8590]' : 'text-[#0E1116] placeholder-[#6B7280]'
                    }`}
                />
                <button
                  onClick={generateImage}
                  disabled={!inputMessage.trim() || isGeneratingImage}
                  className={`p-2 rounded-lg transition-all disabled:opacity-50 ${isDark ? 'hover:bg-[#1F2630] text-[#7D8590]' : 'hover:bg-[#ECEFF3] text-[#6B7280]'
                    }`}
                  title="Generate Image"
                >
                  <Image size={18} />
                </button>
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className={`p-2.5 rounded-xl text-white transition-all disabled:opacity-50 shadow-lg ${mode === 'zen'
                    ? 'bg-[#687988] shadow-[#687988]/20 hover:bg-[#586978]'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 shadow-purple-500/20 hover:opacity-90'
                    }`}
                >
                  <Send size={18} />
                </button>
              </div>
              <p className={`text-xs text-center mt-3 ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Powered by GPT-5.2 & Gemini Nano Banana
              </p>
            </div>
          </div>
        )}
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes blob-slow {
          0%, 100% { transform: scale(1) rotate(0deg); }
          33% { transform: scale(1.02) rotate(0.5deg); }
          66% { transform: scale(0.98) rotate(-0.5deg); }
        }
        
        @keyframes float-particle {
          0%, 100% { 
            transform: translateY(0) translateX(0); 
            opacity: 0.3;
          }
          50% { 
            transform: translateY(-30px) translateX(15px); 
            opacity: 0.7;
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.05); }
        }

        .animate-pulse-slow {
          animation: pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        .animate-blob-slow {
          animation: blob-slow 4s ease-in-out infinite;
        }
        
        .animate-float-particle {
          animation: float-particle 3s ease-in-out infinite;
        }
      `}</style>
    </div >
  );
};

const MessageBubble = ({ message, isDark }) => {
  const isUser = message.role === 'user';
  const { mode } = useTheme();
  const isZen = mode === 'zen';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isUser
        ? isDark ? 'bg-[#1F2630]' : 'bg-[#ECEFF3]'
        : isZen ? 'bg-[#687988]' : 'bg-gradient-to-br from-purple-500 to-blue-500'
        }`}>
        {isUser ? (
          <User size={18} className={isDark ? 'text-[#A9AFB8]' : 'text-[#4B5563]'} />
        ) : (
          <AtomicPowerIcon size={18} className="text-white" />
        )}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'text-right' : ''}`}>
        <div className={`rounded-2xl px-5 py-3 ${isUser
          ? isZen
            ? 'bg-[#687988] text-white shadow-md shadow-[#687988]/10'
            : 'bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-md shadow-purple-500/10'
          : isDark
            ? 'bg-[#171C22] border border-[#1F2630] text-[#E6E8EB]'
            : 'bg-[#ECEFF3] border border-[#D9DEE5] text-[#0E1116]'
          }`}>
          {message.message_type === 'image' && message.image_url ? (
            <div>
              <p className="text-sm mb-3">{message.content}</p>
              <img
                src={message.image_url}
                alt="Generated"
                className="rounded-xl max-w-full"
              />
            </div>
          ) : (
            <>
              {(message._isStreaming || (message.thinking_process && message.thinking_process.length > 0)) && (
                <ThinkingProcess steps={message.thinking_process || []} isDark={isDark} isStreaming={message._isStreaming} />
              )}
              {message.content ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}{message._isStreaming && <span className={`inline-block w-1.5 h-4 ml-0.5 animate-pulse rounded-sm ${isZen ? 'bg-stone-400' : 'bg-purple-400'}`} />}</p>
              ) : message._isStreaming ? null : (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
              )}
            </>
          )}
        </div>
        <span className={`text-xs mt-1.5 block ${isDark ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default AIAgent;
