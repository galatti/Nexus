import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChatMessage } from '../../../shared/types';

interface ChatWindowProps {
  className?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ className = '' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage, scrollToBottom]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load message history from localStorage
  useEffect(() => {
    const savedMessages = localStorage.getItem('nexus-chat-history');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
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
    if (!inputMessage.trim() || isLoading || isStreaming) return;

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
      const result = await window.electronAPI.sendMessage(userMessage.content) as any;
      
      if (result.success) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response.content,
          timestamp: new Date(),
          tokens: result.response.tokens
        };
        
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        setError(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Chat error:', error);
      setError('Failed to communicate with the assistant');
    } finally {
      setIsLoading(false);
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

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    
    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`max-w-3xl px-4 py-2 rounded-lg ${
            isUser
              ? 'bg-blue-600 text-white'
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
    );
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Chat Assistant
        </h2>
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
        {messages.length === 0 && !isStreaming && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <div className="mb-4">
              <div className="text-6xl mb-4">🤖</div>
              <h3 className="text-xl font-medium mb-2">Welcome to Nexus MVP</h3>
              <p className="text-sm">
                Start a conversation with your AI assistant powered by MCP tools
              </p>
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
        {isStreaming && streamingMessage && (
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
                {streamingMessage}
              </ReactMarkdown>
              <div className="text-xs mt-2 opacity-70">
                <span className="inline-block animate-pulse">●</span> Streaming...
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !isStreaming && (
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
              disabled={isLoading || isStreaming}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400">
              {inputMessage.length}/4000
            </div>
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || isStreaming}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading || isStreaming ? (
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