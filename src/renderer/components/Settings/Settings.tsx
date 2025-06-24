import React, { useState, useEffect } from 'react';
import { AppSettings, LlmProviderConfig } from '../../../shared/types';
import { McpServerTemplates } from '../MCP/McpServerTemplates';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

type SettingsTab = 'general' | 'llm' | 'mcp' | 'mcp-templates';

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, initialTab = 'general' }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab as SettingsTab);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

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

  const updateLlmProvider = (provider: Partial<LlmProviderConfig>) => {
    if (!settings) return;
    updateSettings({
      llm: {
        provider: { ...settings.llm.provider, ...provider }
      }
    });
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
                  MCP Servers
                </div>
              </button>
              
              <button
                onClick={() => setActiveTab('mcp-templates')}
                className={`w-full text-left px-3 py-2 rounded-md mb-2 transition-colors ${
                  activeTab === 'mcp-templates'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center">
                  <span className="mr-2">📦</span>
                  Server Templates
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
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">LLM Provider Configuration</h3>
                    
                    <div className="space-y-6">
                      {/* Provider Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Provider Type
                        </label>
                        <select
                          value={settings.llm.provider.type}
                          onChange={(e) => updateLlmProvider({ type: e.target.value as 'ollama' | 'openrouter' })}
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
                          value={settings.llm.provider.name}
                          onChange={(e) => updateLlmProvider({ name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Provider display name"
                        />
                      </div>

                      {/* Base URL (for Ollama) */}
                      {settings.llm.provider.type === 'ollama' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Base URL
                          </label>
                          <input
                            type="url"
                            value={settings.llm.provider.baseUrl || ''}
                            onChange={(e) => updateLlmProvider({ baseUrl: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="http://localhost:11434"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            The URL where Ollama is running (default: http://localhost:11434)
                          </p>
                        </div>
                      )}

                      {/* API Key (for OpenRouter) */}
                      {settings.llm.provider.type === 'openrouter' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            API Key
                          </label>
                          <input
                            type="password"
                            value={settings.llm.provider.apiKey || ''}
                            onChange={(e) => updateLlmProvider({ apiKey: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Your OpenRouter API key"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Get your API key from <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">openrouter.ai</a>
                          </p>
                        </div>
                      )}

                      {/* Model */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Default Model
                        </label>
                        <input
                          type="text"
                          value={settings.llm.provider.model}
                          onChange={(e) => updateLlmProvider({ model: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={settings.llm.provider.type === 'ollama' ? 'llama2' : 'meta-llama/llama-2-7b-chat'}
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {settings.llm.provider.type === 'ollama' 
                            ? 'Name of the Ollama model (e.g., llama2, codellama)'
                            : 'OpenRouter model ID (e.g., meta-llama/llama-2-7b-chat)'
                          }
                        </p>
                      </div>

                      {/* Enable Provider */}
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={settings.llm.provider.enabled}
                          onChange={(e) => updateLlmProvider({ enabled: e.target.checked })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Enable this LLM provider
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* MCP Servers */}
                {activeTab === 'mcp' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">MCP Servers</h3>
                      <button 
                        onClick={() => setActiveTab('mcp-templates')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        Add Server
                      </button>
                    </div>
                    
                    {settings.mcp.servers.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <div className="text-4xl mb-4">🔧</div>
                        <p>No MCP servers configured</p>
                        <p className="text-sm mt-1">Add servers to extend functionality with tools and resources</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {settings.mcp.servers.map((server) => (
                          <div key={server.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-white">{server.name}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{server.command}</p>
                                <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
                                  server.status === 'connected' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : server.status === 'error'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                }`}>
                                  {server.status || 'disconnected'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button className="text-blue-600 hover:text-blue-800 text-sm">Edit</button>
                                <button className="text-red-600 hover:text-red-800 text-sm">Remove</button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* MCP Server Templates */}
                {activeTab === 'mcp-templates' && (
                  <McpServerTemplates
                    onAddServer={(_templateId, _config, _serverName) => {
                      // Refresh settings after adding server
                      loadSettings();
                      setActiveTab('mcp');
                    }}
                  />
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