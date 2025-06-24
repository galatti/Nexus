import { FilesystemTemplate } from './FilesystemTemplate.js';
import { describe, it, expect } from 'vitest';

describe('FilesystemTemplate', () => {
  it('should initialize with correct info', () => {
    const template = new FilesystemTemplate();
    const info = template.getInfo();
    
    expect(info.id).toBe('filesystem');
    expect(info.name).toBe('Filesystem Access');
    expect(info.category).toBe('filesystem');
  });

  it('should generate valid config with default values', () => {
    const template = new FilesystemTemplate();
    const config = template.generateConfig({});
    
    expect(config.command).toBeDefined();
    expect(config.args).toBeDefined();
  });

  it('should validate config correctly', () => {
    const template = new FilesystemTemplate();
    const validConfig = { allowedDirectories: '/test/path' };
    const invalidConfig = { allowedDirectories: '' };
    
    expect(template.validateConfig(validConfig).valid).toBe(true);
    expect(template.validateConfig(invalidConfig).valid).toBe(false);
  });
});