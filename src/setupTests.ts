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