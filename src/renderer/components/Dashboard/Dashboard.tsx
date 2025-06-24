import React, { useState, useEffect } from 'react';
import { McpServerConfig } from '../../../shared/types';

export const Dashboard: React.FC = () => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serverCapabilities, setServerCapabilities] = useState<Record<string, { tools: number; resources: number; prompts: number; toolsList: any[] }>>({});
  const [totalCapabilities, setTotalCapabilities] = useState({ tools: 0, resources: 0, prompts: 0 });

  useEffect(() => {
    loadServers();
    loadCapabilities();
  }, []);

  // Listen for server status changes
  useEffect(() => {
    const cleanup = (window as any).electronAPI.onMcpServerStatusChange?.((serverId: string, status: string) => {
      setServers(prev => prev.map(server => 
        server.id === serverId ? { ...server, status: status as any } : server
      ));
      
      // Reload capabilities when server connects
      if (status === 'connected') {
        loadCapabilities();
      }
    });

    return cleanup;
  }, []);

  const loadServers = async () => {
    try {
      setIsLoading(true);
      const result = await (window as any).electronAPI.getMcpServers();
      if (result.success) {
        setServers(result.servers);
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCapabilities = async () => {
    try {
      // Get overall capabilities
      const allCapabilitiesResult = await (window as any).electronAPI.getAllCapabilities();
      if (allCapabilitiesResult.success) {
        setTotalCapabilities(allCapabilitiesResult.capabilities);
      }

      // Get capabilities for each connected server
      const capabilitiesData: Record<string, { tools: number; resources: number; prompts: number; toolsList: any[] }> = {};
      
      for (const server of servers.filter(s => s.status === 'connected')) {
        try {
          const result = await (window as any).electronAPI.getServerCapabilities(server.id);
          if (result.success) {
            capabilitiesData[server.id] = result.capabilities;
          }
        } catch (error) {
          console.error(`Failed to load capabilities for server ${server.id}:`, error);
        }
      }
      
      setServerCapabilities(capabilitiesData);
    } catch (error) {
      console.error('Failed to load capabilities:', error);
    }
  };

  // Get capabilities for a specific server
  const getServerCapabilities = (serverId: string) => {
    return serverCapabilities[serverId] || { tools: 0, resources: 0, prompts: 0, toolsList: [] };
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = (status?: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting';
      case 'error': return 'Error';
      default: return 'Disconnected';
    }
  };

  const getServerIcon = (server: McpServerConfig) => {
    if (server.name.includes('Filesystem')) return '📁';
    if (server.name.includes('Web Search')) return '🔍';
    if (server.name.includes('Weather')) return '🌤️';
    return '🔧';
  };

  const handleConnect = async (serverId: string) => {
    try {
      await (window as any).electronAPI.testMcpConnection(serverId);
    } catch (error) {
      console.error('Failed to connect to server:', error);
    }
  };

  const handleToggleEnabled = async (serverId: string, enabled: boolean) => {
    try {
      await (window as any).electronAPI.updateMcpServerEnabled(serverId, enabled);
      // Reload servers to reflect the change
      loadServers();
    } catch (error) {
      console.error('Failed to toggle server enabled status:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and monitor your MCP servers and available tools
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{servers.length}</p>
                <p className="text-gray-600 dark:text-gray-400">Total Servers</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <div className="w-6 h-6 bg-green-500 rounded-full"></div>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {servers.filter(s => s.status === 'connected').length}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Connected</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalCapabilities.tools}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Available Tools</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900">
                <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalCapabilities.resources}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Resources</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-indigo-100 dark:bg-indigo-900">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {totalCapabilities.prompts}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Prompts</p>
              </div>
            </div>
          </div>
        </div>

        {/* MCP Servers Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              MCP Servers
            </h2>
            <button
              onClick={() => {
                // This would open settings to the MCP tab
                const event = new CustomEvent('openSettings', { detail: { tab: 'mcp' } });
                window.dispatchEvent(event);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              Add Server
            </button>
          </div>

          {servers.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🔧</div>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                No MCP Servers
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Add your first MCP server to extend functionality with tools and resources
              </p>
              <button
                onClick={() => {
                  const event = new CustomEvent('openSettings', { detail: { tab: 'mcp' } });
                  window.dispatchEvent(event);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Get Started
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="p-6">
                    {/* Server Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getServerIcon(server)}</span>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {server.name}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(server.status)}`}></div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {getStatusText(server.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Server Description */}
                    {server.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {server.description}
                      </p>
                    )}

                    {/* MCP Capabilities */}
                    {server.status === 'connected' && (
                      <div className="mb-4">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {getServerCapabilities(server.id).tools}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Tools</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                              {getServerCapabilities(server.id).resources}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Resources</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                              {getServerCapabilities(server.id).prompts}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Prompts</p>
                          </div>
                        </div>
                        
                        {getServerCapabilities(server.id).toolsList.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                              Available Tools
                            </h4>
                            <div className="space-y-1">
                              {getServerCapabilities(server.id).toolsList.slice(0, 3).map((tool: any, index: number) => (
                                <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-medium">{tool.name}</span>
                                  {tool.description && (
                                    <span className="ml-2">- {tool.description}</span>
                                  )}
                                </div>
                              ))}
                              {getServerCapabilities(server.id).toolsList.length > 3 && (
                                <div className="text-xs text-gray-500 dark:text-gray-500">
                                  +{getServerCapabilities(server.id).toolsList.length - 3} more tools
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs">
                        {server.enabled ? (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
                            Enabled
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">
                            Disabled
                          </span>
                        )}
                        {server.autoStart && (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                            Auto-start
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {!server.enabled && (
                          <button
                            onClick={() => handleToggleEnabled(server.id, true)}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                          >
                            Enable
                          </button>
                        )}
                        {server.enabled && server.status !== 'connected' && (
                          <button
                            onClick={() => handleConnect(server.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                          >
                            Connect
                          </button>
                        )}
                        {server.enabled && server.status === 'connected' && (
                          <button
                            onClick={() => handleToggleEnabled(server.id, false)}
                            className="px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
                          >
                            Disable
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 