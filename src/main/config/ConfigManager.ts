import { app } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { AppSettings, LlmProviderConfig, McpServerConfig } from '../../shared/types.js';
import { logger } from '../utils/logger.js';

export class ConfigManager {
  private configPath: string;
  private settings: AppSettings;
  private readonly CONFIG_FILE_NAME = 'nexus-config.json';

  constructor() {
    this.configPath = this.getConfigPath();
    this.settings = this.loadSettings();
  }

  private getConfigPath(): string {
    try {
      const userDataPath = app.getPath('userData');
      const configDir = join(userDataPath, 'config');
      
      // Ensure config directory exists
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      
      return join(configDir, this.CONFIG_FILE_NAME);
    } catch (error) {
      logger.error('Error getting config path:', error);
      // Fallback to current directory
      const fallbackPath = join(process.cwd(), this.CONFIG_FILE_NAME);
      logger.warn('Using fallback config path:', fallbackPath);
      return fallbackPath;
    }
  }

  private getDefaultSettings(): AppSettings {
    return {
      general: {
        theme: 'system',
        autoStart: false,
        minimizeToTray: true,
        language: 'en'
      },
      llm: {
        provider: {
          type: 'ollama',
          name: 'Ollama',
          baseUrl: 'http://localhost:11434',
          model: 'llama2',
          enabled: false
        }
      },
      mcp: {
        servers: []
      }
    };
  }

  private loadSettings(): AppSettings {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Validate and merge with defaults
        const defaultSettings = this.getDefaultSettings();
        const mergedSettings = this.mergeWithDefaults(parsed, defaultSettings);
        
        logger.info('Configuration loaded successfully');
        return mergedSettings;
      } else {
        logger.info('No configuration file found, using defaults');
        return this.getDefaultSettings();
      }
    } catch (error) {
      logger.error('Error loading configuration:', error);
      logger.info('Using default configuration');
      return this.getDefaultSettings();
    }
  }

  private mergeWithDefaults(userSettings: any, defaultSettings: AppSettings): AppSettings {
    return {
      general: {
        theme: userSettings.general?.theme || defaultSettings.general.theme,
        autoStart: userSettings.general?.autoStart ?? defaultSettings.general.autoStart,
        minimizeToTray: userSettings.general?.minimizeToTray ?? defaultSettings.general.minimizeToTray,
        language: userSettings.general?.language || defaultSettings.general.language
      },
      llm: {
        provider: {
          type: userSettings.llm?.provider?.type || defaultSettings.llm.provider.type,
          name: userSettings.llm?.provider?.name || defaultSettings.llm.provider.name,
          baseUrl: userSettings.llm?.provider?.baseUrl || defaultSettings.llm.provider.baseUrl,
          apiKey: userSettings.llm?.provider?.apiKey || defaultSettings.llm.provider.apiKey,
          model: userSettings.llm?.provider?.model || defaultSettings.llm.provider.model,
          enabled: userSettings.llm?.provider?.enabled ?? defaultSettings.llm.provider.enabled,
          models: userSettings.llm?.provider?.models || defaultSettings.llm.provider.models
        }
      },
      mcp: {
        servers: Array.isArray(userSettings.mcp?.servers) ? userSettings.mcp.servers : defaultSettings.mcp.servers
      }
    };
  }

  private saveSettings(): void {
    try {
      const data = JSON.stringify(this.settings, null, 2);
      writeFileSync(this.configPath, data, 'utf8');
      logger.info('Configuration saved successfully');
    } catch (error) {
      logger.error('Error saving configuration:', error);
      throw new Error('Failed to save configuration');
    }
  }

  public getSettings(): AppSettings {
    return JSON.parse(JSON.stringify(this.settings)); // Return a deep copy
  }

  public updateSettings(updates: Partial<AppSettings>): void {
    try {
      // Deep merge the updates
      if (updates.general) {
        this.settings.general = { ...this.settings.general, ...updates.general };
      }
      
      if (updates.llm?.provider) {
        this.settings.llm.provider = { ...this.settings.llm.provider, ...updates.llm.provider };
      }
      
      if (updates.mcp?.servers) {
        this.settings.mcp.servers = updates.mcp.servers;
      }

      this.saveSettings();
      logger.info('Settings updated successfully');
    } catch (error) {
      logger.error('Error updating settings:', error);
      throw error;
    }
  }

  public getLlmProvider(): LlmProviderConfig {
    return this.settings.llm.provider;
  }

  public updateLlmProvider(provider: Partial<LlmProviderConfig>): void {
    this.settings.llm.provider = { ...this.settings.llm.provider, ...provider };
    this.saveSettings();
    logger.info('LLM provider updated:', provider.type);
  }

  public getMcpServers(): McpServerConfig[] {
    return this.settings.mcp.servers;
  }

  public addMcpServer(server: McpServerConfig): void {
    // Check if server with same ID already exists
    const existingIndex = this.settings.mcp.servers.findIndex(s => s.id === server.id);
    
    if (existingIndex >= 0) {
      // Update existing server
      this.settings.mcp.servers[existingIndex] = server;
      logger.info('MCP server updated:', server.id);
    } else {
      // Add new server
      this.settings.mcp.servers.push(server);
      logger.info('MCP server added:', server.id);
    }
    
    this.saveSettings();
  }

  public removeMcpServer(serverId: string): void {
    const initialLength = this.settings.mcp.servers.length;
    this.settings.mcp.servers = this.settings.mcp.servers.filter(s => s.id !== serverId);
    
    if (this.settings.mcp.servers.length < initialLength) {
      this.saveSettings();
      logger.info('MCP server removed:', serverId);
    } else {
      logger.warn('Attempted to remove non-existent MCP server:', serverId);
    }
  }

  public updateMcpServer(serverId: string, updates: Partial<McpServerConfig>): void {
    const serverIndex = this.settings.mcp.servers.findIndex(s => s.id === serverId);
    
    if (serverIndex >= 0) {
      this.settings.mcp.servers[serverIndex] = { 
        ...this.settings.mcp.servers[serverIndex], 
        ...updates 
      };
      this.saveSettings();
      logger.info('MCP server updated:', serverId);
    } else {
      throw new Error(`MCP server not found: ${serverId}`);
    }
  }

  public validateSettings(settings: any): boolean {
    try {
      // Basic validation
      if (!settings || typeof settings !== 'object') return false;
      
      // Validate general settings
      if (settings.general) {
        const { theme, autoStart, minimizeToTray, language } = settings.general;
        if (theme && !['light', 'dark', 'system'].includes(theme)) return false;
        if (autoStart !== undefined && typeof autoStart !== 'boolean') return false;
        if (minimizeToTray !== undefined && typeof minimizeToTray !== 'boolean') return false;
        if (language && typeof language !== 'string') return false;
      }

      // Validate LLM provider settings
      if (settings.llm?.provider) {
        const { type, enabled } = settings.llm.provider;
        if (type && !['ollama', 'openrouter'].includes(type)) return false;
        if (enabled !== undefined && typeof enabled !== 'boolean') return false;
      }

      // Validate MCP servers
      if (settings.mcp?.servers) {
        if (!Array.isArray(settings.mcp.servers)) return false;
        
        for (const server of settings.mcp.servers) {
          if (!server.id || !server.name || !server.command) return false;
          if (!Array.isArray(server.args)) return false;
          if (typeof server.enabled !== 'boolean') return false;
          if (typeof server.autoStart !== 'boolean') return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Settings validation error:', error);
      return false;
    }
  }

  public resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
    this.saveSettings();
    logger.info('Settings reset to defaults');
  }

  public exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  public importSettings(jsonString: string): void {
    try {
      const imported = JSON.parse(jsonString);
      
      if (!this.validateSettings(imported)) {
        throw new Error('Invalid settings format');
      }
      
      this.settings = this.mergeWithDefaults(imported, this.getDefaultSettings());
      this.saveSettings();
      logger.info('Settings imported successfully');
    } catch (error) {
      logger.error('Error importing settings:', error);
      throw new Error('Failed to import settings');
    }
  }
}

// Singleton instance
export const configManager = new ConfigManager(); 