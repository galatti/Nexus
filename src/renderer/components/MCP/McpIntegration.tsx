import React, { useState, useEffect } from 'react';
import { AppSettings, McpServerConfig } from '../../../shared/types';

interface McpIntegrationProps {
  settings: AppSettings;
  onSettingsUpdate: () => void;
}

export const McpIntegration: React.FC<McpIntegrationProps> = ({ settings, onSettingsUpdate }) => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      console.error('Failed to load MCP servers:', error);
      setError('Failed to load servers');
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
    if (!confirm('Are you sure you want to remove this server?')) {
      return;
    }

    try {
      const result = await window.electronAPI.removeMcpServer(serverId);
      if (result.success) {
        await loadServers();
        onSettingsUpdate();
      } else {
        setError(result.error || 'Failed to remove server');
      }
    } catch (error) {
      console.error('Failed to remove server:', error);
      setError('Failed to remove server');
    }
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
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading servers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            MCP Servers
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your Model Context Protocol servers
          </p>
        </div>
        <button
          onClick={() => {
            // This will be replaced with wizard functionality
            alert('MCP Server Wizard coming soon!');
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <span className="mr-2">🧙‍♂️</span>
          Add Server
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {servers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-4xl mb-4">🔌</div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No MCP servers configured
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Add your first MCP server to start using external tools and capabilities
          </p>
          <button
            onClick={() => {
              // This will be replaced with wizard functionality
              alert('MCP Server Wizard coming soon!');
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span className="mr-2">🧙‍♂️</span>
            Add Your First Server
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-md">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {servers.map((server) => (
              <li key={server.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getServerStatusIcon(server)}</span>
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {server.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {server.description || server.command}
                      </p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Status: {getServerStatusText(server)}
                        </span>
                        {server.autoStart && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            Auto-start
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={server.enabled}
                        onChange={(e) => handleServerToggle(server.id, e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                    <button
                      onClick={() => handleRemoveServer(server.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                      title="Remove server"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};