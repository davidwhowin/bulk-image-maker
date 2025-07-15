import type { SupportedFormat, FormatConversionResult } from '@/types/format-conversion';

/**
 * Comprehensive error handling and recovery for format conversion
 */
export class FormatErrorHandler {
  private retryAttempts = new Map<string, number>();
  private errorCounts = new Map<string, number>();

  /**
   * Handle memory exhaustion with graceful recovery
   */
  async handleMemoryExhaustion<T>(
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.isMemoryError(error)) {
        // Force garbage collection if available
        if ('gc' in window && typeof window.gc === 'function') {
          window.gc();
        }

        // Clear any cached object URLs
        this.clearMemoryCache();

        // Wait for a moment to allow cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        if (fallbackOperation) {
          try {
            return await fallbackOperation();
          } catch (fallbackError) {
            const errorMessage = error instanceof Error ? error.message : 'unknown error';
            const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : 'unknown error';
            throw new Error(`Memory exhaustion: ${errorMessage}. Fallback also failed: ${fallbackMessage}`);
          }
        }
      }

      throw error;
    }
  }

  /**
   * Handle format conversion errors with automatic fallbacks
   */
  async handleFormatConversionError(
    originalFormat: SupportedFormat,
    targetFormat: SupportedFormat,
    error: Error
  ): Promise<{ shouldRetry: boolean; fallbackFormat?: SupportedFormat; errorMessage: string }> {
    const errorKey = `${originalFormat}->${targetFormat}`;
    const retryCount = this.retryAttempts.get(errorKey) || 0;
    
    this.retryAttempts.set(errorKey, retryCount + 1);
    this.incrementErrorCount(targetFormat);

    // Check if it's a browser compatibility issue
    if (this.isBrowserCompatibilityError(error)) {
      const fallbackFormat = this.getFallbackFormat(targetFormat);
      return {
        shouldRetry: false,
        fallbackFormat,
        errorMessage: `Format ${targetFormat} not supported. Falling back to ${fallbackFormat}.`
      };
    }

    // Check if it's a temporary error that can be retried
    if (this.isRetryableError(error) && retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000)); // Exponential backoff
      return {
        shouldRetry: true,
        errorMessage: `Temporary error, retrying (attempt ${retryCount + 1}/3): ${error.message}`
      };
    }

    // Check if it's a file corruption issue
    if (this.isFileCorruptionError(error)) {
      return {
        shouldRetry: false,
        errorMessage: `File appears to be corrupted and cannot be converted: ${error.message}`
      };
    }

    // Default error handling
    return {
      shouldRetry: false,
      errorMessage: `Conversion failed: ${error.message}`
    };
  }

  /**
   * Handle batch processing errors with smart recovery
   */
  async handleBatchError(
    error: Error,
    processedCount: number,
    totalCount: number
  ): Promise<{ shouldContinue: boolean; recommendation: string }> {
    // If more than 50% failed, suggest reducing batch size
    const failureRate = processedCount / totalCount;
    
    if (this.isMemoryError(error)) {
      return {
        shouldContinue: false,
        recommendation: 'Memory limit reached. Try processing smaller batches or fewer files at once.'
      };
    }

    if (failureRate > 0.5) {
      return {
        shouldContinue: false,
        recommendation: 'High failure rate detected. Check your files and try smaller batches.'
      };
    }

    if (this.isNetworkError(error)) {
      return {
        shouldContinue: true,
        recommendation: 'Network issue detected. Continuing with remaining files in offline mode.'
      };
    }

    return {
      shouldContinue: true,
      recommendation: 'Some files failed to process. Continuing with remaining files.'
    };
  }

  /**
   * Create user-friendly error message from technical error
   */
  createUserFriendlyError(error: Error, context: string): string {
    const baseMessage = `Error during ${context}`;

    if (this.isMemoryError(error)) {
      return `${baseMessage}: Your device is running low on memory. Try processing fewer files at once.`;
    }

    if (this.isBrowserCompatibilityError(error)) {
      return `${baseMessage}: This format is not supported in your browser. We'll use a compatible alternative.`;
    }

    if (this.isFileCorruptionError(error)) {
      return `${baseMessage}: The file appears to be corrupted or in an unsupported format.`;
    }

    if (this.isNetworkError(error)) {
      return `${baseMessage}: Network connection issue. Please check your internet connection.`;
    }

    if (this.isTimeoutError(error)) {
      return `${baseMessage}: The operation took too long and was cancelled. Try with smaller files.`;
    }

    // Generic error
    return `${baseMessage}: ${error.message}`;
  }

  /**
   * Get fallback format for unsupported format
   */
  private getFallbackFormat(format: SupportedFormat): SupportedFormat {
    const fallbacks: Record<SupportedFormat, SupportedFormat> = {
      avif: 'webp',
      webp: 'jpeg',
      jpeg: 'jpeg',
      png: 'png',
    };
    
    return fallbacks[format];
  }

  /**
   * Check if error is related to memory exhaustion
   */
  private isMemoryError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('memory') ||
      errorMessage.includes('out of memory') ||
      errorMessage.includes('quota exceeded') ||
      error.name === 'QuotaExceededError' ||
      error.code === 22 // DOMException.QUOTA_EXCEEDED_ERR
    );
  }

  /**
   * Check if error is related to browser compatibility
   */
  private isBrowserCompatibilityError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('not supported') ||
      errorMessage.includes('unsupported') ||
      errorMessage.includes('format') ||
      error.name === 'NotSupportedError'
    );
  }

  /**
   * Check if error is retryable (temporary issue)
   */
  private isRetryableError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('network') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('temporarily') ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET'
    );
  }

  /**
   * Check if error indicates file corruption
   */
  private isFileCorruptionError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('corrupt') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('malformed') ||
      errorMessage.includes('parse') ||
      errorMessage.includes('decode')
    );
  }

  /**
   * Check if error is network-related
   */
  private isNetworkError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('fetch') ||
      error.code === 'NETWORK_ERROR'
    );
  }

  /**
   * Check if error is timeout-related
   */
  private isTimeoutError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return (
      errorMessage.includes('timeout') ||
      errorMessage.includes('timed out') ||
      error.name === 'TimeoutError'
    );
  }

  /**
   * Clear memory cache to free up space
   */
  private clearMemoryCache(): void {
    // Clear any global caches if available
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          if (cacheName.includes('image')) {
            caches.delete(cacheName);
          }
        });
      });
    }

    // Trigger any cleanup callbacks
    this.triggerMemoryCleanup();
  }

  /**
   * Trigger memory cleanup callbacks
   */
  private triggerMemoryCleanup(): void {
    // Dispatch custom event for memory cleanup
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('memory-pressure', {
        detail: { source: 'format-conversion' }
      }));
    }
  }

  /**
   * Increment error count for format
   */
  private incrementErrorCount(format: SupportedFormat): void {
    const count = this.errorCounts.get(format) || 0;
    this.errorCounts.set(format, count + 1);
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): Record<SupportedFormat, number> {
    const stats: Record<SupportedFormat, number> = {
      jpeg: 0,
      png: 0,
      webp: 0,
      avif: 0,
    };

    for (const [format, count] of this.errorCounts.entries()) {
      if (format in stats) {
        stats[format as SupportedFormat] = count;
      }
    }

    return stats;
  }

  /**
   * Reset error tracking
   */
  resetErrorTracking(): void {
    this.retryAttempts.clear();
    this.errorCounts.clear();
  }

  /**
   * Create enhanced error result with recovery suggestions
   */
  createErrorResult(
    originalFormat: SupportedFormat,
    targetFormat: SupportedFormat,
    error: Error,
    originalSize: number,
    processingTime: number
  ): FormatConversionResult {
    return {
      success: false,
      originalFormat,
      outputFormat: targetFormat,
      originalSize,
      processingTime,
      error: this.createUserFriendlyError(error, 'format conversion'),
      recoverySuggestion: this.getRecoverySuggestion(error),
      fallbackRecommended: this.getFallbackFormat(targetFormat),
    };
  }

  /**
   * Get recovery suggestion for error
   */
  private getRecoverySuggestion(error: Error): string {
    if (this.isMemoryError(error)) {
      return 'Try processing fewer files at once or closing other browser tabs.';
    }

    if (this.isBrowserCompatibilityError(error)) {
      return 'Your browser may not support this format. Try using a different format or updating your browser.';
    }

    if (this.isFileCorruptionError(error)) {
      return 'The file may be corrupted. Try using a different source image.';
    }

    if (this.isTimeoutError(error)) {
      return 'The file may be too large. Try using smaller images or reducing quality settings.';
    }

    return 'Please try again. If the problem persists, contact support.';
  }
}

// Global error handler instance
export const formatErrorHandler = new FormatErrorHandler();

// Global error boundary for unhandled format conversion errors
export function setupGlobalErrorHandler(): void {
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      if (event.reason?.message?.includes('format') || event.reason?.message?.includes('conversion')) {
        console.error('Unhandled format conversion error:', event.reason);
        
        // Create user-friendly notification
        const userMessage = formatErrorHandler.createUserFriendlyError(
          event.reason,
          'background format conversion'
        );
        
        // Dispatch custom event for UI to handle
        window.dispatchEvent(new CustomEvent('format-conversion-error', {
          detail: { message: userMessage, error: event.reason }
        }));
        
        event.preventDefault(); // Prevent console error
      }
    });

    // Memory pressure handler
    window.addEventListener('memory-pressure', () => {
      console.warn('Memory pressure detected, performing cleanup...');
      // Additional cleanup logic can be added here
    });
  }
}