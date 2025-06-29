import { vi } from 'vitest';
import { EventEmitter } from 'events';
import type { McpServerConfig, McpTool, McpResource, McpPrompt } from '../../src/shared/types.js';

// Test Data Fixtures
export const createMockServerConfig = (overrides: Partial<McpServerConfig> = {}): McpServerConfig => ({
  id: 'test-server',
  name: 'Test Server',
  description: 'A test MCP server',
  transport: 'stdio',
  command: 'node',
  args: ['test.js'],
  env: {},
  enabled: true,
  autoStart: false,
  ...overrides,
});

export const createMockTool = (overrides: Partial<McpTool> = {}): McpTool => ({
  name: 'test-tool',
  description: 'A test tool',
  inputSchema: { type: 'object', properties: {} },
  serverId: 'test-server',
  ...overrides,
});

export const createMockResource = (overrides: Partial<McpResource> = {}): McpResource => ({
  uri: 'file://test.txt',
  name: 'test.txt',
  description: 'A test resource',
  mimeType: 'text/plain',
  serverId: 'test-server',
  ...overrides,
});

export const createMockPrompt = (overrides: Partial<McpPrompt> = {}): McpPrompt => ({
  name: 'test-prompt',
  description: 'A test prompt',
  arguments: [
    { name: 'input', description: 'Input parameter', required: true }
  ],
  serverId: 'test-server',
  ...overrides,
});

// Mock MCP Client Factory
export const createMockClient = (overrides: Record<string, any> = {}) => ({
  connect: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  listTools: vi.fn().mockResolvedValue({ tools: [] }),
  listResources: vi.fn().mockResolvedValue({ resources: [] }),
  listPrompts: vi.fn().mockResolvedValue({ prompts: [] }),
  callTool: vi.fn().mockResolvedValue({ result: 'success' }),
  readResource: vi.fn().mockResolvedValue({ 
    contents: [{ type: 'text', text: 'resource content' }] 
  }),
  getPrompt: vi.fn().mockResolvedValue({ 
    messages: [{ role: 'user', content: { type: 'text', text: 'prompt content' } }] 
  }),
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  subscribeResource: vi.fn().mockResolvedValue(undefined),
  unsubscribeResource: vi.fn().mockResolvedValue(undefined),
  sampleLLM: vi.fn().mockResolvedValue({ content: 'LLM response' }),
  ...overrides,
});

// Mock Transport Factory
export const createMockTransport = (overrides: Record<string, any> = {}) => {
  const mockProcess = new EventEmitter() as any;
  mockProcess.killed = false;
  mockProcess.kill = vi.fn().mockImplementation(() => {
    if (!mockProcess.killed) {
      mockProcess.killed = true;
      // Simulate immediate process exit so production code's grace-period resolves instantly
      mockProcess.emit('exit', 0);
    }
  });

  return {
    process: mockProcess,
    ...overrides,
  };
};

// Mock Electron API Factory
export const createMockElectronAPI = (overrides: Record<string, any> = {}) => ({
  // MCP Server Management
  getMcpServers: vi.fn().mockResolvedValue({ success: true, data: [] }),
  addMcpServer: vi.fn().mockResolvedValue({ success: true }),
  updateMcpServer: vi.fn().mockResolvedValue({ success: true }),
  removeMcpServer: vi.fn().mockResolvedValue({ success: true }),
  removeAllMcpServers: vi.fn().mockResolvedValue({ success: true }),
  startMcpServer: vi.fn().mockResolvedValue({ success: true }),
  stopMcpServer: vi.fn().mockResolvedValue({ success: true }),
  testMcpConnection: vi.fn().mockResolvedValue({ 
    success: true, 
    data: { message: 'Connection successful!' } 
  }),
  
  // Event Listeners
  onMcpServerStatusChange: vi.fn().mockReturnValue(() => {}),
  onSettingsChange: vi.fn().mockReturnValue(() => {}),
  
  // General App APIs
  getSettings: vi.fn().mockResolvedValue({}),
  setSettings: vi.fn().mockResolvedValue(undefined),
  resetSettings: vi.fn().mockResolvedValue({ success: true }),
  getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
  
  // Window Management
  minimizeWindow: vi.fn().mockResolvedValue(undefined),
  maximizeWindow: vi.fn().mockResolvedValue(undefined),
  closeWindow: vi.fn().mockResolvedValue(undefined),
  
  // Chat and LLM
  sendMessage: vi.fn().mockResolvedValue('Mock response'),
  getLlmStatus: vi.fn().mockResolvedValue({ 
    success: true, 
    data: { isHealthy: true, currentProvider: null } 
  }),
  getAvailableModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
  testLlmConnection: vi.fn().mockResolvedValue({ success: true }),
  getModelsForConfig: vi.fn().mockResolvedValue({ success: true, data: [] }),
  
  // Tool and Resource Execution
  connectToServer: vi.fn().mockResolvedValue(undefined),
  disconnectFromServer: vi.fn().mockResolvedValue(undefined),
  executeTools: vi.fn().mockResolvedValue({}),
  
  // Permissions
  getPendingApprovals: vi.fn().mockResolvedValue({ success: true, data: [] }),
  respondToApproval: vi.fn().mockResolvedValue({ success: true }),
  
  ...overrides,
});

// Test Environment Setup
export const setupTestEnvironment = () => {
  const mockElectronAPI = createMockElectronAPI();
  
  Object.defineProperty(window, 'electronAPI', {
    writable: true,
    value: mockElectronAPI,
  });
  
  return { mockElectronAPI };
};

// Mock Dynamic Import System for MCP SDK
export const setupMockDynamicImports = (clientFactory = createMockClient, transportFactory = createMockTransport) => {
  const mockClient = clientFactory();
  const mockTransport = transportFactory();
  
  // Mock the dynamic import function used in ConnectionManager
  const mockDynamicImport = vi.fn().mockImplementation((specifier: string) => {
    if (specifier === '@modelcontextprotocol/sdk/client/index.js') {
      return Promise.resolve({
        Client: vi.fn().mockImplementation(() => mockClient)
      });
    }
    if (specifier === '@modelcontextprotocol/sdk/client/stdio.js') {
      return Promise.resolve({
        StdioClientTransport: vi.fn().mockImplementation(() => mockTransport)
      });
    }
    if (specifier === '@modelcontextprotocol/sdk/client/http.js') {
      return Promise.resolve({
        HttpClientTransport: vi.fn().mockImplementation(() => mockTransport)
      });
    }
    return Promise.reject(new Error(`Unknown module: ${specifier}`));
  });

  // Mock the Function constructor pattern used for dynamic imports
  const originalFunction = global.Function;
  global.Function = vi.fn().mockImplementation((param: string, body: string) => {
    if (body.includes('return import(specifier)')) {
      return mockDynamicImport;
    }
    return originalFunction(param, body);
  }) as any;
  
  return { 
    mockClient, 
    mockTransport, 
    mockDynamicImport,
    restore: () => {
      global.Function = originalFunction;
    }
  };
};

// Test Data Generators
export const generateLargeServerList = (count: number): McpServerConfig[] => {
  return Array.from({ length: count }, (_, i) => createMockServerConfig({
    id: `server-${i}`,
    name: `Server ${i}`,
    description: `Generated test server ${i}`,
  }));
};

export const generateLargeToolList = (count: number, serverId = 'test-server'): McpTool[] => {
  return Array.from({ length: count }, (_, i) => createMockTool({
    name: `tool-${i}`,
    description: `Generated tool ${i}`,
    serverId,
  }));
};

export const generateLargeResourceList = (count: number, serverId = 'test-server'): McpResource[] => {
  return Array.from({ length: count }, (_, i) => createMockResource({
    uri: `file://resource-${i}.txt`,
    name: `resource-${i}.txt`,
    description: `Generated resource ${i}`,
    serverId,
  }));
};

export const generateLargePromptList = (count: number, serverId = 'test-server'): McpPrompt[] => {
  return Array.from({ length: count }, (_, i) => createMockPrompt({
    name: `prompt-${i}`,
    description: `Generated prompt ${i}`,
    serverId,
  }));
};

// Wait Utilities for Testing
export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> => {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

export const waitForElement = async (
  getElement: () => HTMLElement | null,
  timeout = 5000
): Promise<HTMLElement> => {
  let element: HTMLElement | null = null;
  
  await waitForCondition(() => {
    element = getElement();
    return element !== null;
  }, timeout);
  
  return element!;
};

// Error Testing Utilities
export const createNetworkError = (message = 'Network error') => {
  const error = new Error(message);
  error.name = 'NetworkError';
  return error;
};

export const createTimeoutError = (message = 'Operation timed out') => {
  const error = new Error(message);
  error.name = 'TimeoutError';
  return error;
};

export const createPermissionError = (message = 'Permission denied') => {
  const error = new Error(message);
  error.name = 'PermissionError';
  return error;
};

// Platform Testing Utilities
export const mockPlatform = (platform: NodeJS.Platform) => {
  const originalPlatform = process.platform;
  Object.defineProperty(process, 'platform', { value: platform });
  
  return () => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  };
};

export const mockWindowsEnvironment = () => {
  return mockPlatform('win32');
};

export const mockUnixEnvironment = () => {
  return mockPlatform('linux');
};

// Performance Testing Utilities
export const measureExecutionTime = async <T>(
  operation: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await operation();
  const end = performance.now();
  
  return {
    result,
    duration: end - start,
  };
};

export const createConcurrentOperations = <T>(
  operation: () => Promise<T>,
  count: number
): Promise<T>[] => {
  return Array.from({ length: count }, () => operation());
};

// Mock State Management
export interface MockStateManager {
  getState: () => any;
  setState: (newState: any) => void;
  reset: () => void;
  subscribe: (listener: (state: any) => void) => () => void;
}

export const createMockStateManager = (initialState: any = {}): MockStateManager => {
  let state = { ...initialState };
  const listeners: ((state: any) => void)[] = [];
  
  return {
    getState: () => ({ ...state }),
    setState: (newState: any) => {
      state = { ...state, ...newState };
      listeners.forEach(listener => listener(state));
    },
    reset: () => {
      state = { ...initialState };
      listeners.forEach(listener => listener(state));
    },
    subscribe: (listener: (state: any) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    },
  };
};

// Test Cleanup Utilities
export const createTestCleanup = () => {
  const cleanupFunctions: (() => void | Promise<void>)[] = [];
  
  return {
    add: (cleanupFn: () => void | Promise<void>) => {
      cleanupFunctions.push(cleanupFn);
    },
    run: async () => {
      for (const cleanup of cleanupFunctions) {
        await cleanup();
      }
      cleanupFunctions.length = 0;
    },
  };
};

// Assert Utilities
export const assertEventuallyTrue = async (
  assertion: () => boolean | Promise<boolean>,
  message = 'Assertion failed',
  timeout = 5000
): Promise<void> => {
  try {
    await waitForCondition(assertion, timeout);
  } catch {
    throw new Error(message);
  }
};

export const assertNever = (value: never, message?: string): never => {
  throw new Error(message || `Unexpected value: ${value}`);
};

// Test Configuration
export const TEST_TIMEOUTS = {
  SHORT: 1000,
  MEDIUM: 5000,
  LONG: 10000,
  VERY_LONG: 30000,
} as const;

export const TEST_LIMITS = {
  MAX_SERVERS: 8,
  MAX_TOOLS_PER_SERVER: 100,
  MAX_RESOURCES_PER_SERVER: 50,
  MAX_PROMPTS_PER_SERVER: 25,
} as const; 