import { WeatherTemplate } from '../../../../src/main/mcp/templates/WeatherTemplate.js';
import { describe, it, expect } from 'vitest';

describe('WeatherTemplate', () => {
  it('should initialize with correct info', () => {
    const template = new WeatherTemplate();
    const info = template.getInfo();
    
    expect(info.id).toBe('weather');
    expect(info.name).toBe('Weather Information');
    expect(info.category).toBe('weather');
  });

  it('should generate valid config', () => {
    const template = new WeatherTemplate();
    const config = template.generateConfig({});
    
    expect(config.command).toBeDefined();
    expect(config.args).toBeDefined();
  });

  it('should validate config', () => {
    const template = new WeatherTemplate();
    const validation = template.validateConfig({});
    
    expect(validation.valid).toBe(true);
  });
});