import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import { OllamaProvider } from '../../../../src/main/llm/providers/OllamaProvider.js';
import { LlmProviderConfig, ChatMessage } from '../../../../src/shared/types.js';
import { APP_CONSTANTS } from '../../../../src/shared/constants.js';

// Mock logger
vi.mock('../../../../src/main/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let mockConfig: LlmProviderConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      id: 'ollama-test',
      type: 'ollama',
      name: 'Test Ollama',
      baseUrl: 'http://localhost:11434',
      model: 'llama2',
      enabled: true,
      temperature: 0.7,
      maxTokens: 2048
    };

    provider = new OllamaProvider(mockConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided config', () => {
      const config = provider.getConfig();
      expect(config.name).toBe('Test Ollama');
      expect(config.baseUrl).toBe('http://localhost:11434');
      expect(config.model).toBe('llama2');
    });

    it('should use default URL when none provided', () => {
      const configWithoutUrl = { ...mockConfig };
      delete configWithoutUrl.baseUrl;
      
      const providerWithoutUrl = new OllamaProvider(configWithoutUrl);
      const config = providerWithoutUrl.getConfig();
      
      expect(config.baseUrl).toBe(APP_CONSTANTS.DEFAULT_OLLAMA_URL);
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] })
      });

      const result = await provider.testConnection();
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should handle connection refused error', async () => {
      const connectionError = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';
      mockFetch.mockRejectedValue(connectionError);

      const result = await provider.testConnection();
      
      expect(result).toBe(false);
    });

    it('should handle connection error with cause', async () => {
      const connectionError = new Error('Connection failed');
      connectionError.cause = { code: 'ECONNREFUSED' };
      mockFetch.mockRejectedValue(connectionError);

      const result = await provider.testConnection();
      
      expect(result).toBe(false);
    });

    it('should handle HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await provider.testConnection();
      
      expect(result).toBe(false);
    });

    it('should handle timeout errors', async () => {
      // Mock AbortError directly since fake timers don't work well with AbortController
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      const result = await provider.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('Model Management', () => {
    it('should get available models successfully', async () => {
      const mockModels = {
        models: [
          {
            name: 'llama2:latest',
            modified_at: '2024-01-01T00:00:00Z',
            size: 3825819519,
            digest: 'sha256:abc123',
            details: {
              format: 'gguf',
              family: 'llama',
              families: ['llama'],
              parameter_size: '7B',
              quantization_level: 'Q4_0'
            }
          },
          {
            name: 'codellama:13b',
            modified_at: '2024-01-02T00:00:00Z',
            size: 7365960702,
            digest: 'sha256:def456',
            details: {
              format: 'gguf',
              family: 'llama',
              families: ['llama'],
              parameter_size: '13B',
              quantization_level: 'Q4_0'
            }
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockModels
      });

      const models = await provider.getAvailableModels();
      
      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'llama2:latest',
        name: 'llama2:latest',
        size: '3.56 GB',
        description: 'llama (7B)',
        modified_at: '2024-01-01T00:00:00Z'
      });
      expect(models[1]).toEqual({
        id: 'codellama:13b',
        name: 'codellama:13b',
        size: '6.86 GB', 
        description: 'llama (13B)',
        modified_at: '2024-01-02T00:00:00Z'
      });
    });

    it('should handle empty model list', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ models: [] })
      });

      const models = await provider.getAvailableModels();
      
      expect(models).toHaveLength(0);
    });

    it('should handle missing models property', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({})
      });

      const models = await provider.getAvailableModels();
      
      expect(models).toHaveLength(0);
    });

    it('should handle connection error when getting models', async () => {
      const connectionError = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';
      mockFetch.mockRejectedValue(connectionError);

      await expect(provider.getAvailableModels()).rejects.toThrow(
        'Ollama is not running. Please start Ollama to list available models.'
      );
    });

    it('should handle HTTP error when getting models', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(provider.getAvailableModels()).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should format sizes correctly', () => {
      const formatSize = provider['formatSize'].bind(provider);
      
      expect(formatSize(0)).toBe('0 B');
      expect(formatSize(1024)).toBe('1 KB');
      expect(formatSize(1048576)).toBe('1 MB');
      expect(formatSize(1073741824)).toBe('1 GB');
      expect(formatSize(1099511627776)).toBe('1 TB');
      expect(formatSize(1536)).toBe('1.5 KB');
    });
  });

  describe('Message Sending', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'user', content: 'Hello, how are you?' }
    ];

    it('should send message successfully', async () => {
      const mockResponse = {
        model: 'llama2:latest',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Hello! I am doing well, thank you for asking.'
        },
        done: true,
        eval_count: 15
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await provider.sendMessage(mockMessages);
      
      expect(result).toEqual({
        content: 'Hello! I am doing well, thank you for asking.',
        tokens: 15,
        finishReason: 'stop',
        model: 'llama2:latest',
        toolCalls: undefined
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama2',
            messages: [{ role: 'user', content: 'Hello, how are you?' }],
            stream: false,
            options: {
              temperature: 0.7,
              num_predict: -1
            }
          })
        })
      );
    });

    it('should send message with custom options', async () => {
      const mockResponse = {
        model: 'llama2:latest',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Response with custom options'
        },
        done: true,
        eval_count: 10
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const options = {
        temperature: 0.5,
        maxTokens: 1000,
        model: 'custom-model'
      };

      await provider.sendMessage(mockMessages, options);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'custom-model',
            messages: [{ role: 'user', content: 'Hello, how are you?' }],
            stream: false,
            options: {
              temperature: 0.5,
              num_predict: 1000
            }
          })
        })
      );
    });

    it('should send message with tools', async () => {
      const mockResponse = {
        model: 'llama2:latest',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'I can help with that.',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "San Francisco"}'
              }
            }
          ]
        },
        done: true,
        eval_count: 20
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const tools = [
        {
          type: 'function' as const,
          function: {
            name: 'get_weather',
            description: 'Get weather information',
            parameters: {
              type: 'object',
              properties: {
                location: { type: 'string' }
              }
            }
          }
        }
      ];

      const result = await provider.sendMessage(mockMessages, { tools });
      
      expect(result.toolCalls).toEqual([
        {
          id: 'call_123',
          type: 'function',
          function: {
            name: 'get_weather',
            arguments: '{"location": "San Francisco"}'
          }
        }
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          body: expect.stringContaining('"tools":[')
        })
      );
    });

    it('should handle HTTP error when sending message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(provider.sendMessage(mockMessages)).rejects.toThrow('HTTP 400: Bad Request');
    });

    it('should handle network error when sending message', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      await expect(provider.sendMessage(mockMessages)).rejects.toThrow();
    });

    it('should handle finish reason based on done status', async () => {
      const mockResponse = {
        model: 'llama2:latest',
        created_at: '2024-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Incomplete response'
        },
        done: false,
        eval_count: 10
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await provider.sendMessage(mockMessages);
      
      expect(result.finishReason).toBe('length');
    });
  });

  describe('Message Streaming', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'user', content: 'Tell me a story' }
    ];

    it('should stream message successfully', async () => {
      const chunks = [
        '{"model":"llama2","message":{"role":"assistant","content":"Once"},"done":false,"eval_count":1}\n',
        '{"model":"llama2","message":{"role":"assistant","content":" upon"},"done":false,"eval_count":2}\n',
        '{"model":"llama2","message":{"role":"assistant","content":" a time"},"done":true,"eval_count":3}\n'
      ];

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(chunks[2]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      const chunkCallback = vi.fn();
      await provider.streamMessage(mockMessages, chunkCallback);

      expect(chunkCallback).toHaveBeenCalledTimes(3);
      expect(chunkCallback).toHaveBeenNthCalledWith(1, {
        content: 'Once',
        done: false,
        tokens: 1
      });
      expect(chunkCallback).toHaveBeenNthCalledWith(2, {
        content: ' upon',
        done: false,
        tokens: 2
      });
      expect(chunkCallback).toHaveBeenNthCalledWith(3, {
        content: ' a time',
        done: true,
        tokens: 3
      });
    });

    it('should handle streaming with custom options', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"model":"llama2","message":{"role":"assistant","content":"test"},"done":true}\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      const chunkCallback = vi.fn();
      const options = {
        temperature: 0.3,
        maxTokens: 500,
        model: 'custom-model'
      };

      await provider.streamMessage(mockMessages, chunkCallback, options);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'custom-model',
            messages: [{ role: 'user', content: 'Tell me a story' }],
            stream: true,
            options: {
              temperature: 0.3,
              num_predict: 500
            }
          })
        })
      );
    });

    it('should handle HTTP error when streaming', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const chunkCallback = vi.fn();
      
      await expect(provider.streamMessage(mockMessages, chunkCallback)).rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should handle missing response body when streaming', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: null
      });

      const chunkCallback = vi.fn();
      
      await expect(provider.streamMessage(mockMessages, chunkCallback)).rejects.toThrow('No response body available for streaming');
    });

    it('should handle invalid JSON in streaming response', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('invalid json\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"model":"llama2","message":{"content":"valid"},"done":true}\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      const chunkCallback = vi.fn();
      await provider.streamMessage(mockMessages, chunkCallback);

      // Should still process valid chunks despite invalid JSON
      expect(chunkCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle incomplete streaming data', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"model":"llama2","messa') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('ge":{"content":"test"},"done":true}\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      const chunkCallback = vi.fn();
      await provider.streamMessage(mockMessages, chunkCallback);

      expect(chunkCallback).toHaveBeenCalledWith({
        content: 'test',
        done: true,
        tokens: undefined
      });
    });

    it('should release reader lock even on error', async () => {
      const mockReader = {
        read: vi.fn().mockRejectedValue(new Error('Read error')),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      const chunkCallback = vi.fn();
      
      await expect(provider.streamMessage(mockMessages, chunkCallback)).rejects.toThrow();
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });
  });

  describe('Model Download', () => {
    it('should download model successfully', async () => {
      const progressEvents = [
        '{"status":"downloading","completed":1024,"total":10240}\n',
        '{"status":"downloading","completed":5120,"total":10240}\n',
        '{"status":"downloading","completed":10240,"total":10240}\n',
        '{"status":"success"}\n'
      ];

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(progressEvents[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(progressEvents[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(progressEvents[2]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(progressEvents[3]) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      const progressCallback = vi.fn();
      await provider.downloadModel('llama2:latest', progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 10);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 50);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 100);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/pull',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'llama2:latest', stream: true })
        })
      );
    });

    it('should download model without progress callback', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"status":"success"}\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      await expect(provider.downloadModel('llama2:latest')).resolves.not.toThrow();
    });

    it('should handle HTTP error when downloading', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Model Not Found'
      });

      await expect(provider.downloadModel('nonexistent:model')).rejects.toThrow('HTTP 404: Model Not Found');
    });

    it('should handle missing response body when downloading', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: null
      });

      await expect(provider.downloadModel('llama2:latest')).rejects.toThrow('No response body available for model download');
    });

    it('should handle invalid JSON in download response', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('invalid json\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"status":"success"}\n') })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      await expect(provider.downloadModel('llama2:latest')).resolves.not.toThrow();
    });

    it('should release reader lock even on download error', async () => {
      const mockReader = {
        read: vi.fn().mockRejectedValue(new Error('Download error')),
        releaseLock: vi.fn()
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          getReader: () => mockReader
        }
      });

      await expect(provider.downloadModel('llama2:latest')).rejects.toThrow();
      expect(mockReader.releaseLock).toHaveBeenCalled();
    });
  });

  describe('Model Deletion', () => {
    it('should delete model successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200
      });

      await expect(provider.deleteModel('llama2:latest')).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/delete',
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'llama2:latest' })
        })
      );
    });

    it('should handle HTTP error when deleting model', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Model Not Found'
      });

      await expect(provider.deleteModel('nonexistent:model')).rejects.toThrow('HTTP 404: Model Not Found');
    });

    it('should handle network error when deleting model', async () => {
      const networkError = new Error('Network error');
      mockFetch.mockRejectedValue(networkError);

      await expect(provider.deleteModel('llama2:latest')).rejects.toThrow();
    });
  });

  describe('Message Formatting', () => {
    it('should format regular messages correctly', () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      const formatted = provider['formatMessages'](messages);

      expect(formatted).toEqual([
        { role: 'user', content: 'Hello', tool_calls: undefined },
        { role: 'assistant', content: 'Hi there!', tool_calls: undefined }
      ]);
    });

    it('should format tool response messages correctly', () => {
      const messages: ChatMessage[] = [
        {
          role: 'tool',
          content: 'Weather result',
          tool_call_id: 'call_123',
          name: 'get_weather'
        }
      ];

      const formatted = provider['formatMessages'](messages);

      expect(formatted).toEqual([
        {
          role: 'tool',
          content: 'Weather result',
          tool_call_id: 'call_123',
          name: 'get_weather'
        }
      ]);
    });

    it('should format messages with tool calls correctly', () => {
      const messages: ChatMessage[] = [
        {
          role: 'assistant',
          content: 'I can help with that.',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "SF"}'
              }
            }
          ]
        }
      ];

      const formatted = provider['formatMessages'](messages);

      expect(formatted).toEqual([
        {
          role: 'assistant',
          content: 'I can help with that.',
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: '{"location": "SF"}'
              }
            }
          ]
        }
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle timeout errors properly', () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'AbortError';

      const handledError = provider['handleError'](timeoutError, 'test operation');

      expect(handledError.message).toBe('Request timeout for Test Ollama');
    });

    it('should handle connection refused errors', () => {
      const connectionError = new Error('Connection refused');
      connectionError.code = 'ECONNREFUSED';

      const handledError = provider['handleError'](connectionError, 'test operation');

      expect(handledError.message).toBe('Connection refused to Test Ollama. Is the service running?');
    });

    it('should handle authentication errors', () => {
      const authError = new Error('Unauthorized');
      authError.status = 401;

      const handledError = provider['handleError'](authError, 'test operation');

      expect(handledError.message).toBe('Authentication failed for Test Ollama. Check your API key.');
    });

    it('should handle rate limit errors', () => {
      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.status = 429;

      const handledError = provider['handleError'](rateLimitError, 'test operation');

      expect(handledError.message).toBe('Rate limit exceeded for Test Ollama. Please try again later.');
    });

    it('should handle server errors', () => {
      const serverError = new Error('Internal Server Error');
      serverError.status = 500;

      const handledError = provider['handleError'](serverError, 'test operation');

      expect(handledError.message).toBe('Server error from Test Ollama. Please try again later.');
    });

    it('should handle unknown errors', () => {
      const unknownError = new Error('Unknown error');

      const handledError = provider['handleError'](unknownError, 'test operation');

      expect(handledError.message).toBe('Unknown error');
    });

    it('should handle non-Error objects', () => {
      const stringError = 'String error';

      const handledError = provider['handleError'](stringError, 'test operation');

      expect(handledError.message).toBe('Unknown error in Test Ollama: String error');
    });
  });
});