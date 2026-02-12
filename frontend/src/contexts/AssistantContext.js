import React, { createContext, useContext, useState } from 'react';

const AssistantContext = createContext();

export const AssistantProvider = ({ children }) => {
  // For the old modal assistant (keeping for backward compatibility)
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('assistant'); // 'assistant' or 'onboarding'

  // For the new floating chat panel
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);

  // Main assistant panel controls
  const openAssistant = (newMode = 'assistant') => {
    setMode(newMode);
    setIsOpen(true);
  };

  const closeAssistant = () => setIsOpen(false);
  const toggleAssistant = () => setIsOpen(prev => !prev);

  // Floating chat controls (independent)
  const openFloatingChat = () => setIsFloatingChatOpen(true);
  const closeFloatingChat = () => setIsFloatingChatOpen(false);
  const toggleFloatingChat = () => setIsFloatingChatOpen(prev => !prev);

  return (
    <AssistantContext.Provider value={{
      isOpen,
      mode,
      openAssistant,
      closeAssistant,
      toggleAssistant,
      // Floating chat
      isFloatingChatOpen,
      openFloatingChat,
      closeFloatingChat,
      toggleFloatingChat
    }}>
      {children}
    </AssistantContext.Provider>
  );
};

export const useAssistant = () => {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
};

export default AssistantContext;
