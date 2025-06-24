import { TemplateManager } from './TemplateManager.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('TemplateManager', () => {
  let manager: TemplateManager;

  beforeEach(() => {
    manager = new TemplateManager();
  });

  it('should initialize with default templates', () => {
    const templates = manager.getAllTemplates();
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.some((t: { id: string }) => t.id === 'filesystem')).toBe(true);
    expect(templates.some((t: { id: string }) => t.id === 'websearch')).toBe(true);
  });

  it('should get template by id', () => {
    const template = manager.getTemplate('filesystem');
    expect(template).toBeDefined();
    expect(template?.getInfo().name).toBe('Filesystem Access');
  });

  it('should generate valid server config', async () => {
    const config = await manager.generateServerConfig('filesystem', {
      allowedDirectories: '/test/path'
    });
    
    expect(config.id).toBeDefined();
    expect(config.command).toBeDefined();
    expect(config.args).toBeDefined();
  });

  it('should validate template config', () => {
    const validation = manager.validateTemplateConfig('filesystem', {
      allowedDirectories: '/test/path'
    });
    
    expect(validation.valid).toBe(true);
  });

  it('should check template installation', async () => {
    const isInstalled = await manager.checkInstallation('filesystem');
    expect(typeof isInstalled).toBe('boolean');
  });
});