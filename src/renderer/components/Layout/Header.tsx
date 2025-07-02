import React from 'react';
import { useTheme } from '../../context/ThemeContext';

interface HeaderProps {
  onMenuToggle: () => void;
  onSettingsOpen: () => void;
  activeView?: 'dashboard' | 'chat';
  onViewChange?: (view: 'dashboard' | 'chat') => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, onSettingsOpen, activeView = 'dashboard', onViewChange }) => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(nextTheme);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light': return '☀️';
      case 'dark': return '🌙';
      case 'system': return '💻';
      default: return '💻';
    }
  };

  return (
    <header className="h-12 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-4">
      <div className="flex items-center">
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="ml-4 flex items-center space-x-6">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Nexus
          </h1>
          
          {/* Navigation Tabs */}
          {onViewChange && (
            <nav className="flex space-x-1">
              <button
                onClick={() => onViewChange('chat')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'chat'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                💬 Chat
              </button>
              <button
                onClick={() => onViewChange('dashboard')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeView === 'dashboard'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                📊 Dashboard
              </button>
            </nav>
          )}
        </div>
        

      </div>

      <div className="flex items-center space-x-2">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          title={`Current theme: ${theme}`}
        >
          <span className="text-lg">{getThemeIcon()}</span>
        </button>

        {/* Settings Button */}
        <button
          onClick={onSettingsOpen}
          className="p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          title="Settings"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        {/* Window Controls */}
        <div className="flex items-center ml-2 space-x-1">
          <button
            onClick={() => window.electronAPI?.minimizeWindow?.()}
            className="p-1 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
            title="Minimize"
          >
            −
          </button>
          <button
            onClick={() => window.electronAPI?.maximizeWindow?.()}
            className="p-1 rounded text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
            title="Maximize"
          >
            ⬜
          </button>
          <button
            onClick={() => window.electronAPI?.closeWindow?.()}
            className="p-1 rounded text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 text-sm"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>
    </header>
  );
}; 