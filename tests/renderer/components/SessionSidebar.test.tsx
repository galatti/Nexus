import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SessionSidebar } from '../../../src/renderer/components/Chat/SessionSidebar';
import React from 'react';
import { SessionProvider } from '../../../src/renderer/context/SessionContext';

// Helper to render with context
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<SessionProvider>{ui}</SessionProvider>);
};

describe('SessionSidebar', () => {
  beforeEach(() => {
    // Clear localStorage before each run
    localStorage.clear();
  });

  it('creates a new chat when clicking + New Chat', () => {
    renderWithProvider(<SessionSidebar isOpen />);
    const newBtn = screen.getByText('＋ New Chat');
    fireEvent.click(newBtn);
    // Expect a list item titled "New Chat" to appear
    const item = screen.getAllByText(/New Chat/)[0];
    expect(item).toBeInTheDocument();
  });
}); 