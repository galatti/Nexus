// import { spawn } from 'child_process'; // Currently unused but may be needed for direct process spawning
import { EventEmitter } from 'events';
import { McpServerConfig, McpTool } from '../../shared/types.js';

export interface ServerState {
  serverId: string;
  state: 'configured' | 'starting' | 'ready' | 'stopped' | 'failed';
  error?: string;
  lastReady?: Date;
  tools?: McpTool[];
  resources?: McpResource[];
  prompts?: McpPrompt[];
}

// Add new MCP types for resources and prompts
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

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

export interface ProgressNotification {
  operationId: string;
  progress: number;
  total?: number;
  message?: string;
}

export interface LogMessage {
  level: 'debug' | 'info' | 'warning' | 'error';
  logger?: string;
  data: any;
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

// Grace period (in ms) to allow MCP child processes to exit gracefully.
// Disabled during unit tests to keep the test suite fast.
const SHUTDOWN_GRACE_MS = process.env.NODE_ENV === 'test' ? 0 : 1500;

export class ServerManager extends EventEmitter {
  private servers = new Map<string, {
    client: any;
    transport: any;
    config: McpServerConfig;
    state: ServerState;
    process?: any;
    subscribedResources?: Set<string>;
  }>();

  private readonly MAX_SERVERS = 8;
  
  // Concurrency control
  private operationLocks = new Map<string, Promise<void>>();
  private operationQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Acquires a lock for a server operation to prevent race conditions
   */
  private async acquireOperationLock(serverId: string): Promise<() => void> {
    const existingLock = this.operationLocks.get(serverId);
    if (existingLock) {
      console.log(`🔒 Operation lock exists for server ${serverId}, waiting...`);
      await existingLock;
    }

    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        this.operationLocks.delete(serverId);
        console.log(`🔓 Released operation lock for server ${serverId}`);
        resolve();
      };
    });

    this.operationLocks.set(serverId, lockPromise);
    console.log(`🔒 Acquired operation lock for server ${serverId}`);
    
    return releaseLock!;
  }

  /**
   * Safely checks server state with proper locking
   */
  getServerState(serverId: string): 'configured' | 'starting' | 'ready' | 'stopped' | 'failed' | null {
    const server = this.servers.get(serverId);
    return server?.state?.state || null;
  }

  /**
   * Detects potential race conditions by checking for concurrent operations
   */
  private detectRaceConditions(serverId: string, operation: string): void {
    const hasLock = this.operationLocks.has(serverId);
    const serverExists = this.servers.has(serverId);
    const currentState = this.getServerState(serverId);

    console.log(`🔍 Race condition check for ${operation} on ${serverId}:`, {
      hasLock,
      serverExists,
      currentState,
      totalServers: this.servers.size,
      activeLocks: this.operationLocks.size
    });

    if (hasLock) {
      console.warn(`⚠️ Potential race condition detected: ${operation} on ${serverId} while operation lock exists`);
    }
  }

  async startServer(config: McpServerConfig): Promise<void> {
    // Detect potential race conditions before acquiring lock
    this.detectRaceConditions(config.id, 'startServer');

    // Acquire operation lock to prevent race conditions
    const releaseLock = await this.acquireOperationLock(config.id);

    try {
      // Check server limit with lock protection
      if (this.servers.size >= this.MAX_SERVERS) {
        throw new Error(`Maximum number of servers (${this.MAX_SERVERS}) reached`);
      }

      // Check current server state with lock protection
      const currentState = this.getServerState(config.id);
      if (currentState === 'ready') {
        throw new Error(`Server ${config.id} is already running`);
      }
      if (currentState === 'starting') {
        throw new Error(`Server ${config.id} is already starting`);
      }

      console.log(`🚀 Starting MCP server: ${config.name} (${config.id})`);

      // Immediately mark as starting to prevent other concurrent operations
      const startingState: ServerState = {
        serverId: config.id,
        state: 'starting'
      };
      
      // Store starting state immediately to prevent race conditions
      this.servers.set(config.id, {
        client: null,
        transport: null,
        config,
        state: startingState,
        process: undefined,
        subscribedResources: new Set<string>()
      });
      
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

      // Attach process-level error handling to avoid unhandled exceptions (e.g. EPIPE when pipes are closed)
      if (transport?.process) {
        const childProc = transport.process as any;
        const swallowEpipe = (err: NodeJS.ErrnoException) => {
          if (err.code === 'EPIPE') {
            // Broken pipe errors can occur when the client closes before the child
            // process finishes flushing its buffers. Swallow these to avoid bringing
            // down the entire Electron/Node application.
            console.warn(`MCP child process (${config.name}) emitted EPIPE – ignoring`, err);
          } else {
            console.error(`MCP child process (${config.name}) error:`, err);
          }
        };

        // Listen on both the child process itself and its stdio streams.
        childProc.on?.('error', swallowEpipe);
        childProc.stdin?.on?.('error', swallowEpipe);
        childProc.stdout?.on?.('error', swallowEpipe);
        childProc.stderr?.on?.('error', swallowEpipe);
      }

      const client = new Client({
        name: 'nexus-reference-client',
        version: '1.0.0'
      }, {
        capabilities: {
          tools: {},
          resources: {
            subscribe: true,
            listChanged: true
          },
          prompts: {},
          sampling: {
            // Enable sampling capability to handle incoming sampling requests
            createMessage: true
          }
        }
      });

      // Connect the client (start the process)
      await client.connect(transport);

      // Note: Advanced MCP features like bidirectional sampling are not 
      // supported by the current MCP SDK. The sampleLLM tool in the 
      // everything server will fail with "Method not found" because it 
      // requires the client to handle incoming sampling requests.

      // List available tools to verify server is ready
      const result = await client.listTools();
      console.log(`MCP server ready: ${config.name}`, result);

      // Discover tools, resources, and prompts
      const tools = await this.discoverTools(client, config.id);
      const resources = await this.discoverResources(client, config.id);
      const prompts = await this.discoverPrompts(client, config.id);

      // Store server info
      const serverInfo = {
        client,
        transport,
        config,
        state: {
          serverId: config.id,
          state: 'ready' as const,
          lastReady: new Date(),
          tools,
          resources,
          prompts
        },
        process: transport.process // Store process reference if available
      };

      this.servers.set(config.id, serverInfo);

      // Emit ready state
      this.emit('stateChange', serverInfo.state);

        console.log(`✅ Successfully started MCP server: ${config.name}`);

      } catch (startupError) {
        console.error(`❌ Failed to start MCP server ${config.name}:`, startupError);
        const errorMessage = startupError instanceof Error ? startupError.message : 'Unknown error';
        
        // Store failed server info
        const failedServer = {
          client: null,
          transport: null,
          config,
          state: {
            serverId: config.id,
            state: 'failed' as const,
            error: errorMessage,
            tools: [],
            resources: [],
            prompts: []
          },
          process: undefined,
          subscribedResources: new Set<string>()
        };
        this.servers.set(config.id, failedServer);
        
        // Emit failed state
        this.emit('stateChange', failedServer.state);
        
        throw startupError;
      }
    } finally {
      // Always release the operation lock
      releaseLock();
    }
  }

  async stopServer(serverId: string): Promise<void> {
    // Detect potential race conditions before acquiring lock
    this.detectRaceConditions(serverId, 'stopServer');

    // Acquire operation lock to prevent race conditions
    const releaseLock = await this.acquireOperationLock(serverId);

    try {
      const server = this.servers.get(serverId);
      if (!server) {
        console.warn(`⚠️ Attempted to stop non-existent server: ${serverId}`);
        return;
      }

      const currentState = this.getServerState(serverId);
      if (currentState === 'stopped') {
        console.log(`🔄 Server ${serverId} is already stopped`);
        return;
      }

      console.log(`🛑 Stopping MCP server: ${server.config.name} (${serverId})`);

      // Immediately mark as stopped to prevent other operations
      const stoppedState: ServerState = {
        serverId: serverId,
        state: 'stopped'
      };
      server.state = stoppedState;

    try {
      // Close client connection if possible
      if (server.client && typeof server.client.close === 'function') {
        await server.client.close().catch((err: unknown) => {
          console.error(`Failed to close MCP client for ${serverId}:`, err);
        });
      }

      // Dispose transport (closes pipes & removes listeners)
      if (server.transport && typeof server.transport.close === 'function') {
        try {
          await server.transport.close();
        } catch (err) {
          console.error(`Failed to close transport for ${serverId}:`, err);
        }
      }

      // Wait briefly for the child process to exit on its own after graceful close
      const childProc: any = server.process ?? server.transport?.process;
      if (childProc && !childProc.killed) {
        const exited = await new Promise<boolean>((resolve) => {
          const timer = setTimeout(() => resolve(false), SHUTDOWN_GRACE_MS);
          childProc.once?.('exit', () => {
            clearTimeout(timer);
            resolve(true);
          });
        });

        if (!exited) {
          try {
            childProc.kill();
          } catch (err) {
            console.error(`Failed to force-kill child process for ${serverId}:`, err);
          }
        }
      }

        // Remove from internal map
        this.servers.delete(serverId);

        // Emit stopped state
        this.emit('stateChange', stoppedState);

        console.log(`✅ Successfully stopped MCP server: ${server.config.name}`);

      } catch (shutdownError) {
        console.error(`❌ Error stopping server ${serverId}:`, shutdownError);
        // Still remove from servers even if there was an error
        this.servers.delete(serverId);
        
        // Emit stopped state even on error
        const stoppedState: ServerState = {
          serverId,
          state: 'stopped'
        };
        this.emit('stateChange', stoppedState);
      }
    } finally {
      // Always release the operation lock
      releaseLock();
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

  getServerStateObject(serverId: string): ServerState | null {
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

  getAvailableResources(serverId: string): McpResource[] {
    const server = this.servers.get(serverId);
    return server?.state.resources || [];
  }

  getAllAvailableResources(): McpResource[] {
    const allResources: McpResource[] = [];
    for (const server of this.servers.values()) {
      if (server.state.state === 'ready' && server.state.resources) {
        allResources.push(...server.state.resources);
      }
    }
    return allResources;
  }

  getAvailablePrompts(serverId: string): McpPrompt[] {
    const server = this.servers.get(serverId);
    return server?.state.prompts || [];
  }

  getAllAvailablePrompts(): McpPrompt[] {
    const allPrompts: McpPrompt[] = [];
    for (const server of this.servers.values()) {
      if (server.state.state === 'ready' && server.state.prompts) {
        allPrompts.push(...server.state.prompts);
      }
    }
    return allPrompts;
  }

  async readResource(serverId: string, uri: string): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} is not running`);
    }

    if (server.state.state !== 'ready') {
      throw new Error(`Server ${serverId} is not ready (current state: ${server.state.state})`);
    }

    try {
      console.log(`Reading resource ${uri} from server ${serverId}`);
      const result = await server.client.readResource({ uri });
      console.log(`Resource read completed for ${uri}`);
      return result;
    } catch (error) {
      console.error(`Resource read failed for ${uri} on ${serverId}:`, error);
      throw error;
    }
  }

  async subscribeToResource(serverId: string, uri: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} is not running`);
    }

    if (!server.subscribedResources) {
      server.subscribedResources = new Set<string>();
    }

    if (server.subscribedResources.has(uri)) {
      console.log(`Already subscribed to resource ${uri} on ${serverId}`);
      return;
    }

    try {
      await server.client.subscribeResource({ uri });
      server.subscribedResources.add(uri);
      console.log(`Subscribed to resource ${uri} on ${serverId}`);
    } catch (error) {
      console.error(`Failed to subscribe to resource ${uri} on ${serverId}:`, error);
      throw error;
    }
  }

  async unsubscribeFromResource(serverId: string, uri: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server || !server.subscribedResources) {
      return;
    }

    try {
      await server.client.unsubscribeResource({ uri });
      server.subscribedResources.delete(uri);
      console.log(`Unsubscribed from resource ${uri} on ${serverId}`);
    } catch (error) {
      console.error(`Failed to unsubscribe from resource ${uri} on ${serverId}:`, error);
      throw error;
    }
  }

  async executePrompt(serverId: string, promptName: string, args?: Record<string, unknown>): Promise<unknown> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`Server ${serverId} is not running`);
    }

    if (server.state.state !== 'ready') {
      throw new Error(`Server ${serverId} is not ready (current state: ${server.state.state})`);
    }

    // Find the prompt definition
    const prompt = server.state.prompts?.find(p => p.name === promptName);
    if (!prompt) {
      throw new Error(`Prompt ${promptName} not found on server ${serverId}`);
    }

    try {
      console.log(`Executing prompt ${promptName} on server ${serverId}`, { args });
      const result = await server.client.getPrompt({
        name: promptName,
        arguments: args || {}
      });
      console.log(`Prompt execution completed for ${promptName}`);
      return result;
    } catch (error) {
      console.error(`Prompt execution failed for ${promptName} on ${serverId}:`, error);
      throw error;
    }
  }

  async sampleLLM(serverId: string, messages: any[], options?: { maxTokens?: number; temperature?: number; stopSequences?: string[]; modelPreferences?: any }): Promise<unknown> {
    // Note: This method shouldn't be called directly anymore
    // The sampleLLM tool should be called through the normal tool execution path
    console.log(`Warning: sampleLLM called directly - this should go through normal tool execution`);
    return this.executeTool(serverId, 'sampleLLM', {
      messages,
      maxTokens: options?.maxTokens,
      temperature: options?.temperature,
      stopSequences: options?.stopSequences,
      modelPreferences: options?.modelPreferences
    });
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

  private async discoverResources(client: any, serverId: string): Promise<McpResource[]> {
    try {
      const resourcesList = await client.listResources();
      console.log(`Discovered resources for ${serverId}:`, resourcesList.resources?.length || 0);
      
      return resourcesList.resources?.map((resource: any) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        serverId
      })) || [];

    } catch (error: any) {
      // Some servers simply do not implement listResources – treat as non-fatal
      if (error?.code === -32601) {
        console.log(`Server ${serverId} does not provide resources – skipping.`);
        return [];
      }
      console.error(`Failed to discover resources for server ${serverId}:`, error);
      return [];
    }
  }

  private async discoverPrompts(client: any, serverId: string): Promise<McpPrompt[]> {
    try {
      const promptsList = await client.listPrompts();
      console.log(`Discovered prompts for ${serverId}:`, promptsList.prompts?.length || 0);
      
      return promptsList.prompts?.map((prompt: any) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: prompt.arguments,
        serverId
      })) || [];

    } catch (error: any) {
      // Some servers do not implement listPrompts – handle gracefully
      if (error?.code === -32601) {
        console.log(`Server ${serverId} does not provide prompts – skipping.`);
        return [];
      }
      console.error(`Failed to discover prompts for server ${serverId}:`, error);
      return [];
    }
  }

  // NOTE: Current MCP SDK doesn't support bidirectional request handlers
  // The sampling feature would require implementing a custom transport
  // or waiting for SDK updates that support incoming requests from servers

  private async refreshServerResources(serverId: string): Promise<void> {
    try {
      const server = this.servers.get(serverId);
      if (server && server.client) {
        const resources = await this.discoverResources(server.client, serverId);
        server.state.resources = resources;
        this.emit('resourcesChanged', serverId, resources);
      }
    } catch (error) {
      console.error(`Failed to refresh resources for ${serverId}:`, error);
    }
  }
}

// Singleton instance
export const serverManager = new ServerManager(); 