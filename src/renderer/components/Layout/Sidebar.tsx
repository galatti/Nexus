import React, { useState, useEffect } from 'react';
import { McpServerConfig } from '../../../shared/types';

interface SidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serverCapabilities, setServerCapabilities] = useState<Record<string, { tools: number; resources: number; prompts: number; toolsList: any[] }>>({});

      useEffect(() => {
      if (isOpen) {
        loadServers();
      }
    }, [isOpen]);
  
    // Also refresh when component mounts to get current status
    useEffect(() => {
      loadServers();
    }, []);

  // Load capabilities when servers change
  useEffect(() => {
    if (servers.length > 0) {
      loadCapabilities();
    }
  }, [servers]);

  const loadServers = async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setIsLoading(true);
      }
      
      const result = await (window as any).electronAPI.getMcpServers();
      if (result.success) {
        setServers(result.data || []);
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      if (!isRefresh) {
        setIsLoading(false);
      }
    }
  };

  const loadCapabilitiesForServers = async (serversToUse: McpServerConfig[]) => {
    try {
      // Get capabilities for each ready server (same as Dashboard)
      const capabilitiesData: Record<string, { tools: number; resources: number; prompts: number; toolsList: any[] }> = {};
      const readyServers = serversToUse.filter(s => s.state === 'ready');
      
      for (const server of readyServers) {
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
      console.error('Failed to load server capabilities:', error);
    }
  };

  // Convenience wrapper for loading capabilities with current servers
  const loadCapabilities = () => loadCapabilitiesForServers(servers);

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

  // Refresh servers periodically to catch new additions
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await (window as any).electronAPI.getMcpServers();
        if (result.success && (result.data || []).length !== servers.length) {
          // Server count changed, refresh the list
          setServers(result.data || []);
        }
      } catch (error) {
        // Silently ignore errors during periodic refresh
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [servers?.length || 0]);

  if (!isOpen) return null;

  const getServerIcon = (server: McpServerConfig) => {
    if (server.name.includes('Filesystem')) return '📁';
    if (server.name.includes('Web Search')) return '🔍';
    if (server.name.includes('Weather')) return '🌤️';
    return '🔧';
  };

  const getTransportType = (server: McpServerConfig) => {
    if (server.transport) {
      // Use the explicit transport type
      switch (server.transport) {
        case 'stdio':
          return { type: 'STDIO', icon: '💬', color: 'text-green-600 dark:text-green-400' };
        case 'http':
          return { type: 'HTTP', icon: '🌐', color: 'text-blue-600 dark:text-blue-400' };
        case 'websocket':
          return { type: 'WebSocket', icon: '⚡', color: 'text-yellow-600 dark:text-yellow-400' };
        case 'sse':
          return { type: 'SSE', icon: '📡', color: 'text-purple-600 dark:text-purple-400' };
      }
    }
    
    // Fallback to detecting from command/URL (for legacy configs)
    if (!server.command) {
      return { type: 'HTTP', icon: '🌐', color: 'text-blue-600 dark:text-blue-400' };
    }
    
    const command = server.command!.toLowerCase();
    const args = server.args?.map(arg => arg.toLowerCase()) || [];
    
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

  const handleStart = async (serverId: string) => {
    try {
      await (window as any).electronAPI.testMcpConnection(serverId);
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  const handleToggleEnabled = async (serverId: string, enabled: boolean) => {
    try {
      await (window as any).electronAPI.updateMcpServerEnabled(serverId, enabled);
      await loadServers(true);
    } catch (error) {
      console.error('Failed to toggle server:', error);
    }
  };

  return (
    <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">MCP Servers</h2>
          <button
            onClick={() => loadServers(true)}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Refresh servers"
          >
            ↻
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading servers...</p>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔧</div>
            <div className="text-lg text-gray-500 dark:text-gray-400 mb-2">
              No servers configured
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Add servers in Settings to get started
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {servers.map((server) => {
              const capabilities = serverCapabilities[server.id] || { tools: 0, resources: 0, prompts: 0, toolsList: [] };
              const transport = getTransportType(server);
              
              return (
                <div
                  key={server.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow"
                >
                  {/* Server Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">{getServerIcon(server)}</div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                          {server.name}
                        </h3>
                        {server.description && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {server.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStateColor(server.state)}`} />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {getStateText(server.state)}
                      </span>
                    </div>
                  </div>

                  {/* Transport Info */}
                  <div className="flex items-center justify-between text-xs mb-3">
                    <div className="flex items-center space-x-1">
                      <span>{transport.icon}</span>
                      <span className={`font-medium ${transport.color}`}>
                        {transport.type}
                      </span>
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">
                      {server.enabled ? 'Enabled' : 'Disabled'}
                      {server.autoStart && ' • Auto-start'}
                    </div>
                  </div>

                  {/* Capabilities */}
                  {server.state === 'ready' && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {capabilities.tools}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Tools</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">
                          {capabilities.resources}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Resources</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {capabilities.prompts}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Prompts</div>
                      </div>
                    </div>
                  )}

                  {/* Tools List */}
                  {server.state === 'ready' && capabilities.toolsList && capabilities.toolsList.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Available Tools:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {capabilities.toolsList.slice(0, 3).map((tool: any) => (
                          <span
                            key={tool.name}
                            className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded"
                          >
                            {tool.name}
                          </span>
                        ))}
                        {capabilities.toolsList.length > 3 && (
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs rounded">
                            +{capabilities.toolsList.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleEnabled(server.id, !server.enabled)}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          server.enabled
                            ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200'
                        }`}
                      >
                        {server.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </div>

                    <div>
                      {server.enabled && server.state !== 'ready' && transport.type === 'HTTP' && (
                        <button
                          onClick={() => handleStart(server.id)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {server.enabled && server.state !== 'ready' && transport.type === 'STDIO' && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                          Auto-managed process
                        </span>
                      )}
                      {!server.enabled && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 italic">
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}; 