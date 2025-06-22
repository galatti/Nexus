import { BaseProvider, LlmResponse, StreamingResponse } from './BaseProvider';
import { LlmProviderConfig, LlmModel, ChatMessage } from '../../../shared/types';
import { logger } from '../../utils/logger';

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export class OllamaProvider extends BaseProvider {
  constructor(config: LlmProviderConfig) {
    super(config);
    
    // Ensure baseUrl has the correct default
    if (!this.config.baseUrl) {
      this.config.baseUrl = 'http://localhost:11434';
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }, 5000); // Shorter timeout for health check

      return response.ok;
    } catch (error) {
      logger.warn(`Ollama connection test failed:`, error);
      return false;
    }
  }

  async getAvailableModels(): Promise<LlmModel[]> {
    try {
      const response = await this.makeRequest(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as { models: OllamaModelInfo[] };
      
      return data.models.map(model => ({
        name: model.name,
        size: this.formatSize(model.size),
        description: `${model.details.family} (${model.details.parameter_size})`,
        modified_at: model.modified_at
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
      const modelName = this.getModelName(options.model);
      const formattedMessages = this.formatMessages(messages);

      const requestBody = {
        model: modelName,
        messages: formattedMessages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || -1
        }
      };

      const response = await this.makeRequest(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;

      return {
        content: data.message.content,
        tokens: data.eval_count,
        finishReason: data.done ? 'stop' : 'length',
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
      const modelName = this.getModelName(options.model);
      const formattedMessages = this.formatMessages(messages);

      const requestBody = {
        model: modelName,
        messages: formattedMessages,
        stream: true,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || -1
        }
      };

      const response = await this.makeRequest(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available for streaming');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line) as OllamaResponse;
                
                onChunk({
                  content: data.message.content,
                  done: data.done,
                  tokens: data.eval_count
                });

                if (data.done) {
                  return;
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

  async downloadModel(modelName: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      const response = await this.makeRequest(`${this.config.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: modelName,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body available for model download');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim()) {
              try {
                const data = JSON.parse(line) as any;
                
                if (data.status === 'downloading' && data.completed && data.total && onProgress) {
                  const progress = (data.completed / data.total) * 100;
                  onProgress(progress);
                }

                if (data.status === 'success') {
                  logger.info(`Model download completed: ${modelName}`);
                  return;
                }
              } catch (parseError) {
                logger.warn('Failed to parse download response:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      throw this.handleError(error, 'download model');
    }
  }

  async deleteModel(modelName: string): Promise<void> {
    try {
      const response = await this.makeRequest(`${this.config.baseUrl}/api/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: modelName
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      logger.info(`Model deleted: ${modelName}`);
    } catch (error) {
      throw this.handleError(error, 'delete model');
    }
  }

  private formatSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  }

  protected formatMessages(messages: ChatMessage[]): OllamaMessage[] {
    return messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));
  }
} 