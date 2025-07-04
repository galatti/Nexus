import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import { PermissionManager } from '../../../src/main/permissions/PermissionManager.js';
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
      command: 'test-command',
      args: [],
      enabled: true,
      autoStart: false
    };

    mockTool = {
      name: 'test-tool',
      description: 'A test tool'
    };
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
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

  });

  describe('Permission Management API', () => {
    it('should revoke permissions', () => {
      expect(() => {
        permissionManager.revokePermission('test-server', 'test-tool');
      }).not.toThrow();
    });

    it('should handle revoking non-existent permissions', () => {
      expect(() => {
        permissionManager.revokePermission('non-existent', 'tool');
      }).not.toThrow();
    });

    it('should clear all permissions', () => {
      expect(() => {
        permissionManager.clearAllPermissions();
      }).not.toThrow();
    });

    it('should update settings', () => {
      const newSettings = { autoApproveLevel: 'medium' as const };
      
      permissionManager.updateSettings(newSettings);
      
      expect(permissionManager.getSettings().autoApproveLevel).toBe('medium');
    });

    it('should manage trusted servers', () => {
      permissionManager.addTrustedServer('server1');
      permissionManager.addTrustedServer('server2');
      
      expect(permissionManager.getSettings().trustedServers).toContain('server1');
      expect(permissionManager.getSettings().trustedServers).toContain('server2');
      
      permissionManager.removeTrustedServer('server1');
      
      expect(permissionManager.getSettings().trustedServers).not.toContain('server1');
      expect(permissionManager.getSettings().trustedServers).toContain('server2');
    });
  });

  describe('Session Management', () => {
    it('should clear session permissions', () => {
      expect(() => {
        permissionManager.clearSessionPermissions();
      }).not.toThrow();
    });
  });

  describe('Approval Request Handling', () => {
    it('should timeout approval requests', async () => {
      permissionManager.updateSettings({ requestTimeout: 1 }); // 1 second
      
      const requestPromise = permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      // Fast-forward time
      vi.advanceTimersByTime(2000);
      
      const result = await requestPromise;
      expect(result).toBe(false);
    });

    it('should handle invalid approval responses', () => {
      expect(() => {
        permissionManager.respondToApproval('invalid-id', { approved: true });
      }).not.toThrow();
    });

    it('should emit permission request events', async () => {
      const eventSpy = vi.fn();
      permissionManager.on('permissionRequest', eventSpy);
      
      permissionManager.requestPermission(mockServerConfig, mockTool, {});
      
      await vi.advanceTimersToNextTimer();
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('Shutdown', () => {
    it('should clean up all resources on shutdown', () => {
      expect(() => {
        permissionManager.shutdown();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty permission key generation', () => {
      const key1 = permissionManager['getPermissionKey']('', '');
      const key2 = permissionManager['getPermissionKey']('server', '');
      const key3 = permissionManager['getPermissionKey']('', 'tool');
      
      expect(key1).toBe(':');
      expect(key2).toBe('server:');
      expect(key3).toBe(':tool');
    });

    it('should handle session key generation with various inputs', () => {
      const key1 = permissionManager['getSessionKey']('server', 'tool', {});
      const key2 = permissionManager['getSessionKey']('server', 'tool', { arg: 'value' });
      
      expect(typeof key1).toBe('string');
      expect(typeof key2).toBe('string');
      // Keys might be the same for simple args, that's fine
    });

    it('should handle argument hashing with special characters', () => {
      const hash1 = permissionManager['hashArguments']({ 'special': '!@#$%^&*()' });
      const hash2 = permissionManager['hashArguments']({ 'unicode': '💻🔒' });
      
      expect(typeof hash1).toBe('string');
      expect(typeof hash2).toBe('string');
    });

    it('should handle argument hashing with undefined/null values', () => {
      const hash1 = permissionManager['hashArguments']({ 'undefined': undefined });
      const hash2 = permissionManager['hashArguments']({ 'null': null });
      
      expect(typeof hash1).toBe('string');
      expect(typeof hash2).toBe('string');
    });
  });
});