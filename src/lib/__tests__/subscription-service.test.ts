import { describe, it, expect, beforeEach } from 'vitest'
import { SubscriptionService, SUBSCRIPTION_PLANS } from '../subscription-service'
import type { UserTier } from '@/types/auth'
import type { UsageStats } from '@/types/tiers'

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService
  const testUserId = 'test-user-123'

  beforeEach(() => {
    subscriptionService = new SubscriptionService()
  })

  describe('Plan Management', () => {
    it('should return all available plans', async () => {
      const plans = await subscriptionService.getAvailablePlans()
      
      expect(plans).toHaveLength(4)
      expect(plans.map(p => p.tier)).toEqual(['free', 'pro', 'team', 'enterprise'])
    })

    it('should get plan by tier', async () => {
      const proPlan = await subscriptionService.getPlanByTier('pro')
      
      expect(proPlan).toBeDefined()
      expect(proPlan?.tier).toBe('pro')
      expect(proPlan?.price).toBe(29)
      expect(proPlan?.name).toBe('Pro')
    })

    it('should return null for invalid tier', async () => {
      const invalidPlan = await subscriptionService.getPlanByTier('invalid' as UserTier)
      expect(invalidPlan).toBeNull()
    })
  })

  describe('Plan Comparison', () => {
    it('should compare free to pro upgrade', async () => {
      const comparison = await subscriptionService.comparePlans('free', 'pro')
      
      expect(comparison).toBeDefined()
      expect(comparison?.isUpgrade).toBe(true)
      expect(comparison?.priceChange).toBe(29) // 29 - 0
      expect(comparison?.currentPlan.tier).toBe('free')
      expect(comparison?.targetPlan.tier).toBe('pro')
    })

    it('should compare pro to free downgrade', async () => {
      const comparison = await subscriptionService.comparePlans('pro', 'free')
      
      expect(comparison).toBeDefined()
      expect(comparison?.isUpgrade).toBe(false)
      expect(comparison?.priceChange).toBe(-29) // 0 - 29
    })

    it('should calculate proration for upgrades', async () => {
      const comparison = await subscriptionService.comparePlans('free', 'team')
      
      expect(comparison?.prorationAmount).toBeGreaterThan(0)
    })
  })

  describe('Usage-Based Recommendations', () => {
    it('should recommend upgrade for high usage', async () => {
      const highUsage: UsageStats = {
        userId: testUserId,
        currentMonth: '2024-12',
        imagesProcessed: 85, // 85% of free tier limit
        storageUsed: 100 * 1024 * 1024, // 100MB
        lastUpdated: new Date().toISOString()
      }

      const recommendation = await subscriptionService.getUsageBasedRecommendation(
        testUserId, 
        'free', 
        highUsage
      )

      expect(recommendation).toBeDefined()
      expect(recommendation?.recommendedTier).toBe('pro')
      expect(recommendation?.reason).toContain('85%')
      expect(recommendation?.limitationsRemoved).toBeDefined()
      expect(recommendation?.limitationsRemoved.length).toBeGreaterThan(0)
    })

    it('should recommend downgrade for low usage', async () => {
      const lowUsage: UsageStats = {
        userId: testUserId,
        currentMonth: '2024-12',
        imagesProcessed: 150, // Only 5% of team tier limit (150/3000)
        storageUsed: 10 * 1024 * 1024, // 10MB
        lastUpdated: new Date().toISOString()
      }

      const recommendation = await subscriptionService.getUsageBasedRecommendation(
        testUserId, 
        'team', 
        lowUsage
      )

      expect(recommendation).toBeDefined()
      expect(recommendation?.recommendedTier).toBe('pro')
      expect(recommendation?.potentialSavings).toBeGreaterThan(0)
    })

    it('should not recommend changes for appropriate usage', async () => {
      const appropriateUsage: UsageStats = {
        userId: testUserId,
        currentMonth: '2024-12',
        imagesProcessed: 1500, // 50% of pro tier limit
        storageUsed: 50 * 1024 * 1024, // 50MB
        lastUpdated: new Date().toISOString()
      }

      const recommendation = await subscriptionService.getUsageBasedRecommendation(
        testUserId, 
        'pro', 
        appropriateUsage
      )

      expect(recommendation).toBeNull()
    })

    it('should not recommend downgrade from free tier', async () => {
      const lowUsage: UsageStats = {
        userId: testUserId,
        currentMonth: '2024-12',
        imagesProcessed: 5, // Very low usage
        storageUsed: 1024 * 1024, // 1MB
        lastUpdated: new Date().toISOString()
      }

      const recommendation = await subscriptionService.getUsageBasedRecommendation(
        testUserId, 
        'free', 
        lowUsage
      )

      expect(recommendation).toBeNull()
    })

    it('should not recommend upgrade from enterprise tier', async () => {
      const highUsage: UsageStats = {
        userId: testUserId,
        currentMonth: '2024-12',
        imagesProcessed: 70000, // High usage but within enterprise limits
        storageUsed: 1024 * 1024 * 1024, // 1GB
        lastUpdated: new Date().toISOString()
      }

      const recommendation = await subscriptionService.getUsageBasedRecommendation(
        testUserId, 
        'enterprise', 
        highUsage
      )

      expect(recommendation).toBeNull()
    })
  })

  describe('Subscription Management', () => {
    it('should upgrade subscription successfully', async () => {
      const result = await subscriptionService.upgradeSubscription(testUserId, 'pro', 'pm_test123')
      
      expect(result.success).toBe(true)
      expect(result.subscription).toBeDefined()
      expect(result.subscription?.tier).toBe('pro')
      expect(result.subscription?.status).toBe('active')
      expect(result.subscription?.userId).toBe(testUserId)
    })

    it('should require payment method for paid plans', async () => {
      const result = await subscriptionService.upgradeSubscription(testUserId, 'pro')
      
      expect(result.success).toBe(false)
      expect(result.requiresPaymentMethod).toBe(true)
      expect(result.error).toContain('Payment method required')
    })

    it('should allow free tier without payment method', async () => {
      const result = await subscriptionService.upgradeSubscription(testUserId, 'free')
      
      expect(result.success).toBe(true)
      expect(result.subscription?.tier).toBe('free')
    })

    it('should cancel subscription at period end', async () => {
      // First create a subscription
      await subscriptionService.upgradeSubscription(testUserId, 'pro', 'pm_test123')
      
      // Then cancel it
      const result = await subscriptionService.cancelSubscription(testUserId, false)
      
      expect(result.success).toBe(true)
      expect(result.subscription?.cancelAtPeriodEnd).toBe(true)
      expect(result.subscription?.status).toBe('active') // Still active until period end
    })

    it('should cancel subscription immediately', async () => {
      // First create a subscription
      await subscriptionService.upgradeSubscription(testUserId, 'pro', 'pm_test123')
      
      // Then cancel immediately
      const result = await subscriptionService.cancelSubscription(testUserId, true)
      
      expect(result.success).toBe(true)
      expect(result.subscription?.tier).toBe('free')
      expect(result.subscription?.status).toBe('canceled')
    })

    it('should handle cancellation of non-existent subscription', async () => {
      const result = await subscriptionService.cancelSubscription('non-existent-user')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('No active subscription found')
    })
  })

  describe('Billing Information', () => {
    it('should update billing information', async () => {
      const billingInfo = {
        customerId: 'cus_test123',
        paymentMethodId: 'pm_test123',
        billingAddress: {
          line1: '123 Test St',
          city: 'Test City',
          state: 'TC',
          postalCode: '12345',
          country: 'US'
        }
      }

      const success = await subscriptionService.updateBillingInfo(testUserId, billingInfo)
      expect(success).toBe(true)

      const retrievedInfo = await subscriptionService.getBillingInfo(testUserId)
      expect(retrievedInfo?.customerId).toBe('cus_test123')
      expect(retrievedInfo?.billingAddress?.city).toBe('Test City')
    })

    it('should handle partial billing info updates', async () => {
      // Set initial billing info
      await subscriptionService.updateBillingInfo(testUserId, {
        customerId: 'cus_test123'
      })

      // Update with additional info
      await subscriptionService.updateBillingInfo(testUserId, {
        paymentMethodId: 'pm_test456'
      })

      const info = await subscriptionService.getBillingInfo(testUserId)
      expect(info?.customerId).toBe('cus_test123')
      expect(info?.paymentMethodId).toBe('pm_test456')
    })
  })

  describe('Subscription Retrieval', () => {
    it('should retrieve current subscription', async () => {
      // Create subscription
      await subscriptionService.upgradeSubscription(testUserId, 'team', 'pm_test123')
      
      const subscription = await subscriptionService.getCurrentSubscription(testUserId)
      
      expect(subscription).toBeDefined()
      expect(subscription?.tier).toBe('team')
      expect(subscription?.userId).toBe(testUserId)
    })

    it('should return null for non-existent subscription', async () => {
      const subscription = await subscriptionService.getCurrentSubscription('non-existent-user')
      expect(subscription).toBeNull()
    })

    it('should return null for non-existent billing info', async () => {
      const billingInfo = await subscriptionService.getBillingInfo('non-existent-user')
      expect(billingInfo).toBeNull()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid plan IDs', async () => {
      const result = await subscriptionService.upgradeSubscription(testUserId, 'invalid' as UserTier)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid subscription plan')
    })

    it('should validate plan comparison inputs', async () => {
      const comparison = await subscriptionService.comparePlans('invalid' as UserTier, 'pro')
      expect(comparison).toBeNull()
    })
  })
})