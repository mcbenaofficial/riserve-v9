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

  useEffect(() => {
    try {
      localStorage.setItem('ridn_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.style.background = 'linear-gradient(to bottom right, #1a1a1a, #0a0a0a)';
      } else {
        document.documentElement.classList.remove('dark');
        document.body.style.background = 'linear-gradient(to bottom right, #f3f4f6, #e5e7eb)';
      }
    } catch (e) {}
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
