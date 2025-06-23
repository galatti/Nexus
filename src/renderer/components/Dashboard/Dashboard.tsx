import React, { useState, useEffect } from 'react';
import { McpServerConfig } from '../../../shared/types';

export const Dashboard: React.FC = () => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectedTools, setConnectedTools] = useState<Record<string, any[]>>({});

  useEffect(() => {
    loadServers();
    loadConnectedTools();
  }, []);

  // Listen for server status changes
  useEffect(() => {
    const cleanup = (window as any).electronAPI.onMcpServerStatusChange?.((serverId: string, status: string) => {
      setServers(prev => prev.map(server => 
        server.id === serverId ? { ...server, status: status as any } : server
      ));
      
      // Reload tools when server connects
      if (status === 'connected') {
        loadConnectedTools();
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

  const loadConnectedTools = async () => {
    try {
      // Get tools for each connected server
      const toolsData: Record<string, any[]> = {};
      
      for (const server of servers.filter(s => s.status === 'connected')) {
        try {
          // This would need to be implemented in the backend
          // For now, we'll use mock data based on server type
          const tools = getToolsForServer(server);
          toolsData[server.id] = tools;
        } catch (error) {
          console.error(`Failed to load tools for server ${server.id}:`, error);
        }
      }
      
      setConnectedTools(toolsData);
    } catch (error) {
      console.error('Failed to load connected tools:', error);
    }
  };

  // Mock tool data based on server type - this would come from the backend in real implementation
  const getToolsForServer = (server: McpServerConfig) => {
    if (server.name.includes('Filesystem')) {
      return [
        { name: 'read_file', description: 'Read file contents' },
        { name: 'write_file', description: 'Write file contents' },
        { name: 'list_directory', description: 'List directory contents' },
        { name: 'search_files', description: 'Search for files' }
      ];
    } else if (server.name.includes('Web Search')) {
      return [
        { name: 'search_web', description: 'Search the web' },
        { name: 'get_page_content', description: 'Get webpage content' }
      ];
    } else if (server.name.includes('Weather')) {
      return [
        { name: 'get_weather', description: 'Get current weather' },
        { name: 'get_forecast', description: 'Get weather forecast' }
      ];
    }
    return [];
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                  {Object.values(connectedTools).flat().length}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Available Tools</p>
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

                    {/* Tools */}
                    {server.status === 'connected' && connectedTools[server.id] && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Available Tools ({connectedTools[server.id].length})
                        </h4>
                        <div className="space-y-1">
                          {connectedTools[server.id].slice(0, 3).map((tool, index) => (
                            <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">{tool.name}</span>
                              {tool.description && (
                                <span className="ml-2">- {tool.description}</span>
                              )}
                            </div>
                          ))}
                          {connectedTools[server.id].length > 3 && (
                            <div className="text-xs text-gray-500 dark:text-gray-500">
                              +{connectedTools[server.id].length - 3} more tools
                            </div>
                          )}
                        </div>
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

                      {server.status !== 'connected' && server.enabled && (
                        <button
                          onClick={() => handleConnect(server.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Connect
                        </button>
                      )}
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