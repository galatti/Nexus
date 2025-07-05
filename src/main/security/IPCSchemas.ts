import { z } from 'zod';

/**
 * Zod schemas for IPC channel validation
 */
export const IPCSchemas = {
  // Common schemas
  common: {
    string: z.string().max(10000),
    number: z.number().finite(),
    boolean: z.boolean(),
    providerId: z.string().min(1).max(100),
    filePath: z.string().max(1000).refine(
      (path) => !path.includes('../') && !path.includes('..\\'),
      'Invalid file path'
    )
  },

  // Settings operations
  'settings:get': z.tuple([]),
  'settings:save': z.tuple([
    z.object({
      general: z.object({
        theme: z.enum(['light', 'dark', 'system']).optional(),
        autoStart: z.boolean().optional(),
        minimizeToTray: z.boolean().optional(),
        language: z.string().optional()
      }).optional(),
      llm: z.object({
        providers: z.array(z.any()).optional(),
        defaultProviderModel: z.object({
          providerId: z.string(),
          modelName: z.string()
        }).optional(),
        systemPrompt: z.string().optional()
      }).optional(),
      mcp: z.object({
        servers: z.array(z.any()).optional()
      }).optional()
    })
  ]),

  // Secure storage operations
  'secure-storage:getProviderApiKey': z.tuple([z.string().min(1).max(100)]),
  'secure-storage:setProviderApiKey': z.tuple([
    z.string().min(1).max(100),
    z.string().max(1000)
  ]),
  'secure-storage:getSecurityStatus': z.tuple([]),
  'secure-storage:isAvailable': z.tuple([]),

  // Provider operations
  'providers:add': z.tuple([
    z.object({
      id: z.string().min(1).max(100),
      type: z.string().min(1).max(50),
      name: z.string().min(1).max(200),
      enabled: z.boolean().optional(),
      apiKey: z.string().optional(),
      url: z.string().url().optional(),
      model: z.string().optional()
    })
  ]),
  'providers:remove': z.tuple([z.string().min(1).max(100)]),
  'providers:update': z.tuple([
    z.string().min(1).max(100),
    z.object({
      enabled: z.boolean().optional(),
      apiKey: z.string().optional(),
      url: z.string().url().optional(),
      model: z.string().optional()
    })
  ]),
  'providers:list': z.tuple([]),
  'providers:getModels': z.tuple([z.string().min(1).max(100)]),

  // LLM operations
  'llm:chat': z.tuple([
    z.object({
      messages: z.array(z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().max(50000)
      })).max(100),
      providerId: z.string().min(1).max(100),
      modelName: z.string().min(1).max(200),
      options: z.object({
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().min(1).max(10000).optional(),
        stream: z.boolean().optional()
      }).optional()
    })
  ]),
  'llm:getStatus': z.tuple([]),
  'llm:testProvider': z.tuple([z.string().min(1).max(100)]),

  // MCP operations  
  'mcp:listServers': z.tuple([]),
  'mcp:addServer': z.tuple([
    z.object({
      id: z.string().min(1).max(100),
      name: z.string().min(1).max(200),
      command: z.string().min(1).max(1000),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      enabled: z.boolean().optional()
    })
  ]),
  'mcp:removeServer': z.tuple([z.string().min(1).max(100)]),
  'mcp:updateServer': z.tuple([
    z.string().min(1).max(100),
    z.object({
      name: z.string().min(1).max(200).optional(),
      command: z.string().min(1).max(1000).optional(),
      args: z.array(z.string()).optional(),
      env: z.record(z.string()).optional(),
      enabled: z.boolean().optional()
    })
  ]),
  'mcp:startServer': z.tuple([z.string().min(1).max(100)]),
  'mcp:stopServer': z.tuple([z.string().min(1).max(100)]),
  'mcp:getServerStatus': z.tuple([z.string().min(1).max(100)]),

  // Window operations
  'window:minimize': z.tuple([]),
  'window:maximize': z.tuple([]),
  'window:close': z.tuple([]),

  // App operations
  'app:getVersion': z.tuple([]),
  'app:quit': z.tuple([]),
  'app:reportRendererError': z.tuple([
    z.object({
      errorId: z.string().min(1).max(100),
      name: z.string().max(200),
      message: z.string().max(5000),
      stack: z.string().max(10000).optional(),
      componentStack: z.string().max(10000).optional(),
      boundaryName: z.string().max(100).optional(),
      timestamp: z.string().max(50),
      userAgent: z.string().max(500).optional(),
      url: z.string().max(1000).optional()
    })
  ]),

  // File operations
  'file:openDialog': z.tuple([
    z.object({
      filters: z.array(z.object({
        name: z.string(),
        extensions: z.array(z.string())
      })).optional(),
      properties: z.array(z.string()).optional()
    }).optional()
  ]),
  'file:saveDialog': z.tuple([
    z.object({
      defaultPath: z.string().optional(),
      filters: z.array(z.object({
        name: z.string(),
        extensions: z.array(z.string())
      })).optional()
    }).optional()
  ])
};

export type IPCChannels = keyof typeof IPCSchemas;