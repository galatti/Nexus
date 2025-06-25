import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatMessage, LlmStatusResponse, LlmModel, ToolCall } from '../../../shared/types';

interface ChatWindowProps {
  className?: string;
  isActive?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ className = '', isActive = false }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [_isStreaming] = useState(false);
  const [_streamingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<LlmStatusResponse | null>(null);
  const [currentModel, setCurrentModel] = useState<LlmModel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-scroll when chat view becomes active
  useEffect(() => {
    if (isActive && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100); // Small delay to ensure the view has rendered
    }
  }, [isActive, scrollToBottom, messages.length]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load LLM status and model information
  useEffect(() => {
    const loadLlmInfo = async () => {
      try {
        const statusResult = await window.electronAPI.getLlmStatus();
        if (statusResult.success && statusResult.data) {
          setLlmStatus(statusResult.data);
          
          // Get the configured model information
          if (statusResult.data.currentModel) {
            // Try to get detailed model info from available models
            const modelsResult = await window.electronAPI.getAvailableModels();
            if (modelsResult.success && modelsResult.data && modelsResult.data.length > 0) {
              // Find the currently configured model in the available models
              const modelInfo = modelsResult.data.find((m: LlmModel) => m.name === statusResult.data!.currentModel);
              if (modelInfo) {
                setCurrentModel(modelInfo);
              } else {
                // Fallback: create a basic model object with just the name
                setCurrentModel({
                  name: statusResult.data.currentModel,
                  description: `${statusResult.data.currentProviderType} model`
                });
              }
            } else {
              // Fallback: create a basic model object with just the name
              setCurrentModel({
                name: statusResult.data.currentModel,
                description: `${statusResult.data.currentProviderType} model`
              });
            }
          }
        }
      } catch (error) {
        console.error('Failed to load LLM info:', error);
      }
    };

    loadLlmInfo();

    // Listen for LLM provider changes
    const handleProviderChange = () => {
      loadLlmInfo();
    };

    // Add event listeners
    let settingsCleanup: (() => void) | undefined;
    
    if (window.electronAPI.onSettingsChange) {
      settingsCleanup = window.electronAPI.onSettingsChange(handleProviderChange);
    }

    return () => {
      settingsCleanup?.();
    };
  }, []);

  // Load message history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('nexus-chat-history');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((msg: Partial<ChatMessage> & { timestamp: string }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        } as ChatMessage)));
      } catch (error) {
        console.error('Failed to load message history:', error);
      }
    }
  }, []);

  // Save message history to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('nexus-chat-history', JSON.stringify(messages));
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Send the full conversation history including the new user message
      const conversationHistory = [...messages, userMessage];
      const result = await window.electronAPI.sendMessage(conversationHistory) as any;
      
      if (result.success) {
        console.log('🔍 LLM Response Debug:', {
          hasResponse: !!result.response,
          hasToolCalls: !!result.toolCalls,
          toolCallsLength: result.toolCalls?.length || 0,
          toolCalls: result.toolCalls
        });
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response.content,
          timestamp: new Date(),
          tokens: result.response.tokens,
          tools: result.toolCalls || undefined
        };
        
        console.log('📨 Assistant Message:', assistantMessage);
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError('Failed to communicate with the assistant');
    } finally {
      setIsLoading(false);
      // Restore focus to input after the message is processed
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('nexus-chat-history');
    setError(null);
  };

  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const renderToolCall = (toolCall: ToolCall) => {
    return (
      <div className="my-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-r-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-blue-700 dark:text-blue-300">
            🔧 Tool Call: {toolCall.name}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800/30 px-2 py-1 rounded">
            {toolCall.id}
          </div>
        </div>
        {toolCall.args && Object.keys(toolCall.args).length > 0 && (
          <div className="mt-2">
            <div className="text-sm text-blue-600 dark:text-blue-400 mb-1 font-medium">Parameters:</div>
            <pre className="text-xs bg-blue-100 dark:bg-blue-800/30 p-2 rounded overflow-x-auto text-blue-800 dark:text-blue-200">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
        )}

      </div>
    );
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    
    // Only log for debugging in development and avoid excessive logging
    if (process.env.NODE_ENV === 'development' && message.tools?.length) {
      console.log('🎨 Rendering message with tools:', {
        id: message.id,
        role: message.role,
        toolsLength: message.tools.length
      });
    }
    
    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div className="max-w-4xl w-full">
          {/* Tool calls displayed above the message content */}
          {message.tools && message.tools.length > 0 && (
            <div className="mb-2">
              {message.tools.map((toolCall, index) => (
                <div key={index}>
                  {renderToolCall(toolCall)}
                </div>
              ))}
            </div>
          )}
          
          <div
            className={`px-4 py-2 rounded-lg ${
              isUser
                ? 'bg-blue-600 text-white ml-auto max-w-3xl'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {isUser ? (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isCodeBlock = match && String(children).includes('\n');
                        return isCodeBlock ? (
                          <SyntaxHighlighter
                            style={oneDark as any}
                            language={match[1]}
                            PreTag="div"
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
              </div>
              <button
                onClick={() => copyMessage(message.content)}
                className="ml-2 p-1 text-xs opacity-50 hover:opacity-100 transition-opacity"
                title="Copy message"
              >
                📋
              </button>
            </div>
            <div className="text-xs mt-2 opacity-70">
              {message.timestamp.toLocaleTimeString()}
              {message.tokens && (
                <span className="ml-2">({message.tokens} tokens)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Chat Assistant
          </h2>
          {llmStatus && llmStatus.currentProvider && (
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${llmStatus.isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {llmStatus.currentProviderName || llmStatus.currentProvider?.replace(/-/g, ' ')}
                </span>
              </div>
              {currentModel && (
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {currentModel.name}
                  </span>
                  {currentModel.size && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      ({currentModel.size})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {currentModel && currentModel.description && (
            <div className="mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {currentModel.description}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Clear History
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !_isStreaming && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <div className="mb-4">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-medium mb-2">Welcome to Nexus MVP</h3>
              <p className="text-sm mb-4">
                Start a conversation with your AI assistant powered by MCP tools
              </p>
              {llmStatus && llmStatus.currentProvider && (
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                  <div className={`w-2 h-2 rounded-full ${llmStatus.isHealthy ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {llmStatus.currentProviderName || llmStatus.currentProvider?.replace(/-/g, ' ')}
                  </span>
                  {currentModel && (
                    <>
                      <span className="text-blue-400 dark:text-blue-500">•</span>
                      <span className="text-sm text-blue-700 dark:text-blue-300">
                        {currentModel.name}
                      </span>
                    </>
                  )}
                </div>
              )}
              {!llmStatus?.currentProvider && (
                <div className="inline-flex items-center space-x-2 px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-sm text-yellow-700 dark:text-yellow-300">
                    No LLM provider configured
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 max-w-2xl mx-auto">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">💬 Natural Conversations</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Chat naturally with AI models like Ollama or OpenRouter
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">🔧 MCP Tools</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Access powerful tools through the Model Context Protocol
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">📝 Markdown Support</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Rich text formatting with code syntax highlighting
                </p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="font-medium mb-2">🎨 Theme Support</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatic light/dark theme switching
                </p>
              </div>
            </div>
          </div>
        )}

        {messages.map(renderMessage)}

                {/* Streaming message */}
        {_isStreaming && _streamingMessage && (
          <div className="flex justify-start mb-4">
            <div className="max-w-3xl px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isCodeBlock = match && String(children).includes('\n');
                    return isCodeBlock ? (
                      <SyntaxHighlighter
                        style={oneDark as any}
                        language={match[1]}
                        PreTag="div"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  }
                }}
              >
                {_streamingMessage}
              </ReactMarkdown>
              <div className="text-xs mt-2 opacity-70">
                <span className="inline-block animate-pulse">●</span> Streaming...
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !_isStreaming && (
          <div className="flex justify-start mb-4">
            <div className="max-w-3xl px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="flex justify-center mb-4">
            <div className="max-w-3xl px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
              <div className="flex items-center space-x-2">
                <span>⚠️</span>
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              disabled={isLoading || _isStreaming}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {inputMessage.length}/4000
            </div>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || _isStreaming}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading || _isStreaming ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Sending</span>
              </div>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}; 