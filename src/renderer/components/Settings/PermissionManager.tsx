import React, { useState, useEffect } from 'react';

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
  total: number;
  session: number;
  expired: number;
  expiringSoon: number;
}

export const PermissionManager: React.FC = () => {
  const [permissions, setPermissions] = useState<ToolPermission[]>([]);
  const [stats, setStats] = useState<PermissionStats>({ total: 0, session: 0, expired: 0, expiringSoon: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    setIsLoading(true);
    try {
      // Note: We'll need to add these IPC handlers to the backend
      const [permissionsResult, statsResult] = await Promise.all([
        (window as any).electronAPI?.getAllPermissions?.() || { success: false, data: [] },
        (window as any).electronAPI?.getPermissionStats?.() || { success: false, data: { total: 0, session: 0, expired: 0, expiringSoon: 0 } }
      ]);

      if (permissionsResult.success) {
        setPermissions(permissionsResult.data || []);
      }

      if (statsResult.success) {
        setStats(statsResult.data || { total: 0, session: 0, expired: 0, expiringSoon: 0 });
      }
    } catch (error) {
      console.error('Failed to load permissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const revokePermission = async (serverId: string, toolName: string) => {
    try {
      const result = await (window as any).electronAPI?.revokePermission?.(serverId, toolName);
      if (result?.success) {
        await loadPermissions(); // Reload permissions
      }
    } catch (error) {
      console.error('Failed to revoke permission:', error);
    }
  };

  const clearSessionPermissions = async () => {
    try {
      const result = await (window as any).electronAPI?.clearSessionPermissions?.();
      if (result?.success) {
        await loadPermissions(); // Reload permissions
      }
    } catch (error) {
      console.error('Failed to clear session permissions:', error);
    }
  };

  const clearAllPermissions = async () => {
    if (confirm('Are you sure you want to clear ALL permissions? This action cannot be undone.')) {
      try {
        const result = await (window as any).electronAPI?.clearAllPermissions?.();
        if (result?.success) {
          await loadPermissions(); // Reload permissions
        }
      } catch (error) {
        console.error('Failed to clear all permissions:', error);
      }
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900';
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700';
    }
  };

  const getScopeIcon = (scope?: string) => {
    switch (scope) {
      case 'session': return '🔄';
      case 'always': return '♾️';
      default: return '❓';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleString();
  };

  const formatTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return 'Never';
    
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) return `${diffDays}d ${diffHours}h`;
    return `${diffHours}h`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Permission Management
        </h3>
        <button
          onClick={loadPermissions}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Permissions</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.session}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Session Permissions</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.expiringSoon}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Expiring Soon</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.expired}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Expired</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={clearSessionPermissions}
          className="px-4 py-2 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
        >
          🔄 Clear Session Permissions
        </button>
        <button
          onClick={clearAllPermissions}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
        >
          🗑️ Clear All Permissions
        </button>
      </div>

      {/* Permissions List */}
      <div className="space-y-4">
        <h4 className="text-md font-semibold text-gray-900 dark:text-white">
          Active Permissions ({permissions.length})
        </h4>
        
        {permissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No active permissions
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {permissions.map((permission, index) => (
              <div
                key={`${permission.serverId}-${permission.toolName}-${index}`}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">{getScopeIcon(permission.scope)}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {permission.toolName}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${getRiskColor(permission.riskLevel)}`}>
                        {permission.riskLevel} risk
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                      <div><strong>Server:</strong> {permission.serverId}</div>
                      <div><strong>Scope:</strong> {permission.scope}</div>
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
                        <div><strong>Allowed Paths:</strong> {permission.allowedPaths.join(', ')}</div>
                      )}
                      {permission.allowedDomains && permission.allowedDomains.length > 0 && (
                        <div><strong>Allowed Domains:</strong> {permission.allowedDomains.join(', ')}</div>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => revokePermission(permission.serverId, permission.toolName)}
                    className="ml-4 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    🗑️ Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}; 