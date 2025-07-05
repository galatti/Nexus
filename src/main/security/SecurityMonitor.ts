import { logger } from '../utils/logger.js';
import { IPCLogger } from './IPCLogger.js';

/**
 * Security monitoring and alerting system
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private alertCounts = new Map<string, number>();
  private lastAlertTime = new Map<string, number>();
  private readonly ALERT_COOLDOWN = 60000; // 1 minute

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * Log a security incident
   */
  logSecurityIncident(
    type: 'validation_failed' | 'rate_limit_exceeded' | 'injection_attempt' | 'path_traversal' | 'suspicious_activity',
    channel: string,
    details: any
  ): void {
    const now = Date.now();
    const alertKey = `${type}:${channel}`;
    
    // Check if we should throttle this alert
    const lastAlert = this.lastAlertTime.get(alertKey) || 0;
    if (now - lastAlert < this.ALERT_COOLDOWN) {
      return; // Skip duplicate alerts within cooldown period
    }

    // Update alert tracking
    const count = this.alertCounts.get(alertKey) || 0;
    this.alertCounts.set(alertKey, count + 1);
    this.lastAlertTime.set(alertKey, now);

    // Log the security incident
    logger.error(`SECURITY INCIDENT: ${type}`, {
      type,
      channel,
      details,
      incidentCount: count + 1,
      timestamp: new Date().toISOString()
    });

    // Additional monitoring based on type
    switch (type) {
      case 'rate_limit_exceeded':
        this.handleRateLimitIncident(channel, details);
        break;
      case 'injection_attempt':
        this.handleInjectionAttempt(channel, details);
        break;
      case 'path_traversal':
        this.handlePathTraversalAttempt(channel, details);
        break;
    }
  }

  /**
   * Handle rate limiting incidents
   */
  private handleRateLimitIncident(channel: string, _details: any): void {
    const stats = IPCLogger.getStats();
    const channelStats = stats.find(s => s.channel === channel);
    
    if (channelStats && channelStats.recentCalls > 100) {
      logger.warn(`High frequency IPC calls detected on ${channel}`, {
        recentCalls: channelStats.recentCalls,
        totalCalls: channelStats.calls
      });
    }
  }

  /**
   * Handle injection attempt incidents
   */
  private handleInjectionAttempt(channel: string, details: any): void {
    logger.error(`Potential injection attack on ${channel}`, {
      details: this.sanitizeForLogging(details),
      channel,
      severity: 'HIGH'
    });
  }

  /**
   * Handle path traversal attempt incidents
   */
  private handlePathTraversalAttempt(channel: string, details: any): void {
    logger.error(`Path traversal attempt on ${channel}`, {
      details: this.sanitizeForLogging(details),
      channel,
      severity: 'HIGH'
    });
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    totalIncidents: number;
    incidentsByType: Record<string, number>;
    incidentsByChannel: Record<string, number>;
    recentActivity: { channel: string; calls: number; recentCalls: number }[];
  } {
    const incidentsByType: Record<string, number> = {};
    const incidentsByChannel: Record<string, number> = {};
    let totalIncidents = 0;

    for (const [alertKey, count] of this.alertCounts.entries()) {
      const [type, channel] = alertKey.split(':');
      totalIncidents += count;
      incidentsByType[type] = (incidentsByType[type] || 0) + count;
      incidentsByChannel[channel] = (incidentsByChannel[channel] || 0) + count;
    }

    return {
      totalIncidents,
      incidentsByType,
      incidentsByChannel,
      recentActivity: IPCLogger.getStats()
    };
  }

  /**
   * Check for suspicious patterns
   */
  checkSuspiciousActivity(): void {
    const stats = IPCLogger.getStats();

    for (const stat of stats) {
      // Check for unusual call patterns
      if (stat.recentCalls > 50) {
        this.logSecurityIncident(
          'suspicious_activity',
          stat.channel,
          {
            recentCalls: stat.recentCalls,
            totalCalls: stat.calls,
            reason: 'High frequency calls'
          }
        );
      }
    }
  }

  /**
   * Sanitize sensitive data for logging
   */
  private sanitizeForLogging(data: any): any {
    if (typeof data === 'string') {
      // Hide potential secrets
      if (data.length > 20 && /[A-Za-z0-9_-]{20,}/.test(data)) {
        return `[REDACTED_${data.length}]`;
      }
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeForLogging(value);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Start periodic security monitoring
   */
  startMonitoring(): void {
    // Check for suspicious activity every 5 minutes
    setInterval(() => {
      this.checkSuspiciousActivity();
    }, 5 * 60 * 1000);

    logger.info('Security monitoring started');
  }
}