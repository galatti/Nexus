import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { LlmModel, LlmStatusResponse } from '../../../shared/types';

interface HeaderProps {
  onMenuToggle: () => void;
  onSettingsOpen: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, onSettingsOpen }) => {
  const { theme, setTheme } = useTheme();
  const [currentModel, setCurrentModel] = useState<LlmModel | null>(null);
  const [llmStatus, setLlmStatus] = useState<LlmStatusResponse | null>(null);

  // Load LLM status and model information
  useEffect(() => {
    const loadLlmInfo = async () => {
      try {
        const statusResult = await window.electronAPI.getLlmStatus();
        if (statusResult.success && statusResult.data) {
          setLlmStatus(statusResult.data);
          
          // Get the configured model information
          if (statusResult.data.currentModel) {
            // Try to get detailed model info from available models
            const modelsResult = await window.electronAPI.getAvailableModels();
            if (modelsResult.success && modelsResult.data && modelsResult.data.length > 0) {
              // Find the currently configured model in the available models
              const modelInfo = modelsResult.data.find((m: LlmModel) => m.name === statusResult.data!.currentModel);
              if (modelInfo) {
                setCurrentModel(modelInfo);
              } else {
                // Fallback: create a basic model object with just the name
                setCurrentModel({
                  name: statusResult.data.currentModel,
                  description: `${statusResult.data.currentProviderType} model`
                });
              }
            } else {
              // Fallback: create a basic model object with just the name
              setCurrentModel({
                name: statusResult.data.currentModel,
                description: `${statusResult.data.currentProviderType} model`
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to load LLM info:', error);
      }
    };

    loadLlmInfo();

    // Listen for LLM provider changes
    const handleProviderChange = () => {
      loadLlmInfo();
    };

    // Add event listener if available
    if (window.electronAPI.onSettingsChange) {
      const cleanup = window.electronAPI.onSettingsChange(handleProviderChange);
      return cleanup;
    }
  }, []);

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
        <div className="ml-4">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Nexus MVP
          </h1>
          {llmStatus && llmStatus.currentProvider && (
            <div className="flex items-center space-x-2 mt-0.5">
              <div className="flex items-center space-x-1">
                <div className={`w-1.5 h-1.5 rounded-full ${llmStatus.isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {/* Auto-detect provider based on model name */}
                  {(llmStatus.currentModel && (
                    llmStatus.currentModel.includes('deepseek') || 
                    llmStatus.currentModel.includes('/') ||
                    llmStatus.currentModel.includes('gpt-') ||
                    llmStatus.currentModel.includes('claude-') ||
                    llmStatus.currentModel.includes('llama-')
                  )) ? 'OpenRouter' :
                   llmStatus.currentProviderType === 'openrouter' ? 'OpenRouter' : 
                   llmStatus.currentProviderType === 'ollama' ? 'Ollama' : 
                   llmStatus.currentProviderName || llmStatus.currentProvider?.replace(/-/g, ' ')}
                </span>
              </div>
              {currentModel && (
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400 text-xs">•</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {currentModel.name}
                  </span>
                  {currentModel.size && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      ({currentModel.size})
                    </span>
                  )}
                </div>
              )}
            </div>
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