import { McpServerTemplate, McpServerTemplateInfo } from './McpServerTemplate.js';

export class WeatherTemplate extends McpServerTemplate {
  constructor() {
    const info: McpServerTemplateInfo = {
      id: 'weather',
      name: 'Weather Information',
      description: 'Get current weather conditions and forecasts using OpenWeatherMap API',
      category: 'weather',
      icon: '🌤️',
      npmPackage: '@modelcontextprotocol/server-weather',
      version: 'latest',
      defaultEnabled: false,
      requiresConfig: true,
      configFields: [
        {
          key: 'apiKey',
          label: 'OpenWeatherMap API Key',
          type: 'password',
          required: true,
          placeholder: 'your-openweathermap-api-key',
          description: 'Get your free API key from https://openweathermap.org/api'
        },
        {
          key: 'units',
          label: 'Temperature Units',
          type: 'select',
          required: false,
          options: ['standard', 'metric', 'imperial'],
          description: 'Temperature units: standard (Kelvin), metric (Celsius), imperial (Fahrenheit)',
          defaultValue: 'metric'
        },
        {
          key: 'language',
          label: 'Language',
          type: 'text',
          required: false,
          placeholder: 'en',
          description: 'Language code for weather descriptions (e.g., en, es, fr, de)',
          defaultValue: 'en',
          validation: /^[a-z]{2}$/
        },
        {
          key: 'defaultLocation',
          label: 'Default Location',
          type: 'text',
          required: false,
          placeholder: 'New York, NY',
          description: 'Default city/location for weather queries when not specified'
        }
      ],
      documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/weather',
      examples: [
        'Current weather: "What\'s the weather like in Paris today?"',
        'Weather forecast: "Give me the 5-day forecast for Tokyo"',
        'Compare weather: "Compare the weather in London and Berlin"',
        'Weather alerts: "Are there any weather warnings for Miami?"'
      ]
    };

    super(info);
  }

  generateConfig(userConfig: Record<string, any>): {
    command: string;
    args: string[];
    env?: Record<string, string>;
  } {
    return {
      command: 'npx',
      args: ['--yes', '@modelcontextprotocol/server-weather'],
      env: {
        OPENWEATHERMAP_API_KEY: userConfig.apiKey,
        WEATHER_UNITS: userConfig.units || 'metric',
        WEATHER_LANGUAGE: userConfig.language || 'en',
        WEATHER_DEFAULT_LOCATION: userConfig.defaultLocation || ''
      }
    };
  }

  validateConfig(config: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate API key
    if (!config.apiKey || typeof config.apiKey !== 'string') {
      errors.push('OpenWeatherMap API key is required');
    } else if (config.apiKey.length < 10) {
      errors.push('OpenWeatherMap API key appears to be invalid (too short)');
    }

    // Validate units
    if (config.units && !['standard', 'metric', 'imperial'].includes(config.units)) {
      errors.push('Temperature units must be one of: standard, metric, imperial');
    }

    // Validate language code
    if (config.language && !/^[a-z]{2}$/.test(config.language)) {
      errors.push('Language code must be a two-letter code (e.g., en, es, fr)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 