import { BaseProvider, LlmResponse, StreamingResponse } from './BaseProvider.js';
import { LlmModel, LlmProviderConfig, ChatMessage } from '../../../shared/types.js';
import { logger } from '../../utils/logger.js';

export class GrokProvider extends BaseProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: LlmProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.x.ai/v1';
    this.apiKey = config.apiKey || '';
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        logger.warn('xAI Grok API key not configured');
        return false;
      }

      const response = await this.makeRequest(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }, 10000);

      if (!response.ok) {
        logger.error(`Grok API test failed: ${response.status} ${response.statusText}`);
        return false;
      }

      const data = await response.json();
      return Array.isArray(data.data) && data.data.length > 0;
    } catch (error) {
      logger.error('Grok connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<LlmModel[]> {
    return [
      {
        id: 'grok-beta',
        name: 'Grok Beta',
        description: 'Latest Grok model with advanced reasoning and real-time data access',
        contextLength: 131072,
        supportsTools: true,
        provider: 'grok',
      },
      {
        id: 'grok-vision-beta',
        name: 'Grok Vision Beta',
        description: 'Multimodal Grok model with vision capabilities',
        contextLength: 131072,
        supportsTools: true,
        provider: 'grok',
      },
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
        throw new Error('xAI Grok API key not configured');
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
        throw new Error(`Grok API error: ${errorMessage}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice) {
        throw new Error('No response from Grok API');
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
      logger.error('Grok sendMessage error:', error);
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