import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout/Layout';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <div className="app">
        <Layout />
      </div>
    </ThemeProvider>
  );
}; 