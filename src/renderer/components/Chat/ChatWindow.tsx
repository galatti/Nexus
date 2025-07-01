import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { OptimizedSyntaxHighlighter } from './SyntaxHighlighter';
import { ChatMessage, LlmStatusResponse, LlmModel, ToolCall } from '../../../shared/types';
import { ModelSelector } from './ModelSelector';

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
  const [showThinking, setShowThinking] = useState(true);
  const [expandedThinkBlocks, setExpandedThinkBlocks] = useState<Set<string>>(new Set());
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Sequence counter to ensure only the latest loadLlmInfo call can update state
  const loadSeq = useRef(0);

  // Maximum number of messages to persist in localStorage to avoid exceeding
  // browser storage quotas (which could silently fail and wipe the value)
  const MAX_STORED_MESSAGES = 500;

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

  // Load LLM status and model information function
  const loadLlmInfo = useCallback(async () => {
    const seq = ++loadSeq.current; // capture sequence for this invocation

    try {
      console.log('ChatWindow: Loading LLM status... (seq)', seq);
      const statusResult = await window.electronAPI.getLlmStatus();

      // If a newer invocation has started, abort processing
      if (seq !== loadSeq.current) {
        console.log('ChatWindow: Skipping outdated LLM status load (seq)', seq);
        return;
      }

      console.log('ChatWindow: LLM status result:', statusResult);
      
      if (statusResult.success && statusResult.data) {
        console.log('ChatWindow: Setting LLM status:', statusResult.data, '(seq)', seq);
        console.log('ChatWindow: Provider info - currentProvider:', statusResult.data.currentProvider, 'currentProviderName:', statusResult.data.currentProviderName, 'currentModel:', statusResult.data.currentModel);
        setLlmStatus(statusResult.data);
        
        // Get the configured model information
        if (statusResult.data.currentModel) {
          console.log('ChatWindow: Loading model info for:', statusResult.data.currentModel, '(seq)', seq);
          
          // Try to get detailed model info from available models
          const modelsResult = await window.electronAPI.getAvailableModels();
          console.log('ChatWindow: Available models result:', modelsResult);
          
          // Abort if stale
          if (seq !== loadSeq.current) {
            console.log('ChatWindow: Skipping outdated model info load (seq)', seq);
            return;
          }
          
          if (modelsResult.success && modelsResult.data && modelsResult.data.length > 0) {
            // Find the currently configured model in the available models
            const modelInfo = modelsResult.data.find((m: LlmModel) => m.name === statusResult.data!.currentModel);
            if (modelInfo) {
              console.log('ChatWindow: Found detailed model info:', modelInfo, '(seq)', seq);
              setCurrentModel(modelInfo);
            } else {
              // Fallback: create a basic model object with just the name
              const fallbackModel = {
                name: statusResult.data.currentModel,
                description: `${statusResult.data.currentProviderType} model`
              };
              console.log('ChatWindow: Using fallback model info:', fallbackModel, '(seq)', seq);
              setCurrentModel(fallbackModel);
            }
          } else {
            // Fallback: create a basic model object with just the name
            const fallbackModel = {
              name: statusResult.data.currentModel,
              description: `${statusResult.data.currentProviderType} model`
            };
            console.log('ChatWindow: Using fallback model info (no models available):', fallbackModel, '(seq)', seq);
            setCurrentModel(fallbackModel);
          }
        } else {
          console.log('ChatWindow: No current model in status (seq)', seq);
        }
      } else {
        console.warn('ChatWindow: Failed to get LLM status:', statusResult, '(seq)', seq);
      }
    } catch (error) {
      // Abort log if outdated
      if (seq !== loadSeq.current) return;
      console.error('Failed to load LLM info:', error, '(seq)', seq);
    }
  }, []);

  // Load LLM status and model information
  useEffect(() => {
    loadLlmInfo();

    // Listen for LLM provider changes with more robust handling
    const handleProviderChange = (data?: any) => {
      console.log('ChatWindow: Provider change event detected, updating info...', data);
      // Immediately update with new data to prevent out-of-sync state
      loadLlmInfo();
    };

    // Add event listeners with improved error handling
    let settingsCleanup: (() => void) | undefined;
    let providerCleanup: (() => void) | undefined;
    
    try {
      if (window.electronAPI.onSettingsChange) {
        settingsCleanup = window.electronAPI.onSettingsChange(handleProviderChange);
      }
      
      if (window.electronAPI.onLlmProviderChange) {
        providerCleanup = window.electronAPI.onLlmProviderChange(handleProviderChange);
      }
    } catch (error) {
      console.warn('ChatWindow: Failed to set up event listeners:', error);
    }

    return () => {
      try {
        settingsCleanup?.();
        providerCleanup?.();
      } catch (error) {
        console.warn('ChatWindow: Error during cleanup:', error);
      }
    };
  }, [loadLlmInfo]);

  // Track if initial load is complete
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

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
    setInitialLoadComplete(true);
  }, []);

  // Save message history to localStorage (only after initial load)
  useEffect(() => {
    if (!initialLoadComplete) return;

    try {
      // Persist only the most recent messages to stay well below localStorage limits
      const toPersist =
        messages.length > MAX_STORED_MESSAGES
          ? messages.slice(-MAX_STORED_MESSAGES)
          : messages;

      localStorage.setItem('nexus-chat-history', JSON.stringify(toPersist));
    } catch (err) {
      console.warn('ChatWindow: Failed to persist chat history, disabling persistence for this session.', err);
    }
  }, [messages, initialLoadComplete]);

  // Chronometer for tracking request time
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isLoading && startTime) {
      timer = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isLoading, startTime]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const trimmedMessage = inputMessage.trim();
    
    // Check for slash commands (prompts)
    if (trimmedMessage.startsWith('/')) {
      await handleSlashCommand(trimmedMessage);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setStartTime(new Date());
    setIsLoading(true);
    setError(null);

    try {
      // Send the full conversation history including the new user message
      const conversationHistory = [...messages, userMessage];
      const result = await window.electronAPI.sendMessage(conversationHistory) as any;
      
      if (result.success) {
        // Debug logging removed for cleaner console
        
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response.content,
          timestamp: new Date(),
          tokens: result.response.tokens,
          tools: result.toolCalls || undefined
        };
        
        // Debug logging removed for cleaner console
        
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

  // Format elapsed time for chronometer display
  const formatElapsedTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
  };

  // Format tool result for display
  const formatToolResult = (result: unknown): string => {
    try {
      if (typeof result === 'string') {
        return result;
      }
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return String(result);
    }
  };

  const handleSlashCommand = async (command: string) => {
    setInputMessage('');
    setStartTime(new Date());
    setIsLoading(true);
    setError(null);

    // Add user message showing the command
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: command,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Parse the slash command
      const parts = command.substring(1).split(' ');
      const promptName = parts[0];
      const argsText = parts.slice(1).join(' ');
      
      // Try to parse arguments as JSON, or use as simple parameters
      let args: Record<string, any> = {};
      if (argsText) {
        try {
          // Try JSON parsing first
          args = JSON.parse(argsText);
        } catch {
          // If JSON parsing fails, treat as simple key=value pairs or single prompt text
          if (argsText.includes('=')) {
            // Parse key=value pairs: /complex_prompt temperature=0.8 style=conversational
            const pairs = argsText.split(' ');
            pairs.forEach(pair => {
              if (pair.includes('=')) {
                const [key, value] = pair.split('=', 2);
                // Keep all values as strings for MCP prompt compatibility
                args[key] = value;
              }
            });
          } else {
            // Single argument prompts: /resource_prompt 25
            if (!isNaN(Number(argsText))) {
              args.resourceId = Number(argsText);
            } else {
              args.text = argsText;
            }
          }
        }
      }

      // Get available MCP servers (assuming we use the first one with prompts)
      const mcpServers = await (window as any).electronAPI.getMcpServers();
      if (!mcpServers.success || !mcpServers.servers || mcpServers.servers.length === 0) {
        throw new Error('No MCP servers available');
      }

      // Find a server that has the requested prompt
      let targetServerId: string | null = null;
      for (const server of mcpServers.servers) {
        if (server.state === 'ready') {
          // Get server capabilities to check for prompts
          const capabilities = await (window as any).electronAPI.getServerCapabilities(server.id);
          if (capabilities.success && capabilities.capabilities && capabilities.capabilities.promptsList) {
            const hasPrompt = capabilities.capabilities.promptsList.some((p: any) => p.name === promptName);
            if (hasPrompt) {
              targetServerId = server.id;
              break;
            }
          }
        }
      }

      if (!targetServerId) {
        throw new Error(`Prompt "${promptName}" not found in any connected MCP server`);
      }

      // Execute the prompt
      // Debug logging removed for cleaner console
      const result = await (window as any).electronAPI.executePrompt(targetServerId, promptName, args);

      if (result.success && result.result) {
        // Process the prompt result
        let responseContent = '';
        if (result.result.messages && Array.isArray(result.result.messages)) {
          responseContent = result.result.messages
            .filter((msg: any) => msg.content?.type === 'text')
            .map((msg: any) => msg.content.text)
            .join('\n\n');
        } else if (typeof result.result === 'string') {
          responseContent = result.result;
        } else {
          responseContent = JSON.stringify(result.result, null, 2);
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: responseContent || `✅ Prompt "${promptName}" executed successfully`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(result.error || 'Failed to execute prompt');
      }

    } catch (error) {
      console.error('Slash command error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error executing command: ${errorMessage}\n\n**Available commands:**\n- \`/simple_prompt\` - Basic prompt without arguments\n- \`/complex_prompt temperature=0.7 style=conversational\` - Advanced prompt with arguments\n- \`/resource_prompt 25\` - Prompt with resource ID`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
      // Restore focus to input
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

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToastType('success');
      setToastMessage('Message copied to clipboard!');
      setTimeout(() => setToastMessage(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
      setToastType('error');
      setToastMessage('Failed to copy message');
      setTimeout(() => setToastMessage(null), 2000);
    }
  };

  // Parse content to separate thinking blocks from regular content
  const parseThinkingBlocks = (content: string, messageId?: string) => {
    const parts: Array<{ type: 'text'; content: string; } | { type: 'think'; content: string; id: string }> = [];
    const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
    let lastIndex = 0;
    let match;
    let thinkBlockIndex = 0;

    while ((match = thinkRegex.exec(content)) !== null) {
      // Add text before the think block
      if (match.index > lastIndex) {
        const textContent = content.slice(lastIndex, match.index).trim();
        if (textContent) {
          parts.push({ type: 'text', content: textContent });
        }
      }

      // Add the think block with deterministic ID based on content
      const contentHash = match[1].trim().substring(0, 50).replace(/[^a-zA-Z0-9]/g, '');
      parts.push({
        type: 'think',
        content: match[1].trim(),
        id: `think-${messageId || 'msg'}-${thinkBlockIndex++}-${contentHash}`
      });

      lastIndex = thinkRegex.lastIndex;
    }

    // Add remaining text after the last think block
    if (lastIndex < content.length) {
      const textContent = content.slice(lastIndex).trim();
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    return parts.length > 0 ? parts : [{ type: 'text', content }];
  };

  const toggleThinkBlock = (blockId: string) => {
    console.log('toggleThinkBlock called with blockId:', blockId);
    console.log('Current expandedThinkBlocks:', Array.from(expandedThinkBlocks));
    setExpandedThinkBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(blockId)) {
        console.log('Collapsing block:', blockId);
        newSet.delete(blockId);
      } else {
        console.log('Expanding block:', blockId);
        newSet.add(blockId);
      }
      console.log('New expandedThinkBlocks:', Array.from(newSet));
      return newSet;
    });
  };

  const toggleToolCall = (toolCallId: string) => {
    setExpandedToolCalls(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolCallId)) {
        newSet.delete(toolCallId);
      } else {
        newSet.add(toolCallId);
      }
      return newSet;
    });
  };

  const renderThinkBlock = useCallback((thinkContent: string, blockId: string) => {
    const isExpanded = expandedThinkBlocks.has(blockId);
    
    return (
      <div key={blockId} className="my-3 border border-purple-200 dark:border-purple-700 rounded-lg bg-purple-50 dark:bg-purple-900/20">
        <button
          onClick={() => toggleThinkBlock(blockId)}
          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-purple-100 dark:hover:bg-purple-800/30 transition-colors rounded-t-lg"
        >
          <div className="flex items-center space-x-2">
            <span className="text-purple-600 dark:text-purple-400">🧠</span>
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              AI Thinking Process
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-purple-600 dark:text-purple-400">
              {isExpanded ? 'Hide' : 'Show'}
            </span>
            <span className={`text-purple-600 dark:text-purple-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-purple-200 dark:border-purple-700">
            <div className="mt-2 p-3 bg-white dark:bg-gray-800 rounded border border-purple-100 dark:border-purple-800">
              <div className="text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {thinkContent}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [expandedThinkBlocks]);

  const renderToolCall = (toolCall: ToolCall, index: number) => {
    // Create a consistent ID for each tool call
    const toolCallId = toolCall.id || `tool-${index}-${toolCall.name || 'unknown'}`;
    const isExpanded = expandedToolCalls.has(toolCallId);
    
    return (
      <div className="my-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <button
          onClick={() => toggleToolCall(toolCallId)}
          className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors rounded-t-lg"
        >
          <div className="flex items-center space-x-2">
            <span className="text-blue-600 dark:text-blue-400">🔧</span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Tool Call: {toolCall.name || 'Unknown Tool'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {toolCall.id && (
              <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800/30 px-2 py-0.5 rounded">
                {toolCall.id.substring(0, 8)}...
              </span>
            )}
            <span className="text-xs text-blue-600 dark:text-blue-400">
              {isExpanded ? 'Hide' : 'Show'}
            </span>
            <span className={`text-blue-600 dark:text-blue-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </button>
        {isExpanded && (
          <div className="px-3 pb-3 border-t border-blue-200 dark:border-blue-700">
            {/* Input JSON */}
            {toolCall.args && Object.keys(toolCall.args).length > 0 && (
              <div className="mt-3">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center">
                  <span className="text-green-600 dark:text-green-400 mr-2">📤</span>
                  Input (JSON sent to tool):
                </div>
                <div className="bg-white dark:bg-gray-800 rounded border border-blue-100 dark:border-blue-800">
                  <pre className="text-xs p-3 overflow-x-auto text-gray-800 dark:text-gray-200 font-mono">
                    {JSON.stringify(toolCall.args, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            
            {/* Output JSON */}
            {!!toolCall.result && (
              <div className="mt-3">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center">
                  <span className="text-orange-600 dark:text-orange-400 mr-2">📥</span>
                  Output (JSON received from tool):
                </div>
                <div className="bg-white dark:bg-gray-800 rounded border border-blue-100 dark:border-blue-800">
                  <pre className="text-xs p-3 overflow-x-auto text-gray-800 dark:text-gray-200 font-mono">
                    {formatToolResult(toolCall.result)}
                  </pre>
                </div>
              </div>
            )}
            
            {/* Show message if no result yet */}
            {!toolCall.result && (
              <div className="mt-3">
                <div className="text-sm text-blue-600 dark:text-blue-400 italic flex items-center">
                  <span className="text-yellow-600 dark:text-yellow-400 mr-2">⏳</span>
                  Tool execution result not available yet
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    
    // Debug logging removed for cleaner console
    
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
                  {renderToolCall(toolCall, index)}
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
                  <div>
                    {parseThinkingBlocks(message.content, message.id).map((part, index) => {
                      if (part.type === 'think') {
                        if (!showThinking) return null;
                        const thinkPart = part as { type: 'think'; content: string; id: string };
                        return renderThinkBlock(thinkPart.content, thinkPart.id);
                      } else {
                        return (
                          <div key={index}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ className, children, ...props }) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const isCodeBlock = match && String(children).includes('\n');
                                  return isCodeBlock ? (
                                    <OptimizedSyntaxHighlighter
                                      language={match[1]}
                                      className="rounded-md"
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </OptimizedSyntaxHighlighter>
                                  ) : (
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                              }}
                            >
                              {part.content}
                            </ReactMarkdown>
                          </div>
                        );
                      }
                    })}
                  </div>
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
          <div className="mt-1">
            <ModelSelector
              llmStatus={llmStatus}
              currentModel={currentModel}
              onModelChange={loadLlmInfo}
            />
          </div>

          {currentModel && currentModel.description && (
            <div className="mt-1">
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {currentModel.description}
              </span>
            </div>
          )}
          {messages.length > 0 && (
            <div className="flex justify-end mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={clearHistory}
                className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Clear History
              </button>
            </div>
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
                      <OptimizedSyntaxHighlighter
                        language={match[1]}
                        className="rounded-md"
                      >
                        {String(children).replace(/\n$/, '')}
                      </OptimizedSyntaxHighlighter>
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

        {/* Loading indicator with chronometer */}
        {isLoading && !_isStreaming && (
          <div className="flex justify-start mb-4">
            <div className="max-w-3xl px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Thinking...</span>
                {elapsedTime > 0 && (
                  <>
                    <span className="text-gray-400 dark:text-gray-500">•</span>
                    <span className="text-sm text-blue-600 dark:text-blue-400 font-mono">
                      {formatElapsedTime(elapsedTime)}
                    </span>
                  </>
                )}
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
                <span>
                  {elapsedTime > 0 ? formatElapsedTime(elapsedTime) : 'Sending'}
                </span>
              </div>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out translate-y-0 opacity-100 ${
          toastType === 'success' 
            ? 'bg-green-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center space-x-2">
            <span className="text-lg">
              {toastType === 'success' ? '✓' : '✗'}
            </span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
}; 