import { EventEmitter } from 'events';
import { McpServerConfig, McpTool } from '../../shared/types.js';
import { logger } from '../utils/logger.js';

export interface ToolPermission {
  serverId: string;
  toolName: string;
  permission: 'allow' | 'deny' | 'ask';
  scope?: 'once' | 'session' | 'always';
  expiresAt?: Date;
  grantedAt?: Date;
  riskLevel: 'low' | 'medium' | 'high';
  // Security improvements
  allowedPaths?: string[];     // For file operations
  allowedDomains?: string[];   // For web operations
  argumentPattern?: string;    // Hash of approved argument pattern
  usageCount?: number;         // Track how many times used
  lastUsed?: Date;            // Track last usage
}

export interface PendingApproval {
  id: string;
  serverId: string;
  serverName: string;
  toolName: string;
  toolDescription: string;
  args: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
  riskReasons: string[];
  requestedAt: Date;
  resolve: (result: ApprovalResult) => void;
  timeout?: NodeJS.Timeout;
}

export interface ApprovalResult {
  approved: boolean;
  scope?: 'once' | 'session' | 'always';
  reason?: string;
}

export interface PermissionSettings {
  autoApproveLevel: 'none' | 'low' | 'medium' | 'high';
  requestTimeout: number; // seconds
  requireApprovalForFileAccess: boolean;
  requireApprovalForNetworkAccess: boolean;
  requireApprovalForSystemCommands: boolean;
  trustedServers: string[];
  // Security improvements
  alwaysPermissionDuration: number; // days (default 7 instead of 30)
  enableArgumentValidation: boolean;
  enablePermissionExpireNotifications: boolean;
  maxSessionPermissions: number; // Limit number of session permissions
}

export class PermissionManager extends EventEmitter {
  private permissions = new Map<string, ToolPermission>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private settings: PermissionSettings;
  private sessionPermissions = new Set<string>();
  private expirationTimeouts = new Set<NodeJS.Timeout>();

  constructor() {
    super();
    this.setMaxListeners(50);
    
    this.settings = {
      autoApproveLevel: 'none', // Require approval for all operations to show permission UI
      requestTimeout: 30,
      requireApprovalForFileAccess: true, // Require approval for file access to show permission UI
      requireApprovalForNetworkAccess: true,
      requireApprovalForSystemCommands: true,
      trustedServers: [],
      // Security improvements
      alwaysPermissionDuration: 0, // An 'always' permission should persist indefinitely (0 = no expiry)
      enableArgumentValidation: true,
      enablePermissionExpireNotifications: true,
      maxSessionPermissions: 50 // Reasonable limit
    };
  }

  async requestPermission(
    serverConfig: McpServerConfig,
    tool: McpTool,
    args: Record<string, unknown>
  ): Promise<boolean> {
    const permissionKey = this.getPermissionKey(serverConfig.id, tool.name);
    const existingPermission = this.permissions.get(permissionKey);
    
    // Check existing permissions
    if (existingPermission) {
      if (existingPermission.permission === 'allow') {
        // Check if permission is still valid
        if (this.isPermissionValid(existingPermission, args)) {
          // Update usage statistics
          existingPermission.usageCount = (existingPermission.usageCount || 0) + 1;
          existingPermission.lastUsed = new Date();
          
          logger.info(`Tool execution approved by existing permission: ${tool.name} (used ${existingPermission.usageCount} times)`);
          return true;
        } else {
          // Permission expired or invalid arguments, remove it
          this.permissions.delete(permissionKey);
          logger.info(`Removed invalid/expired permission: ${tool.name}`);
        }
      } else if (existingPermission.permission === 'deny') {
        logger.info(`Tool execution denied by existing permission: ${tool.name}`);
        return false;
      }
    }

    // Check for existing session permission
    const argsHash = this.hashArguments(args);
    const sessionKeySpecific = this.getSessionKey(serverConfig.id, tool.name, argsHash);
    const sessionKeyBase = this.getSessionKey(serverConfig.id, tool.name);

    if (this.sessionPermissions.has(sessionKeySpecific) || this.sessionPermissions.has(sessionKeyBase)) {
      logger.info(`Tool execution approved by session permission: ${tool.name}`);
      return true;
    }

    // Assess risk level
    const riskAssessment = this.assessRisk(serverConfig, tool, args);
    
    // Check if auto-approval applies
    if (this.shouldAutoApprove(serverConfig, riskAssessment)) {
      logger.info(`Tool execution auto-approved: ${tool.name} (${riskAssessment.level} risk)`);
      
      // Store the auto-approval as a session permission
      this.sessionPermissions.add(permissionKey);
      
      return true;
    }

    // Request user approval
    return this.requestUserApproval(serverConfig, tool, args, riskAssessment);
  }

  private async requestUserApproval(
    serverConfig: McpServerConfig,
    tool: McpTool,
    args: Record<string, unknown>,
    riskAssessment: { level: 'low' | 'medium' | 'high'; reasons: string[] }
  ): Promise<boolean> {
    const approvalId = `${serverConfig.id}-${tool.name}-${Date.now()}`;
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(approvalId);
        logger.warn(`Permission request timed out: ${tool.name}`);
        resolve(false);
      }, this.settings.requestTimeout * 1000);

      const pendingApproval: PendingApproval = {
        id: approvalId,
        serverId: serverConfig.id,
        serverName: serverConfig.name,
        toolName: tool.name,
        toolDescription: tool.description,
        args,
        riskLevel: riskAssessment.level,
        riskReasons: riskAssessment.reasons,
        requestedAt: new Date(),
        timeout,
        resolve: (result: ApprovalResult) => {
          clearTimeout(timeout);
          this.pendingApprovals.delete(approvalId);
          
          if (result.approved) {
            // Store permission based on scope
            if (result.scope && result.scope !== 'once') {
              this.storePermission(serverConfig.id, tool.name, result.scope, riskAssessment.level, args);
            }
          }
          
          logger.info(`Permission request resolved: ${tool.name} - ${result.approved ? 'approved' : 'denied'}`);
          resolve(result.approved);
        }
      };

      this.pendingApprovals.set(approvalId, pendingApproval);
      
      // Emit permission request event for UI
      this.emit('permissionRequest', pendingApproval);
    });
  }

  respondToApproval(approvalId: string, result: ApprovalResult): boolean {
    const pending = this.pendingApprovals.get(approvalId);
    if (!pending) {
      logger.warn(`Approval request not found: ${approvalId}`);
      return false;
    }

    pending.resolve(result);
    return true;
  }

  private shouldAutoApprove(
    serverConfig: McpServerConfig,
    riskAssessment: { level: 'low' | 'medium' | 'high'; reasons: string[] }
  ): boolean {
    // Check if server is trusted
    if (this.settings.trustedServers.includes(serverConfig.id)) {
      return true;
    }

    // Check auto-approval level
    const riskLevels = ['none', 'low', 'medium', 'high'];
    const autoApproveIndex = riskLevels.indexOf(this.settings.autoApproveLevel);
    const riskIndex = riskLevels.indexOf(riskAssessment.level);
    
    return autoApproveIndex >= riskIndex && autoApproveIndex > 0;
  }

  private assessRisk(
    serverConfig: McpServerConfig,
    tool: McpTool,
    args: Record<string, unknown>
  ): { level: 'low' | 'medium' | 'high'; reasons: string[] } {
    const reasons: string[] = [];
    let riskScore = 0;

    // Risk factors based on tool name and arguments
    const toolName = tool.name.toLowerCase();
    const description = tool.description.toLowerCase();
    const argStrings = JSON.stringify(args).toLowerCase();

    // File system operations
    if (toolName.includes('file') || toolName.includes('read') || toolName.includes('write') ||
        description.includes('file') || argStrings.includes('path')) {
      if (this.settings.requireApprovalForFileAccess) {
        riskScore += 2;
        reasons.push('File system access');
      } else {
        riskScore += 1;
      }
    }

    // Network operations
    if (toolName.includes('fetch') || toolName.includes('request') || toolName.includes('search') ||
        description.includes('network') || description.includes('http') || argStrings.includes('url')) {
      if (this.settings.requireApprovalForNetworkAccess) {
        riskScore += 2;
        reasons.push('Network access');
      } else {
        riskScore += 1;
      }
    }

    // System commands
    if (toolName.includes('exec') || toolName.includes('command') || toolName.includes('shell') ||
        description.includes('execute') || description.includes('command')) {
      if (this.settings.requireApprovalForSystemCommands) {
        riskScore += 3;
        reasons.push('System command execution');
      } else {
        riskScore += 2;
      }
    }

    // Data modification operations
    if (toolName.includes('delete') || toolName.includes('remove') || toolName.includes('modify') ||
        toolName.includes('update') || description.includes('delete') || description.includes('modify')) {
      riskScore += 2;
      reasons.push('Data modification');
    }

    // Sensitive data access
    if (argStrings.includes('password') || argStrings.includes('token') || argStrings.includes('key') ||
        argStrings.includes('secret')) {
      riskScore += 3;
      reasons.push('Sensitive data access');
    }

    // Determine risk level
    let level: 'low' | 'medium' | 'high';
    if (riskScore >= 4) {
      level = 'high';
    } else if (riskScore >= 2) {
      level = 'medium';
    } else {
      level = 'low';
    }

    if (reasons.length === 0) {
      reasons.push('General tool execution');
    }

    return { level, reasons };
  }

  private storePermission(
    serverId: string,
    toolName: string,
    scope: 'session' | 'always',
    riskLevel: 'low' | 'medium' | 'high',
    args?: Record<string, unknown>
  ): void {
    const permissionKey = this.getPermissionKey(serverId, toolName);
    
    const permission: ToolPermission = {
      serverId,
      toolName,
      permission: 'allow',
      scope,
      riskLevel,
      grantedAt: new Date(),
      usageCount: 0,
      lastUsed: new Date()
    };

    // Extract security context from arguments
    if (args && this.settings.enableArgumentValidation) {
      permission.argumentPattern = this.hashArguments(args);
      
      // Extract allowed paths for file operations
      if (args.path && typeof args.path === 'string') {
        permission.allowedPaths = [args.path];
      }
      
      // Extract allowed domains for web operations
      if (args.url && typeof args.url === 'string') {
        try {
          const url = new URL(args.url);
          permission.allowedDomains = [url.hostname];
        } catch {
          // Invalid URL, no domain restriction
        }
      }
    }

    if (scope === 'session') {
      // Check session permission limits
      if (this.sessionPermissions.size >= this.settings.maxSessionPermissions) {
        logger.warn(`Session permission limit reached (${this.settings.maxSessionPermissions}), clearing oldest`);
        this.clearOldestSessionPermission();
      }
      
      const sessionKey = args 
        ? this.getSessionKey(serverId, toolName, this.hashArguments(args))
        : this.getSessionKey(serverId, toolName);
      
      this.sessionPermissions.add(sessionKey);
    } else {
      // For 'always' scope, respect configurable duration; 0 means no expiry
      if (this.settings.alwaysPermissionDuration > 0) {
        const durationMs = this.settings.alwaysPermissionDuration * 24 * 60 * 60 * 1000;
        permission.expiresAt = new Date(Date.now() + durationMs);
      }

      this.permissions.set(permissionKey, permission);

      // Schedule expiration notification only when expiry is set
      if (permission.expiresAt && this.settings.enablePermissionExpireNotifications) {
        this.scheduleExpirationNotification(permission);
      }
    }

    logger.info(`Permission stored: ${toolName} (${scope}) for server ${serverId}${args ? ' with argument validation' : ''}`);
  }

  private isPermissionValid(permission: ToolPermission, args?: Record<string, unknown>): boolean {
    if (permission.scope === 'session') {
      // Check session permissions with server-specific keys
      const argsHash = args ? this.hashArguments(args) : undefined;
      const sessionKey = this.getSessionKey(permission.serverId, permission.toolName, argsHash);
      const baseSessionKey = this.getSessionKey(permission.serverId, permission.toolName);
      
      // Allow both specific argument pattern and general tool permission
      return this.sessionPermissions.has(sessionKey) || this.sessionPermissions.has(baseSessionKey);
    }

    if (permission.expiresAt && permission.expiresAt < new Date()) {
      return false;
    }

    // Validate arguments against stored permission
    if (args && !this.validateArguments(permission, args)) {
      return false;
    }

    return true;
  }

  private getPermissionKey(serverId: string, toolName: string): string {
    return `${serverId}:${toolName}`;
  }

  private getSessionKey(serverId: string, toolName: string, argsHash?: string): string {
    // More specific session keys to prevent cross-server permission sharing
    const baseKey = `session:${serverId}:${toolName}`;
    return argsHash ? `${baseKey}:${argsHash}` : baseKey;
  }

  private hashArguments(args: Record<string, unknown>): string {
    // Create a simple hash of arguments for pattern matching
    try {
      const sortedArgs = JSON.stringify(args, Object.keys(args).sort());
      return Buffer.from(sortedArgs).toString('base64').substring(0, 16);
    } catch {
      return 'unknown';
    }
  }

  // Public API methods
  getPendingApprovals(): PendingApproval[] {
    return Array.from(this.pendingApprovals.values());
  }

  getAllPermissions(): ToolPermission[] {
    return Array.from(this.permissions.values());
  }

  revokePermission(serverId: string, toolName: string): boolean {
    const permissionKey = this.getPermissionKey(serverId, toolName);
    const removed = this.permissions.delete(permissionKey);
    this.sessionPermissions.delete(permissionKey);
    
    if (removed) {
      logger.info(`Permission revoked: ${toolName}`);
      this.emit('permissionRevoked', { serverId, toolName });
    }
    
    return removed;
  }

  clearSessionPermissions(): void {
    this.sessionPermissions.clear();
    logger.info('Session permissions cleared');
    this.emit('sessionPermissionsCleared');
  }

  updateSettings(newSettings: Partial<PermissionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    logger.info('Permission settings updated');
    this.emit('settingsUpdated', this.settings);
  }

  getSettings(): PermissionSettings {
    return { ...this.settings };
  }

  addTrustedServer(serverId: string): void {
    if (!this.settings.trustedServers.includes(serverId)) {
      this.settings.trustedServers.push(serverId);
      logger.info(`Server added to trusted list: ${serverId}`);
      this.emit('trustedServerAdded', serverId);
    }
  }

  removeTrustedServer(serverId: string): void {
    this.settings.trustedServers = this.settings.trustedServers.filter(id => id !== serverId);
    this.emit('settingsChanged', this.settings);
  }

  clearExpiredPermissions(): number {
    const now = new Date();
    let clearedCount = 0;
    
    // Remove expired permissions
    for (const [key, permission] of this.permissions.entries()) {
      if (permission.expiresAt && permission.expiresAt < now) {
        this.permissions.delete(key);
        clearedCount++;
        logger.info(`Cleared expired permission: ${permission.toolName} for ${permission.serverId}`);
      }
    }
    
    if (clearedCount > 0) {
      this.emit('expiredPermissionsCleared', clearedCount);
    }
    
    return clearedCount;
  }

  clearAllPermissions(): void {
    this.permissions.clear();
    this.sessionPermissions.clear();
    this.emit('permissionsChanged');
  }

  private clearOldestSessionPermission(): void {
    // Remove the first (oldest) session permission
    const firstKey = this.sessionPermissions.values().next().value;
    if (firstKey) {
      this.sessionPermissions.delete(firstKey);
      logger.info(`Removed oldest session permission: ${firstKey}`);
    }
  }

  private scheduleExpirationNotification(permission: ToolPermission): void {
    if (!permission.expiresAt) return;
    
    const timeUntilExpiration = permission.expiresAt.getTime() - Date.now();
    const oneDayBeforeExpiration = timeUntilExpiration - (24 * 60 * 60 * 1000);
    
    if (oneDayBeforeExpiration > 0) {
      const timeoutId = setTimeout(() => {
        this.expirationTimeouts.delete(timeoutId);
        logger.warn(`Permission expiring soon: ${permission.toolName} for server ${permission.serverId}`);
        this.emit('permissionExpiringSoon', permission);
      }, oneDayBeforeExpiration);
      
      this.expirationTimeouts.add(timeoutId);
    }
  }

  // Security improvement: Validate arguments against stored permission
  private validateArguments(permission: ToolPermission, args: Record<string, unknown>): boolean {
    if (!this.settings.enableArgumentValidation || !permission.argumentPattern) {
      return true; // No validation required
    }

    const argsHash = this.hashArguments(args);
    if (permission.argumentPattern !== argsHash) {
      logger.warn(`Argument pattern mismatch for ${permission.toolName}: expected ${permission.argumentPattern}, got ${argsHash}`);
      return false;
    }

    // Validate allowed paths
    if (permission.allowedPaths && args.path) {
      const requestedPath = String(args.path);
      const isAllowed = permission.allowedPaths.some(allowedPath => 
        requestedPath.startsWith(allowedPath)
      );
      if (!isAllowed) {
        logger.warn(`Path not allowed: ${requestedPath} (allowed: ${permission.allowedPaths.join(', ')})`);
        return false;
      }
    }

    // Validate allowed domains
    if (permission.allowedDomains && args.url) {
      try {
        const url = new URL(String(args.url));
        const isAllowed = permission.allowedDomains.includes(url.hostname);
        if (!isAllowed) {
          logger.warn(`Domain not allowed: ${url.hostname} (allowed: ${permission.allowedDomains.join(', ')})`);
          return false;
        }
      } catch {
        logger.warn(`Invalid URL in arguments: ${args.url}`);
        return false;
      }
    }

    return true;
  }

  // Get permission usage statistics
  getPermissionStats(): { total: number; session: number; expired: number; expiringSoon: number } {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    let expired = 0;
    let expiringSoon = 0;
    
    for (const permission of this.permissions.values()) {
      if (permission.expiresAt && permission.expiresAt < now) {
        expired++;
      } else if (permission.expiresAt && permission.expiresAt < oneDayFromNow) {
        expiringSoon++;
      }
    }
    
    return {
      total: this.permissions.size,
      session: this.sessionPermissions.size,
      expired,
      expiringSoon
    };
  }

  shutdown(): void {
    logger.info('Shutting down PermissionManager');
    
    // Clear all pending approval timeouts
    for (const [approvalId, pending] of this.pendingApprovals.entries()) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      // Reject pending approvals
      pending.resolve({ approved: false, reason: 'Application shutdown' });
    }
    this.pendingApprovals.clear();
    
    // Clear all expiration notification timeouts
    for (const timeoutId of this.expirationTimeouts) {
      clearTimeout(timeoutId);
    }
    this.expirationTimeouts.clear();
    
    // Clear all permissions and session data
    this.clearAllPermissions();
    
    // Remove all event listeners
    this.removeAllListeners();
    
    logger.info('PermissionManager shutdown complete');
  }
}

// Singleton instance
export const permissionManager = new PermissionManager(); 