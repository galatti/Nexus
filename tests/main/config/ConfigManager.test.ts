import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import { ConfigManager } from '../../../src/main/config/ConfigManager.js';
import { LlmProviderConfig, McpServerConfig } from '../../../src/shared/types.js';
import { APP_CONSTANTS } from '../../../src/shared/constants.js';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';


// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  default: {
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn()
  }
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  default: {
    join: vi.fn((...args) => args.join('/'))
  }
}));

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn()
  }
}));

// Mock logger
vi.mock('../../../src/main/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const mockUserDataPath = '/test/userData';

  beforeEach(() => {
    vi.clearAllMocks();
    (app.getPath as any).mockReturnValue(mockUserDataPath);
    (fs.existsSync as any).mockReturnValue(false);
    (fs.mkdirSync as any).mockImplementation(() => {});
    (fs.writeFileSync as any).mockImplementation(() => {});
    (path.join as any).mockImplementation((...args: string[]) => args.join('/'));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default settings when no config file exists', () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      configManager = new ConfigManager();
      const settings = configManager.getSettings();
      
      expect(settings.general.theme).toBe('system');
      expect(settings.general.autoStart).toBe(false);
      expect(settings.general.minimizeToTray).toBe(true);
      expect(settings.general.language).toBe('en');
      expect(settings.llm.providers).toHaveLength(7);
      expect(settings.mcp.servers).toHaveLength(0);
    });

    it('should load existing configuration when config file exists', () => {
      const mockConfig = {
        general: { theme: 'dark', autoStart: true, minimizeToTray: false, language: 'es' },
        llm: { providers: [], defaultProviderModel: undefined },
        mcp: { servers: [] }
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConfig));
      
      configManager = new ConfigManager();
      const settings = configManager.getSettings();
      
      expect(settings.general.theme).toBe('dark');
      expect(settings.general.autoStart).toBe(true);
      expect(settings.general.minimizeToTray).toBe(false);
      expect(settings.general.language).toBe('es');
    });

    it('should handle config file read errors gracefully', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockImplementation(() => {
        throw new Error('Read error');
      });
      
      configManager = new ConfigManager();
      const settings = configManager.getSettings();
      
      // Should fall back to defaults
      expect(settings.general.theme).toBe('system');
      expect(settings.llm.providers).toHaveLength(7);
    });

    it('should handle invalid JSON gracefully', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('invalid json');
      
      configManager = new ConfigManager();
      const settings = configManager.getSettings();
      
      // Should fall back to defaults
      expect(settings.general.theme).toBe('system');
      expect(settings.llm.providers).toHaveLength(7);
    });

    it('should use fallback path when userData path fails', () => {
      (app.getPath as any).mockImplementation(() => {
        throw new Error('Path error');
      });
      
      configManager = new ConfigManager();
      
      expect(path.join).toHaveBeenCalledWith(process.cwd(), APP_CONSTANTS.CONFIG_FILE_NAME);
    });
  });

  describe('Settings Management', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager();
    });

    it('should update general settings', () => {
      const updates = {
        general: {
          theme: 'dark' as const,
          autoStart: true,
          minimizeToTray: false,
          language: 'es'
        }
      };
      
      configManager.updateSettings(updates);
      const settings = configManager.getSettings();
      
      expect(settings.general.theme).toBe('dark');
      expect(settings.general.autoStart).toBe(true);
      expect(settings.general.language).toBe('es');
      expect(settings.general.minimizeToTray).toBe(false);
    });

    it('should update LLM providers', () => {
      const newProviders: LlmProviderConfig[] = [
        {
          id: 'test-provider',
          type: 'ollama',
          name: 'Test Provider',
          baseUrl: 'http://test',
          model: 'test-model',
          enabled: true,
          temperature: 0.5,
          maxTokens: 1024
        }
      ];
      
      configManager.updateSettings({ llm: { providers: newProviders } });
      const settings = configManager.getSettings();
      
      expect(settings.llm.providers).toHaveLength(1);
      expect(settings.llm.providers[0].name).toBe('Test Provider');
    });

    it('should update MCP servers', () => {
      const newServers: McpServerConfig[] = [
        {
          id: 'test-server',
          name: 'Test Server',
          command: 'node',
          args: ['test.js'],
          enabled: true,
          autoStart: false,
          env: {},
          transport: 'stdio'
        }
      ];
      
      configManager.updateSettings({ mcp: { servers: newServers } });
      const settings = configManager.getSettings();
      
      expect(settings.mcp.servers).toHaveLength(1);
      expect(settings.mcp.servers[0].name).toBe('Test Server');
    });

    it('should handle update errors', () => {
      (fs.writeFileSync as any).mockImplementation(() => {
        throw new Error('Write error');
      });
      
      expect(() => {
        configManager.updateSettings({ 
          general: { theme: 'dark', autoStart: false, minimizeToTray: true, language: 'en' } 
        });
      }).toThrow('Failed to save configuration');
    });

    it('should return deep copy of settings', () => {
      const settings1 = configManager.getSettings();
      const settings2 = configManager.getSettings();
      
      expect(settings1).not.toBe(settings2);
      expect(settings1.general).not.toBe(settings2.general);
      expect(settings1.llm).not.toBe(settings2.llm);
      expect(settings1.mcp).not.toBe(settings2.mcp);
    });
  });

  describe('Provider Management', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager();
    });

    it('should add LLM provider', () => {
      const newProvider: LlmProviderConfig = {
        id: 'custom-provider',
        type: 'ollama',
        name: 'Custom Provider',
        baseUrl: 'http://custom',
        model: 'custom-model',
        enabled: true,
        temperature: 0.8,
        maxTokens: 4096
      };
      
      configManager.addLlmProvider(newProvider);
      const providers = configManager.getLlmProviders();
      
      expect(providers).toHaveLength(8); // 7 defaults + 1 new
      expect(providers[7]).toEqual(newProvider);
    });

    it('should update LLM provider by ID', () => {
      const providers = configManager.getLlmProviders();
      const providerId = providers[0].id;
      
      configManager.updateLlmProviderById(providerId, {
        enabled: true,
        model: 'updated-model'
      });
      
      const updatedProviders = configManager.getLlmProviders();
      expect(updatedProviders[0].enabled).toBe(true);
      expect(updatedProviders[0].model).toBe('updated-model');
    });

    it('should remove LLM provider', () => {
      const providers = configManager.getLlmProviders();
      const providerId = providers[0].id;
      
      configManager.removeLlmProvider(providerId);
      const remainingProviders = configManager.getLlmProviders();
      
      expect(remainingProviders).toHaveLength(6);
      expect(remainingProviders.find(p => p.id === providerId)).toBeUndefined();
    });

    it('should clear default provider when removing it', () => {
      const providers = configManager.getLlmProviders();
      const providerId = providers[0].id;
      
      configManager.setDefaultProviderModel(providerId, 'test-model');
      expect(configManager.getDefaultProviderModel()?.providerId).toBe(providerId);
      
      configManager.removeLlmProvider(providerId);
      expect(configManager.getDefaultProviderModel()).toBeUndefined();
    });

    it('should find best default provider model', () => {
      const providers = configManager.getLlmProviders();
      configManager.updateLlmProviderById(providers[0].id, {
        enabled: true,
        model: 'test-model'
      });
      
      const bestDefault = configManager.findBestDefaultProviderModel();
      expect(bestDefault?.providerId).toBe(providers[0].id);
      expect(bestDefault?.modelName).toBe('test-model');
    });

    it('should return undefined when no enabled provider with model exists', () => {
      const bestDefault = configManager.findBestDefaultProviderModel();
      expect(bestDefault).toBeUndefined();
    });

    it('should set and get default provider model', () => {
      configManager.setDefaultProviderModel('test-provider', 'test-model');
      
      const defaultModel = configManager.getDefaultProviderModel();
      expect(defaultModel?.providerId).toBe('test-provider');
      expect(defaultModel?.modelName).toBe('test-model');
    });
  });

  describe('MCP Server Management', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager();
    });

    it('should add MCP server', () => {
      const newServer: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'node',
        args: ['test.js'],
        enabled: true,
        autoStart: false,
        env: { TEST: 'value' },
        transport: { type: 'stdio' }
      };
      
      configManager.addMcpServer(newServer);
      const servers = configManager.getMcpServers();
      
      expect(servers).toHaveLength(1);
      expect(servers[0]).toEqual(newServer);
    });

    it('should update existing MCP server when adding with same ID', () => {
      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'node',
        args: ['test.js'],
        enabled: true,
        autoStart: false,
        env: {},
        transport: 'stdio' as const
      };
      
      configManager.addMcpServer(server);
      
      const updatedServer = { ...server, name: 'Updated Server' };
      configManager.addMcpServer(updatedServer);
      
      const servers = configManager.getMcpServers();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe('Updated Server');
    });

    it('should remove MCP server', () => {
      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'node',
        args: ['test.js'],
        enabled: true,
        autoStart: false,
        env: {},
        transport: 'stdio' as const
      };
      
      configManager.addMcpServer(server);
      expect(configManager.getMcpServers()).toHaveLength(1);
      
      configManager.removeMcpServer('test-server');
      expect(configManager.getMcpServers()).toHaveLength(0);
    });

    it('should handle removing non-existent MCP server', () => {
      configManager.removeMcpServer('non-existent');
      expect(configManager.getMcpServers()).toHaveLength(0);
    });

    it('should update MCP server', () => {
      const server: McpServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        command: 'node',
        args: ['test.js'],
        enabled: true,
        autoStart: false,
        env: {},
        transport: 'stdio' as const
      };
      
      configManager.addMcpServer(server);
      
      configManager.updateMcpServer('test-server', {
        name: 'Updated Server',
        enabled: false
      });
      
      const servers = configManager.getMcpServers();
      expect(servers[0].name).toBe('Updated Server');
      expect(servers[0].enabled).toBe(false);
      expect(servers[0].command).toBe('node'); // Should retain original value
    });

    it('should throw error when updating non-existent MCP server', () => {
      expect(() => {
        configManager.updateMcpServer('non-existent', { name: 'Updated' });
      }).toThrow('MCP server not found: non-existent');
    });
  });

  describe('Settings Validation', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager();
    });

    it('should validate valid settings', () => {
      const validSettings = {
        general: {
          theme: 'dark',
          autoStart: true,
          minimizeToTray: false,
          language: 'en'
        },
        llm: {
          providers: [
            {
              id: 'test',
              type: 'ollama',
              name: 'Test',
              baseUrl: 'http://test',
              enabled: true,
              model: 'test-model',
              temperature: 0.7,
              maxTokens: 2048
            }
          ],
          defaultProviderModel: undefined
        },
        mcp: {
          servers: [
            {
              id: 'test-server',
              name: 'Test Server',
              command: 'node',
              args: ['test.js'],
              enabled: true,
              autoStart: false,
              transport: 'stdio'
            }
          ]
        }
      };
      
      expect(configManager.validateSettings(validSettings)).toBe(true);
    });

    it('should reject invalid theme', () => {
      const invalidSettings = {
        general: { theme: 'invalid' }
      };
      
      expect(configManager.validateSettings(invalidSettings)).toBe(false);
    });

    it('should reject invalid provider type', () => {
      const invalidSettings = {
        llm: {
          providers: [
            { id: 'test', type: 'invalid', name: 'Test' }
          ]
        }
      };
      
      expect(configManager.validateSettings(invalidSettings)).toBe(false);
    });

    it('should reject invalid MCP server structure', () => {
      const invalidSettings = {
        mcp: {
          servers: [
            { id: 'test' } // Missing required fields
          ]
        }
      };
      
      expect(configManager.validateSettings(invalidSettings)).toBe(false);
    });

    it('should reject non-object settings', () => {
      expect(configManager.validateSettings(null)).toBe(false);
      expect(configManager.validateSettings(undefined)).toBe(false);
      expect(configManager.validateSettings('string')).toBe(false);
      expect(configManager.validateSettings(123)).toBe(false);
    });

  });

  describe('Import/Export', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager();
    });

    it('should export settings as JSON string', () => {
      const exported = configManager.exportSettings();
      const parsed = JSON.parse(exported);
      
      expect(parsed.general.theme).toBe('system');
      expect(parsed.llm.providers).toHaveLength(7);
      expect(parsed.mcp.servers).toHaveLength(0);
    });

    it('should import valid settings', () => {
      const settingsToImport = {
        general: { theme: 'dark' },
        llm: { providers: [] },
        mcp: { servers: [] }
      };
      
      configManager.importSettings(JSON.stringify(settingsToImport));
      const settings = configManager.getSettings();
      
      expect(settings.general.theme).toBe('dark');
    });

    it('should reject invalid JSON during import', () => {
      expect(() => {
        configManager.importSettings('invalid json');
      }).toThrow('Failed to import settings');
    });

    it('should reject invalid settings during import', () => {
      const invalidSettings = {
        general: { theme: 'invalid' }
      };
      
      expect(() => {
        configManager.importSettings(JSON.stringify(invalidSettings));
      }).toThrow('Failed to import settings');
    });
  });

  describe('Provider Deduplication', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
    });

    it('should deduplicate providers by type', () => {
      const mockConfig = {
        llm: {
          providers: [
            { id: 'ollama-1', type: 'ollama', name: 'Ollama 1' },
            { id: 'ollama-2', type: 'ollama', name: 'Ollama 2' },
            { id: 'openrouter-1', type: 'openrouter', name: 'OpenRouter 1' }
          ]
        }
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConfig));
      
      configManager = new ConfigManager();
      const providers = configManager.getLlmProviders();
      
      // Should keep first occurrence and ensure required providers exist
      expect(providers.find(p => p.type === 'ollama')).toBeDefined();
      expect(providers.find(p => p.type === 'openrouter')).toBeDefined();
      expect(providers.filter(p => p.type === 'ollama')).toHaveLength(1);
      expect(providers.filter(p => p.type === 'openrouter')).toHaveLength(1);
    });

    it('should ensure required default providers exist', () => {
      const mockConfig = {
        llm: {
          providers: [
            { id: 'custom', type: 'custom', name: 'Custom Provider' }
          ]
        }
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockConfig));
      
      configManager = new ConfigManager();
      const providers = configManager.getLlmProviders();
      
      // Should add missing required providers
      expect(providers.find(p => p.type === 'ollama')).toBeDefined();
      expect(providers.find(p => p.type === 'openrouter')).toBeDefined();
    });
  });

  describe('Reset to Defaults', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
      configManager = new ConfigManager();
    });

    it('should reset all settings to defaults', () => {
      // Modify settings first
      configManager.updateSettings({
        general: { theme: 'dark', autoStart: true, minimizeToTray: false, language: 'es' }
      });
      
      let settings = configManager.getSettings();
      expect(settings.general.theme).toBe('dark');
      expect(settings.general.autoStart).toBe(true);
      
      // Reset to defaults
      configManager.resetToDefaults();
      
      settings = configManager.getSettings();
      expect(settings.general.theme).toBe('system');
      expect(settings.general.autoStart).toBe(false);
      expect(settings.general.minimizeToTray).toBe(true);
      expect(settings.general.language).toBe('en');
    });
  });

  describe('Migration and Merging', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
    });

    it('should merge partial user settings with defaults', () => {
      const partialConfig = {
        general: { theme: 'dark' },
        llm: { providers: [] }
        // Missing mcp section
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(partialConfig));
      
      configManager = new ConfigManager();
      const settings = configManager.getSettings();
      
      expect(settings.general.theme).toBe('dark');
      expect(settings.general.autoStart).toBe(false); // Default
      expect(settings.mcp.servers).toHaveLength(0); // Default
    });

    it('should handle migration of LLM settings', () => {
      const oldConfig = {
        llm: {
          providers: [
            { id: 'test', type: 'ollama', name: 'Test' }
          ],
          defaultProviderModel: { providerId: 'test', modelName: 'test-model' }
        }
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(oldConfig));
      
      configManager = new ConfigManager();
      const settings = configManager.getSettings();
      
      expect(settings.llm.providers.length).toBeGreaterThanOrEqual(1);
      expect(settings.llm.providers.some(p => p.id === 'test')).toBe(true);
      expect(settings.llm.defaultProviderModel?.providerId).toBe('test');
      expect(settings.llm.defaultProviderModel?.modelName).toBe('test-model');
    });

    it('should use defaults when LLM providers are invalid', () => {
      const invalidConfig = {
        llm: {
          providers: 'invalid' // Not an array
        }
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(invalidConfig));
      
      configManager = new ConfigManager();
      const settings = configManager.getSettings();
      
      expect(settings.llm.providers).toHaveLength(7); // Should use defaults
    });
  });
});