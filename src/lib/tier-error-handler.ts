export enum TierErrorCode {
  // Network and connectivity errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  
  // Authentication errors
  USER_NOT_AUTHENTICATED = 'USER_NOT_AUTHENTICATED',
  INVALID_USER_ID = 'INVALID_USER_ID',
  
  // Tier limit errors
  MONTHLY_LIMIT_EXCEEDED = 'MONTHLY_LIMIT_EXCEEDED',
  FILE_SIZE_LIMIT_EXCEEDED = 'FILE_SIZE_LIMIT_EXCEEDED',
  BATCH_SIZE_LIMIT_EXCEEDED = 'BATCH_SIZE_LIMIT_EXCEEDED',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  
  // Subscription errors
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  INVALID_PLAN = 'INVALID_PLAN',
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  ALREADY_SUBSCRIBED = 'ALREADY_SUBSCRIBED',
  
  // Data errors
  INVALID_USAGE_DATA = 'INVALID_USAGE_DATA',
  CORRUPTED_USER_DATA = 'CORRUPTED_USER_DATA',
  DATABASE_ERROR = 'DATABASE_ERROR',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Unknown errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface TierError {
  code: TierErrorCode
  message: string
  userMessage: string
  isRetryable: boolean
  retryAfter?: number // seconds
  actionRequired?: 'upgrade' | 'authenticate' | 'wait' | 'contact_support'
  metadata?: Record<string, any>
}

export class TierErrorHandler {
  static createError(
    code: TierErrorCode, 
    message: string, 
    userMessage?: string,
    metadata?: Record<string, any>
  ): TierError {
    return {
      code,
      message,
      userMessage: userMessage || TierErrorHandler.getDefaultUserMessage(code),
      isRetryable: TierErrorHandler.isRetryableError(code),
      retryAfter: TierErrorHandler.getRetryDelay(code),
      actionRequired: TierErrorHandler.getRequiredAction(code),
      metadata
    }
  }

  static fromException(error: unknown, context?: string): TierError {
    if (error instanceof Error) {
      // Network errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return TierErrorHandler.createError(
          TierErrorCode.NETWORK_ERROR,
          `Network error in ${context}: ${error.message}`,
          'Unable to connect to the server. Please check your internet connection and try again.'
        )
      }

      // Timeout errors
      if (error.message.includes('timeout')) {
        return TierErrorHandler.createError(
          TierErrorCode.TIMEOUT_ERROR,
          `Timeout error in ${context}: ${error.message}`,
          'The request took too long to complete. Please try again.'
        )
      }

      // Payment errors
      if (error.message.includes('payment') || error.message.includes('card')) {
        return TierErrorHandler.createError(
          TierErrorCode.PAYMENT_FAILED,
          `Payment error in ${context}: ${error.message}`,
          'Payment processing failed. Please check your payment method and try again.'
        )
      }

      // Rate limiting
      if (error.message.includes('rate limit') || error.message.includes('too many requests')) {
        return TierErrorHandler.createError(
          TierErrorCode.RATE_LIMIT_EXCEEDED,
          `Rate limit exceeded in ${context}: ${error.message}`,
          'You\'re making requests too quickly. Please wait a moment and try again.'
        )
      }
    }

    // Default unknown error
    return TierErrorHandler.createError(
      TierErrorCode.UNKNOWN_ERROR,
      `Unknown error in ${context}: ${error}`,
      'An unexpected error occurred. Please try again or contact support if the problem persists.'
    )
  }

  static handleAsyncOperation<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      let lastError: TierError | null = null
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await Promise.race([
            operation(),
            TierErrorHandler.createTimeoutPromise(30000) // 30 second timeout
          ])
          resolve(result)
          return
        } catch (error) {
          lastError = TierErrorHandler.fromException(error, context)
          
          // Don't retry if it's not a retryable error
          if (!lastError.isRetryable || attempt === maxRetries) {
            reject(lastError)
            return
          }
          
          // Wait before retrying (exponential backoff)
          const delay = lastError.retryAfter ? lastError.retryAfter * 1000 : initialDelay * Math.pow(2, attempt - 1)
          await TierErrorHandler.delay(delay)
        }
      }
      
      if (lastError) {
        reject(lastError)
      }
    })
  }

  static validateUsageStats(usage: any): asserts usage is { userId: string; imagesProcessed: number; storageUsed: number } {
    if (!usage || typeof usage !== 'object') {
      throw TierErrorHandler.createError(
        TierErrorCode.INVALID_USAGE_DATA,
        'Usage data is null or not an object',
        'Invalid usage data received. Please refresh the page and try again.'
      )
    }

    if (!usage.userId || typeof usage.userId !== 'string') {
      throw TierErrorHandler.createError(
        TierErrorCode.INVALID_USAGE_DATA,
        'Usage data missing valid userId',
        'Invalid user data. Please sign out and sign back in.'
      )
    }

    if (typeof usage.imagesProcessed !== 'number' || usage.imagesProcessed < 0) {
      throw TierErrorHandler.createError(
        TierErrorCode.INVALID_USAGE_DATA,
        'Usage data has invalid imagesProcessed value',
        'Invalid usage statistics. Data will be reset.'
      )
    }

    if (typeof usage.storageUsed !== 'number' || usage.storageUsed < 0) {
      throw TierErrorHandler.createError(
        TierErrorCode.INVALID_USAGE_DATA,
        'Usage data has invalid storageUsed value',
        'Invalid storage statistics. Data will be reset.'
      )
    }
  }

  static validateFileList(files: File[]): void {
    if (!Array.isArray(files)) {
      throw TierErrorHandler.createError(
        TierErrorCode.INVALID_USAGE_DATA,
        'Files parameter is not an array',
        'Invalid file selection. Please try selecting files again.'
      )
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file || !(file instanceof File)) {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USAGE_DATA,
          `Invalid file at index ${i}`,
          'One or more selected files are invalid. Please try selecting files again.'
        )
      }

      if (file.size <= 0) {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USAGE_DATA,
          `Empty file detected: ${file.name}`,
          `The file "${file.name}" appears to be empty. Please select a valid image file.`
        )
      }

      if (file.size > 1024 * 1024 * 1024) { // 1GB absolute limit
        throw TierErrorHandler.createError(
          TierErrorCode.FILE_SIZE_LIMIT_EXCEEDED,
          `File too large: ${file.name} (${file.size} bytes)`,
          `The file "${file.name}" is too large. Maximum file size is 1GB.`
        )
      }
    }
  }

  private static getDefaultUserMessage(code: TierErrorCode): string {
    switch (code) {
      case TierErrorCode.NETWORK_ERROR:
        return 'Network connection failed. Please check your internet connection and try again.'
      
      case TierErrorCode.TIMEOUT_ERROR:
        return 'The request timed out. Please try again.'
      
      case TierErrorCode.USER_NOT_AUTHENTICATED:
        return 'Please sign in to continue.'
      
      case TierErrorCode.MONTHLY_LIMIT_EXCEEDED:
        return 'You\'ve reached your monthly processing limit. Upgrade your plan to continue.'
      
      case TierErrorCode.FILE_SIZE_LIMIT_EXCEEDED:
        return 'One or more files exceed your plan\'s file size limit. Upgrade for larger file support.'
      
      case TierErrorCode.BATCH_SIZE_LIMIT_EXCEEDED:
        return 'You\'ve selected too many files for your plan. Upgrade for larger batch processing.'
      
      case TierErrorCode.UNSUPPORTED_FORMAT:
        return 'Some file formats are not supported in your current plan. Upgrade for full format support.'
      
      case TierErrorCode.PAYMENT_REQUIRED:
        return 'A payment method is required for this upgrade.'
      
      case TierErrorCode.PAYMENT_FAILED:
        return 'Payment processing failed. Please check your payment method and try again.'
      
      case TierErrorCode.RATE_LIMIT_EXCEEDED:
        return 'You\'re making requests too quickly. Please wait a moment and try again.'
      
      case TierErrorCode.DATABASE_ERROR:
        return 'Database connection failed. Please try again or contact support if the problem persists.'
      
      default:
        return 'An unexpected error occurred. Please try again or contact support.'
    }
  }

  private static isRetryableError(code: TierErrorCode): boolean {
    const retryableErrors = [
      TierErrorCode.NETWORK_ERROR,
      TierErrorCode.TIMEOUT_ERROR,
      TierErrorCode.RATE_LIMIT_EXCEEDED,
      TierErrorCode.DATABASE_ERROR
    ]
    return retryableErrors.includes(code)
  }

  private static getRetryDelay(code: TierErrorCode): number | undefined {
    switch (code) {
      case TierErrorCode.RATE_LIMIT_EXCEEDED:
        return 60 // 60 seconds
      case TierErrorCode.NETWORK_ERROR:
        return 5 // 5 seconds
      case TierErrorCode.TIMEOUT_ERROR:
        return 10 // 10 seconds
      case TierErrorCode.DATABASE_ERROR:
        return 3 // 3 seconds
      default:
        return undefined
    }
  }

  private static getRequiredAction(code: TierErrorCode): 'upgrade' | 'authenticate' | 'wait' | 'contact_support' | undefined {
    switch (code) {
      case TierErrorCode.MONTHLY_LIMIT_EXCEEDED:
      case TierErrorCode.FILE_SIZE_LIMIT_EXCEEDED:
      case TierErrorCode.BATCH_SIZE_LIMIT_EXCEEDED:
      case TierErrorCode.UNSUPPORTED_FORMAT:
        return 'upgrade'
      
      case TierErrorCode.USER_NOT_AUTHENTICATED:
      case TierErrorCode.INVALID_USER_ID:
        return 'authenticate'
      
      case TierErrorCode.RATE_LIMIT_EXCEEDED:
        return 'wait'
      
      case TierErrorCode.CORRUPTED_USER_DATA:
      case TierErrorCode.UNKNOWN_ERROR:
        return 'contact_support'
      
      default:
        return undefined
    }
  }

  private static createTimeoutPromise<T>(ms: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`))
      }, ms)
    })
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Export utility functions for easy use
export const createTierError = TierErrorHandler.createError
export const handleAsyncTierOperation = TierErrorHandler.handleAsyncOperation
export const validateUsageStats = TierErrorHandler.validateUsageStats
export const validateFileList = TierErrorHandler.validateFileList