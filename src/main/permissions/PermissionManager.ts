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
}

export class PermissionManager extends EventEmitter {
  private permissions = new Map<string, ToolPermission>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private settings: PermissionSettings;
  private sessionPermissions = new Set<string>();

  constructor() {
    super();
    this.setMaxListeners(50);
    
    this.settings = {
      autoApproveLevel: 'none', // Require approval for all operations to show permission UI
      requestTimeout: 30,
      requireApprovalForFileAccess: true, // Require approval for file access to show permission UI
      requireApprovalForNetworkAccess: true,
      requireApprovalForSystemCommands: true,
      trustedServers: []
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
        if (this.isPermissionValid(existingPermission)) {
          logger.info(`Tool execution approved by existing permission: ${tool.name}`);
          return true;
        } else {
          // Permission expired, remove it
          this.permissions.delete(permissionKey);
        }
      } else if (existingPermission.permission === 'deny') {
        logger.info(`Tool execution denied by existing permission: ${tool.name}`);
        return false;
      }
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
              this.storePermission(serverConfig.id, tool.name, result.scope, riskAssessment.level);
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
    riskLevel: 'low' | 'medium' | 'high'
  ): void {
    const permissionKey = this.getPermissionKey(serverId, toolName);
    
    const permission: ToolPermission = {
      serverId,
      toolName,
      permission: 'allow',
      scope,
      riskLevel,
      grantedAt: new Date()
    };

    if (scope === 'session') {
      this.sessionPermissions.add(permissionKey);
    } else {
      // For 'always' scope, set expiration to 30 days
      permission.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      this.permissions.set(permissionKey, permission);
    }

    logger.info(`Permission stored: ${toolName} (${scope})`);
  }

  private isPermissionValid(permission: ToolPermission): boolean {
    if (permission.scope === 'session') {
      const permissionKey = this.getPermissionKey(permission.serverId, permission.toolName);
      return this.sessionPermissions.has(permissionKey);
    }

    if (permission.expiresAt && permission.expiresAt < new Date()) {
      return false;
    }

    return true;
  }

  private getPermissionKey(serverId: string, toolName: string): string {
    return `${serverId}:${toolName}`;
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

  clearAllPermissions(): void {
    this.permissions.clear();
    this.sessionPermissions.clear();
    this.emit('permissionsChanged');
  }
}

// Singleton instance
export const permissionManager = new PermissionManager(); 