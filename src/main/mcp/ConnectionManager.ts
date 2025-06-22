import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { McpServerConfig, McpTool } from '../../shared/types';

export interface ConnectionStatus {
  serverId: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
  lastConnected?: Date;
  tools?: McpTool[];
}

// Dynamic imports for ES modules
let mcpSdk: any = null;

async function loadMcpSdk() {
  if (!mcpSdk) {
    try {
      mcpSdk = await import('@modelcontextprotocol/sdk/client/index.js');
    } catch (error) {
      console.error('Failed to load MCP SDK:', error);
      throw error;
    }
  }
  return mcpSdk;
}

export class ConnectionManager extends EventEmitter {
  private connections = new Map<string, {
    client: any;
    transport: any;
    config: McpServerConfig;
    status: ConnectionStatus;
    reconnectAttempts: number;
    healthCheckInterval?: NodeJS.Timeout;
  }>();

  private readonly MAX_CONNECTIONS = 8;
  private readonly RECONNECT_DELAY = 5000;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly HEALTH_CHECK_INTERVAL = 30000;

  constructor() {
    super();
    this.setMaxListeners(50); // Allow many listeners for server status updates
  }

  async connectToServer(config: McpServerConfig): Promise<void> {
    if (this.connections.size >= this.MAX_CONNECTIONS) {
      throw new Error(`Maximum number of connections (${this.MAX_CONNECTIONS}) reached`);
    }

    if (this.connections.has(config.id)) {
      throw new Error(`Server ${config.id} is already connected`);
    }

    console.log(`Connecting to MCP server: ${config.name} (${config.id})`);

    try {
      // Update status to connecting
      const status: ConnectionStatus = {
        serverId: config.id,
        status: 'connecting'
      };
      this.emit('statusChange', status);

      // Load MCP SDK dynamically
      const { Client } = await loadMcpSdk();
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');

      // Create transport and client
      const env = { ...process.env } as Record<string, string>;
      if (config.env) {
        Object.assign(env, config.env);
      }
      
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env
      });

      const client = new Client({
        name: 'nexus-mvp',
        version: '0.1.0'
      }, {
        capabilities: {
          tools: {},
          resources: {}
        }
      });

      // Connect the client
      await client.connect(transport);

      // List available tools
      const result = await client.listTools();
      console.log(`MCP server initialized: ${config.name}`, result);

      // Discover tools
      const tools = await this.discoverTools(client, config.id);

      // Store connection info
      const connectionInfo = {
        client,
        transport,
        config,
        status: {
          serverId: config.id,
          status: 'connected' as const,
          lastConnected: new Date(),
          tools
        },
        reconnectAttempts: 0
      };

      this.connections.set(config.id, connectionInfo);

      // Start health monitoring
      this.startHealthCheck(config.id);

      // Emit connected status
      this.emit('statusChange', connectionInfo.status);

      console.log(`Successfully connected to MCP server: ${config.name}`);

    } catch (error) {
      console.error(`Failed to connect to MCP server ${config.name}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.handleConnectionError(config.id, errorMessage);
      throw error;
    }
  }

  async disconnectFromServer(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      console.warn(`Attempted to disconnect non-existent server: ${serverId}`);
      return;
    }

    console.log(`Disconnecting from MCP server: ${connection.config.name}`);

    try {
      // Stop health check
      if (connection.healthCheckInterval) {
        clearInterval(connection.healthCheckInterval);
      }

      // Close client connection
      await connection.client.close();

      // Remove from connections
      this.connections.delete(serverId);

      // Emit disconnected status
      const status: ConnectionStatus = {
        serverId,
        status: 'disconnected'
      };
      this.emit('statusChange', status);

      console.log(`Successfully disconnected from MCP server: ${connection.config.name}`);

    } catch (error) {
      console.error(`Error disconnecting from server ${serverId}:`, error);
      // Still remove from connections even if there was an error
      this.connections.delete(serverId);
    }
  }

  async executeTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`Server ${serverId} is not connected`);
    }

    if (connection.status.status !== 'connected') {
      throw new Error(`Server ${serverId} is not in connected state`);
    }

    try {
      console.log(`Executing tool ${toolName} on server ${serverId}`, { args });

      const result = await connection.client.callTool({
        name: toolName,
        arguments: args
      });

      console.log(`Tool execution completed for ${toolName}`, { result });
      return result;

    } catch (error) {
      console.error(`Tool execution failed for ${toolName} on ${serverId}:`, error);
      throw error;
    }
  }

  getConnectionStatus(serverId: string): ConnectionStatus | null {
    const connection = this.connections.get(serverId);
    return connection ? connection.status : null;
  }

  getAllConnections(): ConnectionStatus[] {
    return Array.from(this.connections.values()).map(conn => conn.status);
  }

  getAvailableTools(serverId: string): McpTool[] {
    const connection = this.connections.get(serverId);
    return connection?.status.tools || [];
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map(serverId =>
      this.disconnectFromServer(serverId)
    );
    await Promise.all(disconnectPromises);
  }

  private async discoverTools(client: any, serverId: string): Promise<McpTool[]> {
    try {
      const toolsList = await client.listTools();
      
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

  private startHealthCheck(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    connection.healthCheckInterval = setInterval(async () => {
      try {
        // Simple ping to check if connection is alive
        await connection.client.ping();
        
        // Reset reconnect attempts on successful health check
        connection.reconnectAttempts = 0;

      } catch (error) {
        console.warn(`Health check failed for server ${serverId}:`, error);
        this.handleConnectionError(serverId, 'Health check failed');
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private handleConnectionError(serverId: string, errorMessage: string): void {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    // Update status to error
    connection.status = {
      ...connection.status,
      status: 'error',
      error: errorMessage
    };

    this.emit('statusChange', connection.status);

    // Attempt reconnection if enabled and under max attempts
    if (connection.config.autoStart && connection.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      connection.reconnectAttempts++;
      
      console.log(`Attempting reconnection ${connection.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} for server ${serverId}`);
      
      setTimeout(async () => {
        try {
          // Remove the failed connection
          this.connections.delete(serverId);
          
          // Attempt to reconnect
          await this.connectToServer(connection.config);
          
        } catch (error) {
          console.error(`Reconnection attempt failed for server ${serverId}:`, error);
        }
      }, this.RECONNECT_DELAY);
    }
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager(); 