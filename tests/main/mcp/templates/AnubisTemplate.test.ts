import { AnubisTemplate } from '../../../../src/main/mcp/templates/AnubisTemplate.js';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AnubisTemplate', () => {
  let template: AnubisTemplate;

  beforeEach(() => {
    template = new AnubisTemplate();
  });

  it('should create with correct info', () => {
    const info = template.getInfo();
    expect(info.id).toBe('anubis');
    expect(info.name).toBe('Anubis');
    expect(info.description).toContain('Advanced file system operations');
    expect(info.category).toBe('development');
  });

  it('should generate correct npx config', () => {
    const config = template.generateConfig({});
    expect(config.command).toBeDefined();
    expect(config.args).toContain('@hive-academy/anubis');
  });

  describe('validateConfig', () => {
    it('should fail if Node.js version < 20', () => {
      vi.stubGlobal('process', { 
        version: 'v18.12.1',
        platform: 'linux'
      });
      
      const result = template.validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Node.js >= 20');
    });

    it('should pass if Node.js version >= 20', () => {
      vi.stubGlobal('process', { 
        version: 'v20.0.0',
        platform: 'linux'
      });
      
      const result = template.validateConfig({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});