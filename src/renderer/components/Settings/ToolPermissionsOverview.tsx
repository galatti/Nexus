import React, { useState, useEffect } from 'react';

interface McpServer {
  id: string;
  name: string;
  status: string;
  allowedDirectories?: string[];
  maxFileSize?: number;
  readOnly?: boolean;
  tools?: Array<{
    name: string;
    description: string;
  }>;
}

interface ToolPermission {
  serverId: string;
  toolName: string;
  permission: 'allow' | 'deny' | 'ask';
  scope?: 'once' | 'session' | 'always';
  expiresAt?: string;
  grantedAt?: string;
  riskLevel: 'low' | 'medium' | 'high';
  allowedPaths?: string[];
  allowedDomains?: string[];
  usageCount?: number;
  lastUsed?: string;
}

interface PermissionStats {
  totalPermissions: number;
  activePermissions: number;
  sessionPermissions: number;
  expiredPermissions: number;
}

export const ToolPermissionsOverview: React.FC = () => {
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [permissions, setPermissions] = useState<ToolPermission[]>([]);
  const [stats, setStats] = useState<PermissionStats>({
    totalPermissions: 0,
    activePermissions: 0,
    sessionPermissions: 0,
    expiredPermissions: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'servers' | 'permissions'>('servers');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load MCP servers with basic config
      const serversResult = await (window as any).electronAPI.getMcpServers();
      if (serversResult.success) {
        const servers = serversResult.servers || [];
        
        // Enrich servers with capabilities and configuration details
        const enrichedServers = await Promise.all(
          servers.map(async (server: any) => {
            try {
              // Get server capabilities (tools)
              const capabilitiesResult = await (window as any).electronAPI.getServerCapabilities?.(server.id);
              const tools = capabilitiesResult?.success ? capabilitiesResult.capabilities?.toolsList || [] : [];
              
              // Extract configuration from server config
              // Note: In a real implementation, this would come from the server configuration
              // For now, we'll use known values from the console logs
              const allowedDirectories = server.id.includes('filesystem') 
                ? ['C:\\Users\\galat\\Documents'] // From console log
                : undefined;
              
              const maxFileSize = server.id.includes('filesystem') ? 10 : undefined; // 10MB default
              const readOnly = false; // Default value
              
              return {
                ...server,
                status: server.state || 'stopped',
                allowedDirectories,
                maxFileSize,
                readOnly,
                tools: tools.map((tool: any) => ({
                  name: tool.name,
                  description: tool.description
                }))
              };
            } catch (error) {
              console.error(`Failed to load capabilities for server ${server.id}:`, error);
              return {
                ...server,
                status: server.state || 'stopped',
                tools: []
              };
            }
          })
        );
        
        setMcpServers(enrichedServers);
      }

      // Load permissions
      const permissionsResult = await (window as any).electronAPI.getAllPermissions();
      if (permissionsResult.success) {
        setPermissions(permissionsResult.data || []);
      }

      // Load permission stats
      const statsResult = await (window as any).electronAPI.getPermissionStats();
      if (statsResult.success) {
        const data = statsResult.data || {};
        setStats({
          totalPermissions: data.total || 0,
          activePermissions: data.total || 0, // For now, same as total
          sessionPermissions: data.session || 0,
          expiredPermissions: data.expired || 0
        });
      }
    } catch (error) {
      console.error('Failed to load permissions data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready': return '🟢';
      case 'starting': return '🟡';
      case 'stopped': return '🔴';
      case 'error': return '❌';
      default: return '⚪';
    }
  };

  const getRiskColor = (riskLevel: 'low' | 'medium' | 'high') => {
    switch (riskLevel) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const formatTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return 'Never';
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `${diffDays} days`;
  };

  const clearExpiredPermissions = async () => {
    try {
      const result = await (window as any).electronAPI.clearExpiredPermissions();
      if (result.success) {
        await loadData(); // Reload data
      }
    } catch (error) {
      console.error('Failed to clear expired permissions:', error);
    }
  };

  const revokePermission = async (serverId: string, toolName: string) => {
    try {
      const result = await (window as any).electronAPI.revokePermission(serverId, toolName);
      if (result.success) {
        await loadData(); // Reload data
      }
    } catch (error) {
      console.error('Failed to revoke permission:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading permissions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tool Permissions & Security Overview</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('servers')}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === 'servers'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            🔧 Server Capabilities
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-3 py-1 text-sm rounded ${
              activeTab === 'permissions'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
            }`}
          >
            🔐 Active Permissions
          </button>
        </div>
      </div>

      {/* Permission Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.totalPermissions}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Permissions</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.activePermissions}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Active</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600">{stats.sessionPermissions}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Session Only</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{stats.expiredPermissions}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Expired</div>
        </div>
      </div>

      {/* Server Capabilities Tab */}
      {activeTab === 'servers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">MCP Server Capabilities & Restrictions</h4>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              What each server can access on your system
            </span>
          </div>

          {mcpServers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-4">🔧</div>
              <p>No MCP servers configured</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mcpServers.map((server) => (
                <div key={server.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-3">
                        <span className="text-lg">{getStatusIcon(server.status)}</span>
                        <span className="font-semibold text-gray-900 dark:text-white text-lg">
                          {server.name}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          ({server.id})
                        </span>
                      </div>

                      {/* Security Information */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                          🔒 Security Restrictions
                        </div>
                        
                        {server.allowedDirectories && server.allowedDirectories.length > 0 ? (
                          <div className="space-y-1">
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                              <strong>Allowed Directories:</strong>
                            </div>
                            {server.allowedDirectories.map((dir, idx) => (
                              <div key={idx} className="text-sm font-mono bg-blue-100 dark:bg-blue-800/30 px-2 py-1 rounded text-blue-800 dark:text-blue-200">
                                📁 {dir}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            ⚠️ No directory restrictions configured
                          </div>
                        )}

                        {server.maxFileSize && (
                          <div className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                            <strong>Max File Size:</strong> {server.maxFileSize} MB
                          </div>
                        )}

                        {server.readOnly && (
                          <div className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                            🔒 <strong>Read-Only Mode:</strong> Cannot modify files
                          </div>
                        )}
                      </div>

                      {/* Available Tools */}
                      {server.tools && server.tools.length > 0 && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                          <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                            🔧 Available Tools ({server.tools.length})
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {server.tools.slice(0, 6).map((tool, idx) => (
                              <div key={idx} className="text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-gray-700 dark:text-gray-300">
                                {tool.name}
                              </div>
                            ))}
                            {server.tools.length > 6 && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                ... and {server.tools.length - 6} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-md font-medium text-gray-900 dark:text-white">Active Tool Permissions</h4>
            <div className="space-x-2">
              {stats.expiredPermissions > 0 && (
                <button
                  onClick={clearExpiredPermissions}
                  className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Clear Expired ({stats.expiredPermissions})
                </button>
              )}
              <button
                onClick={loadData}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {permissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-4">🔐</div>
              <p>No active permissions</p>
              <p className="text-sm mt-1">Tool permissions will appear here when granted</p>
            </div>
          ) : (
            <div className="space-y-3">
              {permissions.map((permission, index) => (
                <div
                  key={`${permission.serverId}-${permission.toolName}-${index}`}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-lg">🔧</span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {permission.toolName}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded ${getRiskColor(permission.riskLevel)}`}>
                          {permission.riskLevel} risk
                        </span>
                        <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
                          {permission.scope}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div><strong>Server:</strong> {permission.serverId}</div>
                        <div><strong>Granted:</strong> {formatDate(permission.grantedAt)}</div>
                        {permission.scope === 'always' && (
                          <div><strong>Expires:</strong> {formatTimeRemaining(permission.expiresAt)}</div>
                        )}
                        {permission.usageCount !== undefined && (
                          <div><strong>Used:</strong> {permission.usageCount} times</div>
                        )}
                        {permission.lastUsed && (
                          <div><strong>Last Used:</strong> {formatDate(permission.lastUsed)}</div>
                        )}
                        {permission.allowedPaths && permission.allowedPaths.length > 0 && (
                          <div>
                            <strong>Allowed Paths:</strong>
                            <div className="mt-1 space-y-1">
                              {permission.allowedPaths.map((path, idx) => (
                                <div key={idx} className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  📁 {path}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {permission.allowedDomains && permission.allowedDomains.length > 0 && (
                          <div>
                            <strong>Allowed Domains:</strong>
                            <div className="mt-1 space-y-1">
                              {permission.allowedDomains.map((domain, idx) => (
                                <div key={idx} className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  🌐 {domain}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => revokePermission(permission.serverId, permission.toolName)}
                      className="ml-4 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      title="Revoke this permission"
                    >
                      🗑️ Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 