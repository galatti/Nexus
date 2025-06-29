import { BaseProvider, LlmResponse, StreamingResponse } from './BaseProvider.js';
import { LlmProviderConfig, LlmModel, ChatMessage } from '../../../shared/types.js';
import { logger } from '../../utils/logger.js';

// Configuration constants
const OLLAMA_CHAT_TIMEOUT_MS = 120000; // 2 minutes timeout for chat requests
const OLLAMA_HEALTH_CHECK_TIMEOUT_MS = 5000; // 5 seconds for health checks

interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
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
    
    // Ensure baseUrl has the correct default - use IPv4 to avoid IPv6 resolution issues
    if (!this.config.baseUrl) {
      this.config.baseUrl = 'http://127.0.0.1:11434';
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRequest(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }, OLLAMA_HEALTH_CHECK_TIMEOUT_MS);

      return response.ok;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
        logger.warn(`Ollama connection failed: Ollama is not running on ${this.config.baseUrl}. Please start Ollama to use local models.`);
      } else {
        logger.warn(`Ollama connection test failed:`, error);
      }
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
      
      if (!data.models || data.models.length === 0) {
        logger.warn('Ollama is running but no models are installed. Please install models using: ollama pull <model-name>');
        return [];
      }
      
      return data.models.map(model => ({
        name: model.name,
        size: this.formatSize(model.size),
        description: `${model.details.family} (${model.details.parameter_size})`,
        modified_at: model.modified_at
      }));

    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
        throw new Error('Ollama is not running. Please start Ollama to list available models.');
      }
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
      const modelName = this.getModelName(options.model);
      const formattedMessages = this.formatMessages(messages);

      const requestBody: any = {
        model: modelName,
        messages: formattedMessages,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || -1
        }
      };

      // Add tools if provided (Ollama supports function calling since July 2024)
      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
      }

      const response = await this.makeRequest(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }, OLLAMA_CHAT_TIMEOUT_MS);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as OllamaResponse;

      return {
        content: data.message.content,
        tokens: data.eval_count,
        finishReason: data.done ? 'stop' : 'length',
        model: data.model,
        toolCalls: data.message.tool_calls
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
      }, OLLAMA_CHAT_TIMEOUT_MS);

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
    return messages.map(msg => {
      if (msg.role === 'tool') {
        // Handle tool response messages
        return {
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id,
          name: msg.name
        };
      }
      
      return {
        role: msg.role,
        content: msg.content,
        tool_calls: (msg as any).tool_calls
      };
    });
  }
} 