import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('ridn_theme') || 'dark';
    } catch (e) {
      return 'dark';
    }
  });

  const [mode, setMode] = useState(() => { // 'vivid' or 'zen'
    try {
      return localStorage.getItem('ridn_ui_mode') || 'vivid';
    } catch (e) {
      return 'vivid';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ridn_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.style.background = mode === 'zen' ? '#12100D' : 'linear-gradient(to bottom right, #1a1a1a, #0a0a0a)';
      } else {
        document.documentElement.classList.remove('dark');
        document.body.style.background = mode === 'zen' ? '#FDFAF5' : 'linear-gradient(to bottom right, #f3f4f6, #e5e7eb)';
      }
    } catch (e) { }
  }, [theme, mode]);

  useEffect(() => {
    try {
      localStorage.setItem('ridn_ui_mode', mode);
      if (mode === 'zen') {
        document.documentElement.classList.add('zen');
      } else {
        document.documentElement.classList.remove('zen');
      }
    } catch (e) { }
  }, [mode]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const toggleMode = () => setMode((m) => (m === 'vivid' ? 'zen' : 'vivid'));

  return (
    <ThemeContext.Provider value={{ theme, toggle, mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
