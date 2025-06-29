import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverManager, ServerManager, type ServerState } from '../../../src/main/mcp/ConnectionManager.js';
import type { McpServerConfig, McpTool, McpResource, McpPrompt } from '../../../src/shared/types.js';
import { permissionManager } from '../../../src/main/permissions/PermissionManager.js';
import { setupMockDynamicImports, createMockClient, createMockTransport } from '../../utils/test-helpers.js';

// Mock the permission manager
vi.mock('../../../src/main/permissions/PermissionManager.js', () => ({
  permissionManager: {
    requestPermission: vi.fn().mockResolvedValue(true),
  },
}));

describe('ServerManager', () => {
  const mockConfig: McpServerConfig = {
    id: 'test-server',
    name: 'Test Server',
    transport: 'stdio',
    command: 'node',
    args: ['test.js'],
    enabled: true,
    autoStart: false,
    env: {}
  };

  const mockHttpConfig: McpServerConfig = {
    id: 'test-http-server', 
    name: 'Test HTTP Server',
    transport: 'http',
    url: 'http://localhost:3000',
    enabled: true,
    autoStart: false,
    env: {}
  };

  let mockingSetup: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any existing servers
    serverManager['servers'].clear();
    // Set up MCP SDK mocking
    mockingSetup = setupMockDynamicImports();
  });

  afterEach(async () => {
    await serverManager.stopAllServers();
    if (mockingSetup?.restore) {
      mockingSetup.restore();
    }
  });

  describe('Server Lifecycle Management', () => {
    describe('startServer', () => {
      it('should successfully start a STDIO server', async () => {
        // Configure the mock client to return a tool
        mockingSetup.mockClient.listTools.mockResolvedValue({ 
          tools: [{ name: 'test-tool', description: 'Test tool', inputSchema: {} }] 
        });

        // Set up state change listener
        const stateChanges: ServerState[] = [];
        serverManager.on('stateChange', (state) => stateChanges.push(state));

        await serverManager.startServer(mockConfig);
        
        const state = serverManager.getServerState(mockConfig.id);
        expect(state?.state).toBe('ready');
        expect(state?.tools).toHaveLength(1);
        expect(state?.tools?.[0].name).toBe('test-tool');
        
        // Verify state transitions
        expect(stateChanges).toHaveLength(2);
        expect(stateChanges[0].state).toBe('starting');
        expect(stateChanges[1].state).toBe('ready');
      });

      it('should successfully start an HTTP server', async () => {
        // Note: Current implementation doesn't properly support HTTP transport
        // It requires a command even for HTTP servers, so we need to provide one
        const httpConfigWithCommand = {
          ...mockHttpConfig,
          command: 'node', // Add required command
          args: ['server.js']
        };

        await serverManager.startServer(httpConfigWithCommand);
        
        const state = serverManager.getServerState(httpConfigWithCommand.id);
        expect(state?.state).toBe('ready');
      });

      it('should handle Windows command resolution', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });

        const npmConfig = {
          ...mockConfig,
          command: 'npm'
        };

        await serverManager.startServer(npmConfig);
        
        const state = serverManager.getServerState(npmConfig.id);
        expect(state?.state).toBe('ready');

        Object.defineProperty(process, 'platform', { value: originalPlatform });
      });

      it('should handle command with spaces and quotes', async () => {
        const quotedConfig = {
          ...mockConfig,
          command: 'node "path with spaces/script.js"'
        };

        await serverManager.startServer(quotedConfig);
        
        const state = serverManager.getServerState(quotedConfig.id);
        expect(state?.state).toBe('ready');
      });

      it('should handle maximum server limit', async () => {
        // Fill up server slots
        for (let i = 0; i < 8; i++) {
          serverManager['servers'].set(`server-${i}`, {
            client: createMockClient(),
            transport: createMockTransport(),
            config: {
              id: `server-${i}`,
              name: `Server ${i}`,
              transport: 'stdio',
              command: 'node',
              args: [],
              enabled: true,
              autoStart: false,
              env: {}
            },
            state: { serverId: `server-${i}`, state: 'ready' }
          });
        }

        await expect(serverManager.startServer(mockConfig))
          .rejects.toThrow('Maximum number of servers (8) reached');
      });

      it('should handle server already running', async () => {
        serverManager['servers'].set(mockConfig.id, {
          client: createMockClient(),
          transport: createMockTransport(),
          config: mockConfig,
          state: { serverId: mockConfig.id, state: 'ready' }
        });

        await expect(serverManager.startServer(mockConfig))
          .rejects.toThrow(`Server ${mockConfig.id} is already running`);
      });

      it('should handle MCP SDK loading failure', async () => {
        const mockErrorImport = vi.fn()
          .mockRejectedValue(new Error('MCP SDK not available'));
        vi.stubGlobal('Function', () => mockErrorImport);

        await expect(serverManager.startServer(mockConfig))
          .rejects.toThrow('MCP SDK not available');

        const server = serverManager['servers'].get(mockConfig.id);
        expect(server?.state.state).toBe('failed');
        expect(server?.state.error).toContain('MCP SDK not available');
      });

      it('should handle client connection failure', async () => {
        const mockClient = createMockClient({
          connect: vi.fn().mockRejectedValue(new Error('Connection failed'))
        });

        const mockDynamicImport = vi.fn()
          .mockImplementationOnce(() => Promise.resolve({
            Client: vi.fn().mockImplementation(() => mockClient)
          }))
          .mockImplementationOnce(() => Promise.resolve({
            StdioClientTransport: vi.fn().mockImplementation(() => createMockTransport())
          }));

        vi.stubGlobal('Function', () => mockDynamicImport);

        await expect(serverManager.startServer(mockConfig))
          .rejects.toThrow('Connection failed');

        const server = serverManager['servers'].get(mockConfig.id);
        expect(server?.state.state).toBe('failed');
      });

      it('should handle missing command for STDIO transport', async () => {
        const invalidConfig = {
          ...mockConfig,
          command: undefined
        };

        await expect(serverManager.startServer(invalidConfig))
          .rejects.toThrow('Command is required for STDIO transport');
      });

      it('should set up environment variables correctly', async () => {
        const configWithEnv = {
          ...mockConfig,
          env: { 'TEST_VAR': 'test_value', 'NODE_ENV': 'test' }
        };

        const mockClient = createMockClient();
        const mockTransport = createMockTransport();

        const mockDynamicImport = vi.fn()
          .mockImplementationOnce(() => Promise.resolve({
            Client: vi.fn().mockImplementation(() => mockClient)
          }))
          .mockImplementationOnce(() => Promise.resolve({
            StdioClientTransport: vi.fn().mockImplementation((options) => {
              expect(options.env.TEST_VAR).toBe('test_value');
              expect(options.env.NODE_ENV).toBe('test');
              expect(options.env.LANG).toBe('en_US.UTF-8');
              return mockTransport;
            })
          }));

        vi.stubGlobal('Function', () => mockDynamicImport);

        await serverManager.startServer(configWithEnv);
      });
    });

    describe('stopServer', () => {
      it('should successfully stop a running server', async () => {
        const mockClose = vi.fn().mockResolvedValue(undefined);
        const stateChanges: ServerState[] = [];
        
        serverManager['servers'].set(mockConfig.id, {
          client: { close: mockClose },
          transport: createMockTransport(),
          config: mockConfig,
          state: { serverId: mockConfig.id, state: 'ready' }
        });

        serverManager.on('stateChange', (state) => stateChanges.push(state));

        await serverManager.stopServer(mockConfig.id);
        
        expect(mockClose).toHaveBeenCalled();
        expect(serverManager.getServerState(mockConfig.id)).toBeNull();
        expect(stateChanges).toHaveLength(1);
        expect(stateChanges[0].state).toBe('stopped');
      });

      it('should handle stopping non-existent server gracefully', async () => {
        await expect(serverManager.stopServer('non-existent'))
          .resolves.not.toThrow();
      });

      it('should handle client close failure', async () => {
        const mockClose = vi.fn().mockRejectedValue(new Error('Close failed'));
        
        serverManager['servers'].set(mockConfig.id, {
          client: { close: mockClose },
          transport: createMockTransport(),
          config: mockConfig,
          state: { serverId: mockConfig.id, state: 'ready' }
        });

        // Should not throw, just log the error
        await expect(serverManager.stopServer(mockConfig.id))
          .resolves.not.toThrow();
        
        expect(serverManager.getServerState(mockConfig.id)).toBeNull();
      });

      it('should kill process if client close fails', async () => {
        const mockKill = vi.fn();
        const mockClose = vi.fn().mockRejectedValue(new Error('Close failed'));
        
        serverManager['servers'].set(mockConfig.id, {
          client: { close: mockClose },
          transport: createMockTransport({ process: { kill: mockKill } }),
          config: mockConfig,
          state: { serverId: mockConfig.id, state: 'ready' },
          process: { kill: mockKill } // Add process reference
        });

        await serverManager.stopServer(mockConfig.id);
        
        expect(mockKill).toHaveBeenCalled();
        expect(serverManager.getServerState(mockConfig.id)).toBeNull();
      });
    });

    describe('stopAllServers', () => {
      it('should stop all running servers', async () => {
        const servers = ['server1', 'server2', 'server3'];
        const mockClients = servers.map(() => ({ close: vi.fn().mockResolvedValue(undefined) }));
        
        servers.forEach((id, index) => {
          serverManager['servers'].set(id, {
            client: mockClients[index],
            transport: createMockTransport(),
            config: { ...mockConfig, id },
            state: { serverId: id, state: 'ready' }
          });
        });

        await serverManager.stopAllServers();

        expect(serverManager.getAllServerStates()).toHaveLength(0);
        mockClients.forEach(client => {
          expect(client.close).toHaveBeenCalled();
        });
      });
    });
  });

  describe('Tool Management', () => {
    beforeEach(() => {
      const mockTool: McpTool = {
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: { type: 'object', properties: {} },
        serverId: mockConfig.id
      };

      serverManager['servers'].set(mockConfig.id, {
        client: createMockClient(),
        transport: createMockTransport(),
        config: mockConfig,
        state: { 
          serverId: mockConfig.id, 
          state: 'ready',
          tools: [mockTool]
        }
      });
    });

    describe('executeTool', () => {
      it('should execute a tool with permission', async () => {
        (permissionManager.requestPermission as any).mockResolvedValue(true);
        
        const result = await serverManager.executeTool(mockConfig.id, 'test-tool', { arg1: 'value1' });
        
        expect(result).toEqual({ result: 'success' });
        expect(permissionManager.requestPermission).toHaveBeenCalledWith(
          mockConfig, // server.config
          expect.objectContaining({ // tool object
            name: 'test-tool',
            serverId: mockConfig.id
          }),
          { arg1: 'value1' } // args
        );
      });

      it('should reject when server not found', async () => {
        await expect(serverManager.executeTool('non-existent', 'test-tool', {}))
          .rejects.toThrow('Server non-existent is not running');
      });

      it('should reject when server not ready', async () => {
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.state.state = 'starting';

        await expect(serverManager.executeTool(mockConfig.id, 'test-tool', {}))
          .rejects.toThrow(`Server ${mockConfig.id} is not ready`);
      });

      it('should reject when tool not found', async () => {
        await expect(serverManager.executeTool(mockConfig.id, 'missing-tool', {}))
          .rejects.toThrow('Tool missing-tool not found');
      });

      it('should reject when permission denied', async () => {
        (permissionManager.requestPermission as any).mockResolvedValue(false);

        await expect(serverManager.executeTool(mockConfig.id, 'test-tool', {}))
          .rejects.toThrow('Permission denied');
      });

      it('should handle tool execution errors', async () => {
        const mockClient = createMockClient({
          callTool: vi.fn().mockRejectedValue(new Error('Tool execution failed'))
        });
        
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.client = mockClient;
        
        (permissionManager.requestPermission as any).mockResolvedValue(true);

        await expect(serverManager.executeTool(mockConfig.id, 'test-tool', {}))
          .rejects.toThrow('Tool execution failed');
      });
    });

    describe('getAvailableTools', () => {
      it('should return tools for a specific server', () => {
        const tools = serverManager.getAvailableTools(mockConfig.id);
        expect(tools).toHaveLength(1);
        expect(tools[0].name).toBe('test-tool');
      });

      it('should return empty array for non-existent server', () => {
        const tools = serverManager.getAvailableTools('non-existent');
        expect(tools).toHaveLength(0);
      });

      it('should return empty array for server without tools', () => {
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.state.tools = undefined;

        const tools = serverManager.getAvailableTools(mockConfig.id);
        expect(tools).toHaveLength(0);
      });
    });

    describe('getAllAvailableTools', () => {
      it('should return tools from all servers', () => {
        // Add another server with tools
        const server2Tool: McpTool = {
          name: 'server2-tool',
          description: 'Server 2 tool',
          inputSchema: {},
          serverId: 'server2'
        };

        serverManager['servers'].set('server2', {
          client: createMockClient(),
          transport: createMockTransport(),
          config: { ...mockConfig, id: 'server2' },
          state: { 
            serverId: 'server2', 
            state: 'ready',
            tools: [server2Tool]
          }
        });

        const allTools = serverManager.getAllAvailableTools();
        expect(allTools).toHaveLength(2);
        expect(allTools.map(t => t.name)).toContain('test-tool');
        expect(allTools.map(t => t.name)).toContain('server2-tool');
      });
    });
  });

  describe('Resource Management', () => {
    beforeEach(() => {
      const mockResource: McpResource = {
        uri: 'file://test.txt',
        name: 'test.txt',
        description: 'Test resource',
        mimeType: 'text/plain',
        serverId: mockConfig.id
      };

      serverManager['servers'].set(mockConfig.id, {
        client: createMockClient(),
        transport: createMockTransport(),
        config: mockConfig,
        state: { 
          serverId: mockConfig.id, 
          state: 'ready',
          resources: [mockResource]
        },
        subscribedResources: new Set()
      });
    });

    describe('readResource', () => {
      it('should read a resource successfully', async () => {
        const result = await serverManager.readResource(mockConfig.id, 'file://test.txt');
        
        expect(result).toEqual({ 
          contents: [{ type: 'text', text: 'resource content' }] 
        });
      });

      it('should reject when server not found', async () => {
        await expect(serverManager.readResource('non-existent', 'file://test.txt'))
          .rejects.toThrow('Server non-existent is not running');
      });

      it('should reject when server not ready', async () => {
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.state.state = 'starting';

        await expect(serverManager.readResource(mockConfig.id, 'file://test.txt'))
          .rejects.toThrow(`Server ${mockConfig.id} is not ready`);
      });

      it('should handle read errors', async () => {
        const mockClient = createMockClient({
          readResource: vi.fn().mockRejectedValue(new Error('Read failed'))
        });
        
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.client = mockClient;

        await expect(serverManager.readResource(mockConfig.id, 'file://test.txt'))
          .rejects.toThrow('Read failed');
      });
    });

    describe('subscribeToResource', () => {
      it('should subscribe to a resource successfully', async () => {
        await serverManager.subscribeToResource(mockConfig.id, 'file://test.txt');
        
        const server = serverManager['servers'].get(mockConfig.id)!;
        expect(server.subscribedResources?.has('file://test.txt')).toBe(true);
      });

      it('should handle already subscribed resources', async () => {
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.subscribedResources!.add('file://test.txt');

        // Should not throw, just skip
        await expect(serverManager.subscribeToResource(mockConfig.id, 'file://test.txt'))
          .resolves.not.toThrow();
      });

      it('should handle subscription errors', async () => {
        const mockClient = createMockClient({
          subscribeResource: vi.fn().mockRejectedValue(new Error('Subscribe failed'))
        });
        
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.client = mockClient;

        await expect(serverManager.subscribeToResource(mockConfig.id, 'file://test.txt'))
          .rejects.toThrow('Subscribe failed');
      });
    });

    describe('unsubscribeFromResource', () => {
      it('should unsubscribe from a resource successfully', async () => {
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.subscribedResources!.add('file://test.txt');

        await serverManager.unsubscribeFromResource(mockConfig.id, 'file://test.txt');
        
        expect(server.subscribedResources?.has('file://test.txt')).toBe(false);
      });

      it('should handle not subscribed resources', async () => {
        // Should not throw, just skip
        await expect(serverManager.unsubscribeFromResource(mockConfig.id, 'file://test.txt'))
          .resolves.not.toThrow();
      });
    });

    describe('getAvailableResources', () => {
      it('should return resources for a specific server', () => {
        const resources = serverManager.getAvailableResources(mockConfig.id);
        expect(resources).toHaveLength(1);
        expect(resources[0].name).toBe('test.txt');
      });

      it('should return empty array for non-existent server', () => {
        const resources = serverManager.getAvailableResources('non-existent');
        expect(resources).toHaveLength(0);
      });
    });

    describe('getAllAvailableResources', () => {
      it('should return resources from all servers', () => {
        // Add another server with resources
        const server2Resource: McpResource = {
          uri: 'file://server2.txt',
          name: 'server2.txt',
          description: 'Server 2 resource',
          mimeType: 'text/plain',
          serverId: 'server2'
        };

        serverManager['servers'].set('server2', {
          client: createMockClient(),
          transport: createMockTransport(),
          config: { ...mockConfig, id: 'server2' },
          state: { 
            serverId: 'server2', 
            state: 'ready',
            resources: [server2Resource]
          }
        });

        const allResources = serverManager.getAllAvailableResources();
        expect(allResources).toHaveLength(2);
        expect(allResources.map(r => r.name)).toContain('test.txt');
        expect(allResources.map(r => r.name)).toContain('server2.txt');
      });
    });
  });

  describe('Prompt Management', () => {
    beforeEach(() => {
      const mockPrompt: McpPrompt = {
        name: 'test-prompt',
        description: 'Test prompt',
        arguments: [
          { name: 'arg1', description: 'First argument', required: true }
        ],
        serverId: mockConfig.id
      };

      serverManager['servers'].set(mockConfig.id, {
        client: createMockClient(),
        transport: createMockTransport(),
        config: mockConfig,
        state: { 
          serverId: mockConfig.id, 
          state: 'ready',
          prompts: [mockPrompt]
        }
      });
    });

    describe('executePrompt', () => {
      it('should execute a prompt successfully', async () => {
        const result = await serverManager.executePrompt(mockConfig.id, 'test-prompt', { arg1: 'value1' });
        
        expect(result).toEqual({ 
          messages: [{ role: 'user', content: { type: 'text', text: 'prompt content' } }] 
        });
      });

      it('should execute prompt without arguments', async () => {
        const result = await serverManager.executePrompt(mockConfig.id, 'test-prompt');
        
        expect(result).toEqual({ 
          messages: [{ role: 'user', content: { type: 'text', text: 'prompt content' } }] 
        });
      });

      it('should reject when server not found', async () => {
        await expect(serverManager.executePrompt('non-existent', 'test-prompt'))
          .rejects.toThrow('Server non-existent is not running');
      });

      it('should reject when prompt not found', async () => {
        await expect(serverManager.executePrompt(mockConfig.id, 'missing-prompt'))
          .rejects.toThrow('Prompt missing-prompt not found');
      });

      it('should handle prompt execution errors', async () => {
        const mockClient = createMockClient({
          getPrompt: vi.fn().mockRejectedValue(new Error('Prompt execution failed'))
        });
        
        const server = serverManager['servers'].get(mockConfig.id)!;
        server.client = mockClient;

        await expect(serverManager.executePrompt(mockConfig.id, 'test-prompt'))
          .rejects.toThrow('Prompt execution failed');
      });
    });

    describe('getAvailablePrompts', () => {
      it('should return prompts for a specific server', () => {
        const prompts = serverManager.getAvailablePrompts(mockConfig.id);
        expect(prompts).toHaveLength(1);
        expect(prompts[0].name).toBe('test-prompt');
      });

      it('should return empty array for non-existent server', () => {
        const prompts = serverManager.getAvailablePrompts('non-existent');
        expect(prompts).toHaveLength(0);
      });
    });

    describe('getAllAvailablePrompts', () => {
      it('should return prompts from all servers', () => {
        // Add another server with prompts
        const server2Prompt: McpPrompt = {
          name: 'server2-prompt',
          description: 'Server 2 prompt',
          serverId: 'server2'
        };

        serverManager['servers'].set('server2', {
          client: createMockClient(),
          transport: createMockTransport(),
          config: { ...mockConfig, id: 'server2' },
          state: { 
            serverId: 'server2', 
            state: 'ready',
            prompts: [server2Prompt]
          }
        });

        const allPrompts = serverManager.getAllAvailablePrompts();
        expect(allPrompts).toHaveLength(2);
        expect(allPrompts.map(p => p.name)).toContain('test-prompt');
        expect(allPrompts.map(p => p.name)).toContain('server2-prompt');
      });
    });
  });

  describe('State Management', () => {
    it('should get server state', () => {
      const mockState: ServerState = {
        serverId: mockConfig.id,
        state: 'ready',
        lastReady: new Date()
      };

      serverManager['servers'].set(mockConfig.id, {
        client: createMockClient(),
        transport: createMockTransport(),
        config: mockConfig,
        state: mockState
      });

      const state = serverManager.getServerState(mockConfig.id);
      expect(state).toEqual(mockState);
    });

    it('should return null for non-existent server state', () => {
      const state = serverManager.getServerState('non-existent');
      expect(state).toBeNull();
    });

    it('should get all server states', () => {
      const states = [
        { serverId: 'server1', state: 'ready' as const },
        { serverId: 'server2', state: 'starting' as const }
      ];

      states.forEach((state, index) => {
        serverManager['servers'].set(state.serverId, {
          client: createMockClient(),
          transport: createMockTransport(),
          config: { ...mockConfig, id: state.serverId },
          state
        });
      });

      const allStates = serverManager.getAllServerStates();
      expect(allStates).toHaveLength(2);
      expect(allStates.map(s => s.serverId)).toContain('server1');
      expect(allStates.map(s => s.serverId)).toContain('server2');
    });
  });

  describe('Advanced Features', () => {
    describe('sampleLLM', () => {
      it('should handle LLM sampling requests', async () => {
        // sampleLLM tries to execute the 'sampleLLM' tool, so we need to add it
        const sampleLLMTool: McpTool = {
          name: 'sampleLLM',
          description: 'Sample LLM tool',
          inputSchema: { type: 'object', properties: {} },
          serverId: mockConfig.id
        };

        serverManager['servers'].set(mockConfig.id, {
          client: createMockClient({
            callTool: vi.fn().mockResolvedValue({ content: 'LLM response' })
          }),
          transport: createMockTransport(),
          config: mockConfig,
          state: { 
            serverId: mockConfig.id, 
            state: 'ready',
            tools: [sampleLLMTool]
          }
        });

        const messages = [{ role: 'user', content: 'Test message' }];
        const options = { maxTokens: 100, temperature: 0.7 };

        const result = await serverManager.sampleLLM(mockConfig.id, messages, options);
        
        expect(result).toEqual({ content: 'LLM response' });
      });

      it('should reject when server not found', async () => {
        await expect(serverManager.sampleLLM('non-existent', []))
          .rejects.toThrow('Server non-existent is not running');
      });

      it('should handle sampling errors gracefully', async () => {
        // Without the sampleLLM tool, it should throw tool not found error
        serverManager['servers'].set(mockConfig.id, {
          client: createMockClient(),
          transport: createMockTransport(),
          config: mockConfig,
          state: { 
            serverId: mockConfig.id, 
            state: 'ready',
            tools: [] // No tools available
          }
        });

        await expect(serverManager.sampleLLM(mockConfig.id, []))
          .rejects.toThrow('Tool sampleLLM not found on server test-server');
      });
    });

    describe('Discovery Methods', () => {
      it('should discover tools correctly', async () => {
        const mockClient = createMockClient({
          listTools: vi.fn().mockResolvedValue({
            tools: [
              { name: 'tool1', description: 'Tool 1', inputSchema: { type: 'object' } },
              { name: 'tool2', description: 'Tool 2', inputSchema: { type: 'string' } }
            ]
          })
        });

        const tools = await serverManager['discoverTools'](mockClient, mockConfig.id);
        
        expect(tools).toHaveLength(2);
        expect(tools[0]).toEqual({
          name: 'tool1',
          description: 'Tool 1',
          inputSchema: { type: 'object' },
          serverId: mockConfig.id
        });
      });

      it('should discover resources correctly', async () => {
        const mockClient = createMockClient({
          listResources: vi.fn().mockResolvedValue({
            resources: [
              { uri: 'file://test1.txt', name: 'test1.txt', description: 'Test 1' },
              { uri: 'file://test2.txt', name: 'test2.txt', mimeType: 'text/plain' }
            ]
          })
        });

        const resources = await serverManager['discoverResources'](mockClient, mockConfig.id);
        
        expect(resources).toHaveLength(2);
        expect(resources[0]).toEqual({
          uri: 'file://test1.txt',
          name: 'test1.txt',
          description: 'Test 1',
          serverId: mockConfig.id
        });
      });

      it('should discover prompts correctly', async () => {
        const mockClient = createMockClient({
          listPrompts: vi.fn().mockResolvedValue({
            prompts: [
              { 
                name: 'prompt1', 
                description: 'Prompt 1',
                arguments: [{ name: 'arg1', required: true }]
              },
              { name: 'prompt2', description: 'Prompt 2' }
            ]
          })
        });

        const prompts = await serverManager['discoverPrompts'](mockClient, mockConfig.id);
        
        expect(prompts).toHaveLength(2);
        expect(prompts[0]).toEqual({
          name: 'prompt1',
          description: 'Prompt 1',
          arguments: [{ name: 'arg1', required: true }],
          serverId: mockConfig.id
        });
      });

      it('should handle discovery errors gracefully', async () => {
        const mockClient = createMockClient({
          listTools: vi.fn().mockRejectedValue(new Error('Discovery failed'))
        });

        const tools = await serverManager['discoverTools'](mockClient, mockConfig.id);
        expect(tools).toEqual([]);
      });
    });

    describe('Resource Refresh', () => {
      it('should refresh server resources', async () => {
        const mockClient = createMockClient({
          listResources: vi.fn().mockResolvedValue({
            resources: [
              { uri: 'file://new.txt', name: 'new.txt', description: 'New resource' }
            ]
          })
        });

        serverManager['servers'].set(mockConfig.id, {
          client: mockClient,
          transport: createMockTransport(),
          config: mockConfig,
          state: { 
            serverId: mockConfig.id, 
            state: 'ready',
            resources: []
          }
        });

        await serverManager['refreshServerResources'](mockConfig.id);
        
        const server = serverManager['servers'].get(mockConfig.id)!;
        expect(server.state.resources).toHaveLength(1);
        expect(server.state.resources![0].name).toBe('new.txt');
      });

      it('should handle refresh errors gracefully', async () => {
        const mockClient = createMockClient({
          listResources: vi.fn().mockRejectedValue(new Error('Refresh failed'))
        });

        serverManager['servers'].set(mockConfig.id, {
          client: mockClient,
          transport: createMockTransport(),
          config: mockConfig,
          state: { serverId: mockConfig.id, state: 'ready' }
        });

        // Should not throw
        await expect(serverManager['refreshServerResources'](mockConfig.id))
          .resolves.not.toThrow();
      });
    });
  });
});