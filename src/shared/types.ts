// Electron API types
// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LlmStatusResponse {
  currentProvider: string | null;
  currentProviderName: string | null;
  currentProviderType: string | null;
  currentModel: string | null;
  isHealthy: boolean;
  models?: LlmModel[];
}

export interface McpTemplateResponse {
  templates: McpServerTemplateInfo[];
}

export interface McpInstallationStatus {
  [templateId: string]: {
    isInstalled: boolean;
    isInstalling: boolean;
    error?: string;
  };
}

export interface McpInstallationResponse {
  success: boolean;
  error?: string;
  installedVersion?: string;
  command?: string;
  args?: string[];
}

export interface PendingApproval {
  id: string;
  toolName: string;
  serverId: string;
  args: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: Date;
  timeout?: number;
}

export interface ApprovalResult {
  approved: boolean;
  scope?: 'once' | 'session' | 'always';
}

export interface McpServerTemplateInfo {
  id: string;
  name: string;
  description: string;
  category: 'filesystem' | 'web' | 'weather' | 'productivity' | 'development' | 'custom';
  icon: string;
  npmPackage?: string;
  version?: string;
  defaultEnabled: boolean;
  requiresConfig: boolean;
  configFields: McpConfigField[];
  documentation?: string;
  examples?: string[];
}

export interface McpConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select' | 'path';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string[];
  validation?: RegExp;
  defaultValue?: unknown;
}

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: AppSettings) => Promise<void>;
  connectToServer: (config: McpServerConfig) => Promise<void>;
  disconnectFromServer: (serverId: string) => Promise<void>;
  executeTools: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  sendMessage: (message: string, options?: Record<string, unknown>) => Promise<string>;
  getLlmStatus: () => Promise<ApiResponse<LlmStatusResponse>>;
  getAvailableModels: (providerId?: string) => Promise<ApiResponse<LlmModel[]>>;
  onMcpServerStatusChange: (callback: (serverId: string, status: string) => void) => () => void;
  onSettingsChange: (callback: (settings: AppSettings) => void) => () => void;
  getMcpTemplates: () => Promise<ApiResponse<McpTemplateResponse>>;
  checkMcpInstallations: () => Promise<ApiResponse<McpInstallationStatus>>;
  installMcpTemplate: (templateId: string) => Promise<McpInstallationResponse>;
  generateServerFromTemplate: (templateId: string, config: Record<string, unknown>, serverName: string) => Promise<ApiResponse<McpServerConfig>>;
  getPendingApprovals: () => Promise<ApiResponse<PendingApproval[]>>;
  respondToApproval: (approvalId: string, result: ApprovalResult) => Promise<ApiResponse<boolean>>;
}

// Application settings
export interface AppSettings {
  general: {
    theme: 'light' | 'dark' | 'system';
    autoStart: boolean;
    minimizeToTray: boolean;
    language: string;
  };
  llm: {
    provider: LlmProviderConfig;
  };
  mcp: {
    servers: McpServerConfig[];
  };
}

// MCP Server configuration
export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  autoStart: boolean;
  status?: 'disconnected' | 'connecting' | 'connected' | 'error';
  templateId?: string;
  userConfig?: Record<string, unknown>;
}

// LLM Provider configuration
export interface LlmProviderConfig {
  type: 'ollama' | 'openrouter';
  name: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
  models?: LlmModel[];
}

// LLM Model information
export interface LlmModel {
  name: string;
  size?: string;
  description?: string;
  modified_at?: string;
}

// Chat message types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  tools?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

// MCP Tool information
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

// Extend Window interface for Electron API
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 