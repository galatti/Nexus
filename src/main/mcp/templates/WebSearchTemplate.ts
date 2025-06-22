import { McpServerTemplate, McpServerTemplateInfo } from './McpServerTemplate.js';

export class WebSearchTemplate extends McpServerTemplate {
  constructor() {
    const info: McpServerTemplateInfo = {
      id: 'websearch',
      name: 'Web Search',
      description: 'Search the web using Brave Search API for real-time information and research',
      category: 'web',
      icon: '🔍',
      npmPackage: '@modelcontextprotocol/server-brave-search',
      version: 'latest',
      defaultEnabled: false,
      requiresConfig: true,
      configFields: [
        {
          key: 'apiKey',
          label: 'Brave Search API Key',
          type: 'password',
          required: true,
          placeholder: 'BSA...your-api-key',
          description: 'Get your free API key from https://api.search.brave.com/register'
        },
        {
          key: 'maxResults',
          label: 'Max Results',
          type: 'number',
          required: false,
          placeholder: '10',
          description: 'Maximum number of search results to return (1-50)',
          defaultValue: 10
        },
        {
          key: 'safeSearch',
          label: 'Safe Search',
          type: 'select',
          required: false,
          options: ['off', 'moderate', 'strict'],
          description: 'Filter adult content from search results',
          defaultValue: 'moderate'
        },
        {
          key: 'country',
          label: 'Country Code',
          type: 'text',
          required: false,
          placeholder: 'US',
          description: 'Two-letter country code for localized results (e.g., US, GB, DE)',
          defaultValue: 'US',
          validation: /^[A-Z]{2}$/
        }
      ],
      documentation: 'https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search',
      examples: [
        'Search for current events: "What are the latest news about AI developments?"',
        'Research topics: "Find information about renewable energy trends in 2024"',
        'Get factual information: "What is the current population of Tokyo?"',
        'Find tutorials: "Search for Python machine learning tutorials"'
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
      args: ['--yes', '@modelcontextprotocol/server-brave-search'],
      env: {
        BRAVE_API_KEY: userConfig.apiKey,
        BRAVE_MAX_RESULTS: userConfig.maxResults ? String(userConfig.maxResults) : '10',
        BRAVE_SAFE_SEARCH: userConfig.safeSearch || 'moderate',
        BRAVE_COUNTRY: userConfig.country || 'US'
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
      errors.push('Brave Search API key is required');
    } else if (!config.apiKey.startsWith('BSA')) {
      errors.push('Brave Search API key should start with "BSA"');
    }

    // Validate max results
    if (config.maxResults !== undefined) {
      const maxResults = Number(config.maxResults);
      if (isNaN(maxResults) || maxResults < 1 || maxResults > 50) {
        errors.push('Max results must be a number between 1 and 50');
      }
    }

    // Validate safe search
    if (config.safeSearch && !['off', 'moderate', 'strict'].includes(config.safeSearch)) {
      errors.push('Safe search must be one of: off, moderate, strict');
    }

    // Validate country code
    if (config.country && !/^[A-Z]{2}$/.test(config.country)) {
      errors.push('Country code must be a two-letter code (e.g., US, GB, DE)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
} 