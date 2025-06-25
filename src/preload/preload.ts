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
  sendMessage: (messages: Record<string, unknown>[], options?: Record<string, unknown>) =>
    ipcRenderer.invoke('llm:sendMessage', messages, options),
  getLlmStatus: () => ipcRenderer.invoke('llm:getStatus'),
  getAvailableModels: (providerId?: string) => 
    ipcRenderer.invoke('llm:getAvailableModels', providerId),
  testLlmConnection: (providerConfig: Record<string, unknown>) =>
    ipcRenderer.invoke('llm:test-connection', providerConfig),
  getModelsForConfig: (providerConfig: Record<string, unknown>) =>
    ipcRenderer.invoke('llm:getModelsForConfig', providerConfig),
  
  // Event listeners
  onMcpServerStateChange: (callback: (serverId: string, state: string) => void) => {
    ipcRenderer.on('mcp:serverStateChange', (_event, serverId, state) => 
      callback(serverId, state));
    return () => ipcRenderer.removeAllListeners('mcp:serverStateChange');
  },

  onSettingsChange: (callback: (settings: Record<string, unknown>) => void) => {
    ipcRenderer.on('settings:changed', (_event, settings) => callback(settings));
    return () => ipcRenderer.removeAllListeners('settings:changed');
  },

  // MCP notification event listeners
  onProgressNotification: (callback: (serverId: string, notification: any) => void) => {
    ipcRenderer.on('mcp:progressNotification', (_event, serverId, notification) => 
      callback(serverId, notification));
    return () => ipcRenderer.removeAllListeners('mcp:progressNotification');
  },

  onLogMessage: (callback: (serverId: string, logMessage: any) => void) => {
    ipcRenderer.on('mcp:logMessage', (_event, serverId, logMessage) => 
      callback(serverId, logMessage));
    return () => ipcRenderer.removeAllListeners('mcp:logMessage');
  },

  onResourcesChanged: (callback: (serverId: string, resources: any[]) => void) => {
    ipcRenderer.on('mcp:resourcesChanged', (_event, serverId, resources) => 
      callback(serverId, resources));
    return () => ipcRenderer.removeAllListeners('mcp:resourcesChanged');
  },

  onResourceUpdated: (callback: (serverId: string, uri: string) => void) => {
    ipcRenderer.on('mcp:resourceUpdated', (_event, serverId, uri) => 
      callback(serverId, uri));
    return () => ipcRenderer.removeAllListeners('mcp:resourceUpdated');
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