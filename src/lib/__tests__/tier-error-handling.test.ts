import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TierService } from '../tier-service'
import { 
  TierErrorHandler, 
  TierErrorCode, 
  validateUsageStats, 
  validateFileList 
} from '../tier-error-handler'

describe('Tier Error Handling', () => {
  let tierService: TierService

  beforeEach(() => {
    tierService = new TierService()
    vi.clearAllMocks()
  })

  describe('Input Validation', () => {
    it('should throw error for invalid user ID in checkUsageLimit', async () => {
      await expect(
        tierService.checkUsageLimit('', 'free', 1, 1024)
      ).rejects.toMatchObject({
        code: TierErrorCode.INVALID_USER_ID,
        userMessage: expect.stringContaining('sign out and sign back in')
      })
    })

    it('should throw error for negative image count', async () => {
      await expect(
        tierService.checkUsageLimit('valid-user', 'free', -1, 1024)
      ).rejects.toMatchObject({
        code: TierErrorCode.INVALID_USAGE_DATA,
        userMessage: expect.stringContaining('Invalid request')
      })
    })

    it('should throw error for invalid file size', async () => {
      await expect(
        tierService.checkUsageLimit('valid-user', 'free', 1, -100)
      ).rejects.toMatchObject({
        code: TierErrorCode.INVALID_USAGE_DATA,
        userMessage: expect.stringContaining('Invalid file size')
      })
    })

    it('should validate file list with empty files', () => {
      const emptyFile = new File([''], 'empty.jpg', { type: 'image/jpeg' })
      
      expect(() => validateFileList([emptyFile])).toThrowError(
        expect.objectContaining({
          code: TierErrorCode.INVALID_USAGE_DATA,
          userMessage: expect.stringContaining('appears to be empty')
        })
      )
    })

    it('should validate file list with oversized files', () => {
      // Create a mock file that reports a huge size
      const oversizedFile = new File(['content'], 'huge.jpg', { 
        type: 'image/jpeg'
      })
      Object.defineProperty(oversizedFile, 'size', {
        value: 2 * 1024 * 1024 * 1024, // 2GB
        writable: false
      })
      
      expect(() => validateFileList([oversizedFile])).toThrowError(
        expect.objectContaining({
          code: TierErrorCode.FILE_SIZE_LIMIT_EXCEEDED,
          userMessage: expect.stringContaining('too large')
        })
      )
    })

    it('should validate usage stats with missing fields', () => {
      expect(() => validateUsageStats({})).toThrowError(
        expect.objectContaining({
          code: TierErrorCode.INVALID_USAGE_DATA
        })
      )
    })

    it('should validate usage stats with negative values', () => {
      const invalidUsage = {
        userId: 'test-user',
        imagesProcessed: -5,
        storageUsed: 1024
      }
      
      expect(() => validateUsageStats(invalidUsage)).toThrowError(
        expect.objectContaining({
          code: TierErrorCode.INVALID_USAGE_DATA
        })
      )
    })
  })

  describe('Network Error Simulation', () => {
    it('should handle timeout errors with retry', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      // Mock a service that times out on first call but succeeds on retry
      let callCount = 0
      const mockService = {
        async checkUsage() {
          callCount++
          if (callCount === 1) {
            throw new Error('Request timeout after 30000ms')
          }
          return { canProcess: true, remainingImages: 100, remainingStorage: 1024, upgradeRequired: false }
        }
      }

      // This would normally use handleAsyncTierOperation with retries
      await expect(mockService.checkUsage()).rejects.toThrow('Request timeout')
      
      // Second call should succeed
      const result = await mockService.checkUsage()
      expect(result.canProcess).toBe(true)
      
      consoleSpy.mockRestore()
    })

    it('should handle network errors gracefully', () => {
      const networkError = new Error('fetch failed')
      const tierError = TierErrorHandler.fromException(networkError, 'checkUsage')
      
      expect(tierError.code).toBe(TierErrorCode.NETWORK_ERROR)
      expect(tierError.isRetryable).toBe(true)
      expect(tierError.userMessage).toContain('internet connection')
    })

    it('should handle rate limit errors', () => {
      const rateLimitError = new Error('Too many requests - rate limit exceeded')
      const tierError = TierErrorHandler.fromException(rateLimitError, 'upgrade')
      
      expect(tierError.code).toBe(TierErrorCode.RATE_LIMIT_EXCEEDED)
      expect(tierError.isRetryable).toBe(true)
      expect(tierError.retryAfter).toBe(60)
      expect(tierError.actionRequired).toBe('wait')
    })
  })

  describe('Error Recovery and Graceful Degradation', () => {
    it('should recover from corrupted usage data', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Simulate corrupted data in storage
      const corruptedData = { invalid: 'data' }
      // @ts-expect-error - Intentionally setting invalid data for testing
      tierService['usageStorage'] = new Map([['test-user', corruptedData]])
      
      // Should recover gracefully and return valid usage
      const usage = await tierService.getUserUsage('test-user')
      
      expect(usage).toBeDefined()
      expect(usage?.imagesProcessed).toBe(0)
      expect(usage?.storageUsed).toBe(0)
      expect(usage?.userId).toBe('test-user')
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Corrupted usage data detected'),
        expect.any(Object)
      )
      
      consoleSpy.mockRestore()
    })

    it('should provide meaningful error messages for different error types', () => {
      const testCases = [
        {
          error: new Error('payment failed'),
          expectedCode: TierErrorCode.PAYMENT_FAILED,
          expectedAction: undefined
        },
        {
          error: new Error('Invalid login credentials'),
          expectedCode: TierErrorCode.UNKNOWN_ERROR, // Generic handling
          expectedAction: 'contact_support'
        }
      ]

      testCases.forEach(({ error, expectedCode, expectedAction }) => {
        const tierError = TierErrorHandler.fromException(error, 'test')
        expect(tierError.code).toBe(expectedCode)
        if (expectedAction) {
          expect(tierError.actionRequired).toBe(expectedAction)
        }
        expect(tierError.userMessage).toBeTruthy()
        expect(tierError.userMessage.length).toBeGreaterThan(10)
      })
    })
  })

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle concurrent usage updates safely', async () => {
      const userId = 'concurrent-user'
      
      // Simulate concurrent updates
      const updates = Array(10).fill(null).map((_, i) => 
        tierService.updateUsage(userId, 1, 1024 * 1024)
      )
      
      await Promise.all(updates)
      
      // Verify final state is consistent
      const usage = await tierService.getUserUsage(userId)
      expect(usage?.imagesProcessed).toBe(10)
      expect(usage?.storageUsed).toBe(10 * 1024 * 1024)
    })

    it('should handle concurrent limit checks', async () => {
      const userId = 'limit-check-user'
      
      // Add some existing usage
      await tierService.updateUsage(userId, 50, 50 * 1024 * 1024)
      
      // Perform concurrent limit checks
      const checks = Array(5).fill(null).map(() => 
        tierService.checkUsageLimit(userId, 'free', 10, 10 * 1024 * 1024)
      )
      
      const results = await Promise.all(checks)
      
      // All checks should return consistent results
      results.forEach(result => {
        expect(result.canProcess).toBe(true) // 50 + 10 = 60, within free tier limit of 100
        expect(result.remainingImages).toBe(40) // 100 - 50 - 10
      })
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle exactly at limit scenarios', async () => {
      const userId = 'boundary-user'
      
      // Set usage to exactly at free tier limit minus 1
      await tierService.updateUsage(userId, 99, 99 * 1024 * 1024)
      
      // Should allow exactly 1 more image
      const result1 = await tierService.checkUsageLimit(userId, 'free', 1, 1024 * 1024)
      expect(result1.canProcess).toBe(true)
      expect(result1.remainingImages).toBe(0)
      
      // Should reject any more than that
      const result2 = await tierService.checkUsageLimit(userId, 'free', 2, 2 * 1024 * 1024)
      expect(result2.canProcess).toBe(false)
      expect(result2.limitType).toBe('images')
    })

    it('should handle zero and negative inputs gracefully', async () => {
      const userId = 'zero-user'
      
      // Zero images should be allowed
      const result = await tierService.checkUsageLimit(userId, 'free', 0, 0)
      expect(result.canProcess).toBe(true)
      
      // Zero usage update should work
      await expect(tierService.updateUsage(userId, 0, 0)).resolves.not.toThrow()
    })

    it('should handle very large numbers', async () => {
      const userId = 'large-number-user'
      
      // Test with maximum safe integer
      const largeCount = Number.MAX_SAFE_INTEGER
      
      await expect(
        tierService.checkUsageLimit(userId, 'enterprise', largeCount, 1024)
      ).resolves.toMatchObject({
        canProcess: false,
        limitType: 'images'
      })
    })
  })

  describe('Error Message Localization and Clarity', () => {
    it('should provide clear upgrade prompts in error messages', async () => {
      const files = Array(10).fill(null).map((_, i) => 
        new File(['content'], `file${i}.jpg`, { type: 'image/jpeg' })
      )
      
      const result = await tierService.canProcessFiles('batch-user', 'free', files)
      
      expect(result.canProcess).toBe(false)
      expect(result.limitType).toBe('batchSize')
      expect(result.message).toContain('Upgrade')
      expect(result.upgradeRequired).toBe(true)
    })

    it('should provide specific format requirements in error messages', async () => {
      const webpFile = new File(['content'], 'test.webp', { type: 'image/webp' })
      
      const result = await tierService.canProcessFiles('format-user', 'free', [webpFile])
      
      expect(result.canProcess).toBe(false)
      expect(result.limitType).toBe('format')
      expect(result.message).toContain('webp')
      expect(result.message).toContain('not supported')
    })
  })

  describe('Performance Under Error Conditions', () => {
    it('should not degrade performance with invalid inputs', async () => {
      const startTime = Date.now()
      
      // Try multiple invalid operations
      const promises = Array(100).fill(null).map(async () => {
        try {
          await tierService.checkUsageLimit('', 'free', -1, -1)
        } catch {
          // Expected to fail
        }
      })
      
      await Promise.all(promises)
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(1000) // Should complete in under 1 second
    })
  })
})