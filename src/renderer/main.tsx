import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/index.css';

// Force console logging to work
console.log('=== RENDERER: Starting React app ===');
console.log('Window object:', window);
console.log('ElectronAPI available:', !!window.electronAPI);
console.warn('RENDERER: Warning test');
console.error('RENDERER: Error test');
console.info('RENDERER: Info test');

// Try different console methods
console.table([{ test: 'value' }]);
console.group('RENDERER: Group test');
console.log('Inside group');
console.groupEnd();

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('=== RENDERER: React app rendered ==='); 