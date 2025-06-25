// import { spawn } from 'child_process'; // Currently unused but may be needed for direct process spawning
import { EventEmitter } from 'events';
import { McpServerConfig, McpTool } from '../../shared/types.js';

export interface ServerState {
  serverId: string;
  state: 'configured' | 'starting' | 'ready' | 'stopped' | 'failed';
  error?: string;
  lastReady?: Date;
  tools?: McpTool[];
}

const dynamicImport = (specifier: string): Promise<any> => {
  return Function('specifier', 'return import(specifier)')(specifier);
};

async function loadMcpSdk() {
  try {
    return await dynamicImport('@modelcontextprotocol/sdk/client/index.js');
  } catch (error) {
    console.error('Failed to load MCP SDK:', error);
    throw new Error('MCP SDK not available. Please install @modelcontextprotocol/sdk');
  }
}

export class ServerManager extends EventEmitter {
  private servers = new Map<string, {
    client: any;
    transport: any;
    config: McpServerConfig;
    state: ServerState;
    process?: any;
  }>();

  private readonly MAX_SERVERS = 8;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  async startServer(config: McpServerConfig): Promise<void> {
    if (this.servers.size >= this.MAX_SERVERS) {
      throw new Error(`Maximum number of servers (${this.MAX_SERVERS}) reached`);
    }

    if (this.servers.has(config.id)) {
      throw new Error(`Server ${config.id} is already running`);
    }

    console.log(`Starting MCP server: ${config.name} (${config.id})`);

    // Emit starting state
    const startingState: ServerState = {
      serverId: config.id,
      state: 'starting'
    };
    this.emit('stateChange', startingState);

    try {
      // Load MCP SDK dynamically
      const { Client } = await loadMcpSdk();
      const { StdioClientTransport } = await dynamicImport('@modelcontextprotocol/sdk/client/stdio.js');

      // Create transport and client
      const env = { ...process.env } as Record<string, string>;
      if (config.env) {
        Object.assign(env, config.env);
      }
      
      // Set appropriate encoding based on platform
      if (process.platform === 'win32') {
        env.CHCP = '65001'; // UTF-8 code page
      } else {
        env.LANG = 'en_US.UTF-8';
        env.LC_ALL = 'en_US.UTF-8';
      }
      
      // Parse command properly - split command string if it contains spaces
      if (!config.command) {
        throw new Error('Command is required for STDIO transport');
      }
      
      let command = config.command;
      let args = config.args || [];
      
      // If command contains spaces, split it properly with quote handling
      if (command.includes(' ')) {
        const parts = command.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
        command = parts[0] || command;
        args = [...parts.slice(1).map((arg: string) => arg.replace(/^["']|["']$/g, '')), ...args];
      }
      
      // On Windows, handle special commands
      if (process.platform === 'win32' && (command === 'npx' || command === 'npm' || command === 'node')) {
        // Use .cmd extension on Windows for npm/npx
        if (command === 'npx' && !command.endsWith('.cmd')) {
          command = 'npx.cmd';
        } else if (command === 'npm' && !command.endsWith('.cmd')) {
          command = 'npm.cmd';
        }
      }
      
      // Configure transport options based on platform
      const transportOptions: any = {
        command,
        args,
        env,
        encoding: 'utf8'
      };
      
      // On Windows, we need to use shell mode for proper command resolution
      if (process.platform === 'win32') {
        transportOptions.shell = true;
      }
      
      const transport = new StdioClientTransport(transportOptions);

      const client = new Client({
        name: 'nexus-mvp',
        version: '0.1.0'
      }, {
        capabilities: {
          tools: {},
          resources: {}
        }
      });

      // Connect the client (start the process)
      await client.connect(transport);

      // List available tools to verify server is ready
      const result = await client.listTools();
      console.log(`MCP server ready: ${config.name}`, result);

      // Discover tools
      const tools = await this.discoverTools(client, config.id);

      // Store server info
      const serverInfo = {
        client,
        transport,
        config,
        state: {
          serverId: config.id,
          state: 'ready' as const,
          lastReady: new Date(),
          tools
        },
        process: transport.process // Store process reference if available
      };

      this.servers.set(config.id, serverInfo);

      // Emit ready state
      this.emit('stateChange', serverInfo.state);

      console.log(`Successfully started MCP server: ${config.name}`);

    } catch (error) {
      console.error(`Failed to start MCP server ${config.name}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Store failed server info
      const failedServer = {
        client: null,
        transport: null,
        config,
        state: {
          serverId: config.id,
          state: 'failed' as const,
          error: errorMessage,
          tools: []
        }
      };
      this.servers.set(config.id, failedServer);
      
      // Emit failed state
      this.emit('stateChange', failedServer.state);
      
      throw error;
    }
  }

  async stopServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      console.warn(`Attempted to stop non-existent server: ${serverId}`);
      return;
    }

    console.log(`Stopping MCP server: ${server.config.name}`);

    try {
      // Close client connection if it exists and has close method
      if (server.client && typeof server.client.close === 'function') {
        await server.client.close();
      }

      // Remove from servers
      this.servers.delete(serverId);

      // Emit stopped state
      const stoppedState: ServerState = {
        serverId,
        state: 'stopped'
      };
      this.emit('stateChange', stoppedState);

      console.log(`Successfully stopped MCP server: ${server.config.name}`);

    } catch (error) {
      console.error(`Error stopping server ${serverId}:`, error);
      // Still remove from servers even if there was an error
      this.servers.delete(serverId);
    }
  }

  async executeTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} is not running`);
    }

    if (server.state.state !== 'ready') {
      throw new Error(`Server ${serverId} is not ready (current state: ${server.state.state})`);
    }

    // Find the tool definition
    const tool = server.state.tools?.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`);
    }

    // Import permission manager
    const { permissionManager } = await import('../permissions/PermissionManager.js');
    
    // Request permission before execution
    const hasPermission = await permissionManager.requestPermission(server.config, tool, args);
    if (!hasPermission) {
      throw new Error(`Permission denied for tool execution: ${toolName}`);
    }

    try {
      console.log(`Executing tool ${toolName} on server ${serverId}`, { args });

      const result = await server.client.callTool({
        name: toolName,
        arguments: args
      });

      console.log(`Tool execution completed for ${toolName}`, { result });
      
      // Update last ready time on successful execution
      server.state.lastReady = new Date();
      
      return result;

    } catch (error) {
      console.error(`Tool execution failed for ${toolName} on ${serverId}:`, error);
      throw error;
    }
  }

  getServerState(serverId: string): ServerState | null {
    const server = this.servers.get(serverId);
    return server ? server.state : null;
  }

  getAllServerStates(): ServerState[] {
    return Array.from(this.servers.values()).map(server => server.state);
  }

  getAvailableTools(serverId: string): McpTool[] {
    const server = this.servers.get(serverId);
    return server?.state.tools || [];
  }

  getAllAvailableTools(): McpTool[] {
    const allTools: McpTool[] = [];
    for (const server of this.servers.values()) {
      if (server.state.state === 'ready' && server.state.tools) {
        allTools.push(...server.state.tools);
      }
    }
    return allTools;
  }

  async stopAllServers(): Promise<void> {
    const stopPromises = Array.from(this.servers.keys()).map(serverId =>
      this.stopServer(serverId)
    );
    await Promise.all(stopPromises);
  }

  private async discoverTools(client: any, serverId: string): Promise<McpTool[]> {
    try {
      const toolsList = await client.listTools();
      console.log(`Discovered tools for ${serverId}:`, toolsList.tools?.length || 0, toolsList.tools?.map((t: any) => t.name) || []);
      
      return toolsList.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema,
        serverId
      }));

    } catch (error) {
      console.error(`Failed to discover tools for server ${serverId}:`, error);
      return [];
    }
  }
}

// Singleton instance
export const serverManager = new ServerManager(); 