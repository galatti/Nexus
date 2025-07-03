import React, { useState, useEffect, useRef } from 'react';
import { LlmStatusResponse, LlmModel, LlmProviderConfig } from '../../../shared/types';

interface ModelOption {
  providerId: string;
  providerName: string;
  providerType: string;
  model: LlmModel;
}

interface ModelSelectorProps {
  llmStatus: LlmStatusResponse | null;
  currentModel: LlmModel | null;
  selectedProviderModel?: { providerId: string; modelName: string };
  selectedProvider?: string | null;
  onModelChange: () => void;
  onSelectModel?: (providerId: string, modelName: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  llmStatus,
  currentModel,
  selectedProviderModel,
  selectedProvider,
  onModelChange,
  onSelectModel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAvailableModels = async () => {
    if (!selectedProvider) {
      setAvailableModels([]);
      return;
    }

    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const settings = await window.electronAPI.getSettings();
      console.log('[ModelSelector] Fetching models for provider:', selectedProvider);
      const modelOptions: ModelOption[] = [];
      
      const provider = settings.llm.providers.find(p => p.id === selectedProvider);
      if (provider && provider.enabled) {
        try {
          const providerModelsResponse = await window.electronAPI.getModelsForConfig(provider);
          console.log(`[ModelSelector] Models response for ${provider.id}:`, providerModelsResponse);
          if (providerModelsResponse.success && providerModelsResponse.data) {
            for (const model of providerModelsResponse.data) {
              modelOptions.push({
                providerId: provider.id,
                providerName: provider.name,
                providerType: provider.type,
                model
              });
            }
          }
        } catch (err) {
          console.error(`[ModelSelector] Error fetching models for ${provider.id}:`, err);
        }
      }

      console.log('[ModelSelector] Compiled model options:', modelOptions);
      setAvailableModels(modelOptions);
    } catch (err) {
      setError('Failed to load available models');
      console.error('[ModelSelector] Failed to load available models:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModelSelect = (option: ModelOption) => {
    if (selectedProviderModel?.modelName === option.model.name) {
      setIsOpen(false);
      return;
    }
    
    if (onSelectModel) {
      onSelectModel(option.providerId, option.model.name);
    }
    onModelChange();
    setIsOpen(false);
  };

  const handleToggleDropdown = async () => {
    if (!isOpen && availableModels.length === 0 && !isLoading) {
      await fetchAvailableModels();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    fetchAvailableModels();
  }, [selectedProvider]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setError(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        setIsOpen(false);
        setError(null);
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
    if (!groups[key]) groups[key] = [];
    groups[key].push(option);
    return groups;
  }, {} as Record<string, ModelOption[]>);

  // Only show the "no provider" message if no provider is selected
  if (!selectedProvider) {
    return (
      <div className="flex items-center space-x-2 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="w-3 h-3 rounded-full bg-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400">No provider selected</span>
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
        aria-label={currentModel ? `Current model: ${currentModel.name} from ${Object.values(groupedModels).flat().find(o => o.model.name === currentModel.name)?.providerName || ''}. Click to change model.` : 'No model selected. Click to select a model.'}
      >
        <div className="flex items-center space-x-2 flex-1">
          <div className={`w-3 h-3 rounded-full shadow-sm ${currentModel ? 'bg-green-500' : 'bg-gray-400'}`} />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {currentModel ? currentModel.name : 'Select model'}
          </span>
          {currentModel?.size && (
            <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800/30 px-1.5 py-0.5 rounded">
              {currentModel.size}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-blue-600 dark:text-blue-400 transition-transform ${isOpen ? 'rotate-180' : 'rotate-0'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-72 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
              <span>Loading models...</span>
            </div>
          ) : error ? (
            <div className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : Object.keys(groupedModels).length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No models available</div>
          ) : (
            Object.entries(groupedModels).map(([group, options]) => (
              <div key={group}>
                <div className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {group}
                </div>
                {options.map(option => {
                  const selected =
                    selectedProviderModel?.providerId === option.providerId &&
                    selectedProviderModel?.modelName === option.model.name;
                  return (
                    <button
                      key={`${option.providerId}-${option.model.name}`}
                      onClick={() => handleModelSelect(option)}
                      title={option.model.description || option.model.name}
                      className={`
                        flex items-center justify-between gap-2 px-3 py-2 w-full text-left rounded-md cursor-pointer transition-colors
                        hover:bg-gray-50 dark:hover:bg-gray-700 ${selected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                      `}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{option.model.name}</span>
                        {option.model.size && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800/30 px-1.5 py-0.5 rounded">
                            {option.model.size}
                          </span>
                        )}
                      </div>
                      {selected && (
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};