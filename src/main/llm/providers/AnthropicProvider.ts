import { BaseProvider, LlmResponse, StreamingResponse } from './BaseProvider.js';
import { LlmModel, LlmProviderConfig, ChatMessage } from '../../../shared/types.js';
import { logger } from '../../utils/logger.js';

export class AnthropicProvider extends BaseProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: LlmProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
    this.apiKey = config.apiKey || '';
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        logger.warn('Anthropic API key not configured');
        return false;
      }

      const response = await this.makeRequest(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      }, 10000);

      return response.ok || response.status === 400;
    } catch (error) {
      logger.error('Anthropic connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<LlmModel[]> {
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Most capable model for complex reasoning, coding, and analysis',
        contextLength: 200000,
        supportsTools: true,
        provider: 'anthropic',
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fast, cost-effective model for simple tasks',
        contextLength: 200000,
        supportsTools: true,
        provider: 'anthropic',
      },
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for highly complex tasks',
        contextLength: 200000,
        supportsTools: true,
        provider: 'anthropic',
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
        throw new Error('Anthropic API key not configured');
      }

      const modelName = this.getModelName(options.model);
      const systemMessage = messages.find(msg => msg.role === 'system');
      const userMessages = messages.filter(msg => msg.role !== 'system');

      const requestBody: any = {
        model: modelName,
        max_tokens: options.maxTokens ?? this.config.maxTokens ?? 4000,
        temperature: options.temperature ?? this.config.temperature ?? 0.7,
        messages: userMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      };

      if (systemMessage) {
        requestBody.system = systemMessage.content;
      }

      const response = await this.makeRequest(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Anthropic API error: ${errorMessage}`);
      }

      const data = await response.json();
      
      const textContent = data.content
        ?.filter((item: any) => item.type === 'text')
        ?.map((item: any) => item.text)
        ?.join('') || '';

      return {
        content: textContent,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    } catch (error) {
      logger.error('Anthropic sendMessage error:', error);
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