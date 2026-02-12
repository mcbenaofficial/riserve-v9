import React, { useState, useEffect, useRef } from 'react';
import { FaIoxhost } from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import {
  X, Send, Bot, User, Mic, MicOff,
  ChevronDown, ChevronUp, RefreshCw, MessageSquare,
  Lightbulb, BarChart3, HelpCircle, Minimize2, Maximize2
} from 'lucide-react';

import ThinkingProcess from './ThinkingProcess';

// Message Bubble Component
const ChatMessage = ({ message, theme }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''} animate-fade-in`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isUser
          ? theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#ECEFF3]'
          : 'bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0]'
        }`}>
        {isUser ? (
          <User size={14} className={theme === 'dark' ? 'text-[#A9AFB8]' : 'text-[#6B7280]'} />
        ) : (
          <FaIoxhost size={14} className="text-white" />
        )}
      </div>
      <div className={`max-w-[85%] ${isUser ? 'text-right' : ''}`}>
        <div className={`rounded-xl px-3 py-2 text-sm ${isUser
            ? 'bg-[#5FA8D3] text-white'
            : theme === 'dark'
              ? 'bg-[#1F2630] text-[#E6E8EB]'
              : 'bg-[#ECEFF3] text-[#0E1116]'
          }`}>
          {message.message_type === 'image' && message.image_url ? (
            <div>
              <p className="mb-2">{message.content}</p>
              <img
                src={message.image_url}
                alt="Generated"
                className="rounded-lg max-w-full"
              />
            </div>
          ) : (
            <>
              {/* Show Thinking Process if available */}
              {message.thinking_process && message.thinking_process.length > 0 && (
                <div className="mb-2">
                  <ThinkingProcess
                    steps={message.thinking_process}
                    isDark={theme === 'dark'}
                    isStreaming={false}
                    compact={true}
                  />
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Typing Indicator
const TypingIndicator = ({ theme }) => (
  <div className="flex gap-2 animate-fade-in">
    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0]">
      <FaIoxhost size={14} className="text-white" />
    </div>
    <div className={`rounded-xl px-3 py-2 ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#ECEFF3]'
      }`}>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-[#5FA8D3] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-[#5FA8D3] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-[#5FA8D3] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

// Suggested Prompt Button
const SuggestedPrompt = ({ text, onClick, theme }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${theme === 'dark'
        ? 'bg-[#1F2630] text-[#5FA8D3] hover:bg-[#2A3444] border border-[#5FA8D3]/20'
        : 'bg-[#5FA8D3]/10 text-[#4A95C0] hover:bg-[#5FA8D3]/20 border border-[#5FA8D3]/20'
      }`}
  >
    {text}
  </button>
);

const FloatingAIChat = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const firstName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (customMessage = null) => {
    const messageText = customMessage || inputMessage;
    if (!messageText.trim() || isLoading) return;

    setShowSuggestions(false);

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      message_type: 'text',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const res = await api.sendChatMessage(messageText, conversationId);

      if (!conversationId) {
        setConversationId(res.data.conversation_id);
      }

      setMessages(prev => [...prev, res.data.message]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        message_type: 'text',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setShowSuggestions(true);
  };

  const suggestedPrompts = [
    "Today's bookings",
    "Revenue summary",
    "Top services"
  ];

  if (!isOpen) return null;

  return (
    <div
      className={`fixed right-6 bottom-20 z-50 flex flex-col transition-all duration-300 ${isMinimized ? 'w-72 h-14' : 'w-80 h-[500px]'
        } rounded-2xl shadow-2xl overflow-hidden ${theme === 'dark'
          ? 'bg-[#12161C] border border-[#1F2630]'
          : 'bg-white border border-[#D9DEE5]'
        }`}
      data-testid="floating-ai-chat"
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${theme === 'dark' ? 'border-[#1F2630] bg-[#0B0D10]' : 'border-[#D9DEE5] bg-[#F6F7F9]'
        }`}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center">
            <FaIoxhost size={16} className="text-white" />
          </div>
          <div>
            <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'
              }`}>
              Ri'Serve AI
            </h3>
            {!isMinimized && (
              <p className={`text-xs ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'}`}>
                Quick Assistant
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isMinimized && messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-[#1F2630] text-[#7D8590]' : 'hover:bg-[#ECEFF3] text-[#6B7280]'
                }`}
              title="New chat"
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-[#1F2630] text-[#7D8590]' : 'hover:bg-[#ECEFF3] text-[#6B7280]'
              }`}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-[#1F2630] text-[#7D8590]' : 'hover:bg-[#ECEFF3] text-[#6B7280]'
              }`}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5FA8D3] to-[#4A95C0] flex items-center justify-center mb-3">
                  <Bot size={24} className="text-white" />
                </div>
                <h4 className={`text-sm font-medium mb-1 ${theme === 'dark' ? 'text-[#E6E8EB]' : 'text-[#0E1116]'
                  }`}>
                  Hi {firstName}! Need help?
                </h4>
                <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-[#7D8590]' : 'text-[#6B7280]'
                  }`}>
                  Ask me anything about your bookings, revenue, or business insights.
                </p>

                {showSuggestions && (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestedPrompts.map((prompt, idx) => (
                      <SuggestedPrompt
                        key={idx}
                        text={prompt}
                        onClick={() => handleSendMessage(prompt)}
                        theme={theme}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} theme={theme} />
                ))}
                {isLoading && <TypingIndicator theme={theme} />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Disclaimer */}
          <div className={`px-3 py-1.5 text-center border-t ${theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'
            }`}>
            <p className={`text-[10px] ${theme === 'dark' ? 'text-[#7D8590]/60' : 'text-[#6B7280]/60'
              }`}>
              AI can make mistakes. Please verify important info.
            </p>
          </div>

          {/* Input Area */}
          <div className={`p-3 border-t ${theme === 'dark' ? 'border-[#1F2630]' : 'border-[#D9DEE5]'
            }`}>
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 ${theme === 'dark' ? 'bg-[#1F2630]' : 'bg-[#ECEFF3]'
              }`}>
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a question..."
                className={`flex-1 bg-transparent text-sm outline-none ${theme === 'dark'
                    ? 'text-[#E6E8EB] placeholder-[#7D8590]'
                    : 'text-[#0E1116] placeholder-[#6B7280]'
                  }`}
                data-testid="floating-chat-input"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className="w-7 h-7 rounded-lg bg-[#5FA8D3] hover:bg-[#4A95C0] text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="floating-chat-send"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FloatingAIChat;
