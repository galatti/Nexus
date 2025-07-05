import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI = {
  // App info
  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),
  
  // Window controls
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings: Record<string, unknown>) => 
    ipcRenderer.invoke('settings:set', settings),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),

  // Secure storage
  getProviderApiKey: (providerId: string) => 
    ipcRenderer.invoke('secure-storage:getProviderApiKey', providerId),
  setProviderApiKey: (providerId: string, apiKey: string) => 
    ipcRenderer.invoke('secure-storage:setProviderApiKey', providerId, apiKey),
  getSecurityStatus: () => 
    ipcRenderer.invoke('secure-storage:getSecurityStatus'),
  isSecureStorageAvailable: () => 
    ipcRenderer.invoke('secure-storage:isAvailable'),
  forceMigrateApiKeys: () => 
    ipcRenderer.invoke('secure-storage:forceMigrate'),
  
  // MCP operations
  connectToServer: (config: Record<string, unknown>) => 
    ipcRenderer.invoke('mcp:connect', config),
  disconnectFromServer: (serverId: string) => 
    ipcRenderer.invoke('mcp:disconnect', serverId),
  testMcpConnection: (serverConfigOrId: string | Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:testConnection', serverConfigOrId),
  executeTools: (serverId: string, toolName: string, args: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:executeTool', serverId, toolName, args),
  
  // MCP Server management
  getMcpServers: () => 
    ipcRenderer.invoke('mcp:getServers'),
  addMcpServer: (serverConfig: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:addServer', serverConfig),
  updateMcpServer: (serverId: string, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:updateServer', serverId, updates),
  removeMcpServer: (serverId: string) =>
    ipcRenderer.invoke('mcp:removeServer', serverId),
  removeAllMcpServers: () =>
    ipcRenderer.invoke('mcp:removeAllServers'),
  startMcpServer: (serverId: string) =>
    ipcRenderer.invoke('mcp:start', serverId),
  stopMcpServer: (serverId: string) =>
    ipcRenderer.invoke('mcp:stop', serverId),
  getServerCapabilities: (serverId: string) =>
    ipcRenderer.invoke('mcp:getServerCapabilities', serverId),
  getAllCapabilities: () =>
    ipcRenderer.invoke('mcp:getAllCapabilities'),
  updateMcpServerEnabled: (serverId: string, enabled: boolean) =>
    ipcRenderer.invoke('mcp:updateServerEnabled', serverId, enabled),
  
  // Resource operations
  readResource: (serverId: string, uri: string) =>
    ipcRenderer.invoke('mcp:readResource', serverId, uri),
  subscribeResource: (serverId: string, uri: string) =>
    ipcRenderer.invoke('mcp:subscribeResource', serverId, uri),
  unsubscribeResource: (serverId: string, uri: string) =>
    ipcRenderer.invoke('mcp:unsubscribeResource', serverId, uri),
  
  // Prompt operations
  executePrompt: (serverId: string, promptName: string, args?: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:executePrompt', serverId, promptName, args),
  
  // LLM sampling via MCP
  sampleLLM: (serverId: string, messages: any[], options?: any) =>
    ipcRenderer.invoke('mcp:sampleLLM', serverId, messages, options),
  
  // Permission operations
  getPendingApprovals: () => ipcRenderer.invoke('permissions:getPending'),
  respondToApproval: (approvalId: string, result: any) =>
    ipcRenderer.invoke('permissions:respond', approvalId, result),
  getAllPermissions: () => ipcRenderer.invoke('permissions:getAll'),
  getPermissionStats: () => ipcRenderer.invoke('permissions:getStats'),
  revokePermission: (serverId: string, toolName: string) =>
    ipcRenderer.invoke('permissions:revoke', serverId, toolName),
  clearSessionPermissions: () => ipcRenderer.invoke('permissions:clearSession'),
  clearAllPermissions: () => ipcRenderer.invoke('permissions:clearAll'),
  clearExpiredPermissions: () => ipcRenderer.invoke('permissions:clearExpired'),
  
  // LLM operations
  sendMessage: (params: { messages: Record<string, unknown>[]; providerId: string; modelName: string; options?: Record<string, unknown> }) =>
    ipcRenderer.invoke('llm:sendMessage', params),
  getLlmStatus: () => ipcRenderer.invoke('llm:getStatus'),
  getAvailableModels: (providerId?: string) => 
    ipcRenderer.invoke('llm:getAvailableModels', providerId),
  testLlmConnection: (providerConfig: Record<string, unknown>) =>
    ipcRenderer.invoke('llm:test-connection', providerConfig),
  getModelsForConfig: (providerConfig: Record<string, unknown>) =>
    ipcRenderer.invoke('llm:getModelsForConfig', providerConfig),
  
  // Event listeners
  onMcpServerStateChange: (callback: (serverId: string, state: string) => void) => {
    const listener = (_event: any, serverId: string, state: string) => callback(serverId, state);
    ipcRenderer.on('mcp:serverStateChange', listener);
    return () => ipcRenderer.removeListener('mcp:serverStateChange', listener);
  },

  onMcpServerConfigChange: (callback: (serverId: string, changes: Record<string, unknown>) => void) => {
    const listener = (_event: any, serverId: string, changes: Record<string, unknown>) => callback(serverId, changes);
    ipcRenderer.on('mcp:serverConfigChanged', listener);
    return () => ipcRenderer.removeListener('mcp:serverConfigChanged', listener);
  },

  onSettingsChange: (callback: (settings: Record<string, unknown>) => void) => {
    const listener = (_event: any, settings: Record<string, unknown>) => callback(settings);
    ipcRenderer.on('settings:changed', listener);
    return () => ipcRenderer.removeListener('settings:changed', listener);
  },

  // MCP notification event listeners
  onProgressNotification: (callback: (serverId: string, notification: any) => void) => {
    const listener = (_event: any, serverId: string, notification: any) => callback(serverId, notification);
    ipcRenderer.on('mcp:progressNotification', listener);
    return () => ipcRenderer.removeListener('mcp:progressNotification', listener);
  },

  onLogMessage: (callback: (serverId: string, logMessage: any) => void) => {
    const listener = (_event: any, serverId: string, logMessage: any) => callback(serverId, logMessage);
    ipcRenderer.on('mcp:logMessage', listener);
    return () => ipcRenderer.removeListener('mcp:logMessage', listener);
  },

  onResourcesChanged: (callback: (serverId: string, resources: any[]) => void) => {
    const listener = (_event: any, serverId: string, resources: any[]) => callback(serverId, resources);
    ipcRenderer.on('mcp:resourcesChanged', listener);
    return () => ipcRenderer.removeListener('mcp:resourcesChanged', listener);
  },

  onResourceUpdated: (callback: (serverId: string, uri: string) => void) => {
    const listener = (_event: any, serverId: string, uri: string) => callback(serverId, uri);
    ipcRenderer.on('mcp:resourceUpdated', listener);
    return () => ipcRenderer.removeListener('mcp:resourceUpdated', listener);
  },

  onLlmProviderChange: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('llm:providerChanged', listener);
    return () => ipcRenderer.removeListener('llm:providerChanged', listener);
  },
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  } catch (error) {
    console.error('Failed to expose electronAPI:', error);
  }
} else {
  // @ts-expect-error Legacy support for non-isolated contexts
  window.electronAPI = electronAPI;
}

// Type definitions for renderer process
export type ElectronAPI = typeof electronAPI; 