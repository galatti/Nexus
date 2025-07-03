import { EventEmitter } from 'events';
import { BaseProvider, LlmResponse, StreamingResponse } from './providers/BaseProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { OpenRouterProvider } from './providers/OpenRouterProvider.js';
import { LlmProviderConfig, LlmModel, ChatMessage, ProviderHealth, ProviderWarning } from '../../shared/types.js';

export interface LlmManagerStatus {
  enabledProviders: Array<{
    id: string;
    name: string;
    type: string;
    isHealthy: boolean;
    models: LlmModel[];
  }>;
  defaultProviderModel?: {
    providerId: string;
    modelName: string;
  };
}

export class LlmManager extends EventEmitter {
  private providers = new Map<string, BaseProvider>();
  private healthStatus = new Map<string, ProviderHealth>();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  async initialize(): Promise<void> {
    console.log('Initializing LLM Manager');
    
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

      // Initialize health status
      this.healthStatus.set(providerId, {
        providerId,
        isHealthy: false,
        lastChecked: new Date(),
        retryCount: 0
      });

      console.log(`LLM provider added: ${config.name} (${config.type})`);

      // Check health immediately if enabled
      if (config.enabled) {
        await this.checkProviderHealth(providerId);
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

    this.providers.delete(providerId);
    this.healthStatus.delete(providerId);
    
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

    // Check health if enabled
    if (updates.enabled === true) {
      await this.checkProviderHealth(providerId);
    } else if (updates.enabled === false) {
      // Mark as unhealthy if disabled
      const health = this.healthStatus.get(providerId);
      if (health) {
        health.isHealthy = false;
        health.lastChecked = new Date();
        health.error = 'Provider disabled';
      }
    }

    this.emit('providerUpdated', { providerId, updates });
  }

  getProvider(providerId: string): BaseProvider | null {
    return this.providers.get(providerId) || null;
  }

  getAllProviders(): Map<string, BaseProvider> {
    return new Map(this.providers);
  }

  getProviderHealth(providerId: string): ProviderHealth | undefined {
    return this.healthStatus.get(providerId);
  }

  getAllProviderHealth(): Map<string, ProviderHealth> {
    return new Map(this.healthStatus);
  }

  async sendMessage(
    messages: ChatMessage[],
    providerId: string,
    modelName: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      tools?: Array<{ 
        type: 'function';
        function: {
          name: string;
          description: string;
          parameters: any;
        };
      }>;
    }
  ): Promise<LlmResponse> {
    const provider = this.providers.get(providerId);
    const health = this.healthStatus.get(providerId);

    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    if (!provider.isEnabled()) {
      throw new Error(`Provider is disabled: ${providerId}`);
    }

    // Check if provider is healthy
    if (!health?.isHealthy) {
      // Try to recover the provider
      await this.checkProviderHealth(providerId);
      const updatedHealth = this.healthStatus.get(providerId);
      
      if (!updatedHealth?.isHealthy) {
        throw new Error(`Provider ${providerId} is currently unhealthy: ${updatedHealth?.error || 'Unknown error'}`);
      }
    }

    try {
      // Merge provider defaults with passed options
      const providerConfig = provider.getConfig();
      const mergedOptions = {
        temperature: providerConfig.temperature,
        maxTokens: providerConfig.maxTokens,
        model: modelName, // Use the specific model requested
        ...options // User options override provider defaults
      };
      
      const response = await provider.sendMessage(messages, mergedOptions);
      
      // Reset retry count on successful message
      if (health) {
        health.retryCount = 0;
      }
      
      this.emit('messageProcessed', {
        providerId,
        modelName,
        tokens: response.tokens,
        model: response.model
      });

      return response;
    } catch (error) {
      console.error('LLM message processing failed:', error);
      
      // Update health status on error
      if (health) {
        health.isHealthy = false;
        health.error = error instanceof Error ? error.message : String(error);
        health.retryCount++;
        health.lastChecked = new Date();
      }
      
      this.emit('messageError', {
        providerId,
        modelName,
        error: error instanceof Error ? error.message : String(error)
      });

      throw error;
    }
  }

  async checkProviderHealth(providerId: string): Promise<boolean> {
    const provider = this.providers.get(providerId);
    let health = this.healthStatus.get(providerId);

    if (!provider) {
      return false;
    }

    if (!health) {
      health = {
        providerId,
        isHealthy: false,
        lastChecked: new Date(),
        retryCount: 0
      };
      this.healthStatus.set(providerId, health);
    }

    try {
      const isHealthy = await provider.checkHealth();
      
      health.isHealthy = isHealthy;
      health.lastChecked = new Date();
      health.error = isHealthy ? undefined : 'Health check failed';
      
      if (isHealthy) {
        health.retryCount = 0;
        health.nextRetry = undefined;
      } else {
        health.retryCount++;
        // Exponential backoff for retries
        const backoffMs = Math.min(300000, 5000 * Math.pow(2, health.retryCount)); // Max 5 minutes
        health.nextRetry = new Date(Date.now() + backoffMs);
      }

      console.log(`Health check for ${providerId}: ${isHealthy ? 'healthy' : 'unhealthy'}`);
      
      this.emit('providerHealthChanged', { providerId, isHealthy, health });
      
      return isHealthy;
    } catch (error) {
      health.isHealthy = false;
      health.error = error instanceof Error ? error.message : String(error);
      health.lastChecked = new Date();
      health.retryCount++;

      console.error(`Health check failed for ${providerId}:`, error);
      
      this.emit('providerHealthChanged', { providerId, isHealthy: false, health });
      
      return false;
    }
  }

  async checkAllProvidersHealth(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const healthChecks = Array.from(this.providers.keys()).map(async (providerId) => {
      const provider = this.providers.get(providerId);
      if (provider?.isEnabled()) {
        const health = this.healthStatus.get(providerId);
        
        // Skip if we recently failed and haven't reached retry time
        if (health?.nextRetry && health.nextRetry > new Date()) {
          results.set(providerId, health.isHealthy);
          return;
        }
        
        const isHealthy = await this.checkProviderHealth(providerId);
        results.set(providerId, isHealthy);
      }
    });

    await Promise.allSettled(healthChecks);
    return results;
  }

  async getAvailableModels(providerId: string): Promise<LlmModel[]> {
    const provider = this.providers.get(providerId);

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

  async getStatus(): Promise<LlmManagerStatus> {
    console.log('[LlmManager] getStatus: Gathering status for providers...');

    // Snapshot of currently registered providers and their enabled state
    for (const [pid, provider] of this.providers) {
      const cfg = provider.getConfig();
      console.log(`  → Provider ${pid}: name="${cfg.name}" type=${cfg.type} enabled=${provider.isEnabled()}`);
    }

    const enabledProviders: Array<{
      id: string;
      name: string;
      type: string;
      isHealthy: boolean;
      models: LlmModel[];
    }> = [];

    for (const [providerId, provider] of this.providers) {
      if (provider.isEnabled()) {
        console.log(`[LlmManager] getStatus: Processing enabled provider ${providerId}`);
        const config = provider.getConfig();
        const health = this.healthStatus.get(providerId);
        const models = await this.getAvailableModels(providerId);

        console.log(`    • ${providerId} health=${health?.isHealthy ?? false} models=${models.length}`);

        enabledProviders.push({
          id: providerId,
          name: config.name,
          type: config.type,
          isHealthy: health?.isHealthy ?? false,
          models
        });
      }
    }

    console.log(`[LlmManager] getStatus: Returning ${enabledProviders.length} enabled providers`);

    return {
      enabledProviders
    };
  }

  validateProviderModel(providerId: string, modelName: string): ProviderWarning | null {
    const provider = this.providers.get(providerId);
    
    if (!provider) {
      return {
        type: 'removed',
        providerId,
        modelName,
        message: `Provider "${providerId}" no longer exists`,
        actions: [
          { label: 'Select Different Provider', action: 'select_provider' }
        ]
      };
    }

    if (!provider.isEnabled()) {
      return {
        type: 'disabled',
        providerId,
        modelName,
        message: `Provider "${provider.getConfig().name}" is disabled`,
        actions: [
          { label: 'Enable Provider', action: 'enable', data: { providerId } },
          { label: 'Select Different Provider', action: 'select_provider' }
        ]
      };
    }

    const health = this.healthStatus.get(providerId);
    if (!health?.isHealthy) {
      return {
        type: 'unhealthy',
        providerId,
        modelName,
        message: `Provider "${provider.getConfig().name}" is currently unhealthy: ${health?.error || 'Unknown error'}`,
        actions: [
          { label: 'Retry Connection', action: 'retry', data: { providerId } },
          { label: 'Select Different Provider', action: 'select_provider' }
        ]
      };
    }

    return null; // Provider+model is valid
  }

  async shutdown(): Promise<void> {
    console.log('Shutting down LLM Manager');
    
    this.providers.clear();
    this.healthStatus.clear();
    this.removeAllListeners();
    
    console.log('LLM Manager shutdown complete');
  }

  private getProviderId(config: LlmProviderConfig): string {
    return config.id || `${config.type}-${config.name.toLowerCase().replace(/\s+/g, '-')}`;
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