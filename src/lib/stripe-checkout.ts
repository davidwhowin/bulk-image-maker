import { stripePromise, STRIPE_PRICE_IDS } from './stripe-client'
import type { UserTier } from '@/types/auth'

export interface CheckoutSessionData {
  sessionId: string
  url: string
}

export interface CreateCheckoutSessionParams {
  priceId: string
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
  tier: UserTier
}

class StripeCheckoutService {
  /**
   * Create a Stripe Checkout session for subscription
   */
  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CheckoutSessionData | null> {
    try {
      const response = await fetch('http://localhost:3001/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        throw new Error(`Failed to create checkout session: ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error creating checkout session:', error)
      return null
    }
  }

  /**
   * Redirect user to Stripe Checkout
   */
  async redirectToCheckout(params: CreateCheckoutSessionParams): Promise<void> {
    const stripe = await stripePromise
    if (!stripe) {
      throw new Error('Stripe failed to load')
    }

    const sessionData = await this.createCheckoutSession(params)
    if (!sessionData) {
      throw new Error('Failed to create checkout session')
    }

    const { error } = await stripe.redirectToCheckout({
      sessionId: sessionData.sessionId
    })

    if (error) {
      throw new Error(error.message)
    }
  }

  /**
   * Get the price ID for a tier and billing interval
   */
  getPriceIdForTier(tier: UserTier, interval: 'monthly' | 'yearly' = 'monthly'): string | null {
    const suffix = interval === 'yearly' ? '_yearly' : '_monthly'
    const priceKey = `${tier}${suffix}` as keyof typeof STRIPE_PRICE_IDS
    
    return STRIPE_PRICE_IDS[priceKey] || null
  }

  /**
   * Create customer portal session for managing subscriptions
   */
  async createCustomerPortalSession(customerId: string, returnUrl: string): Promise<string | null> {
    try {
      const response = await fetch('http://localhost:3001/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId,
          returnUrl
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to create portal session: ${response.statusText}`)
      }

      const data = await response.json()
      return data.url
    } catch (error) {
      console.error('Error creating portal session:', error)
      return null
    }
  }

  /**
   * Redirect to customer portal
   */
  async redirectToCustomerPortal(customerId: string, returnUrl?: string): Promise<void> {
    const defaultReturnUrl = `${window.location.origin}/plans`
    const portalUrl = await this.createCustomerPortalSession(
      customerId, 
      returnUrl || defaultReturnUrl
    )

    if (portalUrl) {
      window.location.href = portalUrl
    } else {
      throw new Error('Failed to create customer portal session')
    }
  }

  /**
   * Get pricing information for display
   */
  getPricingInfo() {
    return {
      pro: {
        monthly: {
          priceId: STRIPE_PRICE_IDS.pro_monthly,
          amount: 29,
          currency: 'usd',
          interval: 'month'
        },
        yearly: {
          priceId: STRIPE_PRICE_IDS.pro_yearly,
          amount: 290,
          currency: 'usd',
          interval: 'year'
        }
      },
      team: {
        monthly: {
          priceId: STRIPE_PRICE_IDS.team_monthly,
          amount: 149,
          currency: 'usd',
          interval: 'month'
        },
        yearly: {
          priceId: STRIPE_PRICE_IDS.team_yearly,
          amount: 1490,
          currency: 'usd',
          interval: 'year'
        }
      },
      enterprise: {
        monthly: {
          priceId: STRIPE_PRICE_IDS.enterprise_monthly,
          amount: 499,
          currency: 'usd',
          interval: 'month'
        },
        yearly: {
          priceId: STRIPE_PRICE_IDS.enterprise_yearly,
          amount: 4990,
          currency: 'usd',
          interval: 'year'
        }
      }
    }
  }
}

export const stripeCheckoutService = new StripeCheckoutService()