// Electron API types
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
  onMcpServerStatusChange: (callback: (serverId: string, status: string) => void) => () => void;
  onSettingsChange: (callback: (settings: AppSettings) => void) => () => void;
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
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
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