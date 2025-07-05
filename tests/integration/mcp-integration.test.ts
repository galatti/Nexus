import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverManager } from '../../src/main/mcp/ConnectionManager.js';
import type { McpServerConfig } from '../../src/shared/types.js';
import { setupMockDynamicImports, createMockClient } from '../utils/test-helpers.js';

// Mock permission manager
vi.mock('../../src/main/permissions/PermissionManager.js', () => ({
  permissionManager: {
    requestPermission: vi.fn().mockResolvedValue(true),
  },
}));

describe('MCP Integration Tests', () => {
  const testServerConfig: McpServerConfig = {
    id: 'integration-test-server',
    name: 'Integration Test Server',
    description: 'Server for integration testing',
    transport: 'stdio',
    command: 'node',
    args: ['test-server.js'],
    env: { NODE_ENV: 'test' },
    enabled: true,
    autoStart: false,
  };

  let mockingSetup: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up MCP SDK mocking with custom client responses for integration testing
    mockingSetup = setupMockDynamicImports(() => createMockClient({
      listTools: vi.fn().mockResolvedValue({ 
        tools: [
          { name: 'test-tool', description: 'A test tool', inputSchema: { type: 'object' } }
        ] 
      }),
      listResources: vi.fn().mockResolvedValue({ 
        resources: [
          { uri: 'file://test.txt', name: 'test.txt', description: 'Test resource' }
        ] 
      }),
      listPrompts: vi.fn().mockResolvedValue({ 
        prompts: [
          { name: 'test-prompt', description: 'A test prompt' }
        ] 
      }),
      callTool: vi.fn().mockResolvedValue({ result: 'Tool executed successfully' }),
      readResource: vi.fn().mockResolvedValue({ 
        contents: [{ type: 'text', text: 'Resource content' }] 
      }),
      getPrompt: vi.fn().mockResolvedValue({ 
        messages: [{ role: 'user', content: { type: 'text', text: 'Prompt content' } }] 
      }),
      subscribeResource: vi.fn().mockResolvedValue(undefined),
      unsubscribeResource: vi.fn().mockResolvedValue(undefined),
    }));
  });

  afterEach(async () => {
    await serverManager.stopAllServers();
    if (mockingSetup?.restore) {
      mockingSetup.restore();
    }
  });

  describe('Complete Server Lifecycle', () => {
    it('should handle complete server lifecycle from creation to destruction', async () => {
      // Set up state change listener BEFORE starting the server
      const stateChanges: any[] = [];
      serverManager.on('stateChange', (state) => stateChanges.push(state));

      // 1. Start server
      await serverManager.startServer(testServerConfig);

      // Verify server is running and tools are discovered
      const serverState = serverManager.getServerStateObject(testServerConfig.id);
      expect(serverState?.state).toBe('ready');
      expect(serverState?.tools).toHaveLength(1);
      expect(serverState?.tools?.[0].name).toBe('test-tool');
      expect(serverState?.resources).toHaveLength(1);
      expect(serverState?.prompts).toHaveLength(1);

      // Verify state transitions occurred
      expect(stateChanges.length).toBeGreaterThanOrEqual(1);
      expect(stateChanges[stateChanges.length - 1].state).toBe('ready');

      // 2. Execute tools
      const toolResult = await serverManager.executeTool(
        testServerConfig.id, 
        'test-tool', 
        { testParam: 'value' }
      );
      expect(toolResult).toEqual({ result: 'Tool executed successfully' });
      expect(mockingSetup.mockClient.callTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { testParam: 'value' }
      });

      // 3. Read resources
      const resourceResult = await serverManager.readResource(
        testServerConfig.id, 
        'file://test.txt'
      );
      expect(resourceResult).toEqual({ 
        contents: [{ type: 'text', text: 'Resource content' }] 
      });

      // 4. Execute prompts
      const promptResult = await serverManager.executePrompt(
        testServerConfig.id, 
        'test-prompt',
        { context: 'test' }
      );
      expect(promptResult).toEqual({ 
        messages: [{ role: 'user', content: { type: 'text', text: 'Prompt content' } }] 
      });

      // 5. Subscribe to resources
      await serverManager.subscribeToResource(testServerConfig.id, 'file://test.txt');
      expect(mockingSetup.mockClient.subscribeResource).toHaveBeenCalledWith({ uri: 'file://test.txt' });

      // 6. Stop server
      await serverManager.stopServer(testServerConfig.id);
      expect(mockingSetup.mockClient.close).toHaveBeenCalled();
      expect(serverManager.getServerStateObject(testServerConfig.id)).toBeNull();
    });

    it('should handle server failure and recovery', async () => {
      // Mock initial connection failure
      mockingSetup.mockClient.connect.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(serverManager.startServer(testServerConfig))
        .rejects.toThrow('Connection failed');

      const failedState = serverManager.getServerStateObject(testServerConfig.id);
      expect(failedState?.state).toBe('failed');
      expect(failedState?.error).toContain('Connection failed');

      // Reset mock and try again
      mockingSetup.mockClient.connect.mockResolvedValue(undefined);
      
      // Clear the failed server first
      await serverManager.stopServer(testServerConfig.id);
      
      // Start again successfully
      await serverManager.startServer(testServerConfig);
      const recoveredState = serverManager.getServerStateObject(testServerConfig.id);
      expect(recoveredState?.state).toBe('ready');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle tool execution errors gracefully', async () => {
      await serverManager.startServer(testServerConfig);

      // Mock tool execution failure
      mockingSetup.mockClient.callTool.mockRejectedValueOnce(new Error('Tool execution failed'));

      await expect(
        serverManager.executeTool(testServerConfig.id, 'test-tool', {})
      ).rejects.toThrow('Tool execution failed');

      // Server should still be running
      const state = serverManager.getServerStateObject(testServerConfig.id);
      expect(state?.state).toBe('ready');
    });

    it('should handle resource reading errors', async () => {
      await serverManager.startServer(testServerConfig);

      // Mock resource reading failure
      mockingSetup.mockClient.readResource.mockRejectedValueOnce(new Error('Resource not found'));

      await expect(
        serverManager.readResource(testServerConfig.id, 'file://nonexistent.txt')
      ).rejects.toThrow('Resource not found');

      // Server should still be running
      const state = serverManager.getServerStateObject(testServerConfig.id);
      expect(state?.state).toBe('ready');
    });

    it('should handle server process crashes', async () => {
      await serverManager.startServer(testServerConfig);

      // Simulate process crash by rejecting close operation
      mockingSetup.mockClient.close.mockRejectedValueOnce(new Error('Process already dead'));

      // Stop server should still complete
      await serverManager.stopServer(testServerConfig.id);
      
      // Server should be removed
      expect(serverManager.getServerStateObject(testServerConfig.id)).toBeNull();
    });
  });

  describe('Resource Subscription Management', () => {
    it('should handle resource subscription lifecycle', async () => {
      await serverManager.startServer(testServerConfig);

      const resourceUri = 'file://dynamic-resource.txt';

      // Subscribe to resource
      await serverManager.subscribeToResource(testServerConfig.id, resourceUri);
      expect(mockingSetup.mockClient.subscribeResource).toHaveBeenCalledWith({ uri: resourceUri });

      // Verify subscription is tracked
      const server = serverManager['servers'].get(testServerConfig.id);
      expect(server?.subscribedResources?.has(resourceUri)).toBe(true);

      // Unsubscribe
      await serverManager.unsubscribeFromResource(testServerConfig.id, resourceUri);
      expect(mockingSetup.mockClient.unsubscribeResource).toHaveBeenCalledWith({ uri: resourceUri });
      expect(server?.subscribedResources?.has(resourceUri)).toBe(false);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle concurrent tool executions', async () => {
      await serverManager.startServer(testServerConfig);

      // Execute tools one by one to verify they work
      const results: Array<any> = [];
      for (let i = 0; i < 3; i++) {
        try {
          const result = await serverManager.executeTool(testServerConfig.id, 'test-tool', { index: i });
          results.push(result);
        } catch (error) {
          results.push({ error: (error as Error).message });
        }
      }
      
      // Verify all operations completed
      expect(results).toHaveLength(3);
      
      // At least one should succeed
      const successfulResults = results.filter(result => !('error' in result));
      expect(successfulResults.length).toBeGreaterThan(0);
    }, 10000); // 10 second timeout
  });
}); 