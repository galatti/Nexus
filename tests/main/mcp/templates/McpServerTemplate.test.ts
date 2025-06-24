import { McpServerTemplate } from '../../../../src/main/mcp/templates/McpServerTemplate.js';
import { describe, it, expect } from 'vitest';

describe('McpServerTemplate', () => {
  class TestTemplate extends McpServerTemplate {
    constructor() {
      super({
        id: 'test',
        name: 'Test Template',
        description: 'Test description',
        category: 'custom',
        icon: '⚡',
        defaultEnabled: true,
        requiresConfig: false,
        configFields: []
      });
    }

    generateConfig(userConfig: Record<string, any>) {
      return { command: 'test', args: [] };
    }

    validateConfig(config: Record<string, any>) {
      return { valid: true, errors: [] };
    }
  }

  it('should initialize with provided info', () => {
    const template = new TestTemplate();
    const info = template.getInfo();
    
    expect(info.id).toBe('test');
    expect(info.name).toBe('Test Template');
  });

  it('should generate config', () => {
    const template = new TestTemplate();
    const config = template.generateConfig({});
    
    expect(config.command).toBe('test');
  });

  it('should validate config', () => {
    const template = new TestTemplate();
    const validation = template.validateConfig({});
    
    expect(validation.valid).toBe(true);
  });
});