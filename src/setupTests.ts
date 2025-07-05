// Jest setup file for testing
import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock Electron APIs for testing
const mockElectronAPI = {
  getAppVersion: vi.fn().mockResolvedValue('1.0.0'),
  minimizeWindow: vi.fn().mockResolvedValue(undefined),
  maximizeWindow: vi.fn().mockResolvedValue(undefined),
  closeWindow: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({}),
  setSettings: vi.fn().mockResolvedValue(undefined),
  connectToServer: vi.fn().mockResolvedValue(undefined),
  disconnectFromServer: vi.fn().mockResolvedValue(undefined),
  executeTools: vi.fn().mockResolvedValue({}),
  sendMessage: vi.fn().mockResolvedValue('Mock response'),
  onMcpServerStatusChange: vi.fn().mockReturnValue(() => {}),
  onSettingsChange: vi.fn().mockReturnValue(() => {}),
};

// Mock the Electron API on window object
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

// Suppress console warnings during tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};

// Suppress JSDOM error reporting for React error boundary tests
// This prevents "Uncaught [Error]" messages from appearing in test output
// when testing error boundaries, which is expected behavior
const originalOnError = window.onerror;
const originalOnUnhandledRejection = window.onunhandledrejection;

window.onerror = function(message, source, lineno, colno, error) {
  // Allow React error boundaries to work without noise
  if (error && error.message && (error.message.includes('Test error') || error.message.includes('Retryable error'))) {
    return true; // Suppress the error
  }
  // For other errors, use original handler
  if (originalOnError) {
    return originalOnError.call(this, message, source, lineno, colno, error);
  }
  return false;
};

window.onunhandledrejection = function(event) {
  // Suppress promise rejections related to error boundary tests
  if (event.reason && event.reason.message && (event.reason.message.includes('Test error') || event.reason.message.includes('Retryable error'))) {
    event.preventDefault();
    return;
  }
  // For other rejections, use original handler
  if (originalOnUnhandledRejection) {
    return originalOnUnhandledRejection.call(this, event);
  }
};