import { WebSearchTemplate } from '../../../../src/main/mcp/templates/WebSearchTemplate.js';
import { describe, it, expect } from 'vitest';

describe('WebSearchTemplate', () => {
  it('should initialize with correct info', () => {
    const template = new WebSearchTemplate();
    const info = template.getInfo();
    
    expect(info.id).toBe('websearch');
    expect(info.name).toBe('Web Search');
    expect(info.category).toBe('web');
  });

  it('should generate valid config with API key', () => {
    const template = new WebSearchTemplate();
    const config = template.generateConfig({
      apiKey: 'BSA-test-key',
      maxResults: 5,
      safeSearch: 'moderate',
      country: 'US'
    });
    
    expect(config.command).toBeDefined();
    expect(config.args).toBeDefined();
    expect(config.env?.BRAVE_API_KEY).toBe('BSA-test-key');
  });

  it('should validate config correctly', () => {
    const template = new WebSearchTemplate();
    
    // Test valid config
    const validConfig = {
      apiKey: 'BSA-valid-key',
      maxResults: 10,
      safeSearch: 'strict',
      country: 'GB'
    };
    expect(template.validateConfig(validConfig).valid).toBe(true);
    
    // Test invalid config
    const invalidConfig = {
      apiKey: '',
      maxResults: 60,
      safeSearch: 'invalid',
      country: 'USA'
    };
    const validation = template.validateConfig(invalidConfig);
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });
});