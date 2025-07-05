import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import { OpenRouterProvider } from '../../../../src/main/llm/providers/OpenRouterProvider.js';
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

describe('OpenRouterProvider', () => {
  let provider: OpenRouterProvider;
  let mockConfig: LlmProviderConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockConfig = {
      id: 'openrouter-test',
      type: 'openrouter',
      name: 'Test OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: 'test-api-key',
      model: 'anthropic/claude-3-sonnet',
      enabled: true,
      temperature: 0.7,
      maxTokens: 4000
    };

    provider = new OpenRouterProvider(mockConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided config', () => {
      const config = provider.getConfig();
      expect(config.name).toBe('Test OpenRouter');
      expect(config.apiKey).toBe('test-api-key');
      expect(config.model).toBe('anthropic/claude-3-sonnet');
    });
  });

  describe('Connection Testing', () => {
    it('should test connection successfully with valid API key', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] })
      });

      const result = await provider.testConnection();
      
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'HTTP-Referer': APP_CONSTANTS.OPENROUTER_REFERER,
            'X-Title': APP_CONSTANTS.OPENROUTER_TITLE
          }
        })
      );
    });

    it('should fail connection test without API key', async () => {
      provider.updateConfig({ apiKey: '' });

      const result = await provider.testConnection();
      
      expect(result).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should handle HTTP errors during connection test', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await provider.testConnection();
      
      expect(result).toBe(false);
    });

    it('should handle network errors during connection test', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.testConnection();
      
      expect(result).toBe(false);
    });

    it('should handle timeout during connection test', async () => {
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
        data: [
          {
            id: 'anthropic/claude-3-sonnet',
            name: 'Claude 3 Sonnet',
            description: 'Anthropic Claude 3 Sonnet model',
            pricing: {
              prompt: '0.000003',
              completion: '0.000015'
            },
            context_length: 200000,
            architecture: {
              modality: 'text',
              tokenizer: 'claude'
            },
            top_provider: {
              context_length: 200000,
              max_completion_tokens: 4096
            }
          },
          {
            id: 'openai/gpt-4',
            name: 'GPT-4',
            pricing: {
              prompt: '0.00003',
              completion: '0.00006'
            },
            context_length: 8192,
            architecture: {
              modality: 'text',
              tokenizer: 'gpt'
            },
            top_provider: {
              context_length: 8192,
              max_completion_tokens: 4096
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
        id: 'anthropic/claude-3-sonnet',
        name: 'anthropic/claude-3-sonnet',
        size: '200000 tokens',
        description: 'Anthropic Claude 3 Sonnet model',
        modified_at: undefined
      });
      expect(models[1]).toEqual({
        id: 'openai/gpt-4',
        name: 'openai/gpt-4',
        size: '8192 tokens',
        description: 'GPT-4 - text model',
        modified_at: undefined
      });
    });

    it('should handle models without description', async () => {
      const mockModels = {
        data: [
          {
            id: 'test-model',
            name: 'Test Model',
            pricing: { prompt: '0.001', completion: '0.002' },
            context_length: 4096,
            architecture: { modality: 'text', tokenizer: 'test' },
            top_provider: { context_length: 4096 }
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockModels
      });

      const models = await provider.getAvailableModels();
      
      expect(models[0].description).toBe('Test Model - text model');
    });

    it('should handle error when API key is missing', async () => {
      provider.updateConfig({ apiKey: '' });

      await expect(provider.getAvailableModels()).rejects.toThrow('OpenRouter API key not configured');
    });

    it('should handle HTTP error when getting models', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(provider.getAvailableModels()).rejects.toThrow('HTTP 401: Unauthorized');
    });

    it('should handle network error when getting models', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(provider.getAvailableModels()).rejects.toThrow();
    });
  });

  describe('Message Sending', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'user', content: 'Hello, how are you?' }
    ];

    it('should send message successfully', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1678901234,
        model: 'anthropic/claude-3-sonnet',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am doing well, thank you for asking.'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 12,
          total_tokens: 22
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await provider.sendMessage(mockMessages);
      
      expect(result).toEqual({
        content: 'Hello! I am doing well, thank you for asking.',
        tokens: 22,
        finishReason: 'stop',
        model: 'anthropic/claude-3-sonnet',
        toolCalls: undefined
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json',
            'HTTP-Referer': APP_CONSTANTS.OPENROUTER_REFERER,
            'X-Title': APP_CONSTANTS.OPENROUTER_TITLE
          },
          body: JSON.stringify({
            model: 'anthropic/claude-3-sonnet',
            messages: [{ role: 'user', content: 'Hello, how are you?' }],
            temperature: 0.7,
            max_tokens: 4000,
            stream: false
          })
        })
      );
    });

    it('should send message with custom options', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1678901234,
        model: 'custom-model',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Response with custom options'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const options = {
        temperature: 0.3,
        maxTokens: 2000,
        model: 'custom-model'
      };

      await provider.sendMessage(mockMessages, options);
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'custom-model',
            messages: [{ role: 'user', content: 'Hello, how are you?' }],
            temperature: 0.3,
            max_tokens: 2000,
            stream: false
          })
        })
      );
    });

    it('should send message with tools', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1678901234,
        model: 'anthropic/claude-3-sonnet',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I can help with the weather.',
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
            finish_reason: 'tool_calls'
          }
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 25,
          total_tokens: 40
        }
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
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"tools":[')
        })
      );
    });

    it('should handle missing API key', async () => {
      provider.updateConfig({ apiKey: '' });

      await expect(provider.sendMessage(mockMessages)).rejects.toThrow('OpenRouter API key not configured');
    });

    it('should handle HTTP error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => 'Invalid request format'
      });

      await expect(provider.sendMessage(mockMessages)).rejects.toThrow('HTTP 400: Invalid request format');
    });

    it('should handle missing choices in response', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1678901234,
        model: 'anthropic/claude-3-sonnet',
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      await expect(provider.sendMessage(mockMessages)).rejects.toThrow('No response choices received from OpenRouter');
    });

    it('should handle response with empty content', async () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1678901234,
        model: 'anthropic/claude-3-sonnet',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null
            },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await provider.sendMessage(mockMessages);
      
      expect(result.content).toBe('');
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(provider.sendMessage(mockMessages)).rejects.toThrow();
    });
  });

  describe('Message Streaming', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'user', content: 'Tell me a story' }
    ];

    it('should stream message successfully', async () => {
      const streamData = [
        'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":"Once"}}]}\n\n',
        'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":" upon"}}]}\n\n',
        'data: {"id":"chatcmpl-123","choices":[{"index":0,"delta":{"content":" a time"}}],"usage":{"total_tokens":15}}\n\n',
        'data: [DONE]\n\n'
      ];

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamData[0]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamData[1]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamData[2]) })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(streamData[3]) })
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

      expect(chunkCallback).toHaveBeenCalledTimes(4);
      expect(chunkCallback).toHaveBeenNthCalledWith(1, {
        content: 'Once',
        done: false,
        tokens: undefined
      });
      expect(chunkCallback).toHaveBeenNthCalledWith(2, {
        content: ' upon',
        done: false,
        tokens: undefined
      });
      expect(chunkCallback).toHaveBeenNthCalledWith(3, {
        content: ' a time',
        done: false,
        tokens: undefined
      });
      expect(chunkCallback).toHaveBeenNthCalledWith(4, {
        content: '',
        done: true,
        tokens: 15
      });
    });

    it('should handle streaming with custom options', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
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
        temperature: 0.5,
        maxTokens: 1000,
        model: 'custom-model'
      };

      await provider.streamMessage(mockMessages, chunkCallback, options);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          body: JSON.stringify({
            model: 'custom-model',
            messages: [{ role: 'user', content: 'Tell me a story' }],
            temperature: 0.5,
            max_tokens: 1000,
            stream: true
          })
        })
      );
    });

    it('should handle missing API key during streaming', async () => {
      provider.updateConfig({ apiKey: '' });

      const chunkCallback = vi.fn();
      
      await expect(provider.streamMessage(mockMessages, chunkCallback)).rejects.toThrow('OpenRouter API key not configured');
    });

    it('should handle HTTP error during streaming', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'Rate limit exceeded'
      });

      const chunkCallback = vi.fn();
      
      await expect(provider.streamMessage(mockMessages, chunkCallback)).rejects.toThrow('HTTP 429: Rate limit exceeded');
    });

    it('should handle missing response body during streaming', async () => {
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
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: invalid json\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
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

      // Should still process [DONE] despite invalid JSON
      expect(chunkCallback).toHaveBeenCalledWith({
        content: '',
        done: true,
        tokens: 0
      });
    });

    it('should handle incomplete streaming data', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"id":"chatcmpl-123","choices":[{"index":0,"delta"') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(':{"content":"test"}}]}\n\ndata: [DONE]\n\n') })
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
        done: false,
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

  describe('Model Info', () => {
    it('should get model info successfully', async () => {
      const mockModelData = {
        data: {
          id: 'anthropic/claude-3-sonnet',
          name: 'Claude 3 Sonnet',
          description: 'Anthropic Claude 3 Sonnet model',
          pricing: {
            prompt: '0.000003',
            completion: '0.000015'
          },
          context_length: 200000,
          architecture: {
            modality: 'text',
            tokenizer: 'claude'
          },
          top_provider: {
            context_length: 200000,
            max_completion_tokens: 4096
          }
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockModelData
      });

      const result = await provider.getModelInfo('anthropic/claude-3-sonnet');
      
      expect(result).toEqual(mockModelData.data);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/models/anthropic/claude-3-sonnet',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should return null for non-existent model', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await provider.getModelInfo('non-existent-model');
      
      expect(result).toBeNull();
    });

    it('should handle missing API key', async () => {
      provider.updateConfig({ apiKey: '' });

      const result = await provider.getModelInfo('test-model');
      expect(result).toBeNull();
    });

    it('should handle HTTP errors other than 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await provider.getModelInfo('test-model');
      
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getModelInfo('test-model');
      
      expect(result).toBeNull();
    });
  });

  describe('Credit Balance', () => {
    it('should get credit balance successfully', async () => {
      const mockCreditData = {
        data: {
          credit_balance: 15.50
        }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockCreditData
      });

      const result = await provider.getCreditBalance();
      
      expect(result).toBe(15.50);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/auth/key',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key'
          })
        })
      );
    });

    it('should return null when no API key configured', async () => {
      provider.updateConfig({ apiKey: '' });

      const result = await provider.getCreditBalance();
      
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return null on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await provider.getCreditBalance();
      
      expect(result).toBeNull();
    });

    it('should return null when credit_balance is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: {} })
      });

      const result = await provider.getCreditBalance();
      
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await provider.getCreditBalance();
      
      expect(result).toBeNull();
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
    it('should handle insufficient credits error', () => {
      const creditsError = new Error('Insufficient credits');
      creditsError.status = 402;

      const handledError = provider['handleError'](creditsError, 'test operation');

      expect(handledError.message).toBe('Insufficient credits in OpenRouter account. Please add more credits.');
    });

    it('should handle rate limit error', () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;

      const handledError = provider['handleError'](rateLimitError, 'test operation');

      expect(handledError.message).toBe('OpenRouter rate limit exceeded. Please try again in a few minutes.');
    });

    it('should handle model validation error', () => {
      const modelError = new Error('Invalid model specified');
      modelError.status = 400;
      modelError.message = 'model not found';

      const handledError = provider['handleError'](modelError, 'test operation');

      expect(handledError.message).toBe('Selected model is not available or invalid for OpenRouter.');
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'AbortError';

      const handledError = provider['handleError'](timeoutError, 'test operation');

      expect(handledError.message).toBe('Request timeout for OpenRouter (test operation)');
    });

    it('should handle timeout message errors', () => {
      const timeoutError = new Error('Request timeout occurred');

      const handledError = provider['handleError'](timeoutError, 'test operation');

      expect(handledError.message).toBe('Request timeout for OpenRouter (test operation)');
    });

    it('should fall back to base error handling', () => {
      const baseError = new Error('Some other error');
      baseError.status = 500;

      const handledError = provider['handleError'](baseError, 'test operation');

      expect(handledError.message).toBe('Server error from Test OpenRouter. Please try again later.');
    });
  });
});