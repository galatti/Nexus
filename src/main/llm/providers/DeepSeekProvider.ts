import { BaseProvider, LlmResponse, StreamingResponse } from './BaseProvider.js';
import { LlmModel, LlmProviderConfig, ChatMessage } from '../../../shared/types.js';
import { logger } from '../../utils/logger.js';

export class DeepSeekProvider extends BaseProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: LlmProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.deepseek.com/v1';
    this.apiKey = config.apiKey || '';
    
    // Debug logging
    logger.info(`DeepSeek provider initialized: baseUrl=${this.baseUrl}, hasApiKey=${!!this.apiKey}, apiKeyLength=${this.apiKey?.length || 0}`);
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        logger.warn('DeepSeek API key not configured');
        return false;
      }

      // Test with a simple chat completion request
      const testRequest = {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
        temperature: 0
      };

      const response = await this.makeRequest(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testRequest),
      }, 10000);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        logger.error(`DeepSeek API test failed: ${response.status} ${response.statusText} - ${errorText}`);
        return false;
      }

      logger.info('DeepSeek connection test passed');
      return true;
    } catch (error) {
      logger.error('DeepSeek connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<LlmModel[]> {
    return [
      {
        id: 'deepseek-chat',
        name: 'deepseek-chat',
        size: '32K context',
        description: 'General-purpose conversational model',
        modified_at: undefined
      },
      {
        id: 'deepseek-coder',
        name: 'deepseek-coder', 
        size: '16K context',
        description: 'Specialized model for code generation and programming tasks',
        modified_at: undefined
      }
    ];
  }

  async sendMessage(
    messages: ChatMessage[],
    options: {
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
    } = {}
  ): Promise<LlmResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('DeepSeek API key not configured');
      }

      const modelName = this.getModelName(options.model);
      const requestBody: any = {
        model: modelName,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? this.config.maxTokens,
        stream: false,
      };

      if (options.tools) {
        requestBody.tools = options.tools;
      }

      const response = await this.makeRequest(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`DeepSeek API error: ${errorMessage}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice) {
        throw new Error('No response from DeepSeek API');
      }

      return {
        content: choice.message.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      logger.error('DeepSeek sendMessage error:', error);
      throw error;
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
    // Simplified streaming implementation
    const result = await this.sendMessage(messages, options);
    onChunk({ content: result.content, done: true });
  }
}