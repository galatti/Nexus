import { McpServerTemplate, McpServerTemplateInfo } from './McpServerTemplate.js';

export class WeatherTemplate extends McpServerTemplate {
  constructor() {
    const info: McpServerTemplateInfo = {
      id: 'weather',
      name: 'Weather Information',
      description: 'Get current weather conditions and forecasts using OpenWeatherMap API',
      category: 'weather',
      icon: '🌤️',
      npmPackage: '@h1deya/mcp-server-weather',
      version: 'latest',
      defaultEnabled: false,
      requiresConfig: false,
      configFields: [],
      documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/weather',
      examples: [
        'Weather forecast: "Tomorrow\'s weather in Palo Alto?"',
        'Weather alerts: "Any weather alerts in California?"',
        'State weather: "What\'s the weather situation in New York state?"'
      ]
    };

    super(info);
  }

  generateConfig(userConfig: Record<string, any>): {
    command: string;
    args: string[];
    env?: Record<string, string>;
  } {
    // Use the cross-platform npx configuration
    const { command, args } = this.generateNpxConfig('@h1deya/mcp-server-weather');

    return {
      command,
      args,
      env: {
        // Ensure PATH is inherited properly on Windows
        ...(process.platform === 'win32' && { PATH: process.env.PATH })
      }
    };
  }

  validateConfig(config: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    // No configuration required for this weather server
    return {
      valid: true,
      errors: []
    };
  }
} 