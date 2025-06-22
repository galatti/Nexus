import { McpServerTemplate, McpServerTemplateInfo, McpInstallationResult } from './McpServerTemplate.js';
import { FilesystemTemplate } from './FilesystemTemplate.js';
import { WebSearchTemplate } from './WebSearchTemplate.js';
import { WeatherTemplate } from './WeatherTemplate.js';
import { McpServerConfig } from '../../../shared/types.js';
import { logger } from '../../utils/logger.js';

export class TemplateManager {
  private templates = new Map<string, McpServerTemplate>();

  constructor() {
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    const templates = [
      new FilesystemTemplate(),
      new WebSearchTemplate(),
      new WeatherTemplate()
    ];

    for (const template of templates) {
      this.templates.set(template.getInfo().id, template);
    }

    logger.info(`Initialized ${templates.length} MCP server templates`);
  }

  getAllTemplates(): McpServerTemplateInfo[] {
    return Array.from(this.templates.values()).map(template => template.getInfo());
  }

  getTemplate(templateId: string): McpServerTemplate | null {
    return this.templates.get(templateId) || null;
  }

  getTemplatesByCategory(category: string): McpServerTemplateInfo[] {
    return this.getAllTemplates().filter(template => template.category === category);
  }

  async generateServerConfig(
    templateId: string, 
    userConfig: Record<string, any>,
    serverName?: string
  ): Promise<McpServerConfig> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Validate configuration
    const validation = template.validateConfig(userConfig);
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Generate the command configuration
    const commandConfig = template.generateConfig(userConfig);
    const templateInfo = template.getInfo();

    // Create server config - use more predictable ID for built-in servers
    const serverId = templateInfo.npmPackage === undefined 
      ? `builtin-${templateId}` // For built-in servers
      : `${templateId}-${Date.now()}`; // For external servers
    const displayName = serverName || `${templateInfo.name} Server`;

    const serverConfig: McpServerConfig = {
      id: serverId,
      name: displayName,
      description: templateInfo.description,
      command: commandConfig.command,
      args: commandConfig.args,
      env: commandConfig.env,
      enabled: templateInfo.defaultEnabled,
      autoStart: templateInfo.defaultEnabled,
      templateId: templateId,
      userConfig: userConfig
    };

    return serverConfig;
  }

  async checkInstallation(templateId: string): Promise<boolean> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    try {
      return await template.checkInstallation();
    } catch (error) {
      logger.error(`Error checking installation for template ${templateId}:`, error);
      return false;
    }
  }

  async installTemplate(templateId: string): Promise<McpInstallationResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    try {
      logger.info(`Installing template: ${templateId}`);
      const result = await template.install();
      
      if (result.success) {
        logger.info(`Successfully installed template: ${templateId}`);
      } else {
        logger.error(`Failed to install template ${templateId}:`, result.error);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error installing template ${templateId}:`, error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async uninstallTemplate(templateId: string): Promise<McpInstallationResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    try {
      logger.info(`Uninstalling template: ${templateId}`);
      const result = await template.uninstall();
      
      if (result.success) {
        logger.info(`Successfully uninstalled template: ${templateId}`);
      } else {
        logger.error(`Failed to uninstall template ${templateId}:`, result.error);
      }
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error uninstalling template ${templateId}:`, error);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async checkAllInstallations(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [templateId, template] of this.templates) {
      try {
        const isInstalled = await template.checkInstallation();
        results.set(templateId, isInstalled);
      } catch (error) {
        logger.error(`Error checking installation for ${templateId}:`, error);
        results.set(templateId, false);
      }
    }
    
    return results;
  }

  validateTemplateConfig(templateId: string, config: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const template = this.templates.get(templateId);
    if (!template) {
      return {
        valid: false,
        errors: [`Template not found: ${templateId}`]
      };
    }

    return template.validateConfig(config);
  }

  getConfigFieldDefaults(templateId: string): Record<string, any> {
    const template = this.templates.get(templateId);
    if (!template) {
      return {};
    }

    const templateInfo = template.getInfo();
    const defaults: Record<string, any> = {};

    for (const field of templateInfo.configFields) {
      if (field.defaultValue !== undefined) {
        defaults[field.key] = field.defaultValue;
      }
    }

    return defaults;
  }
}

// Export singleton instance
export const templateManager = new TemplateManager(); 