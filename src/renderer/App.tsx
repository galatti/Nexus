import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { SessionProvider } from './context/SessionContext';
import { Layout } from './components/Layout/Layout';
import { ErrorBoundary, LayoutErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  console.log('=== RENDERER: App component rendering ===');
  
  return (
    <ErrorBoundary 
      name="App" 
      onError={(error, errorInfo, errorId) => {
        console.error('🚨 Top-level App error boundary caught an error:', {
          error: error.message,
          errorId,
          stack: error.stack
        });
      }}
    >
      <ThemeProvider>
        <SessionProvider>
          <LayoutErrorBoundary>
            <div className="app">
              <Layout />
            </div>
          </LayoutErrorBoundary>
        </SessionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}; 