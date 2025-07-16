import type { SvgErrorDetails } from '@/types/svg-optimization';

/**
 * Comprehensive error handling for SVG optimization
 */
export class SvgErrorHandler {
  private static instance: SvgErrorHandler;
  private errorLog: Array<{ timestamp: number; error: SvgErrorDetails; context?: any }> = [];

  static getInstance(): SvgErrorHandler {
    if (!this.instance) {
      this.instance = new SvgErrorHandler();
    }
    return this.instance;
  }

  /**
   * Handle SVG parsing errors
   */
  handleParseError(error: Error, svgContent: string): SvgErrorDetails {
    const errorDetails: SvgErrorDetails = {
      type: 'PARSE_ERROR',
      message: this.sanitizeErrorMessage(error.message),
      recoverable: this.isRecoverableParseError(error.message),
      suggestion: this.getParseErrorSuggestion(error.message)
    };

    // Try to extract line/column information
    const lineMatch = error.message.match(/line (\d+)/i);
    const columnMatch = error.message.match(/column (\d+)/i);
    
    if (lineMatch) {
      errorDetails.line = parseInt(lineMatch[1]);
    }
    if (columnMatch) {
      errorDetails.column = parseInt(columnMatch[1]);
    }

    this.logError(errorDetails, { svgLength: svgContent.length });
    return errorDetails;
  }

  /**
   * Handle invalid SVG structure errors
   */
  handleInvalidSvgError(reason: string, svgContent: string): SvgErrorDetails {
    const errorDetails: SvgErrorDetails = {
      type: 'INVALID_SVG',
      message: `Invalid SVG structure: ${reason}`,
      recoverable: true,
      suggestion: this.getStructureErrorSuggestion(reason)
    };

    this.logError(errorDetails, { 
      svgLength: svgContent.length,
      reason 
    });
    
    return errorDetails;
  }

  /**
   * Handle optimization failure errors
   */
  handleOptimizationError(error: Error, step: string): SvgErrorDetails {
    const errorDetails: SvgErrorDetails = {
      type: 'OPTIMIZATION_FAILED',
      message: `Optimization failed at ${step}: ${this.sanitizeErrorMessage(error.message)}`,
      recoverable: this.isRecoverableOptimizationError(step, error),
      suggestion: this.getOptimizationErrorSuggestion(step, error)
    };

    this.logError(errorDetails, { step, originalError: error.name });
    return errorDetails;
  }

  /**
   * Handle memory-related errors
   */
  handleMemoryError(availableMemory: number, requiredMemory: number): SvgErrorDetails {
    const errorDetails: SvgErrorDetails = {
      type: 'MEMORY_ERROR',
      message: `Insufficient memory: need ${this.formatBytes(requiredMemory)}, have ${this.formatBytes(availableMemory)}`,
      recoverable: true,
      suggestion: 'Try processing fewer files at once or use a device with more memory'
    };

    this.logError(errorDetails, { availableMemory, requiredMemory });
    return errorDetails;
  }

  /**
   * Handle timeout errors
   */
  handleTimeoutError(duration: number, operation: string): SvgErrorDetails {
    const errorDetails: SvgErrorDetails = {
      type: 'TIMEOUT',
      message: `Operation '${operation}' timed out after ${duration}ms`,
      recoverable: true,
      suggestion: 'Try simplifying the SVG or reducing optimization aggressiveness'
    };

    this.logError(errorDetails, { duration, operation });
    return errorDetails;
  }

  /**
   * Attempt to recover from parsing errors
   */
  async attemptRecovery(svgContent: string, error: SvgErrorDetails): Promise<string | null> {
    if (!error.recoverable) {
      return null;
    }

    try {
      switch (error.type) {
        case 'PARSE_ERROR':
          return this.recoverFromParseError(svgContent, error);
        
        case 'INVALID_SVG':
          return this.recoverFromInvalidSvg(svgContent, error);
        
        default:
          return null;
      }
    } catch (recoveryError) {
      console.warn('Recovery attempt failed:', recoveryError);
      return null;
    }
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(): {
    total: number;
    byType: Record<string, number>;
    recoveryRate: number;
  } {
    const total = this.errorLog.length;
    const byType: Record<string, number> = {};
    let recovered = 0;

    this.errorLog.forEach(entry => {
      const type = entry.error.type;
      byType[type] = (byType[type] || 0) + 1;
      
      if (entry.error.recoverable) {
        recovered++;
      }
    });

    return {
      total,
      byType,
      recoveryRate: total > 0 ? recovered / total : 0
    };
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Sanitize error message for user display
   */
  private sanitizeErrorMessage(message: string): string {
    // Remove potentially sensitive information
    return message
      .replace(/file:\/\/[^\s]*/g, '[file path]')
      .replace(/http[s]?:\/\/[^\s]*/g, '[url]')
      .slice(0, 200); // Limit length
  }

  /**
   * Check if parse error is recoverable
   */
  private isRecoverableParseError(message: string): boolean {
    const recoverablePatterns = [
      /unclosed tag/i,
      /missing.*quote/i,
      /unexpected.*character/i,
      /invalid.*attribute/i
    ];

    return recoverablePatterns.some(pattern => pattern.test(message));
  }

  /**
   * Get suggestion for parse errors
   */
  private getParseErrorSuggestion(message: string): string {
    if (/unclosed tag/i.test(message)) {
      return 'Check for missing closing tags in your SVG';
    }
    if (/missing.*quote/i.test(message)) {
      return 'Check for missing quotes around attribute values';
    }
    if (/invalid.*attribute/i.test(message)) {
      return 'Check for invalid or malformed attributes';
    }
    
    return 'Validate your SVG syntax using an online validator';
  }

  /**
   * Get suggestion for structure errors
   */
  private getStructureErrorSuggestion(reason: string): string {
    if (reason.includes('root element')) {
      return 'Ensure your document has a valid <svg> root element';
    }
    if (reason.includes('viewBox')) {
      return 'Consider adding a viewBox attribute for better scalability';
    }
    
    return 'Check that your SVG follows the SVG specification';
  }

  /**
   * Check if optimization error is recoverable
   */
  private isRecoverableOptimizationError(step: string, error: Error): boolean {
    const recoverableSteps = ['minification', 'attribute cleanup', 'color optimization'];
    const fatalErrors = ['out of memory', 'maximum call stack'];
    
    return recoverableSteps.includes(step) && 
           !fatalErrors.some(fatal => error.message.toLowerCase().includes(fatal));
  }

  /**
   * Get suggestion for optimization errors
   */
  private getOptimizationErrorSuggestion(step: string, error: Error): string {
    if (step === 'path simplification') {
      return 'Try reducing coordinate precision or disabling path simplification';
    }
    if (step === 'color optimization') {
      return 'Try disabling color optimization for this SVG';
    }
    if (error.message.includes('memory')) {
      return 'Process fewer files at once or reduce optimization aggressiveness';
    }
    
    return 'Try using less aggressive optimization settings';
  }

  /**
   * Attempt to recover from parse errors
   */
  private recoverFromParseError(svgContent: string, error: SvgErrorDetails): string | null {
    let recovered = svgContent;

    // Try common fixes
    if (error.message.includes('unclosed tag')) {
      // Attempt to fix unclosed tags (simplified)
      recovered = this.fixUnclosedTags(recovered);
    }

    if (error.message.includes('quote')) {
      // Fix missing quotes
      recovered = this.fixMissingQuotes(recovered);
    }

    // Validate the fix
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(recovered, 'image/svg+xml');
      const parserError = doc.querySelector('parsererror');
      
      if (!parserError) {
        return recovered;
      }
    } catch {
      // Recovery failed
    }

    return null;
  }

  /**
   * Attempt to recover from invalid SVG structure
   */
  private recoverFromInvalidSvg(svgContent: string, error: SvgErrorDetails): string | null {
    if (error.message.includes('root element')) {
      // Try to wrap content in SVG tag
      if (!svgContent.trim().startsWith('<svg')) {
        const wrapped = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${svgContent}</svg>`;
        return wrapped;
      }
    }

    return null;
  }

  /**
   * Fix unclosed tags (simplified implementation)
   */
  private fixUnclosedTags(svgContent: string): string {
    // This is a very basic implementation
    // In production, you'd want more sophisticated tag matching
    const selfClosingTags = ['circle', 'ellipse', 'line', 'path', 'rect', 'use', 'image'];
    
    let fixed = svgContent;
    
    selfClosingTags.forEach(tag => {
      const regex = new RegExp(`<${tag}([^>]*)(?<!/)>`, 'g');
      fixed = fixed.replace(regex, `<${tag}$1/>`);
    });

    return fixed;
  }

  /**
   * Fix missing quotes around attributes
   */
  private fixMissingQuotes(svgContent: string): string {
    // Fix unquoted attribute values
    return svgContent.replace(/(\w+)=([^"\s>]+)/g, '$1="$2"');
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Log error for analytics
   */
  private logError(error: SvgErrorDetails, context?: any): void {
    this.errorLog.push({
      timestamp: Date.now(),
      error,
      context
    });

    // Keep only last 100 errors to prevent memory leaks
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }
  }
}

/**
 * Error boundary for SVG operations
 */
export class SvgOperationBoundary {
  private errorHandler = SvgErrorHandler.getInstance();
  private timeoutMs: number;

  constructor(timeoutMs: number = 30000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Execute operation with error handling and timeout
   */
  async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
    recoveryFn?: (error: SvgErrorDetails) => Promise<T | null>
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutError = this.errorHandler.handleTimeoutError(this.timeoutMs, operationName);
        reject(timeoutError);
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      let errorDetails: SvgErrorDetails;

      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError' || error.message.includes('memory')) {
          errorDetails = this.errorHandler.handleMemoryError(0, 0); // Simplified
        } else {
          errorDetails = this.errorHandler.handleOptimizationError(error, operationName);
        }
      } else {
        errorDetails = error as SvgErrorDetails;
      }

      // Attempt recovery if function provided
      if (recoveryFn && errorDetails.recoverable) {
        try {
          const recovered = await recoveryFn(errorDetails);
          if (recovered !== null) {
            return recovered;
          }
        } catch (recoveryError) {
          console.warn('Recovery failed:', recoveryError);
        }
      }

      throw errorDetails;
    }
  }
}