"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
  globalSettingsEnabled: boolean;
  setGlobalSettingsEnabled: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [globalSettingsEnabled, setGlobalSettingsEnabled] = useState(false);

  // Load theme and global settings from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }

    // Load global settings
    const savedGlobalSettings = localStorage.getItem('globalSettingsEnabled');
    if (savedGlobalSettings) {
      setGlobalSettingsEnabled(savedGlobalSettings === 'true');
    }
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    // Apply theme to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Save global settings to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('globalSettingsEnabled', globalSettingsEnabled.toString());
  }, [globalSettingsEnabled]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, globalSettingsEnabled, setGlobalSettingsEnabled }}>
      {children}
    </ThemeContext.Provider>
  );
};
