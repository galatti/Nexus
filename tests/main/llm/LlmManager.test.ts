import { beforeEach, describe, it, expect, vi, afterEach } from 'vitest';
import { LlmManager } from '../../../src/main/llm/LlmManager.js';
import { LlmProviderConfig, ChatMessage, LlmModel, ProviderHealth } from '../../../src/shared/types.js';

// Mock the providers
const mockOllamaProvider = {
  updateConfig: vi.fn(),
  isEnabled: vi.fn(),
  getConfig: vi.fn(),
  sendMessage: vi.fn(),
  checkHealth: vi.fn(),
  getAvailableModels: vi.fn()
};

const mockOpenRouterProvider = {
  updateConfig: vi.fn(),
  isEnabled: vi.fn(),
  getConfig: vi.fn(),
  sendMessage: vi.fn(),
  checkHealth: vi.fn(),
  getAvailableModels: vi.fn()
};

// Mock the provider classes
vi.mock('../../../src/main/llm/providers/OllamaProvider.js', () => ({
  OllamaProvider: vi.fn(() => mockOllamaProvider)
}));

vi.mock('../../../src/main/llm/providers/OpenRouterProvider.js', () => ({
  OpenRouterProvider: vi.fn(() => mockOpenRouterProvider)
}));

describe('LlmManager', () => {
  let llmManager: LlmManager;
  let mockConfig: LlmProviderConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    llmManager = new LlmManager();
    
    mockConfig = {
      id: 'test-provider',
      type: 'ollama',
      name: 'Test Provider',
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      enabled: true,
      temperature: 0.7,
      maxTokens: 2048
    };

    // Setup default mock behaviors
    mockOllamaProvider.isEnabled.mockReturnValue(true);
    mockOllamaProvider.getConfig.mockReturnValue(mockConfig);
    mockOllamaProvider.checkHealth.mockResolvedValue(true);
    mockOllamaProvider.getAvailableModels.mockResolvedValue([
      { id: 'test-model', name: 'Test Model', size: '1GB' }
    ]);
    mockOllamaProvider.sendMessage.mockResolvedValue({
      content: 'Test response',
      tokens: 100,
      model: 'test-model'
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(llmManager.initialize()).resolves.not.toThrow();
    });

    it('should set max listeners to 50', () => {
      expect(llmManager.getMaxListeners()).toBe(50);
    });
  });

  describe('Provider Management', () => {
    it('should add Ollama provider', async () => {
      await llmManager.addProvider(mockConfig);
      
      const provider = llmManager.getProvider('test-provider');
      expect(provider).toBeTruthy();
    });

    it('should add OpenRouter provider', async () => {
      const openRouterConfig: LlmProviderConfig = {
        ...mockConfig,
        type: 'openrouter',
        apiKey: 'test-key'
      };
      
      await llmManager.addProvider(openRouterConfig);
      
      const provider = llmManager.getProvider('test-provider');
      expect(provider).toBeTruthy();
    });

    it('should reject unsupported provider type', async () => {
      const invalidConfig = {
        ...mockConfig,
        type: 'invalid' as any
      };
      
      await expect(llmManager.addProvider(invalidConfig)).rejects.toThrow('Unsupported provider type: invalid');
    });

    it('should remove provider', async () => {
      await llmManager.addProvider(mockConfig);
      
      expect(llmManager.getProvider('test-provider')).toBeTruthy();
      
      await llmManager.removeProvider('test-provider');
      
      expect(llmManager.getProvider('test-provider')).toBeNull();
    });

    it('should handle removing non-existent provider', async () => {
      await expect(llmManager.removeProvider('non-existent')).resolves.not.toThrow();
    });

    it('should update provider config', async () => {
      await llmManager.addProvider(mockConfig);
      
      const updates = { temperature: 0.5, maxTokens: 1024 };
      await llmManager.updateProvider('test-provider', updates);
      
      expect(mockOllamaProvider.updateConfig).toHaveBeenCalledWith(updates);
    });

    it('should throw error when updating non-existent provider', async () => {
      await expect(llmManager.updateProvider('non-existent', {})).rejects.toThrow('Provider not found: non-existent');
    });

    it('should check health when provider is enabled', async () => {
      await llmManager.addProvider(mockConfig);
      await llmManager.updateProvider('test-provider', { enabled: true });
      
      // Should be called during update
      expect(mockOllamaProvider.checkHealth).toHaveBeenCalled();
    });

    it('should mark as unhealthy when provider is disabled', async () => {
      await llmManager.addProvider(mockConfig);
      
      await llmManager.updateProvider('test-provider', { enabled: false });
      
      const health = llmManager.getProviderHealth('test-provider');
      expect(health?.isHealthy).toBe(false);
      expect(health?.error).toBe('Provider disabled');
    });

    it('should get all providers', async () => {
      await llmManager.addProvider(mockConfig);
      
      const providers = llmManager.getAllProviders();
      expect(providers.size).toBe(1);
      expect(providers.has('test-provider')).toBe(true);
    });

    it('should emit events for provider operations', async () => {
      const addedSpy = vi.fn();
      const removedSpy = vi.fn();
      const updatedSpy = vi.fn();
      
      llmManager.on('providerAdded', addedSpy);
      llmManager.on('providerRemoved', removedSpy);
      llmManager.on('providerUpdated', updatedSpy);
      
      await llmManager.addProvider(mockConfig);
      expect(addedSpy).toHaveBeenCalledWith({ providerId: 'test-provider', config: mockConfig });
      
      await llmManager.updateProvider('test-provider', { temperature: 0.5 });
      expect(updatedSpy).toHaveBeenCalledWith({ providerId: 'test-provider', updates: { temperature: 0.5 } });
      
      await llmManager.removeProvider('test-provider');
      expect(removedSpy).toHaveBeenCalledWith({ providerId: 'test-provider' });
    });
  });

  describe('Health Management', () => {
    beforeEach(async () => {
      await llmManager.addProvider(mockConfig);
    });

    it('should check provider health', async () => {
      const isHealthy = await llmManager.checkProviderHealth('test-provider');
      
      expect(isHealthy).toBe(true);
      expect(mockOllamaProvider.checkHealth).toHaveBeenCalled();
    });

    it('should return false for non-existent provider health check', async () => {
      const isHealthy = await llmManager.checkProviderHealth('non-existent');
      
      expect(isHealthy).toBe(false);
    });

    it('should handle health check failures', async () => {
      mockOllamaProvider.checkHealth.mockRejectedValue(new Error('Health check failed'));
      
      const isHealthy = await llmManager.checkProviderHealth('test-provider');
      
      expect(isHealthy).toBe(false);
      
      const health = llmManager.getProviderHealth('test-provider');
      expect(health?.isHealthy).toBe(false);
      expect(health?.error).toBe('Health check failed');
    });

    it('should implement exponential backoff for retries', async () => {
      mockOllamaProvider.checkHealth.mockResolvedValue(false);
      
      await llmManager.checkProviderHealth('test-provider');
      
      const health = llmManager.getProviderHealth('test-provider');
      expect(health?.retryCount).toBe(1);
      expect(health?.nextRetry).toBeDefined();
    });

    it('should reset retry count on successful health check', async () => {
      // First fail
      mockOllamaProvider.checkHealth.mockResolvedValue(false);
      await llmManager.checkProviderHealth('test-provider');
      
      let health = llmManager.getProviderHealth('test-provider');
      expect(health?.retryCount).toBe(1);
      
      // Then succeed
      mockOllamaProvider.checkHealth.mockResolvedValue(true);
      await llmManager.checkProviderHealth('test-provider');
      
      health = llmManager.getProviderHealth('test-provider');
      expect(health?.retryCount).toBe(0);
      expect(health?.nextRetry).toBeUndefined();
    });

    it('should check all providers health', async () => {
      const openRouterConfig: LlmProviderConfig = {
        ...mockConfig,
        id: 'openrouter-provider',
        type: 'openrouter',
        apiKey: 'test-key'
      };
      
      mockOpenRouterProvider.isEnabled.mockReturnValue(true);
      mockOpenRouterProvider.checkHealth.mockResolvedValue(true);
      
      await llmManager.addProvider(openRouterConfig);
      
      const results = await llmManager.checkAllProvidersHealth();
      
      expect(results.size).toBe(2);
      expect(results.get('test-provider')).toBe(true);
      expect(results.get('openrouter-provider')).toBe(true);
    });

    it('should skip health check for disabled providers', async () => {
      mockOllamaProvider.isEnabled.mockReturnValue(false);
      
      const results = await llmManager.checkAllProvidersHealth();
      
      expect(results.size).toBe(0);
    });

    it('should skip health check if retry time not reached', async () => {
      // Set up a future retry time
      const health = llmManager.getProviderHealth('test-provider');
      if (health) {
        health.nextRetry = new Date(Date.now() + 60000); // 1 minute from now
        health.isHealthy = false;
      }
      
      const results = await llmManager.checkAllProvidersHealth();
      
      expect(results.get('test-provider')).toBe(false);
      // Should not call checkHealth again
      expect(mockOllamaProvider.checkHealth).toHaveBeenCalledTimes(1); // Only from initial add
    });

    it('should get all provider health', async () => {
      const healthMap = llmManager.getAllProviderHealth();
      
      expect(healthMap.size).toBe(1);
      expect(healthMap.has('test-provider')).toBe(true);
      expect(healthMap.get('test-provider')?.providerId).toBe('test-provider');
    });

    it('should emit health change events', async () => {
      const healthChangedSpy = vi.fn();
      llmManager.on('providerHealthChanged', healthChangedSpy);
      
      await llmManager.checkProviderHealth('test-provider');
      
      expect(healthChangedSpy).toHaveBeenCalledWith({
        providerId: 'test-provider',
        isHealthy: true,
        health: expect.any(Object)
      });
    });
  });

  describe('Message Processing', () => {
    const mockMessages: ChatMessage[] = [
      { role: 'user', content: 'Hello, world!' }
    ];

    beforeEach(async () => {
      await llmManager.addProvider(mockConfig);
    });

    it('should send message successfully', async () => {
      const response = await llmManager.sendMessage(mockMessages, 'test-provider', 'test-model');
      
      expect(response.content).toBe('Test response');
      expect(response.tokens).toBe(100);
      expect(response.model).toBe('test-model');
      expect(mockOllamaProvider.sendMessage).toHaveBeenCalledWith(
        mockMessages,
        expect.objectContaining({
          model: 'test-model',
          temperature: 0.7,
          maxTokens: 2048
        })
      );
    });

    it('should merge provider config with options', async () => {
      const customOptions = {
        temperature: 0.5,
        maxTokens: 1024,
        tools: [{ type: 'function' as const, function: { name: 'test', description: 'test', parameters: {} } }]
      };
      
      await llmManager.sendMessage(mockMessages, 'test-provider', 'test-model', customOptions);
      
      expect(mockOllamaProvider.sendMessage).toHaveBeenCalledWith(
        mockMessages,
        expect.objectContaining({
          model: 'test-model',
          temperature: 0.5, // Should override provider default
          maxTokens: 1024, // Should override provider default
          tools: customOptions.tools
        })
      );
    });

    it('should throw error for non-existent provider', async () => {
      await expect(
        llmManager.sendMessage(mockMessages, 'non-existent', 'test-model')
      ).rejects.toThrow('Provider not found: non-existent');
    });

    it('should throw error for disabled provider', async () => {
      mockOllamaProvider.isEnabled.mockReturnValue(false);
      
      await expect(
        llmManager.sendMessage(mockMessages, 'test-provider', 'test-model')
      ).rejects.toThrow('Provider is disabled: test-provider');
    });

    it('should attempt recovery for unhealthy provider', async () => {
      // Set provider as unhealthy
      const health = llmManager.getProviderHealth('test-provider');
      if (health) {
        health.isHealthy = false;
        health.error = 'Test error';
      }
      
      // Mock recovery
      mockOllamaProvider.checkHealth.mockResolvedValue(true);
      
      await llmManager.sendMessage(mockMessages, 'test-provider', 'test-model');
      
      // Should have attempted recovery
      expect(mockOllamaProvider.checkHealth).toHaveBeenCalledTimes(2); // Once during add, once during recovery
    });

    it('should throw error if recovery fails', async () => {
      // Set provider as unhealthy
      const health = llmManager.getProviderHealth('test-provider');
      if (health) {
        health.isHealthy = false;
        health.error = 'Test error';
      }
      
      // Mock failed recovery
      mockOllamaProvider.checkHealth.mockResolvedValue(false);
      
      await expect(
        llmManager.sendMessage(mockMessages, 'test-provider', 'test-model')
      ).rejects.toThrow('Provider test-provider is currently unhealthy');
    });

    it('should handle message processing errors', async () => {
      mockOllamaProvider.sendMessage.mockRejectedValue(new Error('Message processing failed'));
      
      await expect(
        llmManager.sendMessage(mockMessages, 'test-provider', 'test-model')
      ).rejects.toThrow('Message processing failed');
      
      const health = llmManager.getProviderHealth('test-provider');
      expect(health?.isHealthy).toBe(false);
      expect(health?.error).toBe('Message processing failed');
      expect(health?.retryCount).toBe(1);
    });

    it('should emit events for message processing', async () => {
      const processedSpy = vi.fn();
      const errorSpy = vi.fn();
      
      llmManager.on('messageProcessed', processedSpy);
      llmManager.on('messageError', errorSpy);
      
      await llmManager.sendMessage(mockMessages, 'test-provider', 'test-model');
      
      expect(processedSpy).toHaveBeenCalledWith({
        providerId: 'test-provider',
        modelName: 'test-model',
        tokens: 100,
        model: 'test-model'
      });
      
      // Test error event
      mockOllamaProvider.sendMessage.mockRejectedValue(new Error('Test error'));
      
      await expect(
        llmManager.sendMessage(mockMessages, 'test-provider', 'test-model')
      ).rejects.toThrow();
      
      expect(errorSpy).toHaveBeenCalledWith({
        providerId: 'test-provider',
        modelName: 'test-model',
        error: 'Test error'
      });
    });

    it('should reset retry count on successful message', async () => {
      // Set up some retry count
      const health = llmManager.getProviderHealth('test-provider');
      if (health) {
        health.retryCount = 3;
      }
      
      await llmManager.sendMessage(mockMessages, 'test-provider', 'test-model');
      
      expect(health?.retryCount).toBe(0);
    });
  });

  describe('Model Management', () => {
    beforeEach(async () => {
      await llmManager.addProvider(mockConfig);
    });

    it('should get available models', async () => {
      const models = await llmManager.getAvailableModels('test-provider');
      
      expect(models).toHaveLength(1);
      expect(models[0].name).toBe('Test Model');
      expect(mockOllamaProvider.getAvailableModels).toHaveBeenCalled();
    });

    it('should return empty array for non-existent provider', async () => {
      const models = await llmManager.getAvailableModels('non-existent');
      
      expect(models).toHaveLength(0);
    });

    it('should handle model fetching errors', async () => {
      mockOllamaProvider.getAvailableModels.mockRejectedValue(new Error('Model fetch failed'));
      
      const models = await llmManager.getAvailableModels('test-provider');
      
      expect(models).toHaveLength(0);
    });
  });

  describe('Status and Validation', () => {
    beforeEach(async () => {
      await llmManager.addProvider(mockConfig);
    });

    it('should get status with enabled providers', async () => {
      const status = await llmManager.getStatus();
      
      expect(status.enabledProviders).toHaveLength(1);
      expect(status.enabledProviders[0]).toEqual({
        id: 'test-provider',
        name: 'Test Provider',
        type: 'ollama',
        isHealthy: true,
        models: [{ id: 'test-model', name: 'Test Model', size: '1GB' }]
      });
    });

    it('should exclude disabled providers from status', async () => {
      mockOllamaProvider.isEnabled.mockReturnValue(false);
      
      const status = await llmManager.getStatus();
      
      expect(status.enabledProviders).toHaveLength(0);
    });

    it('should validate provider model - valid case', () => {
      const warning = llmManager.validateProviderModel('test-provider', 'test-model');
      
      expect(warning).toBeNull();
    });

    it('should validate provider model - removed provider', () => {
      const warning = llmManager.validateProviderModel('non-existent', 'test-model');
      
      expect(warning).toEqual({
        type: 'removed',
        providerId: 'non-existent',
        modelName: 'test-model',
        message: 'Provider "non-existent" no longer exists',
        actions: [{ label: 'Select Different Provider', action: 'select_provider' }]
      });
    });

    it('should validate provider model - disabled provider', () => {
      mockOllamaProvider.isEnabled.mockReturnValue(false);
      
      const warning = llmManager.validateProviderModel('test-provider', 'test-model');
      
      expect(warning).toEqual({
        type: 'disabled',
        providerId: 'test-provider',
        modelName: 'test-model',
        message: 'Provider "Test Provider" is disabled',
        actions: [
          { label: 'Enable Provider', action: 'enable', data: { providerId: 'test-provider' } },
          { label: 'Select Different Provider', action: 'select_provider' }
        ]
      });
    });

    it('should validate provider model - unhealthy provider', () => {
      const health = llmManager.getProviderHealth('test-provider');
      if (health) {
        health.isHealthy = false;
        health.error = 'Connection failed';
      }
      
      const warning = llmManager.validateProviderModel('test-provider', 'test-model');
      
      expect(warning).toEqual({
        type: 'unhealthy',
        providerId: 'test-provider',
        modelName: 'test-model',
        message: 'Provider "Test Provider" is currently unhealthy: Connection failed',
        actions: [
          { label: 'Retry Connection', action: 'retry', data: { providerId: 'test-provider' } },
          { label: 'Select Different Provider', action: 'select_provider' }
        ]
      });
    });
  });

  describe('Shutdown', () => {
    it('should shutdown cleanly', async () => {
      await llmManager.addProvider(mockConfig);
      
      expect(llmManager.getAllProviders().size).toBe(1);
      expect(llmManager.getAllProviderHealth().size).toBe(1);
      
      await llmManager.shutdown();
      
      expect(llmManager.getAllProviders().size).toBe(0);
      expect(llmManager.getAllProviderHealth().size).toBe(0);
    });

    it('should remove all listeners on shutdown', async () => {
      const testListener = vi.fn();
      llmManager.on('providerAdded', testListener);
      
      expect(llmManager.listenerCount('providerAdded')).toBe(1);
      
      await llmManager.shutdown();
      
      expect(llmManager.listenerCount('providerAdded')).toBe(0);
    });
  });

  describe('Provider ID Generation', () => {
    it('should use provided ID', async () => {
      const configWithId = { ...mockConfig, id: 'custom-id' };
      await llmManager.addProvider(configWithId);
      
      expect(llmManager.getProvider('custom-id')).toBeTruthy();
    });

    it('should generate ID from type and name when not provided', async () => {
      const configWithoutId = { ...mockConfig };
      delete configWithoutId.id;
      
      await llmManager.addProvider(configWithoutId);
      
      expect(llmManager.getProvider('ollama-test-provider')).toBeTruthy();
    });

    it('should handle names with spaces and special characters', async () => {
      const configWithSpaces = {
        ...mockConfig,
        name: 'Test Provider With Spaces'
      };
      delete configWithSpaces.id;
      
      await llmManager.addProvider(configWithSpaces);
      
      expect(llmManager.getProvider('ollama-test-provider-with-spaces')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple providers of same type', async () => {
      const provider1 = { ...mockConfig, id: 'ollama-1', name: 'Ollama 1' };
      const provider2 = { ...mockConfig, id: 'ollama-2', name: 'Ollama 2' };
      
      await llmManager.addProvider(provider1);
      await llmManager.addProvider(provider2);
      
      expect(llmManager.getProvider('ollama-1')).toBeTruthy();
      expect(llmManager.getProvider('ollama-2')).toBeTruthy();
      expect(llmManager.getAllProviders().size).toBe(2);
    });

    it('should handle provider config updates with undefined values', async () => {
      await llmManager.addProvider(mockConfig);
      
      const updates = { enabled: undefined, temperature: undefined };
      await llmManager.updateProvider('test-provider', updates);
      
      expect(mockOllamaProvider.updateConfig).toHaveBeenCalledWith(updates);
    });

    it('should handle health check with no initial health status', async () => {
      // Remove provider and add without initial health check
      await llmManager.removeProvider('test-provider');
      
      // Create a new LlmManager to avoid initial health status
      const newLlmManager = new LlmManager();
      await newLlmManager.addProvider({ ...mockConfig, enabled: false }); // Don't trigger initial health check
      
      const isHealthy = await newLlmManager.checkProviderHealth('test-provider');
      
      expect(isHealthy).toBe(true);
      expect(newLlmManager.getProviderHealth('test-provider')?.isHealthy).toBe(true);
    });
  });
});