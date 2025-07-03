import React, { useState, useRef, useEffect } from 'react';
import { LlmStatusResponse } from '../../../shared/types';

interface ProviderSelectorProps {
  llmStatus: LlmStatusResponse | null;
  selectedProvider: string | null;
  onProviderChange: (providerId: string) => void;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  llmStatus,
  selectedProvider,
  onProviderChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const enabledProviders = llmStatus?.enabledProviders || [];
  const currentProvider = enabledProviders.find(p => p.id === selectedProvider);

  const handleProviderSelect = (providerId: string) => {
    onProviderChange(providerId);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!currentProvider || enabledProviders.length === 0) {
    return null; // Don't show selector if no providers
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${currentProvider.isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {currentProvider.name}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({currentProvider.type})
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-2 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          {enabledProviders.map(provider => {
            const isSelected = provider.id === selectedProvider;
            return (
              <button
                key={provider.id}
                onClick={() => handleProviderSelect(provider.id)}
                className={`flex items-center justify-between w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${provider.isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {provider.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {provider.type} • {provider.models.length} models
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}; 