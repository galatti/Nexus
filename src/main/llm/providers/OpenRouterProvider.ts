import { BaseProvider, LlmResponse, StreamingResponse } from './BaseProvider';
import { LlmProviderConfig, LlmModel, ChatMessage } from '../../../shared/types';
import { logger } from '../../utils/logger';

interface OpenRouterMessage {
  role: string;
  content: string;
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterModelData {
  id: string;
  name: string;
  description?: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens?: number;
  };
}

export class OpenRouterProvider extends BaseProvider {
  private readonly API_BASE = 'https://openrouter.ai/api/v1';
  private readonly MODELS_ENDPOINT = 'https://openrouter.ai/api/v1/models';

  constructor(config: LlmProviderConfig) {
    super(config);
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        logger.warn('OpenRouter API key not configured');
        return false;
      }

      const response = await this.makeRequest(this.MODELS_ENDPOINT, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://nexus-mvp.com',
          'X-Title': 'Nexus MVP'
        }
      }, 5000);

      return response.ok;
    } catch (error) {
      logger.warn(`OpenRouter connection test failed:`, error);
      return false;
    }
  }

  async getAvailableModels(): Promise<LlmModel[]> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const response = await this.makeRequest(this.MODELS_ENDPOINT, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://nexus-mvp.com',
          'X-Title': 'Nexus MVP'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { data: OpenRouterModelData[] };
      
      return data.data.map(model => ({
        name: model.id,
        size: `${model.context_length} tokens`,
        description: model.description || `${model.name} - ${model.architecture.modality} model`,
        modified_at: undefined
      }));

    } catch (error) {
      throw this.handleError(error, 'get available models');
    }
  }

  async sendMessage(
    messages: ChatMessage[], 
    options: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      model?: string;
    } = {}
  ): Promise<LlmResponse> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const modelName = this.getModelName(options.model);
      const formattedMessages = this.formatMessages(messages);

      const requestBody = {
        model: modelName,
        messages: formattedMessages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
        stream: false
      };

      const response = await this.makeRequest(`${this.API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexus-mvp.com',
          'X-Title': 'Nexus MVP'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json() as OpenRouterResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('No response choices received from OpenRouter');
      }

      const choice = data.choices[0];

      return {
        content: choice.message.content,
        tokens: data.usage.total_tokens,
        finishReason: choice.finish_reason,
        model: data.model
      };

    } catch (error) {
      throw this.handleError(error, 'send message');
    }
  }

  async streamMessage(
    messages: ChatMessage[], 
    onChunk: (chunk: StreamingResponse) => void,
    options: {
      temperature?: number;
      maxTokens?: number;
      model?: string;
    } = {}
  ): Promise<void> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const modelName = this.getModelName(options.model);
      const formattedMessages = this.formatMessages(messages);

      const requestBody = {
        model: modelName,
        messages: formattedMessages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 4000,
        stream: true
      };

      const response = await this.makeRequest(`${this.API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://nexus-mvp.com',
          'X-Title': 'Nexus MVP'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let totalTokens = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.substring(6);
              
              if (dataStr === '[DONE]') {
                onChunk({
                  content: '',
                  done: true,
                  tokens: totalTokens
                });
                return;
              }

              try {
                const data = JSON.parse(dataStr) as any;
                
                if (data.choices && data.choices[0] && data.choices[0].delta) {
                  const delta = data.choices[0].delta;
                  
                  if (delta.content) {
                    onChunk({
                      content: delta.content,
                      done: false,
                      tokens: undefined
                    });
                  }
                }

                if (data.usage) {
                  totalTokens = data.usage.total_tokens;
                }

              } catch (parseError) {
                logger.warn('Failed to parse streaming response:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      throw this.handleError(error, 'stream message');
    }
  }

  async getModelInfo(modelId: string): Promise<OpenRouterModelData | null> {
    try {
      if (!this.config.apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const response = await this.makeRequest(`${this.MODELS_ENDPOINT}/${modelId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://nexus-mvp.com',
          'X-Title': 'Nexus MVP'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { data: OpenRouterModelData };
      return data.data;

    } catch (error) {
      logger.error(`Failed to get model info for ${modelId}:`, error);
      return null;
    }
  }

  async getCreditBalance(): Promise<number | null> {
    try {
      if (!this.config.apiKey) {
        return null;
      }

      const response = await this.makeRequest(`${this.API_BASE}/auth/key`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'HTTP-Referer': 'https://nexus-mvp.com',
          'X-Title': 'Nexus MVP'
        }
      });

      if (!response.ok) {
        logger.warn('Failed to get OpenRouter credit balance');
        return null;
      }

      const data = await response.json() as any;
      return data.data?.credit_balance || null;

    } catch (error) {
      logger.warn('Error getting OpenRouter credit balance:', error);
      return null;
    }
  }

  protected formatMessages(messages: ChatMessage[]): OpenRouterMessage[] {
    return messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }

  protected handleError(error: any, context: string): Error {
    // Handle OpenRouter-specific errors
    if (error.status === 402) {
      return new Error('Insufficient credits in OpenRouter account. Please add more credits.');
    }
    
    if (error.status === 429) {
      return new Error('OpenRouter rate limit exceeded. Please try again in a few minutes.');
    }

    if (error.status === 400 && error.message?.includes('model')) {
      return new Error('Selected model is not available or invalid for OpenRouter.');
    }

    // Fall back to base error handling
    return super.handleError(error, context);
  }
} 