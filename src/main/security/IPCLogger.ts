import { logger } from '../utils/logger.js';

/**
 * IPC call logging and monitoring for security analysis
 */
export class IPCLogger {
  private static callCounts = new Map<string, number>();
  private static recentCalls = new Map<string, number[]>();

  /**
   * Log an IPC call with parameters for analysis
   */
  static logCall(channel: string, args: any[], _event?: any): void {
    // Increment call count
    const count = this.callCounts.get(channel) || 0;
    this.callCounts.set(channel, count + 1);

    // Track recent calls for rate limiting
    const now = Date.now();
    const recent = this.recentCalls.get(channel) || [];
    recent.push(now);
    
    // Keep only last 60 seconds
    const filtered = recent.filter(time => now - time < 60000);
    this.recentCalls.set(channel, filtered);

    // Log the call with sanitized parameters
    const sanitizedArgs = this.sanitizeArgs(args);
    logger.info(`IPC Call: ${channel}`, {
      channel,
      argCount: args.length,
      args: sanitizedArgs,
      callCount: count + 1,
      recentCalls: filtered.length
    });
  }

  /**
   * Check if a channel is being called too frequently
   */
  static isRateLimited(channel: string, maxCallsPerMinute: number = 60): boolean {
    const recent = this.recentCalls.get(channel) || [];
    return recent.length > maxCallsPerMinute;
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  private static sanitizeArgs(args: any[]): any[] {
    return args.map(arg => {
      if (typeof arg === 'string') {
        // Hide potential API keys or sensitive strings
        if (arg.length > 20 && /[A-Za-z0-9_-]{20,}/.test(arg)) {
          return `[REDACTED_${arg.length}]`;
        }
        // Hide file paths
        if (arg.includes('/') || arg.includes('\\')) {
          return `[PATH_${arg.split(/[/\\]/).pop()}]`;
        }
      }
      
      if (typeof arg === 'object' && arg !== null) {
        // Sanitize objects recursively
        const sanitized: any = {};
        for (const [key, value] of Object.entries(arg)) {
          if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
            sanitized[key] = '[REDACTED]';
          } else if (typeof value === 'string' && value.length > 20) {
            sanitized[key] = `[STRING_${value.length}]`;
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      }
      
      return arg;
    });
  }

  /**
   * Get statistics about IPC calls
   */
  static getStats(): { channel: string; calls: number; recentCalls: number }[] {
    const stats: { channel: string; calls: number; recentCalls: number }[] = [];
    
    for (const [channel, totalCalls] of this.callCounts.entries()) {
      const recent = this.recentCalls.get(channel) || [];
      stats.push({
        channel,
        calls: totalCalls,
        recentCalls: recent.length
      });
    }
    
    return stats.sort((a, b) => b.calls - a.calls);
  }
}