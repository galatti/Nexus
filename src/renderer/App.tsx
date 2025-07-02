import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { SessionProvider } from './context/SessionContext';
import { Layout } from './components/Layout/Layout';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <SessionProvider>
        <div className="app">
          <Layout />
        </div>
      </SessionProvider>
    </ThemeProvider>
  );
}; 