import { LlmProviderConfig, LlmModel, ChatMessage } from '../../../shared/types.js';

export interface LlmResponse {
  content: string;
  tokens?: number;
  finishReason?: string;
  model?: string;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface StreamingResponse {
  content: string;
  done: boolean;
  tokens?: number;
}

export abstract class BaseProvider {
  protected config: LlmProviderConfig;
  protected isHealthy: boolean = false;
  protected lastHealthCheck: Date | null = null;

  constructor(config: LlmProviderConfig) {
    this.config = config;
  }

  abstract testConnection(): Promise<boolean>;
  abstract getAvailableModels(): Promise<LlmModel[]>;
  abstract sendMessage(
    messages: ChatMessage[], 
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      model?: string;
      tools?: Array<{ 
        type: 'function';
        function: {
          name: string;
          description: string;
          parameters: any;
        };
      }>;
    }
  ): Promise<LlmResponse>;
  abstract streamMessage(
    messages: ChatMessage[], 
    onChunk: (chunk: StreamingResponse) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    }
  ): Promise<void>;

  public getConfig(): LlmProviderConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<LlmProviderConfig>): void {
    this.config = { ...this.config, ...updates };
    this.isHealthy = false; // Reset health status on config change
    console.log(`Provider config updated: ${this.config.name}`);
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const isHealthy = await this.testConnection();
      this.isHealthy = isHealthy;
      this.lastHealthCheck = new Date();
      
      if (isHealthy) {
        console.log(`Health check passed for provider: ${this.config.name}`);
      } else {
        console.warn(`Health check failed for provider: ${this.config.name}`);
      }
      
      return isHealthy;
    } catch (error) {
      console.error(`Health check error for provider ${this.config.name}:`, error);
      this.isHealthy = false;
      this.lastHealthCheck = new Date();
      return false;
    }
  }

  public getHealthStatus(): {
    isHealthy: boolean;
    lastCheck: Date | null;
    provider: string;
  } {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastHealthCheck,
      provider: this.config.name
    };
  }

  protected formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  protected validateModel(model: string): boolean {
    if (!this.config.models || this.config.models.length === 0) {
      return true; // If no models list, assume valid
    }
    
    return this.config.models.some(m => m.name === model);
  }

  protected getModelName(requestedModel?: string): string {
    if (requestedModel && this.validateModel(requestedModel)) {
      return requestedModel;
    }
    
    return this.config.model;
  }

  protected async makeRequest(
    url: string,
    options: RequestInit,
    timeoutMs: number = 30000
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  protected handleError(error: any, context: string): Error {
    console.error(`${this.config.name} ${context} error:`, error);
    
    if (error.name === 'AbortError') {
      return new Error(`Request timeout for ${this.config.name}`);
    }
    
    if (error.code === 'ECONNREFUSED') {
      return new Error(`Connection refused to ${this.config.name}. Is the service running?`);
    }
    
    if (error.status === 401) {
      return new Error(`Authentication failed for ${this.config.name}. Check your API key.`);
    }
    
    if (error.status === 429) {
      return new Error(`Rate limit exceeded for ${this.config.name}. Please try again later.`);
    }
    
    if (error.status >= 500) {
      return new Error(`Server error from ${this.config.name}. Please try again later.`);
    }
    
    return error instanceof Error ? error : new Error(`Unknown error in ${this.config.name}: ${String(error)}`);
  }
} 