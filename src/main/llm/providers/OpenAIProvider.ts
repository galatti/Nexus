import { BaseProvider, LlmResponse, StreamingResponse } from './BaseProvider.js';
import { LlmModel, LlmProviderConfig, ChatMessage } from '../../../shared/types.js';
import { logger } from '../../utils/logger.js';

export class OpenAIProvider extends BaseProvider {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: LlmProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
    this.apiKey = config.apiKey || '';
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        logger.warn('OpenAI API key not configured');
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
        logger.error(`OpenAI API test failed: ${response.status} ${response.statusText}`);
        return false;
      }

      const data = await response.json();
      return Array.isArray(data.data) && data.data.length > 0;
    } catch (error) {
      logger.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  async getAvailableModels(): Promise<LlmModel[]> {
    try {
      if (!this.apiKey) {
        logger.warn('OpenAI API key not configured');
        return this.getDefaultModels();
      }

      const response = await this.makeRequest(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        logger.error(`Failed to fetch OpenAI models: ${response.status} ${response.statusText}`);
        return this.getDefaultModels();
      }

      const data = await response.json();
      const models: LlmModel[] = data.data
        .filter((model: any) => model.id && this.isValidModel(model.id))
        .map((model: any) => ({
          id: model.id,
          name: this.getModelDisplayName(model.id),
          description: this.getModelDescription(model.id),
          contextLength: this.getModelContextLength(model.id),
          supportsTools: this.getModelSupportsTools(model.id),
          provider: 'openai',
        }));

      return models.length > 0 ? models : this.getDefaultModels();
    } catch (error) {
      logger.error('Error fetching OpenAI models:', error);
      return this.getDefaultModels();
    }
  }

  private getDefaultModels(): LlmModel[] {
    return [
      {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: 'Most capable multimodal model, great for complex reasoning tasks',
        contextLength: 128000,
        supportsTools: true,
        provider: 'openai',
      },
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        description: 'Fast, cost-effective model for simpler tasks',
        contextLength: 128000,
        supportsTools: true,
        provider: 'openai',
      },
      {
        id: 'o1-preview',
        name: 'o1-preview',
        description: 'Advanced reasoning model for complex problems',
        contextLength: 128000,
        supportsTools: false,
        provider: 'openai',
      },
      {
        id: 'o1-mini',
        name: 'o1-mini',
        description: 'Smaller reasoning model, faster and more cost-effective',
        contextLength: 128000,
        supportsTools: false,
        provider: 'openai',
      },
      {
        id: 'o3-mini',
        name: 'o3-mini',
        description: 'Latest mini reasoning model with improved performance',
        contextLength: 128000,
        supportsTools: false,
        provider: 'openai',
      },
    ];
  }

  private isValidModel(modelId: string): boolean {
    const validModels = [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4o-2024-11-20',
      'gpt-4o-2024-08-06',
      'gpt-4o-mini-2024-07-18',
      'o1-preview',
      'o1-mini',
      'o3-mini',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-4',
      'gpt-3.5-turbo',
    ];
    return validModels.some(valid => modelId.includes(valid));
  }

  private getModelDisplayName(modelId: string): string {
    const nameMap: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'o1-preview': 'o1-preview',
      'o1-mini': 'o1-mini',
      'o3-mini': 'o3-mini',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4': 'GPT-4',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    };
    
    for (const [key, name] of Object.entries(nameMap)) {
      if (modelId.includes(key)) {
        return name;
      }
    }
    return modelId;
  }

  private getModelDescription(modelId: string): string {
    const descriptionMap: Record<string, string> = {
      'gpt-4o': 'Most capable multimodal model, great for complex reasoning tasks',
      'gpt-4o-mini': 'Fast, cost-effective model for simpler tasks',
      'o1-preview': 'Advanced reasoning model for complex problems',
      'o1-mini': 'Smaller reasoning model, faster and more cost-effective',
      'o3-mini': 'Latest mini reasoning model with improved performance',
      'gpt-4-turbo': 'High-performance model with large context window',
      'gpt-4': 'Powerful model for complex tasks',
      'gpt-3.5-turbo': 'Fast and efficient model for everyday tasks',
    };
    
    for (const [key, description] of Object.entries(descriptionMap)) {
      if (modelId.includes(key)) {
        return description;
      }
    }
    return 'OpenAI language model';
  }

  private getModelContextLength(modelId: string): number {
    const contextMap: Record<string, number> = {
      'gpt-4o': 128000,
      'gpt-4o-mini': 128000,
      'o1-preview': 128000,
      'o1-mini': 128000,
      'o3-mini': 128000,
      'gpt-4-turbo': 128000,
      'gpt-4': 8192,
      'gpt-3.5-turbo': 16384,
    };
    
    for (const [key, contextLength] of Object.entries(contextMap)) {
      if (modelId.includes(key)) {
        return contextLength;
      }
    }
    return 4096;
  }

  private getModelSupportsTools(modelId: string): boolean {
    const reasoningModels = ['o1-preview', 'o1-mini', 'o3-mini'];
    return !reasoningModels.some(reasoning => modelId.includes(reasoning));
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
        throw new Error('OpenAI API key not configured');
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

      if (options.tools && this.getModelSupportsTools(modelName)) {
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
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      
      if (!choice) {
        throw new Error('No response from OpenAI API');
      }

      const result: LlmResponse = {
        content: choice.message.content || '',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };

      if (choice.message.tool_calls) {
        result.toolCalls = choice.message.tool_calls.map((call: any) => ({
          id: call.id,
          type: call.type,
          function: {
            name: call.function.name,
            arguments: call.function.arguments,
          },
        }));
      }

      return result;
    } catch (error) {
      logger.error('OpenAI sendMessage error:', error);
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
    try {
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
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
        stream: true,
      };

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
        throw new Error(`OpenAI API error: ${errorMessage}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            onChunk({ content: '', done: true });
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                onChunk({ content: '', done: true });
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (delta?.content) {
                  onChunk({ content: delta.content, done: false });
                }
              } catch (error) {
                logger.warn('Failed to parse OpenAI stream chunk:', error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      logger.error('OpenAI streamMessage error:', error);
      throw error;
    }
  }
}