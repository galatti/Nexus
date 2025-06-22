import { EventEmitter } from 'events';
import { BaseProvider, LlmResponse, StreamingResponse } from './providers/BaseProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenRouterProvider } from './providers/OpenRouterProvider';
import { LlmProviderConfig, LlmModel, ChatMessage } from '../../shared/types';

export interface LlmManagerStatus {
  currentProvider: string | null;
  isHealthy: boolean;
  availableProviders: string[];
  lastHealthCheck: Date | null;
}

export class LlmManager extends EventEmitter {
  private providers = new Map<string, BaseProvider>();
  private currentProvider: BaseProvider | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  async initialize(): Promise<void> {
    console.log('Initializing LLM Manager');
    
    // Start health monitoring
    this.startHealthMonitoring();
    
    console.log('LLM Manager initialized successfully');
  }

  async addProvider(config: LlmProviderConfig): Promise<void> {
    try {
      let provider: BaseProvider;

      switch (config.type) {
        case 'ollama':
          provider = new OllamaProvider(config);
          break;
        case 'openrouter':
          provider = new OpenRouterProvider(config);
          break;
        default:
          throw new Error(`Unsupported provider type: ${config.type}`);
      }

      const providerId = this.getProviderId(config);
      this.providers.set(providerId, provider);

      console.log(`LLM provider added: ${config.name} (${config.type})`);

      // Set as current provider if it's the first enabled one
      if (config.enabled && !this.currentProvider) {
        await this.setCurrentProvider(providerId);
      }

      this.emit('providerAdded', { providerId, config });

    } catch (error) {
      console.error(`Failed to add LLM provider: ${config.name}`, error);
      throw error;
    }
  }

  async removeProvider(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      console.warn(`Attempted to remove non-existent provider: ${providerId}`);
      return;
    }

    // If this was the current provider, clear it
    if (this.currentProvider === provider) {
      this.currentProvider = null;
      
      // Try to set another enabled provider as current
      await this.selectNextAvailableProvider();
    }

    this.providers.delete(providerId);
    console.log(`LLM provider removed: ${providerId}`);
    
    this.emit('providerRemoved', { providerId });
  }

  async updateProvider(providerId: string, updates: Partial<LlmProviderConfig>): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    provider.updateConfig(updates);
    console.log(`LLM provider updated: ${providerId}`);

    // If this provider was disabled, clear it as current
    if (updates.enabled === false && this.currentProvider === provider) {
      this.currentProvider = null;
      await this.selectNextAvailableProvider();
    }

    // If this provider was enabled and we don't have a current provider, set it
    if (updates.enabled === true && !this.currentProvider) {
      await this.setCurrentProvider(providerId);
    }

    this.emit('providerUpdated', { providerId, updates });
  }

  async setCurrentProvider(providerId: string): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    if (!provider.isEnabled()) {
      throw new Error(`Provider is disabled: ${providerId}`);
    }

    // Test connection before setting as current
    const isHealthy = await provider.checkHealth();
    if (!isHealthy) {
      console.warn(`Provider health check failed, but setting as current anyway: ${providerId}`);
    }

    this.currentProvider = provider;
    console.log(`Current LLM provider set to: ${providerId}`);
    
    this.emit('currentProviderChanged', { providerId, isHealthy });
  }

  getCurrentProvider(): BaseProvider | null {
    return this.currentProvider;
  }

  getProvider(providerId: string): BaseProvider | null {
    return this.providers.get(providerId) || null;
  }

  getAllProviders(): Map<string, BaseProvider> {
    return new Map(this.providers);
  }

  async sendMessage(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
      providerId?: string;
    }
  ): Promise<LlmResponse> {
    const provider = options?.providerId 
      ? this.providers.get(options.providerId)
      : this.currentProvider;

    if (!provider) {
      throw new Error('No LLM provider available');
    }

    if (!provider.isEnabled()) {
      throw new Error('Current LLM provider is disabled');
    }

    try {
      const response = await provider.sendMessage(messages, options);
      
      this.emit('messageProcessed', {
        providerId: this.getProviderIdByInstance(provider),
        tokens: response.tokens,
        model: response.model
      });

      return response;
    } catch (error) {
      console.error('LLM message processing failed:', error);
      
      this.emit('messageError', {
        providerId: this.getProviderIdByInstance(provider),
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  async streamMessage(
    messages: ChatMessage[],
    onChunk: (chunk: StreamingResponse) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
      providerId?: string;
    }
  ): Promise<void> {
    const provider = options?.providerId 
      ? this.providers.get(options.providerId)
      : this.currentProvider;

    if (!provider) {
      throw new Error('No LLM provider available');
    }

    if (!provider.isEnabled()) {
      throw new Error('Current LLM provider is disabled');
    }

    try {
      await provider.streamMessage(messages, onChunk, options);
      
      this.emit('streamProcessed', {
        providerId: this.getProviderIdByInstance(provider)
      });

    } catch (error) {
      console.error('LLM streaming failed:', error);
      
      this.emit('messageError', {
        providerId: this.getProviderIdByInstance(provider),
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  async getAvailableModels(providerId?: string): Promise<LlmModel[]> {
    const provider = providerId 
      ? this.providers.get(providerId)
      : this.currentProvider;

    if (!provider) {
      return [];
    }

    try {
      return await provider.getAvailableModels();
    } catch (error) {
      console.error(`Failed to get models for provider ${providerId}:`, error);
      return [];
    }
  }

  getStatus(): LlmManagerStatus {
    const availableProviders = Array.from(this.providers.keys())
      .filter(id => {
        const provider = this.providers.get(id);
        return provider?.isEnabled() ?? false;
      });

    return {
      currentProvider: this.currentProvider 
        ? this.getProviderIdByInstance(this.currentProvider)
        : null,
      isHealthy: this.currentProvider?.getHealthStatus().isHealthy ?? false,
      availableProviders,
      lastHealthCheck: new Date()
    };
  }

  async checkAllProvidersHealth(): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();

    for (const [id, provider] of this.providers) {
      if (provider.isEnabled()) {
        try {
          const isHealthy = await provider.checkHealth();
          healthStatus.set(id, isHealthy);
        } catch (error) {
          console.error(`Health check failed for provider ${id}:`, error);
          healthStatus.set(id, false);
        }
      } else {
        healthStatus.set(id, false);
      }
    }

    return healthStatus;
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down LLM Manager');
    
    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clear current provider
    this.currentProvider = null;
    
    console.log('LLM Manager shutdown complete');
  }

  private async selectNextAvailableProvider(): Promise<void> {
    for (const [id, provider] of this.providers) {
      if (provider.isEnabled()) {
        try {
          await this.setCurrentProvider(id);
          return;
        } catch (error) {
          console.warn(`Failed to set provider as current: ${id}`, error);
        }
      }
    }
    
    console.warn('No available LLM providers found');
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkAllProvidersHealth();
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private getProviderId(config: LlmProviderConfig): string {
    return `${config.type}-${config.name.toLowerCase().replace(/\s+/g, '-')}`;
  }

  private getProviderIdByInstance(provider: BaseProvider): string | null {
    for (const [id, p] of this.providers) {
      if (p === provider) {
        return id;
      }
    }
    return null;
  }
}

// Singleton instance
export const llmManager = new LlmManager(); 