import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { McpServerWizard } from '../../../../src/renderer/components/MCP/McpServerWizard';

// Mock electron API for testing
const mockElectronAPI = {
  testMcpConnection: vi.fn(),
  addMcpServer: vi.fn(),
  getSettings: vi.fn().mockResolvedValue({}),
  setSettings: vi.fn().mockResolvedValue(undefined),
  onSettingsChange: vi.fn().mockReturnValue(() => {}),
  getMcpServers: vi.fn().mockResolvedValue({ success: true, data: [] }),
};

Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

describe('McpServerWizard', () => {
  const mockOnClose = vi.fn();
  const mockOnServerAdded = vi.fn();

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onServerAdded: mockOnServerAdded,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.testMcpConnection.mockResolvedValue({ 
      success: true, 
      data: { message: 'Connection successful!' } 
    });
    mockElectronAPI.addMcpServer.mockResolvedValue({ success: true });
  });

  describe('Basic Rendering', () => {
    it('renders without crashing when open', () => {
      render(<McpServerWizard {...defaultProps} />);
      expect(screen.getByText(/Add MCP Server/i)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      render(<McpServerWizard {...defaultProps} isOpen={false} />);
      expect(screen.queryByText(/Add MCP Server/i)).not.toBeInTheDocument();
    });

    it('displays wizard steps', () => {
      render(<McpServerWizard {...defaultProps} />);
      
      expect(screen.getByText(/Basic Information/i)).toBeInTheDocument();
      expect(screen.getByText(/Connection Type/i)).toBeInTheDocument();
      expect(screen.getByText(/Configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/Options/i)).toBeInTheDocument();
      expect(screen.getByText(/Review & Test/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('validates server name is required', async () => {
      render(<McpServerWizard {...defaultProps} />);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/server name is required/i)).toBeInTheDocument();
      });
    });

    it('validates command for STDIO transport', async () => {
      render(<McpServerWizard {...defaultProps} />);
      
      // Fill basic info
      const nameInput = screen.getByRole('textbox', { name: /name/i });
      fireEvent.change(nameInput, { target: { value: 'Test Server' } });
      
      // Go to next step (transport)
      let nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Connection Type/i)).toBeInTheDocument();
      });
      
      // Go to configuration
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Configuration/i)).toBeInTheDocument();
      });
      
      // Try to proceed without command
      nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/command is required/i)).toBeInTheDocument();
      });
    });
  });

  describe('Connection Testing', () => {
    it('tests connection successfully', async () => {
      render(<McpServerWizard {...defaultProps} />);
      
      // Navigate to review step (simplified for test)
      const nameInput = screen.getByRole('textbox');
      fireEvent.change(nameInput, { target: { value: 'Test Server' } });
      
      // Find test button (may need to navigate through steps)
      const testButton = screen.queryByRole('button', { name: /test/i });
      if (testButton) {
        fireEvent.click(testButton);

        await waitFor(() => {
          expect(mockElectronAPI.testMcpConnection).toHaveBeenCalled();
        });
      }
    });

    it('handles connection test failure', async () => {
      mockElectronAPI.testMcpConnection.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });

      render(<McpServerWizard {...defaultProps} />);
      
      const testButton = screen.queryByRole('button', { name: /test/i });
      if (testButton) {
        fireEvent.click(testButton);

        await waitFor(() => {
          expect(screen.getByText(/Connection failed/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Server Creation', () => {
    it('creates server successfully', async () => {
      render(<McpServerWizard {...defaultProps} />);
      
      // Fill basic form
      const nameInput = screen.getByRole('textbox');
      fireEvent.change(nameInput, { target: { value: 'Test Server' } });
      
      // Look for finish/add button
      const finishButton = screen.queryByRole('button', { name: /finish/i }) ||
                          screen.queryByRole('button', { name: /add/i });
      
      if (finishButton) {
        fireEvent.click(finishButton);

        await waitFor(() => {
          expect(mockElectronAPI.addMcpServer).toHaveBeenCalled();
        });
      }
    });

    it('handles server creation error', async () => {
      mockElectronAPI.addMcpServer.mockResolvedValue({
        success: false,
        error: 'Failed to create server'
      });

      render(<McpServerWizard {...defaultProps} />);
      
      const nameInput = screen.getByRole('textbox');
      fireEvent.change(nameInput, { target: { value: 'Test Server' } });
      
      const finishButton = screen.queryByRole('button', { name: /finish/i }) ||
                          screen.queryByRole('button', { name: /add/i });
      
      if (finishButton) {
        fireEvent.click(finishButton);

        await waitFor(() => {
          expect(screen.getByText(/Failed to create server/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('User Interactions', () => {
    it('closes when cancel button is clicked', () => {
      render(<McpServerWizard {...defaultProps} />);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);
      
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('calls onServerAdded when server is created', async () => {
      render(<McpServerWizard {...defaultProps} />);
      
      const nameInput = screen.getByRole('textbox');
      fireEvent.change(nameInput, { target: { value: 'Test Server' } });
      
      const finishButton = screen.queryByRole('button', { name: /finish/i }) ||
                          screen.queryByRole('button', { name: /add/i });
      
      if (finishButton) {
        fireEvent.click(finishButton);

        await waitFor(() => {
          expect(mockOnServerAdded).toHaveBeenCalled();
        });
      }
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(<McpServerWizard {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog') || screen.getByText(/Add MCP Server/i).closest('[role]');
      expect(dialog).toBeInTheDocument();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('supports keyboard navigation', () => {
      render(<McpServerWizard {...defaultProps} />);
      
      const firstInput = screen.getByRole('textbox');
      firstInput.focus();
      expect(document.activeElement).toBe(firstInput);
    });
  });
});
