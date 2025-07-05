import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo, errorId: string) => void;
  isolate?: boolean; // If true, prevents error from bubbling up
  name?: string; // For debugging and logging
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorId: string | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorId = this.state.errorId || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.setState({
      error,
      errorInfo,
      errorId
    });

    // Log error details for debugging
    console.group(`🚨 React Error Boundary: ${this.props.name || 'Unknown'}`);
    console.error('Error ID:', errorId);
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error Stack:', error.stack);
    console.groupEnd();

    // Report error to main process for logging/telemetry
    this.reportErrorToMainProcess(error, errorInfo, errorId);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, errorId);
    }

    // Prevent error from bubbling up if isolate is true
    if (this.props.isolate) {
      return false;
    }
  }

  private async reportErrorToMainProcess(error: Error, errorInfo: React.ErrorInfo, errorId: string) {
    try {
      // Prepare error data for IPC
      const errorData = {
        errorId,
        name: error.name,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        boundaryName: this.props.name || 'Unknown',
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      // Send to main process
      if (window.electronAPI && typeof window.electronAPI.reportRendererError === 'function') {
        await window.electronAPI.reportRendererError(errorData);
        console.log('📤 Reported error to main process:', errorData.errorId);
      } else {
        console.warn('📤 Cannot report error to main process - electronAPI not available');
      }
    } catch (reportingError) {
      console.error('Failed to report error to main process:', reportingError);
    }
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg 
                  className="w-8 h-8 text-red-500" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Something went wrong
                </h3>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                An unexpected error occurred in the {this.props.name || 'application'}. 
                You can try to continue or reload the application.
              </p>
              
              {this.state.errorId && (
                <div className="bg-gray-100 dark:bg-gray-700 rounded p-2 mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Error ID: <code className="font-mono">{this.state.errorId}</code>
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={this.handleRetry}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors"
              >
                Reload App
              </button>
            </div>

            {/* Debug info in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer">
                  Debug Information
                </summary>
                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs">
                  <p className="font-semibold text-red-800 dark:text-red-200 mb-1">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                  <pre className="text-red-700 dark:text-red-300 whitespace-pre-wrap overflow-x-auto">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="mt-2 text-red-700 dark:text-red-300 whitespace-pre-wrap overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Convenience wrapper for specific use cases
export const LayoutErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary
    name="Layout"
    onError={(error, errorInfo, errorId) => {
      console.error('Layout Error Boundary caught an error:', { error, errorInfo, errorId });
    }}
  >
    {children}
  </ErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{ 
  children: ReactNode; 
  name: string;
  fallback?: ReactNode;
}> = ({ children, name, fallback }) => (
  <ErrorBoundary
    name={name}
    isolate={true}
    fallback={fallback || (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
        <p className="text-sm text-red-800 dark:text-red-200">
          Error in {name} component. Please try refreshing the page.
        </p>
      </div>
    )}
  >
    {children}
  </ErrorBoundary>
);

export const LazyErrorBoundary: React.FC<{ children: ReactNode; name: string }> = ({ children, name }) => (
  <ErrorBoundary
    name={`Lazy-${name}`}
    fallback={
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
            Failed to load {name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Please try refreshing the page
          </p>
        </div>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);