import { loadStripe } from '@stripe/stripe-js'

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

if (!stripePublishableKey) {
  console.error('Stripe publishable key is missing from environment variables')
}

// Initialize Stripe with locale configuration to fix module loading errors
export const stripePromise = loadStripe(stripePublishableKey || '', {
  locale: 'en'
})

// Stripe Price IDs mapping to tiers
export const STRIPE_PRICE_IDS = {
  pro_monthly: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID || 'price_1RldtdFTfiHug5HPKU85yOMq',
  pro_yearly: import.meta.env.VITE_STRIPE_PRO_YEARLY_PRICE_ID || 'price_1Rle5iFTfiHug5HPcEGmPzzA',
  team_monthly: import.meta.env.VITE_STRIPE_TEAM_MONTHLY_PRICE_ID || 'price_1RldwlFTfiHug5HP7YK5LStI',
  team_yearly: import.meta.env.VITE_STRIPE_TEAM_YEARLY_PRICE_ID || 'price_1Rle4iFTfiHug5HPQbdInrqI',
  enterprise_monthly: import.meta.env.VITE_STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || 'price_1RldxCFTfiHug5HPJ9MY3Y9u',
  enterprise_yearly: import.meta.env.VITE_STRIPE_ENTERPRISE_YEARLY_PRICE_ID || 'price_1Rle02FTfiHug5HPmTuwi1Ic'
} as const

export type StripePriceId = keyof typeof STRIPE_PRICE_IDS