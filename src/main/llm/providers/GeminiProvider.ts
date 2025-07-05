import { BaseProvider, LlmResponse, StreamingResponse } from './BaseProvider.js';
import { LlmModel, LlmProviderConfig, ChatMessage } from '../../../shared/types.js';
import { logger } from '../../utils/logger.js';

export class GeminiProvider extends BaseProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: LlmProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1';
    this.apiKey = config.apiKey || '';
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        logger.warn('Google Gemini API key not configured');
        return false;
      }

      const response = await this.makeRequest(`${this.baseUrl}/models?key=${this.apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }, 10000);

      if (!response.ok) {
        logger.error(`Gemini API test failed: ${response.status} ${response.statusText}`);
        return false;
      }

      const data = await response.json();
      return Array.isArray(data.models) && data.models.length > 0;
    } catch (error) {
      logger.error('Gemini connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<LlmModel[]> {
    return [
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash',
        description: 'Next-generation multimodal model with enhanced reasoning capabilities',
        contextLength: 1000000,
        supportsTools: true,
        provider: 'gemini',
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Most capable model for complex reasoning and analysis',
        contextLength: 2000000,
        supportsTools: true,
        provider: 'gemini',
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast and efficient model for most tasks',
        contextLength: 1000000,
        supportsTools: true,
        provider: 'gemini',
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
        throw new Error('Google Gemini API key not configured');
      }

      const modelName = this.getModelName(options.model);
      const systemMessage = messages.find(msg => msg.role === 'system');
      const userMessages = messages.filter(msg => msg.role !== 'system');

      const contents = userMessages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

      const requestBody: any = {
        contents,
        generationConfig: {
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? this.config.maxTokens,
        },
      };

      if (systemMessage) {
        requestBody.systemInstruction = {
          parts: [{ text: systemMessage.content }],
        };
      }

      const response = await this.makeRequest(`${this.baseUrl}/models/${modelName}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(`Gemini API error: ${errorMessage}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        throw new Error('No response from Gemini API');
      }

      const content = candidate.content;
      const textParts = content.parts.filter((part: any) => part.text);

      return {
        content: textParts.map((part: any) => part.text).join(''),
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      logger.error('Gemini sendMessage error:', error);
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