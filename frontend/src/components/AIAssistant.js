import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import {
  X, Send, Plus, MessageSquare, Image, Mic, Search,
  Clock, ChevronRight, Sparkles, Bot, User, Trash2,
  Calendar, FileText, Share2, MoreVertical
} from 'lucide-react';

const AIAssistant = ({ isOpen, onClose, mode = 'assistant' }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(mode !== 'onboarding');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const hasStartedOnboarding = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (mode === 'onboarding') {
        setShowSidebar(false);
        if (!hasStartedOnboarding.current && messages.length === 0) {
          hasStartedOnboarding.current = true;
          initializeOnboarding();
        }
      } else {
        fetchConversations();
      }
    }
  }, [isOpen, mode]);

  const initializeOnboarding = async () => {
    setIsLoading(true);
    try {
      // Auto-start onboarding with hidden message
      const startMsg = "Hi, I'd like to set up my business.";
      // Get existing conversation ID if any? 
      // For now, simpler to just start. The backend handles finding existing conversation by company_id/user.
      // We pass null conversation_id to let backend find it.

      const res = await api.onboardingChat(startMsg, null, false);

      setActiveConversation({ id: res.data.conversation_id });
      setMessages([res.data.message]); // Only show assistant response
    } catch (error) {
      console.error('Failed to start onboarding:', error);
      setMessages([{
        id: 'error',
        role: 'assistant',
        content: 'I had trouble connecting. Please try refreshing.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      let res;
      if (mode === 'onboarding') {
        res = await api.onboardingChat(inputMessage, activeConversation?.id, false);
      } else {
        res = await api.sendChatMessage(inputMessage, activeConversation?.id);
      }

      if (!activeConversation) {
        setActiveConversation({ id: res.data.conversation_id });
        if (mode !== 'onboarding') fetchConversations();
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

    try {
      const res = await api.generateImage(prompt, activeConversation?.id);

      if (!activeConversation) {
        setActiveConversation({ id: res.data.conversation_id });
        fetchConversations();
      }

      setMessages(prev => [...prev, res.data.message]);
    } catch (error) {
      console.error('Failed to generate image:', error);
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

  const groupConversationsByDate = (convos) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups = {
      today: [],
      yesterday: [],
      previousWeek: [],
      older: []
    };

    convos.forEach(conv => {
      const convDate = new Date(conv.updated_at || conv.created_at);
      if (convDate.toDateString() === today.toDateString()) {
        groups.today.push(conv);
      } else if (convDate.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(conv);
      } else if (convDate > weekAgo) {
        groups.previousWeek.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  };

  const groupedConversations = groupConversationsByDate(conversations);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex" data-testid="ai-assistant-panel">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Main Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-4xl flex bg-white dark:bg-[#0B0D10] shadow-2xl z-[101]">
        {/* Sidebar - Conversation History */}
        {showSidebar && mode !== 'onboarding' && (
          <div className="w-72 border-r border-[#D9DEE5] dark:border-[#1F2630] flex flex-col bg-[#F6F7F9] dark:bg-[#12161C]">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <span className="font-semibold text-[#0E1116] dark:text-[#E6E8EB]">Assistant v2.6</span>
                </div>
              </div>

              <button
                onClick={startNewConversation}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition-all"
              >
                <Plus size={18} />
                New Chat
              </button>
            </div>

            {/* Quick Actions */}
            <div className="p-3 border-b border-[#D9DEE5] dark:border-[#1F2630] space-y-1">
              <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-[#4B5563] dark:text-[#E6E8EB]/70 hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 rounded-lg transition-all">
                <Calendar size={16} />
                <span className="text-sm">Calendar & Planning</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-[#4B5563] dark:text-[#E6E8EB]/70 hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 rounded-lg transition-all">
                <FileText size={16} />
                <span className="text-sm">File Reader</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-[#4B5563] dark:text-[#E6E8EB]/70 hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 rounded-lg transition-all">
                <Image size={16} />
                <span className="text-sm">Media Files</span>
                <span className="ml-auto text-xs bg-gray-200 dark:bg-white/10 px-2 py-0.5 rounded-full">{messages.filter(m => m.message_type === 'image').length}</span>
              </button>
              <button className="w-full flex items-center gap-3 px-3 py-2 text-left text-[#4B5563] dark:text-[#E6E8EB]/70 hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 rounded-lg transition-all">
                <Share2 size={16} />
                <span className="text-sm">Share</span>
              </button>
            </div>

            {/* Conversation History */}
            <div className="flex-1 overflow-y-auto p-3">
              {groupedConversations.today.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-[#6B7280] dark:text-[#E6E8EB]/50 px-2 mb-2">Today</div>
                  {groupedConversations.today.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={activeConversation?.id === conv.id}
                      onClick={() => loadConversation(conv)}
                      onDelete={(e) => deleteConversation(conv.id, e)}
                    />
                  ))}
                </div>
              )}
              {groupedConversations.yesterday.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-[#6B7280] dark:text-[#E6E8EB]/50 px-2 mb-2">Yesterday</div>
                  {groupedConversations.yesterday.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={activeConversation?.id === conv.id}
                      onClick={() => loadConversation(conv)}
                      onDelete={(e) => deleteConversation(conv.id, e)}
                    />
                  ))}
                </div>
              )}
              {groupedConversations.previousWeek.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs font-medium text-[#6B7280] dark:text-[#E6E8EB]/50 px-2 mb-2">Previous 7 Days</div>
                  {groupedConversations.previousWeek.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={activeConversation?.id === conv.id}
                      onClick={() => loadConversation(conv)}
                      onDelete={(e) => deleteConversation(conv.id, e)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9DEE5] dark:border-[#1F2630]">
            <div className="flex items-center gap-3">
              {mode !== 'onboarding' && (
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg transition-all"
                >
                  <MessageSquare size={20} className="text-[#4B5563] dark:text-[#7D8590]" />
                </button>
              )}
              <h2 className="text-lg font-semibold text-[#0E1116] dark:text-[#E6E8EB]">
                {mode === 'onboarding' ? 'Onboarding Assistant' : (activeConversation ? 'Chat' : 'New Conversation')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#ECEFF3] dark:hover:bg-[#1F2630] rounded-lg transition-all"
            >
              <X size={20} className="text-[#4B5563] dark:text-[#7D8590]" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                  <Bot size={40} className="text-white" />
                </div>
                {mode === 'onboarding' ? (
                  <div className="flex items-center gap-2 text-[#6B7280]">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="ml-2">Initializing onboarding...</span>
                  </div>
                ) : (
                  <>
                    <h3 className="text-xl font-semibold text-[#0E1116] dark:text-[#E6E8EB] mb-2">
                      Hi! I'm your AI Assistant
                    </h3>
                    <p className="text-[#6B7280] dark:text-[#7D8590] max-w-md">
                      I can help you analyze your business data, answer questions about bookings,
                      revenue, outlets, and even generate images. How can I assist you today?
                    </p>
                    <div className="flex flex-wrap gap-2 mt-6 justify-center">
                      {[
                        "What's my total revenue?",
                        "Show top performing outlets",
                        "How many bookings today?",
                        "Generate a business chart"
                      ].map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => setInputMessage(suggestion)}
                          className="px-4 py-2 bg-[#ECEFF3] dark:bg-white/10 text-[#4B5563] dark:text-[#A9AFB8] rounded-full text-sm hover:bg-[#D9DEE5] dark:hover:bg-white/20 transition-all"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            {(isLoading || isGeneratingImage) && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-[#ECEFF3] dark:bg-white/10 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-[#D9DEE5] dark:border-[#1F2630]">
            <div className="flex items-center gap-3 bg-[#ECEFF3] dark:bg-white/10 rounded-2xl px-4 py-2">
              <button
                onClick={generateImage}
                disabled={!inputMessage.trim() || isGeneratingImage}
                className="p-2 hover:bg-[#D9DEE5] dark:hover:bg-[#1F2630] rounded-lg transition-all disabled:opacity-50"
                title="Generate Image"
              >
                <Image size={20} className="text-[#6B7280] dark:text-[#7D8590]" />
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 bg-transparent border-none outline-none text-[#0E1116] dark:text-[#E6E8EB] placeholder-gray-500"
                data-testid="assistant-input"
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white hover:opacity-90 transition-all disabled:opacity-50"
                data-testid="send-message-btn"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-xs text-center text-[#7D8590] dark:text-[#E6E8EB]/40 mt-2">
              Powered by OpenAI GPT-5.2 • Image generation by Gemini Nano Banana
            </p>
          </div>
        </div>

        {/* Assistant Mascot */}
        <div className="absolute bottom-24 right-6 pointer-events-none">
          <div className="relative">
            <div className="absolute -top-16 -left-32 bg-white dark:bg-[#171C22] rounded-2xl px-4 py-2 shadow-lg border border-[#D9DEE5] dark:border-[#1F2630]">
              <p className="text-sm text-[#4B5563] dark:text-[#A9AFB8]">
                Stuck on something?<br />
                Let me help, get a<br />
                quick assist! 👋
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ConversationItem = ({ conversation, isActive, onClick, onDelete }) => (
  <div
    onClick={onClick}
    className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive
        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
        : 'hover:bg-[#5FA8D3]/10 dark:hover:bg-[#5FA8D3]/15 text-[#4B5563] dark:text-[#E6E8EB]/70'
      }`}
  >
    <MessageSquare size={14} className="flex-shrink-0" />
    <span className="flex-1 text-sm truncate">{conversation.title}</span>
    <button
      onClick={onDelete}
      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
    >
      <Trash2 size={12} className="text-red-500" />
    </button>
  </div>
);

const MessageBubble = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser
          ? 'bg-gray-200 dark:bg-white/20'
          : 'bg-gradient-to-br from-purple-500 to-pink-500'
        }`}>
        {isUser ? (
          <User size={16} className="text-[#4B5563] dark:text-[#A9AFB8]" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </div>
      <div className={`max-w-[70%] ${isUser ? 'text-right' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 ${isUser
            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
            : 'bg-[#ECEFF3] dark:bg-white/10 text-[#0E1116] dark:text-[#E6E8EB]'
          }`}>
          {message.message_type === 'image' && message.image_url ? (
            <div>
              <p className="mb-2 text-sm">{message.content}</p>
              <img
                src={message.image_url}
                alt="Generated"
                className="rounded-lg max-w-full"
              />
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <span className="text-xs text-[#7D8590] dark:text-[#E6E8EB]/40 mt-1 block">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
};

export default AIAssistant;
