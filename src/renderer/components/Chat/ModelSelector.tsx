import React, { useState, useEffect, useRef } from 'react';
import { LlmStatusResponse, LlmModel, LlmProviderConfig } from '../../../shared/types';

interface ModelOption {
  providerId: string;
  providerName: string;
  providerType: string;
  model: LlmModel;
  isHealthy: boolean;
}

interface ModelSelectorProps {
  llmStatus: LlmStatusResponse | null;
  currentModel: LlmModel | null;
  onModelChange: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  llmStatus,
  currentModel,
  onModelChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAvailableModels = async () => {
    if (!isOpen || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [models, providers] = await Promise.all([
        window.electronAPI.getAvailableModels(),
        window.electronAPI.getSettings()
      ]);
      
      const modelOptions: ModelOption[] = [];
      
      for (const provider of providers.llm.providers) {
        if (!provider.enabled) continue;
        
        const providerModels = models.filter(m => m.providerId === provider.id);
        
        for (const model of providerModels) {
          modelOptions.push({
            providerId: provider.id,
            providerName: provider.name,
            providerType: provider.type,
            model,
            isHealthy: llmStatus?.currentProvider === provider.id ? (llmStatus?.isHealthy ?? false) : true
          });
        }
      }
      
      setAvailableModels(modelOptions);
    } catch (err) {
      console.error('Failed to fetch available models:', err);
      setError('Failed to load available models');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelSelect = async (option: ModelOption) => {
    if (llmStatus?.currentProvider === option.providerId && currentModel?.name === option.model.name) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await window.electronAPI.setCurrentProvider(option.providerId);
      onModelChange();
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to switch model:', err);
      setError('Failed to switch model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleDropdown = () => {
    if (!isOpen) {
      fetchAvailableModels();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setError(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen) {
        if (event.key === 'Escape') {
          setIsOpen(false);
          setError(null);
        }
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

  const groupedModels = availableModels.reduce((groups, option) => {
    const key = `${option.providerName} (${option.providerType})`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(option);
    return groups;
  }, {} as Record<string, ModelOption[]>);

  if (!llmStatus?.currentProvider || !currentModel) {
    return (
      <div className="flex items-center space-x-2 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="w-3 h-3 rounded-full bg-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">No model selected</span>
        <button
          onClick={() => {
            const event = new CustomEvent('openSettings', { detail: { tab: 'llm' } });
            window.dispatchEvent(event);
          }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Configure
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggleDropdown}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleDropdown();
          }
        }}
        disabled={isLoading}
        className="flex items-center space-x-2 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer group w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Current model: ${llmStatus.currentProviderName || llmStatus.currentProvider} - ${currentModel.name}. Click to change model.`}
      >
        <div className="flex items-center space-x-2 flex-1">
          <div className={`w-3 h-3 rounded-full ${llmStatus.isHealthy ? 'bg-green-500' : 'bg-red-500'} shadow-sm`} />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {llmStatus.currentProviderName || llmStatus.currentProvider?.replace(/-/g, ' ')}
          </span>
        </div>
        
        {currentModel && (
          <div className="flex items-center space-x-2">
            <span className="text-blue-400 dark:text-blue-500">•</span>
            <span 
              className="text-sm font-medium text-blue-700 dark:text-blue-300 cursor-help"
              title={currentModel.description || currentModel.name}
            >
              {currentModel.name}
            </span>
            {currentModel.size && (
              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800/30 px-1.5 py-0.5 rounded">
                {currentModel.size}
              </span>
            )}
            {currentModel.description && (
              <div title={currentModel.description}>
                <svg 
                  className="w-3 h-3 text-blue-500 cursor-help" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M9,9h0a3,3,0,0,1,5.12-2.12A3,3,0,0,1,15,11.5c0,1-1,1.5-1,1.5"/>
                  <circle cx="12" cy="17" r=".5"/>
                </svg>
              </div>
            )}
          </div>
        )}
        
        <svg
          className={`w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
          role="listbox"
          aria-label="Available models"
        >
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading models...</span>
            </div>
          )}
          
          {error && (
            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
              {error}
              <button
                onClick={fetchAvailableModels}
                className="ml-2 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
          
          {!isLoading && !error && Object.keys(groupedModels).length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">No models available</p>
              <button
                onClick={() => {
                  const event = new CustomEvent('openSettings', { detail: { tab: 'llm' } });
                  window.dispatchEvent(event);
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Configure Models
              </button>
            </div>
          )}
          
          {!isLoading && !error && Object.entries(groupedModels).map(([providerGroup, options]) => (
            <div key={providerGroup}>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                {providerGroup}
              </div>
              {options.map((option) => {
                const isSelected = llmStatus.currentProvider === option.providerId && 
                                 currentModel.name === option.model.name;
                
                return (
                  <button
                    key={`${option.providerId}-${option.model.name}`}
                    onClick={() => handleModelSelect(option)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleModelSelect(option);
                      }
                    }}
                    disabled={isLoading}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700 ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    role="option"
                    aria-selected={isSelected}
                    aria-label={`${option.model.name} from ${option.providerName}${option.model.description ? ` - ${option.model.description}` : ''}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {option.model.name}
                        </span>
                        {option.model.size && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-600 px-1.5 py-0.5 rounded">
                            {option.model.size}
                          </span>
                        )}
                        {!option.isHealthy && (
                          <span className="w-2 h-2 rounded-full bg-red-500" title="Provider unhealthy" />
                        )}
                      </div>
                      {option.model.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                          {option.model.description}
                        </p>
                      )}
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
          ))}
          
          {!isLoading && !error && Object.keys(groupedModels).length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-600 p-2">
              <button
                onClick={() => {
                  const event = new CustomEvent('openSettings', { detail: { tab: 'llm' } });
                  window.dispatchEvent(event);
                  setIsOpen(false);
                }}
                className="w-full px-2 py-1 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
              >
                Manage Models
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};