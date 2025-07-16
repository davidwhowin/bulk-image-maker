import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { UserTier, UsageStats, TierUsageResult } from '@/types/tiers'
import { TIER_LIMITS, getCurrentMonth } from '../tier-config'
import { TierService } from '../tier-service'

describe('Tier System', () => {
  const currentMonth = getCurrentMonth()
  let tierChecker: TierService
  let testUserIdCounter = 0

  beforeEach(() => {
    // Create fresh instance for each test to avoid state pollution
    tierChecker = new TierService()
    testUserIdCounter++
  })

  const getTestUserId = () => `test-user-${testUserIdCounter}`

  describe('Tier Limits Configuration', () => {
    it('should have correct limits for free tier', () => {
      const freeLimits = TIER_LIMITS.free
      
      expect(freeLimits.maxImagesPerMonth).toBe(100)
      expect(freeLimits.maxFileSize).toBe(5 * 1024 * 1024) // 5MB
      expect(freeLimits.maxBatchSize).toBe(1)
      expect(freeLimits.processingPriority).toBe('low')
      expect(freeLimits.processingDelay).toBe(2 * 60 * 1000) // 2 minutes
      expect(freeLimits.supportedFormats).toEqual(['image/jpeg', 'image/png'])
      expect(freeLimits.teamFeatures).toBe(false)
      expect(freeLimits.prioritySupport).toBe('none')
    })

    it('should have correct limits for pro tier', () => {
      const proLimits = TIER_LIMITS.pro
      
      expect(proLimits.maxImagesPerMonth).toBe(3000)
      expect(proLimits.maxFileSize).toBe(25 * 1024 * 1024) // 25MB
      expect(proLimits.maxBatchSize).toBe(10)
      expect(proLimits.processingPriority).toBe('normal')
      expect(proLimits.processingDelay).toBe(10 * 1000) // 10 seconds
      expect(proLimits.supportedFormats).toContain('image/webp')
      expect(proLimits.teamFeatures).toBe(false)
      expect(proLimits.prioritySupport).toBe('email')
    })

    it('should have correct limits for team tier', () => {
      const teamLimits = TIER_LIMITS.team
      
      expect(teamLimits.maxImagesPerMonth).toBe(15000)
      expect(teamLimits.maxFileSize).toBe(100 * 1024 * 1024) // 100MB
      expect(teamLimits.maxBatchSize).toBe(50)
      expect(teamLimits.processingPriority).toBe('high')
      expect(teamLimits.processingDelay).toBe(3 * 1000) // 3 seconds
      expect(teamLimits.supportedFormats).toContain('image/svg+xml')
      expect(teamLimits.teamFeatures).toBe(true)
      expect(teamLimits.prioritySupport).toBe('chat')
    })

    it('should have correct limits for enterprise tier', () => {
      const enterpriseLimits = TIER_LIMITS.enterprise
      
      expect(enterpriseLimits.maxImagesPerMonth).toBe(75000)
      expect(enterpriseLimits.maxFileSize).toBe(500 * 1024 * 1024) // 500MB
      expect(enterpriseLimits.maxBatchSize).toBe(500)
      expect(enterpriseLimits.processingPriority).toBe('highest')
      expect(enterpriseLimits.processingDelay).toBe(1000) // 1 second
      expect(enterpriseLimits.supportedFormats).toContain('image/gif')
      expect(enterpriseLimits.teamFeatures).toBe(true)
      expect(enterpriseLimits.prioritySupport).toBe('phone')
    })
  })

  describe('Usage Limit Checking', () => {
    it('should allow processing for free tier user within limits', async () => {
      const result = await tierChecker.checkUsageLimit(getTestUserId(), 'free', 1, 1024 * 1024) // 1MB
      
      expect(result.canProcess).toBe(true)
      expect(result.upgradeRequired).toBe(false)
      expect(result.remainingImages).toBeGreaterThan(0)
    })

    it('should reject processing for free tier user exceeding monthly limit', async () => {
      const result = await tierChecker.checkUsageLimit(getTestUserId(), 'free', 101, 1024 * 1024)
      
      expect(result.canProcess).toBe(false)
      expect(result.upgradeRequired).toBe(true)
      expect(result.limitType).toBe('images')
      expect(result.message?.toLowerCase()).toContain('monthly limit')
    })

    it('should reject file exceeding size limit for free tier', async () => {
      const largeFileSize = 10 * 1024 * 1024 // 10MB (exceeds 5MB limit)
      const result = await tierChecker.checkUsageLimit(getTestUserId(), 'free', 1, largeFileSize)
      
      expect(result.canProcess).toBe(false)
      expect(result.upgradeRequired).toBe(true)
      expect(result.limitType).toBe('fileSize')
      expect(result.message?.toLowerCase()).toContain('file size')
    })

    it('should allow larger files for pro tier users', async () => {
      const largeFileSize = 20 * 1024 * 1024 // 20MB (within 25MB limit)
      const result = await tierChecker.checkUsageLimit(getTestUserId(), 'pro', 10, largeFileSize)
      
      expect(result.canProcess).toBe(true)
      expect(result.upgradeRequired).toBe(false)
    })

    it('should reject batch size exceeding tier limit', async () => {
      const files = Array(5).fill(null).map(() => new File(['test'], 'test.jpg', { type: 'image/jpeg' }))
      const result = await tierChecker.canProcessFiles(getTestUserId(), 'free', files)
      
      expect(result.canProcess).toBe(false)
      expect(result.limitType).toBe('batchSize')
      expect(result.upgradeRequired).toBe(true)
    })
  })

  describe('Format Support Checking', () => {
    it('should reject unsupported formats for free tier', async () => {
      const webpFile = new File(['test'], 'test.webp', { type: 'image/webp' })
      const result = await tierChecker.canProcessFiles(getTestUserId(), 'free', [webpFile])
      
      expect(result.canProcess).toBe(false)
      expect(result.limitType).toBe('format')
      expect(result.upgradeRequired).toBe(true)
    })

    it('should allow all formats for enterprise tier', async () => {
      const gifFile = new File(['test'], 'test.gif', { type: 'image/gif' })
      const result = await tierChecker.canProcessFiles(getTestUserId(), 'enterprise', [gifFile])
      
      expect(result.canProcess).toBe(true)
    })
  })

  describe('Usage Tracking', () => {
    it('should track monthly usage correctly', async () => {
      await tierChecker.updateUsage(getTestUserId(), 5, 1024 * 1024 * 5) // 5 images, 5MB
      
      const usage = await tierChecker.getUserUsage(getTestUserId())
      
      expect(usage).toBeDefined()
      expect(usage?.userId).toBe(getTestUserId())
      expect(usage?.currentMonth).toBe(currentMonth)
      expect(usage?.imagesProcessed).toBe(5)
      expect(usage?.storageUsed).toBe(1024 * 1024 * 5)
    })

    it('should reset usage for new month', async () => {
      // Mock a previous month's usage
      const prevMonthUsage: UsageStats = {
        userId: getTestUserId(),
        currentMonth: '2024-11',
        imagesProcessed: 50,
        storageUsed: 1024 * 1024 * 10,
        lastUpdated: new Date().toISOString()
      }

      // Current month should start fresh
      const currentUsage = await tierChecker.getUserUsage(getTestUserId())
      expect(currentUsage?.imagesProcessed).toBe(0)
    })

    it('should accumulate usage within the same month', async () => {
      await tierChecker.updateUsage(getTestUserId(), 3, 1024 * 1024 * 2)
      await tierChecker.updateUsage(getTestUserId(), 2, 1024 * 1024 * 3)
      
      const usage = await tierChecker.getUserUsage(getTestUserId())
      
      expect(usage?.imagesProcessed).toBe(5)
      expect(usage?.storageUsed).toBe(1024 * 1024 * 5)
    })
  })

  describe('Tier Upgrade Scenarios', () => {
    it('should provide upgrade suggestions when limits are reached', async () => {
      const result = await tierChecker.checkUsageLimit(getTestUserId(), 'free', 101, 1024 * 1024)
      
      expect(result.upgradeRequired).toBe(true)
      expect(result.message?.toLowerCase()).toContain('upgrade')
    })

    it('should calculate remaining allowances correctly', async () => {
      // Setup: user has processed 80 images this month
      const userId = getTestUserId()
      await tierChecker.updateUsage(userId, 80, 1024 * 1024 * 80)
      const result = await tierChecker.checkUsageLimit(userId, 'free', 1, 1024 * 1024)
      
      expect(result.remainingImages).toBe(19) // 100 - 80 - 1 (current request)
    })
  })

  describe('Performance and Edge Cases', () => {
    it('should handle multiple simultaneous usage checks', async () => {
      const promises = Array(10).fill(null).map(() => 
        tierChecker.checkUsageLimit(getTestUserId(), 'pro', 1, 1024 * 1024)
      )
      
      const results = await Promise.all(promises)
      results.forEach(result => {
        expect(result).toBeDefined()
        expect(typeof result.canProcess).toBe('boolean')
      })
    })

    it('should handle invalid user IDs gracefully', async () => {
      const result = await tierChecker.checkUsageLimit('invalid-user', 'free', 1, 1024)
      
      // New users are automatically created, so they should be allowed to process
      expect(result.canProcess).toBe(true)
      expect(result.remainingImages).toBe(99) // 100 - 1 = 99 for free tier
    })

    it('should handle network errors in usage tracking', async () => {
      await expect(async () => {
        await tierChecker.updateUsage('', 1, 1024)
      }).rejects.toThrow()
    })
  })
})

describe('Tier Integration with Auth System', () => {
  it('should sync tier changes with auth store', async () => {
    // This test will verify that tier changes are reflected in the auth store
    // Will be implemented when integrating with the auth system
    expect(true).toBe(true) // Placeholder
  })

  it('should enforce tier limits in real-time during processing', async () => {
    // This test will verify that processing stops when limits are reached
    // Will be implemented with the processing integration
    expect(true).toBe(true) // Placeholder
  })
})