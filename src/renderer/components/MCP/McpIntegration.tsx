import React, { useState, useEffect } from 'react';
import { AppSettings, McpServerConfig } from '../../../shared/types';
import { McpServerWizard } from './McpServerWizard';

interface McpIntegrationProps {
  settings: AppSettings;
  onSettingsUpdate: () => void;
}

export const McpIntegration: React.FC<McpIntegrationProps> = ({ settings, onSettingsUpdate }) => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  useEffect(() => {
    loadServers();
  }, [settings]);

  const loadServers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await window.electronAPI.getMcpServers();
      if (result.success) {
        setServers(result.data || []);
      } else {
        setError(result.error || 'Failed to load servers');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load servers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleServerToggle = async (serverId: string, enabled: boolean) => {
    try {
      const result = await window.electronAPI.updateMcpServer(serverId, { enabled });
      if (result.success) {
        await loadServers();
        onSettingsUpdate();
      } else {
        setError(result.error || 'Failed to update server');
      }
    } catch (error) {
      console.error('Failed to toggle server:', error);
      setError('Failed to update server');
    }
  };

  const handleRemoveServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to remove this server?')) return;
    
    try {
      const result = await window.electronAPI.removeMcpServer(serverId);
      if (result.success) {
        await loadServers();
        onSettingsUpdate();
      } else {
        setError(result.error || 'Failed to remove server');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to remove server');
    }
  };

  const handleServerAdded = () => {
    loadServers();
    onSettingsUpdate();
  };

  const getServerStatusIcon = (server: McpServerConfig) => {
    switch (server.state) {
      case 'ready': return '🟢';
      case 'starting': return '🟡';
      case 'failed': return '🔴';
      case 'stopped': return '⚫';
      default: return '⚪';
    }
  };

  const getServerStatusText = (server: McpServerConfig) => {
    switch (server.state) {
      case 'ready': return 'Running';
      case 'starting': return 'Starting...';
      case 'failed': return 'Failed';
      case 'stopped': return 'Stopped';
      default: return 'Configured';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading MCP servers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          MCP Servers
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your Model Context Protocol server connections
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {servers.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <div className="text-6xl mb-6">🚀</div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
            No MCP Servers Configured
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Add your first MCP server to extend functionality with powerful tools, resources, and capabilities.
          </p>
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg shadow-lg"
          >
            Add Your First Server
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Server
            </button>
          </div>

          <div className="space-y-4">
            {servers.map((server) => (
              <div
                key={server.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {server.name}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        server.enabled
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {server.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {server.autoStart && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                          Auto-start
                        </span>
                      )}
                    </div>
                    
                    {server.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {server.description}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center space-x-1">
                        <span>Transport:</span>
                        <span className="font-medium">{server.transport.toUpperCase()}</span>
                      </span>
                      {server.transport === 'stdio' && server.command && (
                        <span className="flex items-center space-x-1">
                          <span>Command:</span>
                          <code className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">
                            {server.command}
                          </code>
                        </span>
                      )}
                      {server.url && (
                        <span className="flex items-center space-x-1">
                          <span>URL:</span>
                          <code className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">
                            {server.url}
                          </code>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleRemoveServer(server.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <McpServerWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onServerAdded={handleServerAdded}
      />
    </div>
  );
};