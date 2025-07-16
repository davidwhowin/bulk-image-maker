import type { UserTier } from './auth'

export interface Subscription {
  id: string
  userId: string
  tier: UserTier
  status: 'active' | 'canceled' | 'past_due' | 'trialing'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEnd?: string
  createdAt: string
  updatedAt: string
}

export interface SubscriptionPlan {
  id: string
  tier: UserTier
  name: string
  description: string
  price: number
  interval: 'month' | 'year'
  features: string[]
  popular?: boolean
  stripePriceId?: string
}

export interface BillingInfo {
  customerId?: string
  paymentMethodId?: string
  defaultPaymentMethod?: {
    id: string
    type: 'card'
    card: {
      brand: string
      last4: string
      expMonth: number
      expYear: number
    }
  }
  billingAddress?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
}

export interface UpgradeResult {
  success: boolean
  subscription?: Subscription
  error?: string
  requiresPaymentMethod?: boolean
  clientSecret?: string
}

export interface PlanComparison {
  currentPlan: SubscriptionPlan
  targetPlan: SubscriptionPlan
  priceChange: number
  isUpgrade: boolean
  prorationAmount?: number
}

export interface UsageBasedRecommendation {
  recommendedTier: UserTier
  reason: string
  potentialSavings?: number
  limitationsRemoved: string[]
}