import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import { PermissionManager, ToolPermission, PendingApproval, ApprovalResult, PermissionSettings } from '../../../src/main/permissions/PermissionManager.js';
import { McpServerConfig, McpTool } from '../../../src/shared/types.js';

// Mock logger
vi.mock('../../../src/main/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;
  let mockServerConfig: McpServerConfig;
  let mockTool: McpTool;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    permissionManager = new PermissionManager();
    
    mockServerConfig = {
      id: 'test-server',
      name: 'Test Server',
      command: 'node',
      args: ['test.js'],
      enabled: true,
      autoStart: false,
      transport: 'stdio' as const,
      env: {}
    };

    mockTool = {
      name: 'test-tool',
      description: 'A test tool for testing'
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
    permissionManager.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize with default settings', () => {
      const settings = permissionManager.getSettings();
      
      expect(settings.autoApproveLevel).toBe('none');
      expect(settings.requestTimeout).toBe(30);
      expect(settings.requireApprovalForFileAccess).toBe(true);
      expect(settings.requireApprovalForNetworkAccess).toBe(true);
      expect(settings.requireApprovalForSystemCommands).toBe(true);
      expect(settings.trustedServers).toEqual([]);
      expect(settings.alwaysPermissionDuration).toBe(0);
      expect(settings.enableArgumentValidation).toBe(true);
      expect(settings.maxSessionPermissions).toBe(50);
    });

    it('should set max listeners to 50', () => {
      expect(permissionManager.getMaxListeners()).toBe(50);
    });
  });

  describe('Risk Assessment', () => {
    it('should assess low risk for basic tools', async () => {
      const lowRiskTool = { name: 'hello', description: 'Says hello' };
      
      const requestSpy = vi.fn().mockResolvedValue(true);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, lowRiskTool, {});
      
      expect(requestSpy).toHaveBeenCalledWith(
        mockServerConfig,
        lowRiskTool,
        {},
        expect.objectContaining({ level: 'low' })
      );
    });

    it('should assess medium risk for file operations', async () => {
      const fileReadTool = { name: 'read-file', description: 'Reads a file from disk' };
      
      const requestSpy = vi.fn().mockResolvedValue(true);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, fileReadTool, { path: '/test/file.txt' });
      
      expect(requestSpy).toHaveBeenCalledWith(
        mockServerConfig,
        fileReadTool,
        { path: '/test/file.txt' },
        expect.objectContaining({ 
          level: 'medium',
          reasons: expect.arrayContaining(['File system access'])
        })
      );
    });

    it('should assess high risk for system commands', async () => {
      const execTool = { name: 'execute-command', description: 'Executes system commands' };
      
      const requestSpy = vi.fn().mockResolvedValue(true);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, execTool, { command: 'rm -rf /' });
      
      expect(requestSpy).toHaveBeenCalledWith(
        mockServerConfig,
        execTool,
        { command: 'rm -rf /' },
        expect.objectContaining({ 
          level: 'high',
          reasons: expect.arrayContaining(['System command execution'])
        })
      );
    });

    it('should assess high risk for sensitive data access', async () => {
      const sensitiveDataTool = { name: 'get-secrets', description: 'Retrieves sensitive data' };
      
      const requestSpy = vi.fn().mockResolvedValue(true);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, sensitiveDataTool, { password: 'secret123' });
      
      expect(requestSpy).toHaveBeenCalledWith(
        mockServerConfig,
        sensitiveDataTool,
        { password: 'secret123' },
        expect.objectContaining({ 
          level: 'high',
          reasons: expect.arrayContaining(['Sensitive data access'])
        })
      );
    });

    it('should assess risk for network operations', async () => {
      const networkTool = { name: 'fetch-data', description: 'Fetches data from the internet' };
      
      const requestSpy = vi.fn().mockResolvedValue(true);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, networkTool, { url: 'https://example.com' });
      
      expect(requestSpy).toHaveBeenCalledWith(
        mockServerConfig,
        networkTool,
        { url: 'https://example.com' },
        expect.objectContaining({ 
          level: 'medium',
          reasons: expect.arrayContaining(['Network access'])
        })
      );
    });

    it('should assess risk for data modification operations', async () => {
      const deleteTool = { name: 'delete-file', description: 'Deletes files from the system' };
      
      const requestSpy = vi.fn().mockResolvedValue(true);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, deleteTool, { path: '/test/file.txt' });
      
      expect(requestSpy).toHaveBeenCalledWith(
        mockServerConfig,
        deleteTool,
        { path: '/test/file.txt' },
        expect.objectContaining({ 
          level: 'high',
          reasons: expect.arrayContaining(['File system access', 'Data modification'])
        })
      );
    });
  });

  describe('Auto-Approval', () => {
    it('should auto-approve for trusted servers', async () => {
      permissionManager.addTrustedServer('test-server');
      
      const result = await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      expect(result).toBe(true);
    });

    it('should auto-approve based on risk level settings', async () => {
      permissionManager.updateSettings({ autoApproveLevel: 'low' });
      
      const lowRiskTool = { name: 'hello', description: 'Says hello' };
      const result = await permissionManager.requestPermission(mockServerConfig, lowRiskTool, {});
      
      expect(result).toBe(true);
    });

    it('should not auto-approve high risk when set to low', async () => {
      permissionManager.updateSettings({ autoApproveLevel: 'low' });
      
      const highRiskTool = { name: 'exec', description: 'Execute commands' };
      
      const requestSpy = vi.fn().mockResolvedValue(false);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, highRiskTool, {});
      
      expect(requestSpy).toHaveBeenCalled();
    });

    it('should not auto-approve when level is none', async () => {
      permissionManager.updateSettings({ autoApproveLevel: 'none' });
      
      const lowRiskTool = { name: 'hello', description: 'Says hello' };
      
      const requestSpy = vi.fn().mockResolvedValue(false);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, lowRiskTool, {});
      
      expect(requestSpy).toHaveBeenCalled();
    });
  });

  describe('Permission Storage and Retrieval', () => {
    it('should store and retrieve always permissions', async () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionRequest', eventSpy);
      
      // Simulate user approval with always scope
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      expect(pendingApprovals).toHaveLength(1);
      
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      const result = await requestPromise;
      expect(result).toBe(true);
      
      // Second request should use stored permission
      const secondResult = await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      expect(secondResult).toBe(true);
    });

    it('should store and retrieve session permissions', async () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionRequest', eventSpy);
      
      // Simulate user approval with session scope
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'session' });
      
      const result = await requestPromise;
      expect(result).toBe(true);
      
      // Second request should use session permission
      const secondResult = await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      expect(secondResult).toBe(true);
    });

    it('should handle once permissions correctly', async () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionRequest', eventSpy);
      
      // Simulate user approval with once scope
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'once' });
      
      const result = await requestPromise;
      expect(result).toBe(true);
      
      // Second request should require new approval
      const requestSpy = vi.fn().mockResolvedValue(false);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      expect(requestSpy).toHaveBeenCalled();
    });

    it('should handle denied permissions', async () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionRequest', eventSpy);
      
      // Simulate user denial
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: false });
      
      const result = await requestPromise;
      expect(result).toBe(false);
    });

    it('should respect existing deny permissions', async () => {
      // First, create a denied permission
      permissionManager['permissions'].set('test-server:test-tool', {
        serverId: 'test-server',
        toolName: 'test-tool',
        permission: 'deny',
        scope: 'always',
        riskLevel: 'low',
        grantedAt: new Date()
      });
      
      const result = await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      expect(result).toBe(false);
    });
  });

  describe('Permission Expiration', () => {
    it('should expire permissions after duration', async () => {
      permissionManager.updateSettings({ alwaysPermissionDuration: 1 }); // 1 day
      
      // Create an approval and approve it
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      await requestPromise;
      
      // Move time forward by 2 days
      vi.advanceTimersByTime(2 * 24 * 60 * 60 * 1000);
      
      // Should require new approval
      const requestSpy = vi.fn().mockResolvedValue(false);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      expect(requestSpy).toHaveBeenCalled();
    });

    it('should not expire permissions when duration is 0', async () => {
      permissionManager.updateSettings({ alwaysPermissionDuration: 0 });
      
      // Create an approval and approve it
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      await requestPromise;
      
      // Move time forward by a year
      vi.advanceTimersByTime(365 * 24 * 60 * 60 * 1000);
      
      // Should still be valid
      const secondResult = await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      expect(secondResult).toBe(true);
    });

    it('should clear expired permissions', () => {
      const expiredPermission: ToolPermission = {
        serverId: 'test-server',
        toolName: 'expired-tool',
        permission: 'allow',
        scope: 'always',
        riskLevel: 'low',
        grantedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // Expired yesterday
      };
      
      const validPermission: ToolPermission = {
        serverId: 'test-server',
        toolName: 'valid-tool',
        permission: 'allow',
        scope: 'always',
        riskLevel: 'low',
        grantedAt: new Date()
      };
      
      permissionManager['permissions'].set('test-server:expired-tool', expiredPermission);
      permissionManager['permissions'].set('test-server:valid-tool', validPermission);
      
      const clearedCount = permissionManager.clearExpiredPermissions();
      
      expect(clearedCount).toBe(1);
      expect(permissionManager.getAllPermissions()).toHaveLength(1);
      expect(permissionManager.getAllPermissions()[0].toolName).toBe('valid-tool');
    });

    it('should schedule expiration notifications', () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionExpiringSoon', eventSpy);
      
      permissionManager.updateSettings({ 
        alwaysPermissionDuration: 2,
        enablePermissionExpireNotifications: true 
      });
      
      // Create a permission that expires in 2 days
      const permission: ToolPermission = {
        serverId: 'test-server',
        toolName: 'test-tool',
        permission: 'allow',
        scope: 'always',
        riskLevel: 'low',
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      };
      
      permissionManager['storePermission']('test-server', 'test-tool', 'always', 'low');
      
      // Advance time to 1 day before expiration
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'test-tool',
        serverId: 'test-server'
      }));
    });
  });

  describe('Argument Validation', () => {
    it('should validate file paths correctly', async () => {
      permissionManager.updateSettings({ enableArgumentValidation: true });
      
      // First approval for specific path
      const fileArgs = { path: '/allowed/path/file.txt' };
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, fileArgs);
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      await requestPromise;
      
      // Should work for same path
      const samePathResult = await permissionManager.requestPermission(mockServerConfig, mockTool, fileArgs);
      expect(samePathResult).toBe(true);
      
      // Should work for subdirectory
      const subDirResult = await permissionManager.requestPermission(mockServerConfig, mockTool, { path: '/allowed/path/file.txt/subdir' });
      expect(subDirResult).toBe(true);
      
      // Should fail for different path
      const requestSpy = vi.fn().mockResolvedValue(false);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, mockTool, { path: '/different/path' });
      expect(requestSpy).toHaveBeenCalled();
    });

    it('should validate domains correctly', async () => {
      permissionManager.updateSettings({ enableArgumentValidation: true });
      
      // First approval for specific domain
      const urlArgs = { url: 'https://example.com/api' };
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, urlArgs);
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      await requestPromise;
      
      // Should work for same domain
      const sameDomainResult = await permissionManager.requestPermission(mockServerConfig, mockTool, { url: 'https://example.com/different' });
      expect(sameDomainResult).toBe(true);
      
      // Should fail for different domain
      const requestSpy = vi.fn().mockResolvedValue(false);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, mockTool, { url: 'https://malicious.com' });
      expect(requestSpy).toHaveBeenCalled();
    });

    it('should handle invalid URLs gracefully', async () => {
      permissionManager.updateSettings({ enableArgumentValidation: true });
      
      const invalidUrlArgs = { url: 'not-a-valid-url' };
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, invalidUrlArgs);
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      await requestPromise;
      
      // Should work since no domain restriction was set
      const result = await permissionManager.requestPermission(mockServerConfig, mockTool, invalidUrlArgs);
      expect(result).toBe(true);
    });

    it('should handle argument pattern validation', async () => {
      permissionManager.updateSettings({ enableArgumentValidation: true });
      
      const specificArgs = { param1: 'value1', param2: 'value2' };
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, specificArgs);
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      await requestPromise;
      
      // Should work for exact same arguments
      const sameArgsResult = await permissionManager.requestPermission(mockServerConfig, mockTool, specificArgs);
      expect(sameArgsResult).toBe(true);
      
      // Should fail for different arguments
      const requestSpy = vi.fn().mockResolvedValue(false);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, mockTool, { param1: 'different' });
      expect(requestSpy).toHaveBeenCalled();
    });

    it('should work when argument validation is disabled', async () => {
      permissionManager.updateSettings({ enableArgumentValidation: false });
      
      const args1 = { param: 'value1' };
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, args1);
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      await requestPromise;
      
      // Should work for different arguments when validation is disabled
      const args2 = { param: 'value2' };
      const result = await permissionManager.requestPermission(mockServerConfig, mockTool, args2);
      expect(result).toBe(true);
    });
  });

  describe('Session Management', () => {
    it('should clear session permissions', () => {
      const eventSpy = vi.fn();
      permissionManager.on('sessionPermissionsCleared', eventSpy);
      
      permissionManager['sessionPermissions'].add('test-session-permission');
      expect(permissionManager['sessionPermissions'].size).toBe(1);
      
      permissionManager.clearSessionPermissions();
      
      expect(permissionManager['sessionPermissions'].size).toBe(0);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should enforce session permission limits', async () => {
      permissionManager.updateSettings({ maxSessionPermissions: 2 });
      
      // Add 2 session permissions
      for (let i = 0; i < 3; i++) {
        const requestPromise = permissionManager.requestPermission(
          { ...mockServerConfig, id: `server-${i}` },
          { ...mockTool, name: `tool-${i}` },
          {}
        );
        
        await vi.advanceTimersToNextTimer();
        
        const pendingApprovals = permissionManager.getPendingApprovals();
        const approvalId = pendingApprovals[0].id;
        permissionManager.respondToApproval(approvalId, { approved: true, scope: 'session' });
        
        await requestPromise;
      }
      
      // Should have cleared oldest when limit exceeded
      expect(permissionManager['sessionPermissions'].size).toBe(2);
    });

    it('should track usage statistics', async () => {
      // Create a permission and use it multiple times
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      const pendingApprovals = permissionManager.getPendingApprovals();
      const approvalId = pendingApprovals[0].id;
      permissionManager.respondToApproval(approvalId, { approved: true, scope: 'always' });
      
      await requestPromise;
      
      // Use the permission multiple times
      await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      await permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      const permissions = permissionManager.getAllPermissions();
      expect(permissions[0].usageCount).toBe(2);
      expect(permissions[0].lastUsed).toBeDefined();
    });
  });

  describe('Permission Management API', () => {
    it('should revoke permissions', () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionRevoked', eventSpy);
      
      const permission: ToolPermission = {
        serverId: 'test-server',
        toolName: 'test-tool',
        permission: 'allow',
        scope: 'always',
        riskLevel: 'low',
        grantedAt: new Date()
      };
      
      permissionManager['permissions'].set('test-server:test-tool', permission);
      
      const revoked = permissionManager.revokePermission('test-server', 'test-tool');
      
      expect(revoked).toBe(true);
      expect(permissionManager.getAllPermissions()).toHaveLength(0);
      expect(eventSpy).toHaveBeenCalledWith({ serverId: 'test-server', toolName: 'test-tool' });
    });

    it('should handle revoking non-existent permissions', () => {
      const revoked = permissionManager.revokePermission('non-existent', 'non-existent');
      expect(revoked).toBe(false);
    });

    it('should clear all permissions', () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionsChanged', eventSpy);
      
      const permission: ToolPermission = {
        serverId: 'test-server',
        toolName: 'test-tool',
        permission: 'allow',
        scope: 'always',
        riskLevel: 'low',
        grantedAt: new Date()
      };
      
      permissionManager['permissions'].set('test-server:test-tool', permission);
      permissionManager['sessionPermissions'].add('session-permission');
      
      permissionManager.clearAllPermissions();
      
      expect(permissionManager.getAllPermissions()).toHaveLength(0);
      expect(permissionManager['sessionPermissions'].size).toBe(0);
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should update settings', () => {
      const eventSpy = vi.fn();
      permissionManager.on('settingsUpdated', eventSpy);
      
      const newSettings: Partial<PermissionSettings> = {
        autoApproveLevel: 'low',
        requestTimeout: 60
      };
      
      permissionManager.updateSettings(newSettings);
      
      const settings = permissionManager.getSettings();
      expect(settings.autoApproveLevel).toBe('low');
      expect(settings.requestTimeout).toBe(60);
      expect(eventSpy).toHaveBeenCalledWith(settings);
    });

    it('should manage trusted servers', () => {
      const addEventSpy = vi.fn();
      const changeEventSpy = vi.fn();
      
      permissionManager.on('trustedServerAdded', addEventSpy);
      permissionManager.on('settingsChanged', changeEventSpy);
      
      permissionManager.addTrustedServer('trusted-server');
      
      expect(permissionManager.getSettings().trustedServers).toContain('trusted-server');
      expect(addEventSpy).toHaveBeenCalledWith('trusted-server');
      
      // Adding same server again should not duplicate
      permissionManager.addTrustedServer('trusted-server');
      expect(permissionManager.getSettings().trustedServers).toHaveLength(1);
      
      permissionManager.removeTrustedServer('trusted-server');
      expect(permissionManager.getSettings().trustedServers).not.toContain('trusted-server');
      expect(changeEventSpy).toHaveBeenCalled();
    });

    it('should get permission statistics', () => {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const permissions: ToolPermission[] = [
        {
          serverId: 'server1',
          toolName: 'tool1',
          permission: 'allow',
          scope: 'always',
          riskLevel: 'low',
          grantedAt: now
        },
        {
          serverId: 'server2',
          toolName: 'tool2',
          permission: 'allow',
          scope: 'always',
          riskLevel: 'low',
          grantedAt: now,
          expiresAt: oneDayFromNow // Expiring soon
        },
        {
          serverId: 'server3',
          toolName: 'tool3',
          permission: 'allow',
          scope: 'always',
          riskLevel: 'low',
          grantedAt: now,
          expiresAt: yesterday // Expired
        },
        {
          serverId: 'server4',
          toolName: 'tool4',
          permission: 'allow',
          scope: 'always',
          riskLevel: 'low',
          grantedAt: now,
          expiresAt: twoDaysFromNow // Valid
        }
      ];
      
      permissions.forEach((permission, index) => {
        permissionManager['permissions'].set(`server${index + 1}:tool${index + 1}`, permission);
      });
      
      permissionManager['sessionPermissions'].add('session1');
      permissionManager['sessionPermissions'].add('session2');
      
      const stats = permissionManager.getPermissionStats();
      
      expect(stats.total).toBe(4);
      expect(stats.session).toBe(2);
      expect(stats.expired).toBe(1);
      expect(stats.expiringSoon).toBe(1);
    });
  });

  describe('Approval Request Handling', () => {
    it('should timeout approval requests', async () => {
      permissionManager.updateSettings({ requestTimeout: 1 }); // 1 second
      
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      // Advance time beyond timeout
      vi.advanceTimersByTime(2000);
      
      const result = await requestPromise;
      expect(result).toBe(false);
      
      expect(permissionManager.getPendingApprovals()).toHaveLength(0);
    });

    it('should handle invalid approval responses', () => {
      const result = permissionManager.respondToApproval('non-existent-id', { approved: true });
      expect(result).toBe(false);
    });

    it('should emit permission request events', async () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionRequest', eventSpy);
      
      permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        serverId: 'test-server',
        toolName: 'test-tool',
        riskLevel: 'low'
      }));
    });
  });

  describe('Shutdown', () => {
    it('should clean up all resources on shutdown', () => {
      // Set up some state
      const permission: ToolPermission = {
        serverId: 'test-server',
        toolName: 'test-tool',
        permission: 'allow',
        scope: 'always',
        riskLevel: 'low',
        grantedAt: new Date()
      };
      
      permissionManager['permissions'].set('test-server:test-tool', permission);
      permissionManager['sessionPermissions'].add('session-permission');
      
      // Create a pending approval
      const mockResolve = vi.fn();
      const pendingApproval: PendingApproval = {
        id: 'test-approval',
        serverId: 'test-server',
        serverName: 'Test Server',
        toolName: 'test-tool',
        toolDescription: 'Test tool',
        args: {},
        riskLevel: 'low',
        riskReasons: [],
        requestedAt: new Date(),
        resolve: mockResolve,
        timeout: setTimeout(() => {}, 30000)
      };
      
      permissionManager['pendingApprovals'].set('test-approval', pendingApproval);
      
      // Add event listener to verify cleanup
      const testListener = vi.fn();
      permissionManager.on('test', testListener);
      
      expect(permissionManager.getAllPermissions()).toHaveLength(1);
      expect(permissionManager['sessionPermissions'].size).toBe(1);
      expect(permissionManager.getPendingApprovals()).toHaveLength(1);
      expect(permissionManager.listenerCount('test')).toBe(1);
      
      permissionManager.shutdown();
      
      expect(permissionManager.getAllPermissions()).toHaveLength(0);
      expect(permissionManager['sessionPermissions'].size).toBe(0);
      expect(permissionManager.getPendingApprovals()).toHaveLength(0);
      expect(permissionManager.listenerCount('test')).toBe(0);
      expect(mockResolve).toHaveBeenCalledWith({ approved: false, reason: 'Application shutdown' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed arguments gracefully', async () => {
      const circularRef: any = {};
      circularRef.self = circularRef;
      
      const requestSpy = vi.fn().mockResolvedValue(false);
      permissionManager['requestUserApproval'] = requestSpy;
      
      await permissionManager.requestPermission(mockServerConfig, mockTool, circularRef);
      
      expect(requestSpy).toHaveBeenCalled();
    });

    it('should handle empty permission key generation', () => {
      const key = permissionManager['getPermissionKey']('', '');
      expect(key).toBe(':');
    });

    it('should handle session key generation with various inputs', () => {
      const key1 = permissionManager['getSessionKey']('server', 'tool');
      const key2 = permissionManager['getSessionKey']('server', 'tool', 'hash');
      
      expect(key1).toBe('session:server:tool');
      expect(key2).toBe('session:server:tool:hash');
    });

    it('should handle argument hashing with special characters', () => {
      const hash1 = permissionManager['hashArguments']({ special: '!@#$%^&*()' });
      const hash2 = permissionManager['hashArguments']({ unicode: '你好世界' });
      
      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2);
    });

    it('should handle argument hashing with undefined/null values', () => {
      const hash = permissionManager['hashArguments']({ 
        undefined: undefined, 
        null: null, 
        string: 'test' 
      });
      
      expect(hash).toBeDefined();
    });
  });
});