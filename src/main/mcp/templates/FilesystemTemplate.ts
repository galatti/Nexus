import { McpServerTemplate, McpServerTemplateInfo } from './McpServerTemplate.js';
import { join } from 'path';
import { homedir } from 'os';

export class FilesystemTemplate extends McpServerTemplate {
  constructor() {
    const info: McpServerTemplateInfo = {
      id: 'filesystem',
      name: 'Filesystem Access',
      description: 'Provides secure access to read and write files and directories on your system',
      category: 'filesystem',
      icon: '📁',
      npmPackage: '@modelcontextprotocol/server-filesystem',
      version: 'latest',
      defaultEnabled: true,
      requiresConfig: true,
      configFields: [
        {
          key: 'allowedDirectories',
          label: 'Allowed Directories',
          type: 'text',
          required: true,
          placeholder: 'C:\\Users\\username\\Documents,C:\\Projects',
          description: 'Comma-separated list of directory paths that the server can access. Use absolute paths.',
          defaultValue: join(homedir(), 'Documents')
        },
        {
          key: 'readOnly',
          label: 'Read Only Mode',
          type: 'boolean',
          required: false,
          description: 'If enabled, only allows reading files, not writing or creating new ones',
          defaultValue: false
        },
        {
          key: 'maxFileSize',
          label: 'Max File Size (MB)',
          type: 'number',
          required: false,
          placeholder: '10',
          description: 'Maximum file size in megabytes that can be read or written',
          defaultValue: 10
        }
      ],
      documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
      examples: [
        'Read a configuration file: "Read the contents of my config.json file"',
        'List directory contents: "List all files in my Documents folder"',
        'Create a new file: "Create a new README.md file with project documentation"',
        'Search for files: "Find all .txt files in my project directory"'
      ]
    };

    super(info);
  }

  generateConfig(userConfig: Record<string, any>): {
    command: string;
    args: string[];
    env?: Record<string, string>;
  } {
    const allowedDirs = userConfig.allowedDirectories
      ? userConfig.allowedDirectories.split(',').map((dir: string) => dir.trim())
      : [join(homedir(), 'Documents')];

    const args = allowedDirs;

    // Add read-only flag if specified
    if (userConfig.readOnly) {
      args.unshift('--read-only');
    }

    return {
      command: 'npx',
      args: ['--yes', '@modelcontextprotocol/server-filesystem', ...args],
      env: {
        MCP_FILESYSTEM_MAX_FILE_SIZE: userConfig.maxFileSize ? 
          String(userConfig.maxFileSize * 1024 * 1024) : '10485760' // 10MB default
      }
    };
  }

  validateConfig(config: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate allowed directories
    if (!config.allowedDirectories || typeof config.allowedDirectories !== 'string') {
      errors.push('At least one allowed directory must be specified');
    } else {
      const dirs = config.allowedDirectories.split(',').map((dir: string) => dir.trim());
      if (dirs.length === 0 || dirs.some(dir => !dir)) {
        errors.push('All directory paths must be non-empty');
      }
    }

    // Validate max file size
    if (config.maxFileSize !== undefined) {
      const size = Number(config.maxFileSize);
      if (isNaN(size) || size <= 0 || size > 1000) {
        errors.push('Max file size must be a number between 1 and 1000 MB');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 