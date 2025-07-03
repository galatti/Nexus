import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import { configManager } from '../../src/main/config/ConfigManager.js';
import { llmManager } from '../../src/main/llm/LlmManager.js';
import { permissionManager } from '../../src/main/permissions/PermissionManager.js';
import { LlmProviderConfig, McpServerConfig } from '../../src/shared/types.js';

// Mock electron
const mockIpcMain = {
  handle: vi.fn(),
  removeHandler: vi.fn()
};

const mockBrowserWindow = {
  webContents: {
    send: vi.fn()
  }
};

vi.mock('electron', () => ({
  ipcMain: mockIpcMain,
  BrowserWindow: {
    getFocusedWindow: () => mockBrowserWindow,
    getAllWindows: () => [mockBrowserWindow]
  }
}));

// Mock logger
vi.mock('../../src/main/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock file system operations
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn()
}));

// Mock path operations
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/'))
}));

describe('Main Process IPC Integration Tests', () => {
  let ipcHandlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    ipcHandlers = new Map();
    
    // Capture IPC handlers
    mockIpcMain.handle.mockImplementation((channel: string, handler: Function) => {
      ipcHandlers.set(channel, handler);
    });

    // Import main process to register handlers
    // Note: This would normally import the main.ts file that registers IPC handlers
    // For this test, we'll simulate the key IPC handlers that would be registered
    registerMockIpcHandlers();
  });

  afterEach(() => {
    vi.resetAllMocks();
    ipcHandlers.clear();
  });

  // Simulate the IPC handlers that would be registered in main.ts
  function registerMockIpcHandlers() {
    // Settings handlers
    ipcHandlers.set('settings:get', async () => {
      return configManager.getSettings();
    });

    ipcHandlers.set('settings:update', async (event: any, updates: any) => {
      configManager.updateSettings(updates);
      return configManager.getSettings();
    });

    ipcHandlers.set('settings:reset', async () => {
      configManager.resetToDefaults();
      return configManager.getSettings();
    });

    ipcHandlers.set('settings:export', async () => {
      return configManager.exportSettings();
    });

    ipcHandlers.set('settings:import', async (event: any, jsonString: string) => {
      configManager.importSettings(jsonString);
      return configManager.getSettings();
    });

    // LLM provider handlers
    ipcHandlers.set('llm:test-provider', async (event: any, config: LlmProviderConfig) => {
      await llmManager.addProvider(config);
      const provider = llmManager.getProvider(config.id);
      if (!provider) return { success: false, error: 'Provider not found' };
      
      try {
        const isHealthy = await provider.checkHealth();
        return { success: isHealthy, error: isHealthy ? null : 'Health check failed' };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('llm:get-models', async (event: any, providerId: string) => {
      try {
        const models = await llmManager.getAvailableModels(providerId);
        return { success: true, models };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('llm:send-message', async (event: any, data: any) => {
      try {
        const response = await llmManager.sendMessage(
          data.messages,
          data.providerId,
          data.modelName,
          data.options
        );
        return { success: true, response };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('llm:get-status', async () => {
      try {
        const status = await llmManager.getStatus();
        return { success: true, status };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // MCP server handlers
    ipcHandlers.set('mcp:add-server', async (event: any, server: McpServerConfig) => {
      try {
        configManager.addMcpServer(server);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('mcp:remove-server', async (event: any, serverId: string) => {
      try {
        configManager.removeMcpServer(serverId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('mcp:update-server', async (event: any, serverId: string, updates: Partial<McpServerConfig>) => {
      try {
        configManager.updateMcpServer(serverId, updates);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('mcp:get-servers', async () => {
      try {
        const servers = configManager.getMcpServers();
        return { success: true, servers };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    // Permission handlers
    ipcHandlers.set('permissions:get-pending', async () => {
      try {
        const pending = permissionManager.getPendingApprovals();
        return { success: true, pending };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('permissions:respond', async (event: any, approvalId: string, result: any) => {
      try {
        const success = permissionManager.respondToApproval(approvalId, result);
        return { success };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('permissions:get-all', async () => {
      try {
        const permissions = permissionManager.getAllPermissions();
        return { success: true, permissions };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('permissions:revoke', async (event: any, serverId: string, toolName: string) => {
      try {
        const revoked = permissionManager.revokePermission(serverId, toolName);
        return { success: revoked };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('permissions:clear-session', async () => {
      try {
        permissionManager.clearSessionPermissions();
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('permissions:update-settings', async (event: any, settings: any) => {
      try {
        permissionManager.updateSettings(settings);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });

    ipcHandlers.set('permissions:get-settings', async () => {
      try {
        const settings = permissionManager.getSettings();
        return { success: true, settings };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
  }

  describe('Settings IPC Handlers', () => {
    it('should handle settings:get', async () => {
      const handler = ipcHandlers.get('settings:get')!;
      const result = await handler();
      
      expect(result).toBeDefined();
      expect(result.general).toBeDefined();
      expect(result.llm).toBeDefined();
      expect(result.mcp).toBeDefined();
    });

    it('should handle settings:update', async () => {
      const handler = ipcHandlers.get('settings:update')!;
      const updates = {
        general: {
          theme: 'dark' as const,
          autoStart: true,
          minimizeToTray: false,
          language: 'en'
        }
      };
      
      const result = await handler(null, updates);
      
      expect(result.general.theme).toBe('dark');
      expect(result.general.autoStart).toBe(true);
    });

    it('should handle settings:reset', async () => {
      const handler = ipcHandlers.get('settings:reset')!;
      
      // First modify settings
      const updateHandler = ipcHandlers.get('settings:update')!;
      await updateHandler(null, { 
        general: { theme: 'dark', autoStart: true, minimizeToTray: false, language: 'en' } 
      });
      
      // Then reset
      const result = await handler();
      
      expect(result.general.theme).toBe('system');
      expect(result.general.autoStart).toBe(false);
    });

    it('should handle settings:export', async () => {
      const handler = ipcHandlers.get('settings:export')!;
      const result = await handler();
      
      expect(typeof result).toBe('string');
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle settings:import', async () => {
      const handler = ipcHandlers.get('settings:import')!;
      const settingsJson = JSON.stringify({
        general: { theme: 'dark', autoStart: true, minimizeToTray: false, language: 'en' },
        llm: { providers: [] },
        mcp: { servers: [] }
      });
      
      const result = await handler(null, settingsJson);
      
      expect(result.general.theme).toBe('dark');
    });

    it('should handle invalid JSON in settings:import', async () => {
      const handler = ipcHandlers.get('settings:import')!;
      
      await expect(handler(null, 'invalid json')).rejects.toThrow();
    });
  });

  describe('LLM Provider IPC Handlers', () => {
    const mockProviderConfig: LlmProviderConfig = {
      id: 'test-provider',
      type: 'ollama',
      name: 'Test Provider',
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      enabled: true,
      temperature: 0.7,
      maxTokens: 2048
    };

    it('should handle llm:test-provider with healthy provider', async () => {
      const handler = ipcHandlers.get('llm:test-provider')!;
      
      // Mock successful health check
      vi.spyOn(llmManager, 'addProvider').mockResolvedValue();
      const mockProvider = {
        checkHealth: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(llmManager, 'getProvider').mockReturnValue(mockProvider as any);
      
      const result = await handler(null, mockProviderConfig);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should handle llm:test-provider with unhealthy provider', async () => {
      const handler = ipcHandlers.get('llm:test-provider')!;
      
      vi.spyOn(llmManager, 'addProvider').mockResolvedValue();
      const mockProvider = {
        checkHealth: vi.fn().mockResolvedValue(false)
      };
      vi.spyOn(llmManager, 'getProvider').mockReturnValue(mockProvider as any);
      
      const result = await handler(null, mockProviderConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Health check failed');
    });

    it('should handle llm:test-provider with missing provider', async () => {
      const handler = ipcHandlers.get('llm:test-provider')!;
      
      vi.spyOn(llmManager, 'addProvider').mockResolvedValue();
      vi.spyOn(llmManager, 'getProvider').mockReturnValue(null);
      
      const result = await handler(null, mockProviderConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider not found');
    });

    it('should handle llm:get-models successfully', async () => {
      const handler = ipcHandlers.get('llm:get-models')!;
      const mockModels = [
        { name: 'model1', size: '1GB', description: 'Test model 1' },
        { name: 'model2', size: '2GB', description: 'Test model 2' }
      ];
      
      vi.spyOn(llmManager, 'getAvailableModels').mockResolvedValue(mockModels);
      
      const result = await handler(null, 'test-provider');
      
      expect(result.success).toBe(true);
      expect(result.models).toEqual(mockModels);
    });

    it('should handle llm:get-models with error', async () => {
      const handler = ipcHandlers.get('llm:get-models')!;
      
      vi.spyOn(llmManager, 'getAvailableModels').mockRejectedValue(new Error('Provider not available'));
      
      const result = await handler(null, 'test-provider');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Provider not available');
    });

    it('should handle llm:send-message successfully', async () => {
      const handler = ipcHandlers.get('llm:send-message')!;
      const mockResponse = {
        content: 'Hello, world!',
        tokens: 10,
        finishReason: 'stop',
        model: 'test-model'
      };
      
      vi.spyOn(llmManager, 'sendMessage').mockResolvedValue(mockResponse);
      
      const messageData = {
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: 'test-provider',
        modelName: 'test-model',
        options: { temperature: 0.7 }
      };
      
      const result = await handler(null, messageData);
      
      expect(result.success).toBe(true);
      expect(result.response).toEqual(mockResponse);
    });

    it('should handle llm:send-message with error', async () => {
      const handler = ipcHandlers.get('llm:send-message')!;
      
      vi.spyOn(llmManager, 'sendMessage').mockRejectedValue(new Error('Message processing failed'));
      
      const messageData = {
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: 'test-provider',
        modelName: 'test-model'
      };
      
      const result = await handler(null, messageData);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Message processing failed');
    });

    it('should handle llm:get-status successfully', async () => {
      const handler = ipcHandlers.get('llm:get-status')!;
      const mockStatus = {
        enabledProviders: [
          {
            id: 'test-provider',
            name: 'Test Provider',
            type: 'ollama',
            isHealthy: true,
            models: []
          }
        ]
      };
      
      vi.spyOn(llmManager, 'getStatus').mockResolvedValue(mockStatus);
      
      const result = await handler();
      
      expect(result.success).toBe(true);
      expect(result.status).toEqual(mockStatus);
    });
  });

  describe('MCP Server IPC Handlers', () => {
    const mockServerConfig: McpServerConfig = {
      id: 'test-server',
      name: 'Test Server',
      command: 'node',
      args: ['test.js'],
      enabled: true,
      autoStart: false,
      transport: 'stdio' as const,
      env: {}
    };

    it('should handle mcp:add-server successfully', async () => {
      const handler = ipcHandlers.get('mcp:add-server')!;
      
      vi.spyOn(configManager, 'addMcpServer').mockImplementation(() => {});
      
      const result = await handler(null, mockServerConfig);
      
      expect(result.success).toBe(true);
      expect(configManager.addMcpServer).toHaveBeenCalledWith(mockServerConfig);
    });

    it('should handle mcp:add-server with error', async () => {
      const handler = ipcHandlers.get('mcp:add-server')!;
      
      vi.spyOn(configManager, 'addMcpServer').mockImplementation(() => {
        throw new Error('Server configuration invalid');
      });
      
      const result = await handler(null, mockServerConfig);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Server configuration invalid');
    });

    it('should handle mcp:remove-server successfully', async () => {
      const handler = ipcHandlers.get('mcp:remove-server')!;
      
      vi.spyOn(configManager, 'removeMcpServer').mockImplementation(() => {});
      
      const result = await handler(null, 'test-server');
      
      expect(result.success).toBe(true);
      expect(configManager.removeMcpServer).toHaveBeenCalledWith('test-server');
    });

    it('should handle mcp:update-server successfully', async () => {
      const handler = ipcHandlers.get('mcp:update-server')!;
      const updates = { enabled: false, name: 'Updated Server' };
      
      vi.spyOn(configManager, 'updateMcpServer').mockImplementation(() => {});
      
      const result = await handler(null, 'test-server', updates);
      
      expect(result.success).toBe(true);
      expect(configManager.updateMcpServer).toHaveBeenCalledWith('test-server', updates);
    });

    it('should handle mcp:get-servers successfully', async () => {
      const handler = ipcHandlers.get('mcp:get-servers')!;
      const mockServers = [mockServerConfig];
      
      vi.spyOn(configManager, 'getMcpServers').mockReturnValue(mockServers);
      
      const result = await handler();
      
      expect(result.success).toBe(true);
      expect(result.servers).toEqual(mockServers);
    });
  });

  describe('Permission IPC Handlers', () => {
    it('should handle permissions:get-pending', async () => {
      const handler = ipcHandlers.get('permissions:get-pending')!;
      const mockPending = [
        {
          id: 'approval-1',
          serverId: 'test-server',
          serverName: 'Test Server',
          toolName: 'test-tool',
          toolDescription: 'A test tool',
          args: { param: 'value' },
          riskLevel: 'low' as const,
          riskReasons: ['General tool execution'],
          requestedAt: new Date()
        }
      ];
      
      vi.spyOn(permissionManager, 'getPendingApprovals').mockReturnValue(mockPending as any);
      
      const result = await handler();
      
      expect(result.success).toBe(true);
      expect(result.pending).toEqual(mockPending);
    });

    it('should handle permissions:respond successfully', async () => {
      const handler = ipcHandlers.get('permissions:respond')!;
      const approvalResult = { approved: true, scope: 'once' as const };
      
      vi.spyOn(permissionManager, 'respondToApproval').mockReturnValue(true);
      
      const result = await handler(null, 'approval-1', approvalResult);
      
      expect(result.success).toBe(true);
      expect(permissionManager.respondToApproval).toHaveBeenCalledWith('approval-1', approvalResult);
    });

    it('should handle permissions:respond with failure', async () => {
      const handler = ipcHandlers.get('permissions:respond')!;
      const approvalResult = { approved: false };
      
      vi.spyOn(permissionManager, 'respondToApproval').mockReturnValue(false);
      
      const result = await handler(null, 'invalid-id', approvalResult);
      
      expect(result.success).toBe(false);
    });

    it('should handle permissions:get-all', async () => {
      const handler = ipcHandlers.get('permissions:get-all')!;
      const mockPermissions = [
        {
          serverId: 'test-server',
          toolName: 'test-tool',
          permission: 'allow' as const,
          scope: 'session' as const,
          riskLevel: 'low' as const,
          grantedAt: new Date()
        }
      ];
      
      vi.spyOn(permissionManager, 'getAllPermissions').mockReturnValue(mockPermissions as any);
      
      const result = await handler();
      
      expect(result.success).toBe(true);
      expect(result.permissions).toEqual(mockPermissions);
    });

    it('should handle permissions:revoke successfully', async () => {
      const handler = ipcHandlers.get('permissions:revoke')!;
      
      vi.spyOn(permissionManager, 'revokePermission').mockReturnValue(true);
      
      const result = await handler(null, 'test-server', 'test-tool');
      
      expect(result.success).toBe(true);
      expect(permissionManager.revokePermission).toHaveBeenCalledWith('test-server', 'test-tool');
    });

    it('should handle permissions:clear-session', async () => {
      const handler = ipcHandlers.get('permissions:clear-session')!;
      
      vi.spyOn(permissionManager, 'clearSessionPermissions').mockImplementation(() => {});
      
      const result = await handler();
      
      expect(result.success).toBe(true);
      expect(permissionManager.clearSessionPermissions).toHaveBeenCalled();
    });

    it('should handle permissions:update-settings', async () => {
      const handler = ipcHandlers.get('permissions:update-settings')!;
      const settings = { autoApproveLevel: 'low' as const };
      
      vi.spyOn(permissionManager, 'updateSettings').mockImplementation(() => {});
      
      const result = await handler(null, settings);
      
      expect(result.success).toBe(true);
      expect(permissionManager.updateSettings).toHaveBeenCalledWith(settings);
    });

    it('should handle permissions:get-settings', async () => {
      const handler = ipcHandlers.get('permissions:get-settings')!;
      const mockSettings = {
        autoApproveLevel: 'none' as const,
        requestTimeout: 30,
        requireApprovalForFileAccess: true,
        requireApprovalForNetworkAccess: true,
        requireApprovalForSystemCommands: true,
        trustedServers: [],
        alwaysPermissionDuration: 0,
        enableArgumentValidation: true,
        enablePermissionExpireNotifications: true,
        maxSessionPermissions: 50
      };
      
      vi.spyOn(permissionManager, 'getSettings').mockReturnValue(mockSettings);
      
      const result = await handler();
      
      expect(result.success).toBe(true);
      expect(result.settings).toEqual(mockSettings);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors in handlers', async () => {
      const handler = ipcHandlers.get('settings:get')!;
      
      vi.spyOn(configManager, 'getSettings').mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      // Should not throw, but would be caught by the IPC handler wrapper in real implementation
      await expect(handler()).rejects.toThrow('Unexpected error');
    });

    it('should handle non-Error objects thrown', async () => {
      const handler = ipcHandlers.get('llm:get-models')!;
      
      vi.spyOn(llmManager, 'getAvailableModels').mockRejectedValue('String error');
      
      const result = await handler(null, 'test-provider');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });
  });

  describe('Cross-Module Integration', () => {
    it('should handle full workflow: add provider, test, and send message', async () => {
      // Add provider through settings
      const settingsHandler = ipcHandlers.get('settings:update')!;
      const providerConfig: LlmProviderConfig = {
        id: 'integration-provider',
        type: 'ollama',
        name: 'Integration Provider',
        baseUrl: 'http://localhost:11434',
        model: 'test-model',
        enabled: true,
        temperature: 0.7,
        maxTokens: 2048
      };

      await settingsHandler(null, {
        llm: {
          providers: [providerConfig]
        }
      });

      // Test the provider
      const testHandler = ipcHandlers.get('llm:test-provider')!;
      vi.spyOn(llmManager, 'addProvider').mockResolvedValue();
      const mockProvider = {
        checkHealth: vi.fn().mockResolvedValue(true)
      };
      vi.spyOn(llmManager, 'getProvider').mockReturnValue(mockProvider as any);

      const testResult = await testHandler(null, providerConfig);
      expect(testResult.success).toBe(true);

      // Send a message
      const messageHandler = ipcHandlers.get('llm:send-message')!;
      vi.spyOn(llmManager, 'sendMessage').mockResolvedValue({
        content: 'Integration test response',
        tokens: 15,
        finishReason: 'stop',
        model: 'test-model'
      });

      const messageResult = await messageHandler(null, {
        messages: [{ role: 'user', content: 'Test message' }],
        providerId: 'integration-provider',
        modelName: 'test-model'
      });

      expect(messageResult.success).toBe(true);
      expect(messageResult.response.content).toBe('Integration test response');
    });

    it('should handle MCP server and permissions workflow', async () => {
      // Add MCP server
      const addServerHandler = ipcHandlers.get('mcp:add-server')!;
      const serverConfig: McpServerConfig = {
        id: 'integration-server',
        name: 'Integration Server',
        command: 'node',
        args: ['server.js'],
        enabled: true,
        autoStart: false,
        transport: 'stdio' as const,
        env: {}
      };

      vi.spyOn(configManager, 'addMcpServer').mockImplementation(() => {});
      
      const addResult = await addServerHandler(null, serverConfig);
      expect(addResult.success).toBe(true);

      // Update permission settings
      const permissionSettingsHandler = ipcHandlers.get('permissions:update-settings')!;
      vi.spyOn(permissionManager, 'updateSettings').mockImplementation(() => {});

      const settingsResult = await permissionSettingsHandler(null, {
        autoApproveLevel: 'low' as const
      });
      expect(settingsResult.success).toBe(true);

      // Verify servers are returned
      const getServersHandler = ipcHandlers.get('mcp:get-servers')!;
      vi.spyOn(configManager, 'getMcpServers').mockReturnValue([serverConfig]);

      const serversResult = await getServersHandler();
      expect(serversResult.success).toBe(true);
      expect(serversResult.servers).toContain(serverConfig);
    });
  });
});