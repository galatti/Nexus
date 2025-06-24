import { McpServerTemplate, McpServerTemplateInfo } from './McpServerTemplate.js';

export class AnubisTemplate extends McpServerTemplate {
  constructor() {
    const info: McpServerTemplateInfo = {
      id: 'anubis',
      name: 'Anubis',
      description: 'Advanced file system operations, git management, and development tools by Hive Academy (Requires Node.js >= 20)',
      category: 'development',
      icon: '🐕',
      npmPackage: '@hive-academy/anubis',
      defaultEnabled: false,
      requiresConfig: false,
      configFields: [],
      documentation: 'https://github.com/Hive-Academy/Anubis-MCP',
      examples: [
        'File system operations with advanced features',
        'Git repository management',
        'Development workflow automation'
      ]
    };
    
    super(info);
  }

  generateConfig(_userConfig: Record<string, any>): {
    command: string;
    args: string[];
    env?: Record<string, string>;
  } {
    return this.generateNpxConfig('@hive-academy/anubis');
  }

  validateConfig(_config: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 20) {
      return {
        valid: false,
        errors: [`Anubis requires Node.js >= 20, but you're running ${nodeVersion}. Please upgrade Node.js.`]
      };
    }

    return {
      valid: true,
      errors: []
    };
  }
}