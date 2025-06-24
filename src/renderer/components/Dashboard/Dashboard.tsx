import React, { useState, useEffect } from 'react';
import { McpServerConfig } from '../../../shared/types';

export const Dashboard: React.FC = () => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serverCapabilities, setServerCapabilities] = useState<Record<string, { tools: number; resources: number; prompts: number; toolsList: any[] }>>({});
  const [totalCapabilities, setTotalCapabilities] = useState({ tools: 0, resources: 0, prompts: 0 });

  useEffect(() => {
    loadServers();
  }, []);

  // Load capabilities when servers change
  useEffect(() => {
    if (servers.length > 0) {
      loadCapabilitiesForServers(servers);
    }
  }, [servers]);

  // Listen for server state changes
  useEffect(() => {
    const cleanup = (window as any).electronAPI.onMcpServerStateChange?.((serverId: string, state: string) => {
      setServers(prev => {
        const updatedServers = prev.map(server => 
          server.id === serverId ? { ...server, state: state as any } : server
        );
        
        // Reload capabilities when server becomes ready, using updated servers
        if (state === 'ready') {
          loadCapabilitiesForServers(updatedServers);
        }
        
        return updatedServers;
      });
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

  const loadCapabilitiesForServers = async (serversToUse: McpServerConfig[]) => {
    try {
      console.log('Dashboard: Loading capabilities, servers:', serversToUse.length, serversToUse.map(s => `${s.name}:${s.state}`));
      
      // Get overall capabilities
      const allCapabilitiesResult = await (window as any).electronAPI.getAllCapabilities();
      console.log('Dashboard: All capabilities result:', allCapabilitiesResult);
      if (allCapabilitiesResult.success) {
        setTotalCapabilities(allCapabilitiesResult.capabilities);
      }

      // Get capabilities for each connected server
      const capabilitiesData: Record<string, { tools: number; resources: number; prompts: number; toolsList: any[] }> = {};
      const readyServers = serversToUse.filter(s => s.state === 'ready');
      console.log('Dashboard: Ready servers:', readyServers.length, readyServers.map(s => s.name));
      
      for (const server of readyServers) {
        try {
          console.log(`Dashboard: Getting capabilities for ${server.name} (${server.id})`);
          const result = await (window as any).electronAPI.getServerCapabilities(server.id);
          console.log(`Dashboard: Capabilities result for ${server.name}:`, result);
          if (result.success) {
            capabilitiesData[server.id] = result.capabilities;
          }
        } catch (error) {
          console.error(`Failed to load capabilities for server ${server.id}:`, error);
        }
      }
      
      console.log('Dashboard: Final capabilities data:', capabilitiesData);
      setServerCapabilities(capabilitiesData);
    } catch (error) {
      console.error('Failed to load capabilities:', error);
    }
  };

  // Convenience wrapper for loading capabilities with current servers
  const loadCapabilities = () => loadCapabilitiesForServers(servers);

  // Get capabilities for a specific server
  const getServerCapabilities = (serverId: string) => {
    return serverCapabilities[serverId] || { tools: 0, resources: 0, prompts: 0, toolsList: [] };
  };

  const getStateColor = (state?: string) => {
    switch (state) {
      case 'ready': return 'bg-green-500';
      case 'starting': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      case 'stopped': return 'bg-gray-400';
      default: return 'bg-gray-300'; // configured
    }
  };

  const getStateText = (state?: string) => {
    switch (state) {
      case 'ready': return 'Ready';
      case 'starting': return 'Starting';
      case 'failed': return 'Failed';
      case 'stopped': return 'Stopped';
      default: return 'Configured';
    }
  };

  const getServerIcon = (server: McpServerConfig) => {
    if (server.name.includes('Filesystem')) return '📁';
    if (server.name.includes('Web Search')) return '🔍';
    if (server.name.includes('Weather')) return '🌤️';
    return '🔧';
  };

  const getTransportType = (server: McpServerConfig) => {
    const command = server.command.toLowerCase();
    const args = server.args.map(arg => arg.toLowerCase());
    
    // Check for HTTP/HTTPS URLs in command or args
    if (command.includes('http') || command.includes('https') || 
        args.some(arg => arg.includes('http'))) {
      return { type: 'HTTP', icon: '🌐', color: 'text-blue-600 dark:text-blue-400' };
    }
    
    // Check for STDIO patterns (most common for MCP servers)
    if (command === 'cmd.exe' || command === 'npx' || command === 'node' || 
        args.includes('npx') || args.some(arg => arg.includes('node')) ||
        args.some(arg => arg.startsWith('@'))) { // npm packages start with @
      return { type: 'STDIO', icon: '💬', color: 'text-green-600 dark:text-green-400' };
    }
    
    // Check for SSH/TCP patterns
    if (command.includes('ssh') || command.includes('tcp') || 
        args.some(arg => arg.includes('ssh') || arg.includes('tcp'))) {
      return { type: 'SSH/TCP', icon: '🔒', color: 'text-purple-600 dark:text-purple-400' };
    }
    
    // Check for WebSocket patterns
    if (command.includes('ws') || args.some(arg => arg.includes('ws://'))) {
      return { type: 'WebSocket', icon: '⚡', color: 'text-yellow-600 dark:text-yellow-400' };
    }
    
    // Default to STDIO for most MCP servers
    return { type: 'STDIO', icon: '💬', color: 'text-green-600 dark:text-green-400' };
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">MCP Servers</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Manage your integrations</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{servers.length}</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {servers.filter(s => s.state === 'ready').length} active
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Capabilities</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Available tools & resources</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalCapabilities.tools}</p>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <span>{totalCapabilities.resources} resources</span> • <span>{totalCapabilities.prompts} prompts</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MCP Servers Grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                MCP Servers
              </h2>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-1">
                  <span>💬</span>
                  <span>STDIO</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>🌐</span>
                  <span>HTTP</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>🔒</span>
                  <span>SSH/TCP</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span>⚡</span>
                  <span>WebSocket</span>
                </div>
              </div>
            </div>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {servers.map((server) => (
                <div
                  key={server.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all hover:border-blue-300 dark:hover:border-blue-600"
                >
                  <div className="p-6">
                    {/* Server Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <span className="text-3xl">{getServerIcon(server)}</span>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {server.name}
                          </h3>
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="flex items-center space-x-2">
                              <div className={`w-3 h-3 rounded-full ${getStateColor(server.state)}`}></div>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {getStateText(server.state)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span className="text-lg">{getTransportType(server).icon}</span>
                              <span className={`text-sm font-medium ${getTransportType(server).color}`}>
                                {getTransportType(server).type}
                              </span>
                            </div>
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
                    {server.state === 'ready' && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3">
                          <div className="flex items-center space-x-6">
                            <div className="text-center">
                              <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {getServerCapabilities(server.id).tools}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Tools</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                {getServerCapabilities(server.id).resources}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Resources</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                                {getServerCapabilities(server.id).prompts}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Prompts</p>
                            </div>
                          </div>
                        </div>
                        
                        {getServerCapabilities(server.id).toolsList.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                              Available Tools ({getServerCapabilities(server.id).toolsList.length})
                            </h4>
                            <div className="flex flex-wrap gap-1">
                              {getServerCapabilities(server.id).toolsList.slice(0, 4).map((tool: any, index: number) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                                  {tool.name}
                                </span>
                              ))}
                              {getServerCapabilities(server.id).toolsList.length > 4 && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                                  +{getServerCapabilities(server.id).toolsList.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {server.enabled ? (
                            <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                              ✓ Enabled
                            </span>
                          ) : (
                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full text-sm">
                              Disabled
                            </span>
                          )}
                          {server.autoStart && (
                            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm">
                              Auto-start
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          {!server.enabled && (
                            <button
                              onClick={() => handleToggleEnabled(server.id, true)}
                              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors font-medium"
                            >
                              Enable
                            </button>
                          )}
                          {server.enabled && server.state !== 'ready' && getTransportType(server).type === 'HTTP' && (
                            <button
                              onClick={() => handleConnect(server.id)}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors font-medium"
                            >
                              Connect
                            </button>
                          )}
                          {server.enabled && server.state !== 'ready' && getTransportType(server).type === 'STDIO' && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                              Auto-managed
                            </span>
                          )}
                          {server.enabled && server.state === 'ready' && (
                            <button
                              onClick={() => handleToggleEnabled(server.id, false)}
                              className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 transition-colors font-medium"
                            >
                              Disable
                            </button>
                          )}
                        </div>
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