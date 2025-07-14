import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface UploadErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface UploadErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class UploadErrorBoundary extends Component<
  UploadErrorBoundaryProps,
  UploadErrorBoundaryState
> {
  constructor(props: UploadErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): UploadErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log error for debugging
    console.error('UploadErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-red-400">
            <svg
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          <h3 className="mb-2 text-lg font-medium text-red-800">
            Upload Error
          </h3>
          
          <p className="mb-4 text-sm text-red-700">
            Something went wrong with the upload area. Please try again.
          </p>
          
          <button
            onClick={this.handleRetry}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Try Again
          </button>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm font-medium text-red-800">
                Error Details (Development)
              </summary>
              <div className="mt-2 rounded bg-red-100 p-3 text-xs font-mono text-red-800">
                <div className="mb-2">
                  <strong>Error:</strong> {this.state.error.message}
                </div>
                <div className="mb-2">
                  <strong>Stack:</strong>
                  <pre className="mt-1 whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </div>
                {this.state.errorInfo && (
                  <div>
                    <strong>Component Stack:</strong>
                    <pre className="mt-1 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withUploadErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<UploadErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <UploadErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </UploadErrorBoundary>
  );

  WrappedComponent.displayName = `withUploadErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Pre-wrapped UserUploadArea component
export { UserUploadArea as BaseUserUploadArea } from './UserUploadArea';

// Safe version with error boundary
export const SafeUserUploadArea = withUploadErrorBoundary(
  React.lazy(() => import('./UserUploadArea').then(m => ({ default: m.UserUploadArea })))
);