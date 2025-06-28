import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { serverManager, ServerManager, type ServerState } from '../../../src/main/mcp/ConnectionManager.js';
import type { McpServerConfig } from '../../../src/shared/types.js';
import { permissionManager } from '../../../src/main/permissions/PermissionManager.js';

describe('ServerManager', () => {
  vi.mock('../../../src/main/permissions/PermissionManager.js', async () => {
    const actual = await vi.importActual('../../../src/main/permissions/PermissionManager.js');
    return {
      ...actual,
      permissionManager: {
        ...actual.permissionManager,
        requestPermission: vi.fn(),
      },
    };
  });
  const mockConfig: McpServerConfig = {
    id: 'test-server',
    name: 'Test Server',
    command: 'node',
    args: ['test.js'],
    enabled: true,
    autoStart: false,
    env: {}
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await serverManager.stopAllServers();
  });

  describe('startServer', () => {
    it('should successfully start a server', async () => {
      // Mock the dynamic import function
      const mockDynamicImport = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({
          Client: vi.fn().mockImplementation(() => ({
            connect: vi.fn().mockResolvedValue(undefined),
            listTools: vi.fn().mockResolvedValue({ tools: [] }),
            close: vi.fn().mockResolvedValue(undefined),
            callTool: vi.fn()
          }))
        }))
        .mockImplementationOnce(() => Promise.resolve({
          StdioClientTransport: vi.fn().mockImplementation(() => ({
            process: {}
          }))
        }));

      vi.stubGlobal('Function', () => mockDynamicImport);

      await serverManager.startServer(mockConfig);
      
      const state = serverManager.getServerState(mockConfig.id);
      expect(state?.state).toBe('ready');
    });

    it('should handle maximum server limit', async () => {
      // Fill up server slots
      for (let i = 0; i < 8; i++) {
        serverManager['servers'].set(`server-${i}`, {
          client: {},
          transport: {},
          config: {
            id: `server-${i}`,
            name: `Server ${i}`,
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
        .rejects.toThrow(`Maximum number of servers (8) reached`);
    });

    it('should handle server already running', async () => {
      serverManager['servers'].set(mockConfig.id, {
        client: {},
        transport: {},
        config: mockConfig,
        state: { serverId: mockConfig.id, state: 'ready' }
      });

      await expect(serverManager.startServer(mockConfig))
        .rejects.toThrow(`Server ${mockConfig.id} is already running`);
    });

    it('should handle connection failures', async () => {
      // Mock dynamic import to throw error
      const mockErrorImport = vi.fn()
        .mockRejectedValue(new Error('MCP SDK not available'));
      vi.stubGlobal('Function', () => mockErrorImport);

      await expect(serverManager.startServer(mockConfig))
        .rejects.toThrow('MCP SDK not available');

      // Verify the server was added with failed state
      const server = serverManager['servers'].get(mockConfig.id);
      expect(server?.state.state).toBe('failed');
      expect(server?.state.error).toContain('MCP SDK not available');
    });
  });

  describe('stopServer', () => {
    it('should successfully stop a running server', async () => {
      // Setup mock server
      const mockClose = vi.fn().mockResolvedValue(undefined);
      serverManager['servers'].set(mockConfig.id, {
        client: { close: mockClose },
        transport: {},
        config: mockConfig,
        state: { serverId: mockConfig.id, state: 'ready' }
      });

      await serverManager.stopServer(mockConfig.id);
      expect(mockClose).toHaveBeenCalled();
      expect(serverManager.getServerState(mockConfig.id)).toBeNull();
    });

    it('should handle stopping non-existent server', async () => {
      await expect(serverManager.stopServer('non-existent'))
        .resolves.not.toThrow();
    });
  });

  describe('executeTool', () => {
    it('should execute a tool with permission', async () => {
      // Setup mock server with tool
      const mockToolCall = vi.fn().mockResolvedValue('test-result');
      serverManager['servers'].set(mockConfig.id, {
        client: { callTool: mockToolCall },
        transport: {},
        config: mockConfig,
        state: { 
          serverId: mockConfig.id, 
          state: 'ready',
          tools: [{ name: 'test-tool', description: '', inputSchema: {}, serverId: mockConfig.id }]
        }
      });

      

      permissionManager.requestPermission.mockResolvedValue(true);
      const result = await serverManager.executeTool(mockConfig.id, 'test-tool', {});
      expect(result).toBe('test-result');
      expect(mockToolCall).toHaveBeenCalled();
    });

    it('should reject when server not ready', async () => {
      serverManager['servers'].set(mockConfig.id, {
        client: {},
        transport: {},
        config: mockConfig,
        state: { serverId: mockConfig.id, state: 'starting' }
      });

      await expect(serverManager.executeTool(mockConfig.id, 'test-tool', {}))
        .rejects.toThrow(`Server ${mockConfig.id} is not ready`);
    });

    it('should reject when tool not found', async () => {
      serverManager['servers'].set(mockConfig.id, {
        client: {},
        transport: {},
        config: mockConfig,
        state: { 
          serverId: mockConfig.id, 
          state: 'ready',
          tools: [] 
        }
      });

      await expect(serverManager.executeTool(mockConfig.id, 'missing-tool', {}))
        .rejects.toThrow('Tool missing-tool not found');
    });

    it('should reject when permission denied', async () => {
      // Setup mock server with tool
      serverManager['servers'].set(mockConfig.id, {
        client: {},
        transport: {},
        config: mockConfig,
        state: { 
          serverId: mockConfig.id, 
          state: 'ready',
          tools: [{ name: 'test-tool', description: '', inputSchema: {}, serverId: mockConfig.id }]
        }
      });

      // Mock permission manager to deny
      permissionManager.requestPermission.mockResolvedValue(false);

      await expect(serverManager.executeTool(mockConfig.id, 'test-tool', {}))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('state management', () => {
    it('should get server state', () => {
      const testState: ServerState = { serverId: mockConfig.id, state: 'ready' };
      serverManager['servers'].set(mockConfig.id, {
        client: {},
        transport: {},
        config: mockConfig,
        state: testState
      });

      expect(serverManager.getServerState(mockConfig.id)).toEqual(testState);
    });

    it('should get all server states', () => {
      const states: ServerState[] = [
        { serverId: 'server-1', state: 'ready' },
        { serverId: 'server-2', state: 'starting' }
      ];

      serverManager['servers'].set('server-1', {
        client: {},
        transport: {},
        config: {
          id: 'server-1',
          name: '',
          command: '',
          args: [],
          enabled: true,
          autoStart: false,
          env: {}
        },
        state: states[0]
      });

      serverManager['servers'].set('server-2', {
        client: {},
        transport: {},
        config: {
          id: 'server-2',
          name: '',
          command: '',
          args: [],
          enabled: true,
          autoStart: false,
          env: {}
        },
        state: states[1]
      });

      expect(serverManager.getAllServerStates()).toEqual(states);
    });
  });

  describe('tool discovery', () => {
    it('should discover available tools', async () => {
      // Setup mock server with tool discovery
      // Mock client with tools
      const mockClient = {
        listTools: vi.fn().mockResolvedValue({
          tools: [
            { name: 'tool1', description: 'Test tool 1', inputSchema: {} },
            { name: 'tool2', description: 'Test tool 2', inputSchema: {} }
          ]
        }),
        close: vi.fn()
      };

      serverManager['servers'].set(mockConfig.id, {
        client: mockClient,
        transport: {},
        config: mockConfig,
        state: {
          serverId: mockConfig.id,
          state: 'ready',
          tools: [
            { name: 'tool1', description: 'Test tool 1', inputSchema: {}, serverId: mockConfig.id },
            { name: 'tool2', description: 'Test tool 2', inputSchema: {}, serverId: mockConfig.id }
          ]
        }
      });

      const tools = serverManager.getAvailableTools(mockConfig.id);
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool1');
      expect(tools[1].name).toBe('tool2');
    });

    it('should handle empty tool list', async () => {
      const mockClient = {
        listTools: vi.fn().mockResolvedValue({ tools: [] }),
        close: vi.fn()
      };

      serverManager['servers'].set(mockConfig.id, {
        client: mockClient,
        transport: {},
        config: mockConfig,
        state: { serverId: mockConfig.id, state: 'ready' }
      });

      const tools = serverManager.getAvailableTools(mockConfig.id);
      expect(tools).toEqual([]);
    });
  });
});