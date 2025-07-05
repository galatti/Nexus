// Electron API types
// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LlmStatusResponse {
  enabledProviders: Array<{
    id: string;
    name: string;
    type: string;
    isHealthy: boolean;
    models: LlmModel[];
  }>;
  defaultProviderModel?: {
    providerId: string;
    modelName: string;
  };
}

// Provider health and status tracking
export interface ProviderHealth {
  providerId: string;
  isHealthy: boolean;
  lastChecked: Date;
  error?: string;
  retryCount: number;
  nextRetry?: Date;
}

// Edge case handling types
export interface ProviderWarning {
  type: 'disabled' | 'removed' | 'unhealthy' | 'no_models' | 'api_error';
  providerId?: string;
  modelName?: string;
  message: string;
  actions: Array<{
    label: string;
    action: 'enable' | 'select_provider' | 'retry' | 'configure';
    data?: any;
  }>;
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

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getSettings: () => Promise<AppSettings>;
  setSettings: (settings: AppSettings) => Promise<void>;
  resetSettings: () => Promise<ApiResponse<void>>;
  connectToServer: (config: McpServerConfig) => Promise<void>;
  disconnectFromServer: (serverId: string) => Promise<void>;
  executeTools: (serverId: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  sendMessage: (messages: ChatMessage[], options?: Record<string, unknown>) => Promise<string>;
  getLlmStatus: () => Promise<ApiResponse<LlmStatusResponse>>;
  getAvailableModels: (providerId?: string) => Promise<ApiResponse<LlmModel[]>>;
  testLlmConnection: (providerConfig: LlmProviderConfig) => Promise<ApiResponse<{ models?: LlmModel[]; message?: string }>>;
  getModelsForConfig: (providerConfig: LlmProviderConfig) => Promise<ApiResponse<LlmModel[]>>;
  onMcpServerStatusChange: (callback: (serverId: string, status: string) => void) => () => void;
  onSettingsChange: (callback: (settings: AppSettings) => void) => () => void;
  onLlmProviderChange: (callback: (data: any) => void) => () => void;
  
  // Secure storage methods
  getProviderApiKey: (providerId: string) => Promise<string>;
  setProviderApiKey: (providerId: string, apiKey: string) => Promise<void>;
  getSecurityStatus: () => Promise<{
    secureStorageAvailable: boolean;
    encryptedApiKeys: number;
    plainTextApiKeys: number;
    totalApiKeys: number;
  }>;
  
  // MCP Server management
  getMcpServers: () => Promise<ApiResponse<McpServerConfig[]>>;
  addMcpServer: (config: Omit<McpServerConfig, 'id'>) => Promise<ApiResponse<void>>;
  updateMcpServer: (serverId: string, updates: Partial<McpServerConfig>) => Promise<ApiResponse<void>>;
  removeMcpServer: (serverId: string) => Promise<ApiResponse<void>>;
  removeAllMcpServers: () => Promise<ApiResponse<void>>;
  startMcpServer: (serverId: string) => Promise<ApiResponse<void>>;
  stopMcpServer: (serverId: string) => Promise<ApiResponse<void>>;
  testMcpConnection: (serverConfigOrId: string | McpServerConfig) => Promise<ApiResponse<{ message?: string }>>;
  
  // Permissions
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
    providers: LlmProviderConfig[];
    defaultProviderModel?: {
      providerId: string;
      modelName: string;
    };
    systemPrompt: string;
  };
  mcp: {
    servers: McpServerConfig[];
  };
}

// MCP Server configuration (simplified - no template references)
export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'http' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  workingDirectory?: string;
  enabled: boolean;
  autoStart: boolean;
  state?: 'configured' | 'starting' | 'ready' | 'stopped' | 'failed';
}

// LLM Provider configuration
export interface LlmProviderConfig {
  id: string;
  type: 'ollama' | 'openrouter';
  name: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  enabled: boolean;
  models?: LlmModel[];
  temperature?: number; // 0.0 to 1.0
  maxTokens?: number;
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
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  tokens?: number;
  tools?: ToolCall[];
  tool_call_id?: string;
  name?: string;
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

// MCP Resource information
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

// MCP Prompt information
export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverId: string;
}

// MCP Progress notification
export interface ProgressNotification {
  operationId: string;
  progress: number;
  total?: number;
  message?: string;
}

// MCP Log message
export interface LogMessage {
  level: 'debug' | 'info' | 'warning' | 'error';
  logger?: string;
  data: any;
}

// Extend Window interface for Electron API
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// === CHAT SESSIONS TYPES (Phase 1.1) ===

// Core session types
export interface ChatSession {
  id: string;
  title: string;
  created: Date;
  lastActive: Date;
  messageCount: number;
  tokenCount: number;
  category?: string;
  tags: string[];
  isPinned: boolean;
  isArchived: boolean;
  projectId?: string;
  metadata: SessionMetadata;
}

export interface SessionMetadata {
  firstMessage?: string; // Preview of the first user message
  lastMessage?: string;  // Preview of the last message
  topics: string[];      // Auto-extracted topics
  hasAttachments: boolean;
  hasToolCalls: boolean;
  language?: string;     // Detected conversation language
  summary?: string;      // AI-generated session summary
}

export interface ChatProject {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created: Date;
  lastActive: Date;
  sessionIds: string[];
  tags: string[];
  sharedContext?: string; // Context shared across all sessions in project
}

export interface SessionFilters {
  dateRange?: [Date, Date];
  categories?: string[];
  projects?: string[];
  hasAttachments?: boolean;
  minMessages?: number;
  topics?: string[];
  searchQuery?: string;
}

// Storage schema for sessions
export interface SessionStorage {
  session: ChatSession;
  messages: ChatMessage[];
  context?: SessionContext;
}

export interface SessionContext {
  modelHistory: string[];    // Models used in this session
  toolsUsed: string[];      // Tools that have been called
  attachments: any[];       // Future: file attachments
  branchPoints: string[];   // Future: conversation branches
}

// App storage structure (replacing simple localStorage)
export interface AppStorage {
  sessions: {
    [sessionId: string]: SessionStorage;
  };
  projects: {
    [projectId: string]: ChatProject;
  };
  userPreferences: UserPreferences;
  sessionIndex: SessionIndex;
  currentSessionId?: string;
}

export interface UserPreferences {
  sidebarState: 'collapsed' | 'condensed' | 'expanded';
  defaultModel?: string;
  sessionOrganization: 'chronological' | 'categorical' | 'project';
  autoArchive: boolean;
  searchHistory: string[];
  maxStoredSessions: number;
}

export interface SessionIndex {
  byDate: string[];
  byProject: { [projectId: string]: string[] };
  byCategory: { [category: string]: string[] };
  searchable: SearchIndex;
}

export interface SearchIndex {
  sessions: {
    [sessionId: string]: {
      title: string;
      content: string;
      topics: string[];
      metadata: string;
    }
  };
  invertedIndex: {
    [term: string]: string[];
  };
} 