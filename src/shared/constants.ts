/**
 * Application constants and branding
 * Centralizes all app-related strings to avoid hardcoding issues
 */

export const APP_CONSTANTS = {
  // App identity
  APP_NAME: 'nexus',
  APP_DISPLAY_NAME: 'Nexus',
  APP_VERSION: '0.2.0',
  
  // URLs and domains
  APP_DOMAIN: 'https://nexus.app',
  GITHUB_URL: 'https://github.com/galatti/Nexus',
  
  // File names
  CONFIG_FILE_NAME: 'nexus-config.json',
  LOG_FILE_NAME: 'nexus.log',
  ERROR_LOG_FILE_NAME: 'error.log',
  
  // Directory names
  CONFIG_DIR_NAME: 'config',
  LOGS_DIR_NAME: 'logs',
  
  // OpenRouter API headers
  OPENROUTER_REFERER: 'https://nexus.app',
  OPENROUTER_TITLE: 'Nexus',
  
  // Default provider settings
  DEFAULT_OLLAMA_URL: 'http://127.0.0.1:11434',
  DEFAULT_OLLAMA_MODEL: 'llama3.2',
} as const;

// Type for the constants (useful for TypeScript)
export type AppConstants = typeof APP_CONSTANTS;