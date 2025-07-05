import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary, ComponentErrorBoundary, LazyErrorBoundary } from '../../../src/renderer/components/ErrorBoundary';

beforeEach(() => {
  // Clear mock between tests
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks();
});

// Mock electronAPI
const mockReportRendererError = vi.fn();
Object.defineProperty(window, 'electronAPI', {
  value: {
    reportRendererError: mockReportRendererError
  },
  writable: true
});

// Component that throws an error
const ThrowingComponent: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Working component</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    mockReportRendererError.mockClear();
    mockReportRendererError.mockResolvedValue({ success: true });
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary name="Test">
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Working component')).toBeInTheDocument();
  });

  it('should catch errors and display error UI', () => {
    render(
      <ErrorBoundary name="Test">
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred in the Test/)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reload App')).toBeInTheDocument();
  });

  it('should display custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>;
    
    render(
      <ErrorBoundary name="Test" fallback={customFallback}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should call onError callback when provided', () => {
    const onError = vi.fn();
    
    render(
      <ErrorBoundary name="Test" onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      }),
      expect.any(String)
    );
  });

  it('should generate unique error ID', () => {
    const onError1 = vi.fn();
    const onError2 = vi.fn();
    
    render(
      <div>
        <ErrorBoundary name="Test1" onError={onError1}>
          <ThrowingComponent />
        </ErrorBoundary>
        <ErrorBoundary name="Test2" onError={onError2}>
          <ThrowingComponent />
        </ErrorBoundary>
      </div>
    );

    expect(onError1).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object),
      expect.any(String)
    );
    expect(onError2).toHaveBeenCalledWith(
      expect.any(Error),
      expect.any(Object),
      expect.any(String)
    );

    const errorId1 = onError1.mock.calls[0][2];
    const errorId2 = onError2.mock.calls[0][2];
    
    expect(errorId1).not.toBe(errorId2);
  });

  it('should report error to main process', async () => {
    render(
      <ErrorBoundary name="Test">
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // Wait for async error reporting
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockReportRendererError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorId: expect.any(String),
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String),
        componentStack: expect.any(String),
        boundaryName: 'Test',
        timestamp: expect.any(String),
        userAgent: expect.any(String),
        url: expect.any(String)
      })
    );
  });

  it('should handle error reporting failure gracefully', async () => {
    mockReportRendererError.mockRejectedValue(new Error('Reporting failed'));
    
    render(
      <ErrorBoundary name="Test">
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // Wait for async error reporting
    await new Promise(resolve => setTimeout(resolve, 0));

    // Should still display error UI even if reporting fails
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should show debug information in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    try {
      render(
        <ErrorBoundary name="Test">
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Debug Information')).toBeInTheDocument();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('should hide debug information in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    
    try {
      render(
        <ErrorBoundary name="Test">
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Debug Information')).not.toBeInTheDocument();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

describe('ComponentErrorBoundary', () => {
  it('should render component-specific error message', () => {
    render(
      <ComponentErrorBoundary name="TestComponent">
        <ThrowingComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText(/Error in TestComponent component/)).toBeInTheDocument();
  });

  it('should use custom fallback when provided', () => {
    const customFallback = <div>Custom component error</div>;
    
    render(
      <ComponentErrorBoundary name="TestComponent" fallback={customFallback}>
        <ThrowingComponent />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText('Custom component error')).toBeInTheDocument();
  });
});

describe('LazyErrorBoundary', () => {
  it('should render lazy component-specific error message', () => {
    render(
      <LazyErrorBoundary name="LazyComponent">
        <ThrowingComponent />
      </LazyErrorBoundary>
    );

    expect(screen.getByText('Failed to load LazyComponent')).toBeInTheDocument();
    expect(screen.getByText('Please try refreshing the page')).toBeInTheDocument();
  });
});

describe('Error boundary retry functionality', () => {
  it('should show retry button when error occurs', async () => {
    render(
      <ErrorBoundary name="Test">
        <ThrowingComponent />
      </ErrorBoundary>
    );

    // Should show error UI with retry button
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Reload App')).toBeInTheDocument();
  });
});