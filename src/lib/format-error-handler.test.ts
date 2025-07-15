import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormatErrorHandler } from './format-error-handler';
import type { SupportedFormat } from '@/types/format-conversion';

describe('FormatErrorHandler', () => {
  let errorHandler: FormatErrorHandler;

  beforeEach(() => {
    errorHandler = new FormatErrorHandler();
    vi.clearAllMocks();
  });

  describe('handleMemoryExhaustion', () => {
    it('should execute primary operation when memory is sufficient', async () => {
      const primaryOperation = vi.fn().mockResolvedValue('success');
      const fallbackOperation = vi.fn();

      const result = await errorHandler.handleMemoryExhaustion(
        primaryOperation,
        fallbackOperation
      );

      expect(result).toBe('success');
      expect(primaryOperation).toHaveBeenCalled();
      expect(fallbackOperation).not.toHaveBeenCalled();
    });

    it('should use fallback operation when memory error occurs', async () => {
      const memoryError = new Error('Out of memory');
      const primaryOperation = vi.fn().mockRejectedValue(memoryError);
      const fallbackOperation = vi.fn().mockResolvedValue('fallback-success');

      const result = await errorHandler.handleMemoryExhaustion(
        primaryOperation,
        fallbackOperation
      );

      expect(result).toBe('fallback-success');
      expect(primaryOperation).toHaveBeenCalled();
      expect(fallbackOperation).toHaveBeenCalled();
    });

    it('should throw enhanced error when both operations fail', async () => {
      const memoryError = new Error('Out of memory');
      const fallbackError = new Error('Fallback failed');
      const primaryOperation = vi.fn().mockRejectedValue(memoryError);
      const fallbackOperation = vi.fn().mockRejectedValue(fallbackError);

      await expect(
        errorHandler.handleMemoryExhaustion(primaryOperation, fallbackOperation)
      ).rejects.toThrow(/Memory exhaustion.*Fallback also failed/);
    });
  });

  describe('handleFormatConversionError', () => {
    it('should suggest fallback for browser compatibility errors', async () => {
      const compatError = new Error('Format not supported');
      
      const result = await errorHandler.handleFormatConversionError(
        'jpeg',
        'avif',
        compatError
      );

      expect(result.shouldRetry).toBe(false);
      expect(result.fallbackFormat).toBe('webp');
      expect(result.errorMessage).toContain('not supported');
      expect(result.errorMessage).toContain('Falling back to webp');
    });

    it('should suggest retry for temporary errors', async () => {
      const networkError = new Error('Network timeout');
      
      const result = await errorHandler.handleFormatConversionError(
        'jpeg',
        'webp',
        networkError
      );

      expect(result.shouldRetry).toBe(true);
      expect(result.errorMessage).toContain('retrying');
    });

    it('should not retry after maximum attempts', async () => {
      const networkError = new Error('Network timeout');
      
      // Simulate multiple retries (but skip the actual delays by not awaiting the timeout)
      for (let i = 0; i < 3; i++) {
        await errorHandler.handleFormatConversionError('jpeg', 'webp', networkError);
      }
      
      const result = await errorHandler.handleFormatConversionError(
        'jpeg',
        'webp',
        networkError
      );

      expect(result.shouldRetry).toBe(false);
    }, 10000); // Increase timeout

    it('should identify file corruption errors', async () => {
      const corruptionError = new Error('File appears to be corrupted');
      
      const result = await errorHandler.handleFormatConversionError(
        'jpeg',
        'webp',
        corruptionError
      );

      expect(result.shouldRetry).toBe(false);
      expect(result.errorMessage).toContain('corrupted');
    });
  });

  describe('handleBatchError', () => {
    it('should recommend stopping for memory errors', async () => {
      const memoryError = new Error('Out of memory');
      
      const result = await errorHandler.handleBatchError(memoryError, 5, 10);

      expect(result.shouldContinue).toBe(false);
      expect(result.recommendation).toContain('Memory limit reached');
    });

    it('should recommend stopping for high failure rates', async () => {
      const genericError = new Error('Generic error');
      
      const result = await errorHandler.handleBatchError(genericError, 6, 10);

      expect(result.shouldContinue).toBe(false);
      expect(result.recommendation).toContain('High failure rate');
    });

    it('should continue for network errors with recommendation', async () => {
      const networkError = new Error('Network connection lost');
      
      const result = await errorHandler.handleBatchError(networkError, 2, 10);

      expect(result.shouldContinue).toBe(true);
      expect(result.recommendation).toContain('Network issue');
    });
  });

  describe('createUserFriendlyError', () => {
    it('should create friendly message for memory errors', () => {
      const memoryError = new Error('Out of memory');
      
      const message = errorHandler.createUserFriendlyError(
        memoryError,
        'batch processing'
      );

      expect(message).toContain('running low on memory');
      expect(message).toContain('fewer files');
    });

    it('should create friendly message for browser compatibility errors', () => {
      const compatError = new Error('Format not supported');
      
      const message = errorHandler.createUserFriendlyError(
        compatError,
        'format conversion'
      );

      expect(message).toContain('not supported in your browser');
      expect(message).toContain('compatible alternative');
    });

    it('should create friendly message for file corruption errors', () => {
      const corruptionError = new Error('File appears corrupted and cannot be decoded');
      
      const message = errorHandler.createUserFriendlyError(
        corruptionError,
        'image processing'
      );

      expect(message).toMatch(/corrupt|unsupported format/i);
    });

    it('should create friendly message for timeout errors', () => {
      const timeoutError = new Error('Operation timed out');
      
      const message = errorHandler.createUserFriendlyError(
        timeoutError,
        'conversion'
      );

      expect(message).toContain('took too long');
      expect(message).toContain('smaller files');
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');
      
      const message = errorHandler.createUserFriendlyError(
        genericError,
        'processing'
      );

      expect(message).toContain('Error during processing');
      expect(message).toContain('Something went wrong');
    });
  });

  describe('createErrorResult', () => {
    it('should create comprehensive error result', () => {
      const error = new Error('Conversion failed');
      
      const result = errorHandler.createErrorResult(
        'jpeg',
        'webp',
        error,
        1024 * 1024,
        500
      );

      expect(result.success).toBe(false);
      expect(result.originalFormat).toBe('jpeg');
      expect(result.outputFormat).toBe('webp');
      expect(result.originalSize).toBe(1024 * 1024);
      expect(result.processingTime).toBe(500);
      expect(result.error).toContain('Error during format conversion');
      expect(result.recoverySuggestion).toBeDefined();
      expect(result.fallbackRecommended).toBe('jpeg'); // WebP falls back to JPEG
    });

    it('should provide appropriate recovery suggestions', () => {
      const memoryError = new Error('Out of memory');
      
      const result = errorHandler.createErrorResult(
        'jpeg',
        'avif',
        memoryError,
        1024 * 1024,
        500
      );

      expect(result.recoverySuggestion).toContain('fewer files');
      expect(result.recoverySuggestion).toContain('browser tabs');
    });
  });

  describe('error statistics', () => {
    it('should track error counts by format', async () => {
      const error = new Error('Test error');
      
      await errorHandler.handleFormatConversionError('jpeg', 'webp', error);
      await errorHandler.handleFormatConversionError('png', 'avif', error);
      await errorHandler.handleFormatConversionError('jpeg', 'webp', error);
      
      const stats = errorHandler.getErrorStatistics();
      
      expect(stats.webp).toBe(2);
      expect(stats.avif).toBe(1);
      expect(stats.jpeg).toBe(0);
      expect(stats.png).toBe(0);
    });

    it('should reset error tracking', async () => {
      const error = new Error('Test error');
      
      await errorHandler.handleFormatConversionError('jpeg', 'webp', error);
      errorHandler.resetErrorTracking();
      
      const stats = errorHandler.getErrorStatistics();
      
      Object.values(stats).forEach(count => {
        expect(count).toBe(0);
      });
    });
  });

  describe('error classification', () => {
    const testCases = [
      {
        error: new Error('Out of memory'),
        expectedType: 'memory',
        description: 'memory error'
      },
      {
        error: new Error('Format not supported'),
        expectedType: 'compatibility',
        description: 'browser compatibility error'
      },
      {
        error: new Error('Network timeout'),
        expectedType: 'retryable',
        description: 'retryable error'
      },
      {
        error: new Error('File is corrupted'),
        expectedType: 'corruption',
        description: 'file corruption error'
      },
      {
        error: new Error('Connection failed'),
        expectedType: 'network',
        description: 'network error'
      },
      {
        error: new Error('Operation timed out'),
        expectedType: 'timeout',
        description: 'timeout error'
      }
    ];

    testCases.forEach(({ error, expectedType, description }) => {
      it(`should correctly classify ${description}`, () => {
        const message = errorHandler.createUserFriendlyError(error, 'test');
        
        switch (expectedType) {
          case 'memory':
            expect(message).toMatch(/memory|fewer files/i);
            break;
          case 'compatibility':
            expect(message).toMatch(/not supported|compatible/i);
            break;
          case 'retryable':
          case 'network':
            expect(message).toMatch(/network|connection/i);
            break;
          case 'corruption':
            expect(message).toMatch(/corrupt|unsupported format/i);
            break;
          case 'timeout':
            expect(message).toMatch(/too long|smaller/i);
            break;
        }
      });
    });
  });

  describe('fallback format logic', () => {
    const fallbackTests = [
      { format: 'avif' as SupportedFormat, expected: 'webp' as SupportedFormat },
      { format: 'webp' as SupportedFormat, expected: 'jpeg' as SupportedFormat },
      { format: 'jpeg' as SupportedFormat, expected: 'jpeg' as SupportedFormat },
      { format: 'png' as SupportedFormat, expected: 'png' as SupportedFormat }
    ];

    fallbackTests.forEach(({ format, expected }) => {
      it(`should provide correct fallback for ${format}`, () => {
        const error = new Error('Format not supported');
        
        const result = errorHandler.createErrorResult(
          'jpeg',
          format,
          error,
          1024,
          100
        );

        expect(result.fallbackRecommended).toBe(expected);
      });
    });
  });
});