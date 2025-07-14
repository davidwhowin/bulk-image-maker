import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UploadErrorBoundary, withUploadErrorBoundary } from './UploadErrorBoundary';

// Mock component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Working component</div>;
};

// Mock component for HOC testing
const MockComponent = ({ title }: { title: string }) => <div>{title}</div>;

describe('UploadErrorBoundary', () => {
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for test clarity
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Normal Operation', () => {
    it('renders children when there is no error', () => {
      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={false} />
        </UploadErrorBoundary>
      );

      expect(screen.getByText('Working component')).toBeInTheDocument();
    });

    it('does not call onError when there is no error', () => {
      render(
        <UploadErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={false} />
        </UploadErrorBoundary>
      );

      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('renders default error UI when child throws error', () => {
      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      expect(screen.getByText('Upload Error')).toBeInTheDocument();
      expect(screen.getByText(/something went wrong with the upload area/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>;
      
      render(
        <UploadErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Upload Error')).not.toBeInTheDocument();
    });

    it('calls onError callback when error occurs', () => {
      render(
        <UploadErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('logs error to console', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      
      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'UploadErrorBoundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('Error Recovery', () => {
    it('recovers from error when retry button is clicked', () => {
      const { rerender } = render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      // Error state
      expect(screen.getByText('Upload Error')).toBeInTheDocument();

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // Re-render with non-throwing component
      rerender(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={false} />
        </UploadErrorBoundary>
      );

      // Should show working component
      expect(screen.getByText('Working component')).toBeInTheDocument();
      expect(screen.queryByText('Upload Error')).not.toBeInTheDocument();
    });
  });

  describe('Development Mode', () => {
    it('shows error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      // Should show development error details
      expect(screen.getByText(/error details.*development/i)).toBeInTheDocument();
      
      // Click to expand details
      fireEvent.click(screen.getByText(/error details.*development/i));
      
      expect(screen.getByText(/test error message/i)).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });

    it('hides error details in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      // Should not show development error details
      expect(screen.queryByText(/error details.*development/i)).not.toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Higher-Order Component', () => {
    it('wraps component with error boundary', () => {
      const WrappedComponent = withUploadErrorBoundary(MockComponent);
      
      render(<WrappedComponent title="Test Title" />);
      
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('sets correct display name', () => {
      const WrappedComponent = withUploadErrorBoundary(MockComponent);
      
      expect(WrappedComponent.displayName).toBe('withUploadErrorBoundary(MockComponent)');
    });

    it('handles errors in wrapped component', () => {
      const WrappedThrowError = withUploadErrorBoundary(ThrowError);
      
      render(<WrappedThrowError shouldThrow={true} />);
      
      expect(screen.getByText('Upload Error')).toBeInTheDocument();
    });

    it('passes through error boundary props', () => {
      const customFallback = <div>HOC Custom Error</div>;
      const WrappedComponent = withUploadErrorBoundary(ThrowError, {
        fallback: customFallback,
        onError: mockOnError,
      });
      
      render(<WrappedComponent shouldThrow={true} />);
      
      expect(screen.getByText('HOC Custom Error')).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('maintains focus management during error recovery', () => {
      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      const retryButton = screen.getByRole('button', { name: /try again/i });
      
      // Button should be focusable
      expect(retryButton).toHaveAttribute('class', expect.stringContaining('focus:outline-none'));
      
      // Should have proper focus styles
      expect(retryButton).toHaveAttribute('class', expect.stringContaining('focus:ring'));
    });

    it('has proper ARIA attributes', () => {
      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      // SVG should have aria-hidden
      const svg = screen.getByRole('button').parentElement?.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('provides semantic HTML structure', () => {
      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      // Should have proper heading hierarchy
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Upload Error');
      
      // Button should have proper role
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  describe('Error Message Display', () => {
    it('shows appropriate error message for different error types', () => {
      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      expect(screen.getByText(/something went wrong with the upload area/i)).toBeInTheDocument();
    });

    it('maintains consistent styling across error states', () => {
      render(
        <UploadErrorBoundary>
          <ThrowError shouldThrow={true} />
        </UploadErrorBoundary>
      );

      const errorContainer = screen.getByText('Upload Error').closest('div');
      expect(errorContainer).toHaveClass('rounded-lg', 'border', 'border-red-200', 'bg-red-50');
    });
  });
});