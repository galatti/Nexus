import React, { useState, useEffect } from 'react';
import { McpServerConfig } from '../../../shared/types';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen }) => {
  const [servers, setServers] = useState<McpServerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadServers();
      // Also refresh every 2 seconds when sidebar is open to catch status changes
      const interval = setInterval(loadServers, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const loadServers = async () => {
    try {
      setIsLoading(true);
      const result = await (window as any).electronAPI.getMcpServers();
      if (result.success) {
        console.log('Sidebar: Loaded servers:', result.servers);
        setServers(result.servers);
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Listen for server status changes
  useEffect(() => {
    if (!isOpen) return;

    console.log('Sidebar: Setting up status change listener');
    const cleanup = (window as any).electronAPI.onMcpServerStatusChange((serverId: string, status: string) => {
      console.log('Sidebar: Received status change:', serverId, status);
      setServers(prev => {
        console.log('Sidebar: Current servers:', prev.map(s => s.id));
        return prev.map(server => 
          server.id === serverId ? { ...server, status: status as any } : server
        );
      });
    });

    return cleanup;
  }, [isOpen]);

  if (!isOpen) return null;

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

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">MCP Servers</h2>
          <button
            onClick={loadServers}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="Refresh servers"
          >
            ↻
          </button>
        </div>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Loading...</p>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🔧</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No servers configured yet
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Add servers in Settings
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {server.name}
                  </h3>
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(server.status)}`} />
                </div>
                
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {getStatusText(server.status)}
                </div>
                
                {server.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {server.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {server.enabled ? 'Enabled' : 'Disabled'}
                    {server.autoStart && ' • Auto-start'}
                  </div>
                  
                  {server.status !== 'connected' && (
                    <button
                      onClick={async () => {
                        try {
                          await (window as any).electronAPI.testMcpConnection(server.id);
                          // Refresh servers after connection attempt
                          setTimeout(() => loadServers(), 1000);
                        } catch (error) {
                          console.error('Failed to connect to server:', error);
                        }
                      }}
                      className="text-xs px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}; 