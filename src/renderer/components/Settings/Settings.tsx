import React, { useState, useEffect } from 'react';
import { AppSettings, LlmProviderConfig } from '../../../shared/types';
import { McpIntegration } from '../MCP/McpIntegration';
import { ToolPermissionsOverview } from './ToolPermissionsOverview';
import { APP_CONSTANTS } from '../../../shared/constants';
import { SessionManager } from '../../utils/SessionManager';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

type SettingsTab = 'general' | 'llm' | 'mcp' | 'permissions';

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, initialTab = 'general' }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab as SettingsTab);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [availableModels, setAvailableModels] = useState<{ name: string; description?: string }[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [selectedModelIndex, setSelectedModelIndex] = useState(-1);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // Load settings when component opens
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Update active tab when initialTab changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab as SettingsTab);
    }
  }, [isOpen, initialTab]);

  // Set selected provider when settings load
  useEffect(() => {
    if (settings?.llm.providers && settings.llm.providers.length > 0 && !selectedProviderId) {
      const providerId = settings.llm.providers[0].id;
      setSelectedProviderId(providerId);
    }
  }, [settings?.llm.providers, selectedProviderId]);

  // Get selected provider
  const selectedProvider = selectedProviderId && settings?.llm.providers
    ? settings.llm.providers.find(p => p.id === selectedProviderId)
    : null;

  // Fetch available models when selected provider configuration changes
  useEffect(() => {
    if (selectedProvider && activeTab === 'llm') {
      // Debounce the model fetching to avoid too many API calls
      const timer = setTimeout(() => {
        fetchAvailableModels();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [selectedProvider?.type, selectedProvider?.apiKey, selectedProvider?.baseUrl, activeTab]);

  // Sync model search query with selected provider model
  useEffect(() => {
    if (selectedProvider?.model && modelSearchQuery !== selectedProvider.model) {
      setModelSearchQuery(selectedProvider.model);
    }
  }, [selectedProvider?.model]);

  // Listen for server status changes
  useEffect(() => {
    if (!isOpen) return;

    const cleanup = (window as any).electronAPI.onMcpServerStatusChange?.((serverId: string, status: string) => {
      setSettings(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          mcp: {
            ...prev.mcp,
            servers: prev.mcp.servers.map(server => 
              server.id === serverId ? { ...server, status: status as any } : server
            )
          }
        };
      });
    });

    return cleanup;
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const currentSettings = await window.electronAPI.getSettings();
      
      // Get real-time server status
      const serversResult = await (window as any).electronAPI.getMcpServers();
      if (serversResult.success) {
        // Update settings with current server status
        const updatedSettings = {
          ...currentSettings,
          mcp: {
            ...currentSettings.mcp,
            servers: serversResult.servers
          }
        };
        setSettings(updatedSettings);
      } else {
        setSettings(currentSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings || !hasChanges) return;

    // Validate default provider configuration
    const enabledProviders = settings.llm.providers.filter(p => p.enabled);
    const defaultProvider = settings.llm.defaultProviderModel;
    
    if (enabledProviders.length > 0) {
      if (!defaultProvider) {
        setError('Please select a default provider');
        return;
      }
      
      const defaultProviderConfig = settings.llm.providers.find(p => p.id === defaultProvider.providerId);
      if (!defaultProviderConfig || !defaultProviderConfig.enabled) {
        setError('Default provider must be enabled');
        return;
      }
      
      if (!defaultProviderConfig.model) {
        setError('Default provider must have a model selected');
        return;
      }
      
      if (defaultProviderConfig.type === 'openrouter' && !defaultProviderConfig.apiKey) {
        setError('OpenRouter provider requires an API key');
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await window.electronAPI.setSettings(settings) as any;
      
      if (result.success) {
        setHasChanges(false);
        // Optionally show success message
        setTimeout(() => {
          // Auto-close settings after successful save
          onClose();
        }, 1000);
      } else {
        setError(result.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSettings = (updates: Partial<AppSettings>) => {
    if (!settings) return;
    
    setSettings(prev => prev ? { ...prev, ...updates } : null);
    setHasChanges(true);
  };

  const updateGeneralSettings = (general: Partial<AppSettings['general']>) => {
    if (!settings) return;
    updateSettings({
      general: { ...settings.general, ...general }
    });
  };

  const addNewProvider = (provider: LlmProviderConfig) => {
    if (!settings) return;
    const updatedProviders = [...settings.llm.providers, provider];
    updateSettings({
      llm: {
        providers: updatedProviders,
      }
    });
    setSelectedProviderId(provider.id);
  };

  const removeProvider = (providerId: string) => {
    if (!settings) return;
    const updatedProviders = settings.llm.providers.filter(p => p.id !== providerId);
    
    updateSettings({
      llm: {
        providers: updatedProviders,
      }
    });
    
    // Select first provider if we removed the selected one
    if (selectedProviderId === providerId && updatedProviders.length > 0) {
      setSelectedProviderId(updatedProviders[0].id);
    }
  };

  const handleAddProvider = () => {
    const newProvider: LlmProviderConfig = {
      id: `provider-${Date.now()}`,
      type: 'ollama',
      name: 'New Provider',
      model: '',
      enabled: false,
      temperature: 0.7,
      maxTokens: 2048
    };
    addNewProvider(newProvider);
  };

  // Filter models based on search query
  const filteredModels = availableModels.filter(model => {
    const query = modelSearchQuery.toLowerCase();
    return model.name.toLowerCase().includes(query) || 
           (model.description && model.description.toLowerCase().includes(query));
  });

  const handleModelSelect = (modelName: string) => {
    setModelSearchQuery(modelName);
    setShowModelDropdown(false);
    setSelectedModelIndex(-1);
  };

  const handleModelInputChange = (value: string) => {
    setModelSearchQuery(value);
    setShowModelDropdown(availableModels.length > 0);
    setSelectedModelIndex(-1);
  };

  const handleModelKeyDown = (e: React.KeyboardEvent) => {
    if (!showModelDropdown || filteredModels.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedModelIndex(prev => 
          prev < filteredModels.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedModelIndex(prev => 
          prev > 0 ? prev - 1 : filteredModels.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedModelIndex >= 0) {
          handleModelSelect(filteredModels[selectedModelIndex].name);
        }
        break;
      case 'Escape':
        setShowModelDropdown(false);
        setSelectedModelIndex(-1);
        break;
    }
  };

  const fetchAvailableModels = async () => {
    if (!selectedProvider) return;

    setIsLoadingModels(true);
    
    try {
      // For OpenRouter, we can fetch models from the API
      // For Ollama, we need a connection to fetch models
      if (selectedProvider.type === 'openrouter') {
        if (!selectedProvider.apiKey) {
          setAvailableModels([]);
          return;
        }
      }

      // Use the dedicated models endpoint to get all available models
      const result = await window.electronAPI.getModelsForConfig(selectedProvider) as any;
      
      if (result.success && result.data) {
        setAvailableModels(result.data);

        // Auto-select model if none chosen or the current model is not in the fetched list
        if (
          (!selectedProvider.model ||
            !result.data.some((m: any) => m.name === selectedProvider.model)) &&
          result.data.length > 0
        ) {
          handleModelSelect(result.data[0].name);
        }
      } else {
        setAvailableModels([]);
        console.error('Failed to fetch models:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const testConnection = async () => {
    if (!selectedProvider) return;

    setIsTestingConnection(true);
    setConnectionStatus('idle');
    
    try {
      // Call the main process to test the connection
      const result = await window.electronAPI.testLlmConnection(selectedProvider) as any;
      
      if (result.success) {
        setConnectionStatus('success');
        // Update available models when connection is successful
        if (result.models) {
          setAvailableModels(result.models);
        }
      } else {
        setConnectionStatus('error');
        console.error('Connection test failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      setConnectionStatus('error');
    } finally {
      setIsTestingConnection(false);
      // Reset status after 3 seconds
      setTimeout(() => setConnectionStatus('idle'), 3000);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmed) return;
    }
    
    setHasChanges(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl h-3/4 max-h-screen flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Settings</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-1/4 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <nav className="p-4">
              <button
                onClick={() => setActiveTab('general')}
                className={`w-full text-left px-3 py-2 rounded-md mb-2 transition-colors ${
                  activeTab === 'general'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <span className="mr-2">⚙️</span>
                  General
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('llm')}
                className={`w-full text-left px-3 py-2 rounded-md mb-2 transition-colors ${
                  activeTab === 'llm'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <span className="mr-2">🤖</span>
                  LLM Providers
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('mcp')}
                className={`w-full text-left px-3 py-2 rounded-md mb-2 transition-colors ${
                  activeTab === 'mcp'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <span className="mr-2">🔧</span>
                  MCP Integration
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('permissions')}
                className={`w-full text-left px-3 py-2 rounded-md mb-2 transition-colors ${
                  activeTab === 'permissions'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <span className="mr-2">🔐</span>
                  Tool Permissions
                </div>
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Loading settings...</span>
              </div>
            ) : error ? (
              <div className="bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md p-4">
                <div className="flex items-center">
                  <span className="text-red-600 dark:text-red-400 mr-2">⚠️</span>
                  <span className="text-red-800 dark:text-red-200">{error}</span>
                  <button
                    onClick={() => setError(null)}
                    className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : settings ? (
              <>
                {/* General Settings */}
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">General Settings</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Theme */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Theme
                        </label>
                        <select
                          value={settings.general.theme}
                          onChange={(e) => updateGeneralSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">System</option>
                        </select>
                      </div>

                      {/* Language */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Language
                        </label>
                        <select
                          value={settings.general.language}
                          onChange={(e) => updateGeneralSettings({ language: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="en">English</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                          <option value="de">Deutsch</option>
                        </select>
                      </div>

                      {/* Clear Chat History */}
                      <div className="col-span-2 flex flex-col">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Danger Zone
                        </label>
                        <button
                          onClick={() => {
                            if (confirm('This will delete all stored chat sessions. Continue?')) {
                              SessionManager.getInstance().clearAllSessions();
                              window.location.reload();
                            }
                          }}
                          className="w-fit px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                        >
                          Clear Chat History
                        </button>

                        {/* Full Factory Reset */}
                        <button
                          onClick={async () => {
                            if (confirm('Factory Reset will erase ALL application data including settings, provider configurations, chat history, logs and permissions. This action cannot be undone. Continue?')) {
                              try {
                                // Clear chat history in renderer
                                SessionManager.getInstance().clearAllSessions();

                                // Request main process to wipe app data
                                const result: any = await window.electronAPI.resetSettings();

                                if (!result?.success) {
                                  alert(result?.error || 'Reset failed');
                                  return;
                                }

                                // Reload the window to launch with a clean slate
                                window.location.reload();
                              } catch (err) {
                                console.error('Factory reset failed:', err);
                                alert('Factory reset failed. Check console for details.');
                              }
                            }
                          }}
                          className="w-fit mt-2 px-4 py-2 bg-red-700 text-white rounded-md hover:bg-red-800 transition-colors"
                        >
                          Factory Reset Application
                        </button>
                      </div>
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.general.autoStart}
                          onChange={(e) => updateGeneralSettings({ autoStart: e.target.checked })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Start automatically on system startup
                        </span>
                      </label>

                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.general.minimizeToTray}
                          onChange={(e) => updateGeneralSettings({ minimizeToTray: e.target.checked })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Minimize to system tray
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* LLM Provider Settings */}
                {activeTab === 'llm' && (
                  <div className="space-y-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">LLM Providers</h3>

                    {/* Show message if no providers */}
                    {(!settings?.llm.providers || settings.llm.providers.length === 0) && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No providers configured yet.</p>
                        <p className="text-sm">Click &quot;Add Provider&quot; to get started.</p>
                      </div>
                    )}

                    {/* Provider List */}
                    {settings?.llm.providers && settings.llm.providers.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-md font-medium text-gray-900 dark:text-white">All Providers</h4>
                        <div className="space-y-2">
                          {settings.llm.providers.map((provider) => (
                            <div
                              key={provider.id}
                              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                selectedProviderId === provider.id
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                              onClick={() => setSelectedProviderId(provider.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-3 h-3 rounded-full ${
                                    provider.enabled
                                      ? 'bg-blue-500'
                                      : 'bg-gray-400'
                                  }`} />
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      {provider.name}
                                      {settings.llm.defaultProviderModel?.providerId === provider.id && (
                                        <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                                          Default
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      {provider.type} • {provider.model || 'No model selected'}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {provider.enabled ? (
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                      Enabled
                                    </span>
                                  ) : (
                                    <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">
                                      Disabled
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected Provider Configuration */}
                    {selectedProvider && (
                      <div className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            Configure: {selectedProvider.name}
                          </h4>
                          {/* Remove button disabled per design change */}
                        </div>

                        <div className="space-y-4">
                          {/* Provider Type */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Provider Type
                            </label>
                            <select
                              value={selectedProvider.type}
                              onChange={(e) => updateSettings({
                                llm: {
                                  providers: settings.llm.providers.map(p => 
                                    p.id === selectedProvider.id ? { ...p, type: e.target.value as 'ollama' | 'openrouter' } : p
                                  ),
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="ollama">Ollama (Local)</option>
                              <option value="openrouter">OpenRouter (Cloud)</option>
                            </select>
                          </div>

                          {/* Provider Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Provider Name
                            </label>
                            <input
                              type="text"
                              value={selectedProvider.name}
                              onChange={(e) => updateSettings({
                                llm: {
                                  providers: settings.llm.providers.map(p => 
                                    p.id === selectedProvider.id ? { ...p, name: e.target.value } : p
                                  ),
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Provider display name"
                            />
                          </div>

                          {/* Base URL (for Ollama) */}
                          {selectedProvider.type === 'ollama' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Base URL
                              </label>
                              <input
                                type="url"
                                value={selectedProvider.baseUrl || ''}
                                onChange={(e) => updateSettings({
                                  llm: {
                                    providers: settings.llm.providers.map(p => 
                                      p.id === selectedProvider.id ? { ...p, baseUrl: e.target.value } : p
                                    ),
                                  }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={APP_CONSTANTS.DEFAULT_OLLAMA_URL}
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                The URL where Ollama is running (default: {APP_CONSTANTS.DEFAULT_OLLAMA_URL})
                              </p>
                            </div>
                          )}

                          {/* API Key (for OpenRouter) */}
                          {selectedProvider.type === 'openrouter' && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                API Key
                              </label>
                              <input
                                type="password"
                                value={selectedProvider.apiKey || ''}
                                onChange={(e) => updateSettings({
                                  llm: {
                                    providers: settings.llm.providers.map(p => 
                                      p.id === selectedProvider.id ? { ...p, apiKey: e.target.value } : p
                                    ),
                                  }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Your OpenRouter API key"
                              />
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Get your API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">openrouter.ai</a>
                              </p>
                            </div>
                          )}

                          {/* Model with Search */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Model
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={modelSearchQuery}
                                onChange={(e) => handleModelInputChange(e.target.value)}
                                onKeyDown={handleModelKeyDown}
                                onFocus={() => setShowModelDropdown(availableModels.length > 0)}
                                onBlur={() => setTimeout(() => setShowModelDropdown(false), 150)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder={availableModels.length > 0 
                                  ? 'Search models...' 
                                  : selectedProvider.type === 'ollama' ? 'llama2' : 'meta-llama/llama-2-7b-chat'
                                }
                                disabled={isLoadingModels}
                              />
                              {isLoadingModels && (
                                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                </div>
                              )}
                              
                              {/* Dropdown Results */}
                              {showModelDropdown && filteredModels.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                  {filteredModels.slice(0, 50).map((model, index) => (
                                    <div
                                      key={model.name}
                                      className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                                        index === selectedModelIndex ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                      }`}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleModelSelect(model.name);
                                      }}
                                    >
                                      <div className="text-sm text-gray-900 dark:text-white font-medium">
                                        {model.name}
                                      </div>
                                      {model.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                          {model.description}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {filteredModels.length > 50 && (
                                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600">
                                      Showing first 50 of {filteredModels.length} results. Continue typing to narrow search.
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {availableModels.length > 0 
                                  ? `${availableModels.length} models available${modelSearchQuery.length > 0 ? `, ${filteredModels.length} filtered` : ''}`
                                  : isLoadingModels 
                                    ? 'Loading models...'
                                    : selectedProvider.type === 'ollama' 
                                      ? 'Connect to load available models or enter manually'
                                      : 'Add API key to load available models or enter manually'
                                }
                              </p>
                              {!isLoadingModels && (
                                <button
                                  onClick={fetchAvailableModels}
                                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                >
                                  Refresh
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Temperature Slider */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Temperature: {selectedProvider.temperature?.toFixed(1) || '0.7'}
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={selectedProvider.temperature || 0.7}
                              onChange={(e) => updateSettings({
                                llm: {
                                  providers: settings.llm.providers.map(p => 
                                    p.id === selectedProvider.id ? { ...p, temperature: parseFloat(e.target.value) } : p
                                  ),
                                }
                              })}
                              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                            />
                            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                              <span>Conservative (0.0)</span>
                              <span>Creative (1.0)</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Controls randomness in the model's responses
                            </p>
                          </div>

                          {/* Max Tokens */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Max Tokens
                            </label>
                            <input
                              type="number"
                              min="1"
                              max="32000"
                              value={selectedProvider.maxTokens || 2048}
                              onChange={(e) => updateSettings({
                                llm: {
                                  providers: settings.llm.providers.map(p => 
                                    p.id === selectedProvider.id ? { ...p, maxTokens: parseInt(e.target.value) || 2048 } : p
                                  ),
                                }
                              })}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="2048"
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Maximum number of tokens in the response (1-32000)
                            </p>
                          </div>

                          {/* Test Connection */}
                          <div>
                            <button
                              onClick={testConnection}
                              disabled={isTestingConnection || !selectedProvider.model}
                              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
                            >
                              {isTestingConnection ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                  <span>Testing Connection...</span>
                                </>
                              ) : (
                                <span>Test Connection</span>
                              )}
                            </button>
                            {connectionStatus === 'success' && (
                              <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Connection successful!
                              </p>
                            )}
                            {connectionStatus === 'error' && (
                              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                Connection failed
                              </p>
                            )}
                          </div>

                          {/* Enable Provider */}
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedProvider.enabled}
                              onChange={(e) => updateSettings({
                                llm: {
                                  providers: settings.llm.providers.map(p => 
                                    p.id === selectedProvider.id ? { ...p, enabled: e.target.checked } : p
                                  ),
                                  defaultProviderModel: !settings.llm.defaultProviderModel && e.target.checked && selectedProvider.model
                                    ? { providerId: selectedProvider.id, modelName: selectedProvider.model }
                                    : settings.llm.defaultProviderModel
                                }
                              })}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              Enable this provider
                            </span>
                          </label>

                          {/* Default Provider */}
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="defaultProvider"
                              checked={settings.llm.defaultProviderModel?.providerId === selectedProvider.id}
                              disabled={!selectedProvider.enabled}
                              onChange={(e) => {
                                if (e.target.checked && selectedProvider.model) {
                                  updateSettings({
                                    llm: {
                                      providers: settings.llm.providers,
                                      defaultProviderModel: {
                                        providerId: selectedProvider.id,
                                        modelName: selectedProvider.model
                                      }
                                    }
                                  });
                                }
                              }}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              Set as default provider
                            </span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* MCP Integration */}
                {activeTab === 'mcp' && (
                  <McpIntegration
                    settings={settings}
                    onSettingsUpdate={loadSettings}
                  />
                )}

                {/* Tool Permissions */}
                {activeTab === 'permissions' && (
                  <ToolPermissionsOverview />
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        {settings && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {hasChanges && '• Unsaved changes'}
            </div>
            <div className="space-x-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                disabled={!hasChanges || isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 