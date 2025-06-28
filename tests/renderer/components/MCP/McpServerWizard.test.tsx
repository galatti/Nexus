import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { McpServerWizard } from '../../../../src/renderer/components/MCP/McpServerWizard';

// Mock the electronAPI that McpServerWizard uses
const mockElectronAPI = {
  getSettings: vi.fn().mockResolvedValue({}),
  setSettings: vi.fn().mockResolvedValue(undefined),
  onSettingsChange: vi.fn().mockReturnValue(() => {}),
  testMcpConnection: vi.fn().mockResolvedValue({ success: true, data: { message: 'Connection successful!' } }),
  addMcpServer: vi.fn().mockResolvedValue({ success: true }),
};

Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

describe('McpServerWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<McpServerWizard isOpen={true} onClose={() => {}} onServerAdded={() => {}} />);
    expect(screen.getByText(/Add MCP Server/i)).toBeInTheDocument();
  });

  // Add more tests here for specific functionalities
  // For example:
  // - Test form submission
  // - Test input validation
  // - Test server configuration saving
});
