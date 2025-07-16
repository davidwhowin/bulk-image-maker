import type { 
  Subscription, 
  SubscriptionPlan, 
  BillingInfo, 
  UpgradeResult, 
  PlanComparison, 
  UsageBasedRecommendation 
} from '@/types/subscription'
import type { UserTier } from '@/types/auth'
import type { UsageStats } from '@/types/tiers'
import { TIER_LIMITS } from './tier-config'
import { supabase } from './supabase'

// Mock subscription plans - in production these would come from Stripe
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    tier: 'free',
    name: 'Free',
    description: 'Perfect for personal projects and trying out the platform',
    price: 0,
    interval: 'month',
    features: [
      '100 images per month',
      '5MB max file size',
      '1 image batch processing',
      'JPEG, PNG formats',
      'Community support'
    ]
  },
  {
    id: 'pro-monthly',
    tier: 'pro',
    name: 'Pro',
    description: 'Ideal for freelancers and small businesses',
    price: 29,
    interval: 'month',
    features: [
      '3,000 images per month',
      '25MB max file size',
      '10 image batch processing',
      'All formats + WebP, AVIF, JPEG XL',
      'Fast processing (10-15 seconds)',
      'Email support'
    ],
    popular: true,
    stripePriceId: 'price_pro_monthly'
  },
  {
    id: 'team-monthly',
    tier: 'team',
    name: 'Team',
    description: 'Perfect for agencies and growing teams',
    price: 149,
    interval: 'month',
    features: [
      '15,000 images per month',
      '100MB max file size',
      '50 image batch processing',
      'All formats + SVG optimization',
      'Ultra-fast processing (3-5 seconds)',
      'Team collaboration features',
      'Live chat support'
    ],
    stripePriceId: 'price_team_monthly'
  },
  {
    id: 'enterprise-monthly',
    tier: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    price: 499,
    interval: 'month',
    features: [
      '75,000 images per month',
      '500MB max file size',
      '500 image batch processing',
      'All formats + custom processing',
      'Instant processing (1-2 seconds)',
      'Advanced team features',
      'Priority phone support',
      'Custom integrations'
    ],
    stripePriceId: 'price_enterprise_monthly'
  }
]

export class SubscriptionService {
  private testingMode = true // Set to true for testing - all plans are free

  // Method to enable/disable testing mode
  setTestingMode(enabled: boolean): void {
    this.testingMode = enabled
    console.log(`Subscription testing mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  async getCurrentSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        // If no subscription found, that's OK - return null
        if (error.code === 'PGRST116') {
          return null
        }
        console.error('Error fetching subscription:', error)
        return null
      }

      return {
        id: data.id,
        userId: data.user_id,
        tier: data.tier as UserTier,
        status: data.status,
        stripeSubscriptionId: data.stripe_subscription_id,
        stripeCustomerId: data.stripe_customer_id,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    } catch (error) {
      console.error('Failed to get subscription:', error)
      return null
    }
  }

  async getBillingInfo(userId: string): Promise<BillingInfo | null> {
    try {
      const { data, error } = await supabase
        .from('billing_info')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        // If no billing info found, that's OK - return null
        if (error.code === 'PGRST116') {
          return null
        }
        console.error('Error fetching billing info:', error)
        return null
      }

      return {
        stripeCustomerId: data.stripe_customer_id,
        paymentMethodId: data.payment_method_id,
        billingEmail: data.billing_email,
        companyName: data.company_name,
        billingAddress: data.billing_address,
        taxId: data.tax_id
      }
    } catch (error) {
      console.error('Failed to get billing info:', error)
      return null
    }
  }

  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    return SUBSCRIPTION_PLANS
  }

  async getPlanByTier(tier: UserTier): Promise<SubscriptionPlan | null> {
    return SUBSCRIPTION_PLANS.find(plan => plan.tier === tier) || null
  }

  async comparePlans(currentTier: UserTier, targetTier: UserTier): Promise<PlanComparison | null> {
    const currentPlan = await this.getPlanByTier(currentTier)
    const targetPlan = await this.getPlanByTier(targetTier)

    if (!currentPlan || !targetPlan) return null

    const priceChange = targetPlan.price - currentPlan.price
    const isUpgrade = this.getTierOrder(targetTier) > this.getTierOrder(currentTier)

    return {
      currentPlan,
      targetPlan,
      priceChange,
      isUpgrade,
      prorationAmount: this.calculateProration(currentPlan, targetPlan)
    }
  }

  async getUsageBasedRecommendation(
    userId: string, 
    currentTier: UserTier, 
    usage: UsageStats
  ): Promise<UsageBasedRecommendation | null> {
    const currentLimits = TIER_LIMITS[currentTier]
    const usagePercentage = (usage.imagesProcessed / currentLimits.maxImagesPerMonth) * 100

    // Recommend upgrade if user is using >80% of their limits
    if (usagePercentage > 80 && currentTier !== 'enterprise') {
      const recommendedTier = this.getNextTier(currentTier)
      const recommendedLimits = TIER_LIMITS[recommendedTier]
      
      return {
        recommendedTier,
        reason: `You're using ${usagePercentage.toFixed(0)}% of your monthly limit. Upgrade for more capacity.`,
        limitationsRemoved: [
          `${recommendedLimits.maxImagesPerMonth - currentLimits.maxImagesPerMonth} more images per month`,
          `${Math.round((recommendedLimits.maxFileSize - currentLimits.maxFileSize) / (1024 * 1024))}MB larger file size limit`,
          `${recommendedLimits.maxBatchSize - currentLimits.maxBatchSize} more files per batch`
        ]
      }
    }

    // Recommend downgrade if user is using <20% consistently
    if (usagePercentage < 20 && currentTier !== 'free') {
      const recommendedTier = this.getPreviousTier(currentTier)
      const currentPlan = await this.getPlanByTier(currentTier)
      const recommendedPlan = await this.getPlanByTier(recommendedTier)
      
      if (currentPlan && recommendedPlan) {
        return {
          recommendedTier,
          reason: `You're only using ${usagePercentage.toFixed(0)}% of your monthly limit. Consider downgrading to save money.`,
          potentialSavings: (currentPlan.price - recommendedPlan.price) * 12, // Annual savings
          limitationsRemoved: []
        }
      }
    }

    return null
  }

  async upgradeSubscription(
    userId: string,
    targetTier: UserTier,
    paymentMethodId?: string
  ): Promise<UpgradeResult> {
    try {
      const currentSubscription = await this.getCurrentSubscription(userId)
      const targetPlan = await this.getPlanByTier(targetTier)

      if (!targetPlan) {
        return { success: false, error: 'Invalid subscription plan' }
      }

      // For paid plans, check if payment method is required (skip in testing mode)
      if (!this.testingMode && targetTier !== 'free' && !paymentMethodId && !currentSubscription) {
        return { 
          success: false, 
          requiresPaymentMethod: true,
          error: 'Payment method required for paid plans'
        }
      }

      try {
        // Check if subscription already exists
        const { data: existingSubscription } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('user_id', userId)
          .single()

        let data, error
        
        if (existingSubscription) {
          // Update existing subscription
          const result = await supabase
            .from('subscriptions')
            .update({
              tier: targetTier,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
              cancel_at_period_end: false,
              stripe_subscription_id: this.testingMode ? null : `stripe_sub_${Date.now()}`,
              stripe_customer_id: this.testingMode ? null : `stripe_cus_${Date.now()}`
            })
            .eq('user_id', userId)
            .select()
            .single()
          
          data = result.data
          error = result.error
        } else {
          // Create new subscription
          const result = await supabase
            .from('subscriptions')
            .insert({
              user_id: userId,
              tier: targetTier,
              status: 'active',
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
              cancel_at_period_end: false,
              stripe_subscription_id: this.testingMode ? null : `stripe_sub_${Date.now()}`,
              stripe_customer_id: this.testingMode ? null : `stripe_cus_${Date.now()}`
            })
            .select()
            .single()
          
          data = result.data
          error = result.error
        }

        if (error) {
          console.error('Database error during subscription upgrade:', error)
          return { success: false, error: 'Failed to save subscription to database' }
        }

        // Also update user tier in user_profiles
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ user_tier: targetTier })
          .eq('id', userId)

        if (profileError) {
          console.error('Failed to update user profile tier:', profileError)
          // Don't fail the whole operation for this
        }

        const newSubscription: Subscription = {
          id: data.id,
          userId: data.user_id,
          tier: data.tier as UserTier,
          status: data.status,
          stripeSubscriptionId: data.stripe_subscription_id,
          stripeCustomerId: data.stripe_customer_id,
          currentPeriodStart: data.current_period_start,
          currentPeriodEnd: data.current_period_end,
          cancelAtPeriodEnd: data.cancel_at_period_end,
          createdAt: data.created_at,
          updatedAt: data.updated_at
        }

        return {
          success: true,
          subscription: newSubscription
        }
      } catch (dbError: any) {
        console.error('Database operation failed:', dbError)
        return { success: false, error: 'Database operation failed' }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upgrade failed'
      }
    }
  }

  async cancelSubscription(userId: string, immediate = false): Promise<UpgradeResult> {
    try {
      const subscription = await this.getCurrentSubscription(userId)
      
      if (!subscription) {
        return { success: false, error: 'No active subscription found' }
      }

      try {
        if (immediate) {
          // Immediate cancellation - downgrade to free
          const { data, error } = await supabase
            .from('subscriptions')
            .update({
              tier: 'free',
              status: 'canceled',
              cancel_at_period_end: false
            })
            .eq('user_id', userId)
            .select()
            .single()

          if (error) {
            console.error('Database error during immediate cancellation:', error)
            return { success: false, error: 'Failed to cancel subscription in database' }
          }

          // Also update user tier in user_profiles
          const { error: profileError } = await supabase
            .from('user_profiles')
            .update({ user_tier: 'free' })
            .eq('id', userId)

          if (profileError) {
            console.error('Failed to update user profile tier:', profileError)
          }

          const canceledSubscription: Subscription = {
            id: data.id,
            userId: data.user_id,
            tier: data.tier as UserTier,
            status: data.status,
            stripeSubscriptionId: data.stripe_subscription_id,
            stripeCustomerId: data.stripe_customer_id,
            currentPeriodStart: data.current_period_start,
            currentPeriodEnd: data.current_period_end,
            cancelAtPeriodEnd: data.cancel_at_period_end,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          }

          return {
            success: true,
            subscription: canceledSubscription
          }
        } else {
          // Cancel at period end
          const { data, error } = await supabase
            .from('subscriptions')
            .update({
              cancel_at_period_end: true
            })
            .eq('user_id', userId)
            .select()
            .single()

          if (error) {
            console.error('Database error during period-end cancellation:', error)
            return { success: false, error: 'Failed to update cancellation in database' }
          }

          const updatedSubscription: Subscription = {
            id: data.id,
            userId: data.user_id,
            tier: data.tier as UserTier,
            status: data.status,
            stripeSubscriptionId: data.stripe_subscription_id,
            stripeCustomerId: data.stripe_customer_id,
            currentPeriodStart: data.current_period_start,
            currentPeriodEnd: data.current_period_end,
            cancelAtPeriodEnd: data.cancel_at_period_end,
            createdAt: data.created_at,
            updatedAt: data.updated_at
          }

          return {
            success: true,
            subscription: updatedSubscription
          }
        }
      } catch (dbError: any) {
        console.error('Database operation failed:', dbError)
        return { success: false, error: 'Database operation failed' }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cancellation failed'
      }
    }
  }

  async updateBillingInfo(userId: string, billingInfo: Partial<BillingInfo>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('billing_info')
        .upsert({
          user_id: userId,
          stripe_customer_id: billingInfo.stripeCustomerId,
          payment_method_id: billingInfo.paymentMethodId,
          billing_email: billingInfo.billingEmail,
          company_name: billingInfo.companyName,
          billing_address: billingInfo.billingAddress,
          tax_id: billingInfo.taxId
        })

      if (error) {
        console.error('Database error updating billing info:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to update billing info:', error)
      return false
    }
  }

  // Helper methods
  private getTierOrder(tier: UserTier): number {
    const order = { free: 0, pro: 1, team: 2, enterprise: 3 }
    return order[tier]
  }

  private getNextTier(tier: UserTier): UserTier {
    const tiers: UserTier[] = ['free', 'pro', 'team', 'enterprise']
    const currentIndex = tiers.indexOf(tier)
    return tiers[Math.min(currentIndex + 1, tiers.length - 1)]
  }

  private getPreviousTier(tier: UserTier): UserTier {
    const tiers: UserTier[] = ['free', 'pro', 'team', 'enterprise']
    const currentIndex = tiers.indexOf(tier)
    return tiers[Math.max(currentIndex - 1, 0)]
  }

  private calculateProration(currentPlan: SubscriptionPlan, targetPlan: SubscriptionPlan): number {
    // Simplified proration calculation - in production this would be more complex
    const daysInMonth = 30
    const daysRemaining = 15 // Mock - would calculate actual days remaining
    
    const proratedCurrent = (currentPlan.price / daysInMonth) * daysRemaining
    const proratedTarget = (targetPlan.price / daysInMonth) * daysRemaining
    
    return Math.max(0, proratedTarget - proratedCurrent)
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService()