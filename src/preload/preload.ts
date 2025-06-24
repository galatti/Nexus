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
  
  // MCP operations
  connectToServer: (config: Record<string, unknown>) => 
    ipcRenderer.invoke('mcp:connect', config),
  disconnectFromServer: (serverId: string) => 
    ipcRenderer.invoke('mcp:disconnect', serverId),
  executeTools: (serverId: string, toolName: string, args: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:executeTool', serverId, toolName, args),
  
  // MCP Template operations
  getMcpTemplates: () => ipcRenderer.invoke('mcp:getTemplates'),
  checkMcpInstallations: () => ipcRenderer.invoke('mcp:checkInstallations'),
  installMcpTemplate: (templateId: string) => 
    ipcRenderer.invoke('mcp:installTemplate', templateId),
  generateServerFromTemplate: (templateId: string, config: Record<string, any>, serverName: string) =>
    ipcRenderer.invoke('mcp:generateServerFromTemplate', templateId, config, serverName),
  getMcpServers: () => 
    ipcRenderer.invoke('mcp:getServers'),
  testMcpConnection: (serverId: string) => 
    ipcRenderer.invoke('mcp:testConnection', serverId),
  getServerCapabilities: (serverId: string) =>
    ipcRenderer.invoke('mcp:getServerCapabilities', serverId),
  getAllCapabilities: () =>
    ipcRenderer.invoke('mcp:getAllCapabilities'),
  updateMcpServerEnabled: (serverId: string, enabled: boolean) =>
    ipcRenderer.invoke('mcp:updateServerEnabled', serverId, enabled),
  
  // Permission operations
  getPendingApprovals: () => ipcRenderer.invoke('permissions:getPending'),
  respondToApproval: (approvalId: string, result: any) =>
    ipcRenderer.invoke('permissions:respond', approvalId, result),
  
  // LLM operations
  sendMessage: (messages: Record<string, unknown>[], options?: Record<string, unknown>) =>
    ipcRenderer.invoke('llm:sendMessage', messages, options),
  getLlmStatus: () => ipcRenderer.invoke('llm:getStatus'),
  getAvailableModels: (providerId?: string) => 
    ipcRenderer.invoke('llm:getAvailableModels', providerId),
  
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