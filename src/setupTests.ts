// Jest setup file for testing
import '@testing-library/jest-dom';

// Mock Electron APIs for testing
const mockElectronAPI = {
  getAppVersion: jest.fn().mockResolvedValue('1.0.0'),
  minimizeWindow: jest.fn().mockResolvedValue(undefined),
  maximizeWindow: jest.fn().mockResolvedValue(undefined),
  closeWindow: jest.fn().mockResolvedValue(undefined),
  getSettings: jest.fn().mockResolvedValue({}),
  setSettings: jest.fn().mockResolvedValue(undefined),
  connectToServer: jest.fn().mockResolvedValue(undefined),
  disconnectFromServer: jest.fn().mockResolvedValue(undefined),
  executeTools: jest.fn().mockResolvedValue({}),
  sendMessage: jest.fn().mockResolvedValue('Mock response'),
  onMcpServerStatusChange: jest.fn().mockReturnValue(() => {}),
  onSettingsChange: jest.fn().mockReturnValue(() => {}),
};

// Mock the Electron API on window object
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

// Suppress console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
}; 