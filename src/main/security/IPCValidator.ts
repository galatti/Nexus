import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { IPCLogger } from './IPCLogger.js';
import { SecurityMonitor } from './SecurityMonitor.js';

/**
 * Comprehensive IPC validation and security wrapper
 */
export class IPCValidator {
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_ARRAY_LENGTH = 1000;
  private static readonly MAX_OBJECT_DEPTH = 10;

  /**
   * Wrap an existing IPC handler with validation and security
   */
  static wrapHandler<T extends any[], R>(
    channel: string,
    originalHandler: (event: any, ...args: T) => R | Promise<R>,
    schema?: z.ZodSchema,
    rateLimitPerMinute: number = 60
  ) {
    return async (event: any, ...args: T): Promise<R> => {
      try {
        // Log the call
        IPCLogger.logCall(channel, args, event);

        // Rate limiting check
        if (IPCLogger.isRateLimited(channel, rateLimitPerMinute)) {
          SecurityMonitor.getInstance().logSecurityIncident(
            'rate_limit_exceeded',
            channel,
            { rateLimitPerMinute, currentCalls: IPCLogger.getStats().find(s => s.channel === channel)?.recentCalls }
          );
          throw new Error(`Rate limit exceeded for ${channel}`);
        }

        // Basic security validation
        this.validateBasicSecurity(args, channel);

        // Schema validation if provided
        if (schema) {
          try {
            schema.parse(args);
          } catch (schemaError) {
            SecurityMonitor.getInstance().logSecurityIncident(
              'validation_failed',
              channel,
              { error: schemaError, args: this.sanitizeArgsForLogging(args) }
            );
            throw schemaError;
          }
        }

        // Call original handler
        return await originalHandler(event, ...args);

      } catch (error) {
        logger.error(`IPC validation failed for ${channel}:`, error);
        throw error;
      }
    };
  }

  /**
   * Basic security validation for all IPC calls
   */
  private static validateBasicSecurity(args: any[], channel: string): void {
    for (const arg of args) {
      this.validateValue(arg, 0, channel);
    }
  }

  /**
   * Determine if command injection checks should be applied based on context
   */
  private static shouldCheckForCommandInjection(channel: string, value: string): boolean {
    // Skip command injection checks for assistant responses and content that should contain code
    if (channel === 'llm:sendMessage') {
      // Check if this looks like assistant response content (contains code blocks, long text, etc.)
      if (value.includes('```') || value.includes('def ') || value.includes('function ') || 
          value.includes('import ') || value.includes('print(') || value.length > 500) {
        return false;
      }
    }
    
    // Skip for settings and configuration where technical content is expected
    if (channel.includes('settings') || channel.includes('config')) {
      return false;
    }
    
    // Apply checks for potentially dangerous channels
    if (channel.includes('execute') || channel.includes('run') || channel.includes('shell') || 
        channel.includes('command') || channel.includes('process')) {
      return true;
    }
    
    // Default to checking for short strings that could be commands
    return value.length < 100;
  }

  /**
   * Recursively validate a value for security issues
   */
  private static validateValue(value: any, depth: number, channel: string): void {
    // Prevent stack overflow
    if (depth > this.MAX_OBJECT_DEPTH) {
      throw new Error('Object depth limit exceeded');
    }

    if (typeof value === 'string') {
      // String length validation
      if (value.length > this.MAX_STRING_LENGTH) {
        throw new Error('String length limit exceeded');
      }

      // Path traversal prevention
      if (value.includes('../') || value.includes('..\\')) {
        SecurityMonitor.getInstance().logSecurityIncident(
          'path_traversal',
          channel,
          { attemptedPath: value }
        );
        throw new Error('Path traversal attempt detected');
      }

      // Command injection prevention - but exclude legitimate assistant responses
      // Only check for command injection in potentially dangerous contexts
      if (this.shouldCheckForCommandInjection(channel, value)) {
        if (/^[\s]*[;&|]+|[;&|]+[\s]*$|^\$\(|\$\{/.test(value)) {
          SecurityMonitor.getInstance().logSecurityIncident(
            'injection_attempt',
            channel,
            { attemptedCommand: value, type: 'command_injection' }
          );
          throw new Error('Potential command injection detected');
        }
      }

      // Script injection prevention
      if (/<script|javascript:|data:/.test(value.toLowerCase())) {
        SecurityMonitor.getInstance().logSecurityIncident(
          'injection_attempt',
          channel,
          { attemptedScript: value, type: 'script_injection' }
        );
        throw new Error('Potential script injection detected');
      }
    }

    if (Array.isArray(value)) {
      if (value.length > this.MAX_ARRAY_LENGTH) {
        throw new Error('Array length limit exceeded');
      }
      
      for (const item of value) {
        this.validateValue(item, depth + 1, channel);
      }
    }

    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value);
      if (keys.length > this.MAX_ARRAY_LENGTH) {
        throw new Error('Object key count limit exceeded');
      }

      for (const key of keys) {
        this.validateValue(key, depth + 1, channel);
        this.validateValue(value[key], depth + 1, channel);
      }
    }
  }

  /**
   * Create schemas for common validation patterns
   */
  static createSchemas() {
    return {
      // Basic types
      string: z.string().max(this.MAX_STRING_LENGTH),
      number: z.number().finite(),
      boolean: z.boolean(),
      
      // File path validation
      filePath: z.string().max(1000).refine(
        (path) => !path.includes('../') && !path.includes('..\\'),
        'Invalid file path'
      ),
      
      // Settings validation
      settings: z.object({
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
      }),

      // Provider configuration
      provider: z.object({
        id: z.string(),
        type: z.string(),
        name: z.string(),
        enabled: z.boolean().optional(),
        apiKey: z.string().optional(),
        url: z.string().url().optional(),
        model: z.string().optional()
      }),

      // MCP server config
      mcpServer: z.object({
        id: z.string(),
        name: z.string(),
        command: z.string(),
        args: z.array(z.string()).optional(),
        env: z.record(z.string()).optional(),
        enabled: z.boolean().optional()
      })
    };
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  private static sanitizeArgsForLogging(args: any[]): any[] {
    return args.map(arg => {
      if (typeof arg === 'string') {
        // Hide potential API keys or sensitive strings
        if (arg.length > 20 && /[A-Za-z0-9_-]{20,}/.test(arg)) {
          return `[REDACTED_${arg.length}]`;
        }
      }
      
      if (typeof arg === 'object' && arg !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(arg)) {
          if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
            sanitized[key] = '[REDACTED]';
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      }
      
      return arg;
    });
  }
}