import type { UsageStats, TierLimits, TierUsageResult } from './tiers'
import type { UsageBasedRecommendation } from './subscription'

export type UserTier = 'free' | 'pro' | 'team' | 'enterprise'

export interface User {
  id: string
  email: string
  userTier: UserTier
  createdAt: string
  lastLoginAt?: string
}

export interface AuthError {
  message: string
  code?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  userTier: UserTier
  error: AuthError | null
  needsEmailVerification: boolean
  pendingVerificationEmail: string | null
  currentUsage: UsageStats | null
  tierLimits: TierLimits | null
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User | null) => void
  setUserTier: (tier: UserTier) => void
  setLoading: (loading: boolean) => void
  setError: (error: AuthError | null) => void
  setNeedsEmailVerification: (needs: boolean, email?: string) => void
  resendVerificationEmail: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  reset: () => void
  initialize: () => Promise<void>
  
  // Tier-related actions
  checkFileUploadLimits: (files: File[]) => Promise<TierUsageResult>
  updateUsageStats: (imageCount: number, storageUsed: number) => Promise<void>
  refreshUsageStats: () => Promise<void>
  getTierLimits: () => TierLimits | null
  
  // Subscription-related actions
  upgradeUserTier: (targetTier: UserTier, paymentMethodId?: string) => Promise<boolean>
  cancelSubscription: (immediate?: boolean) => Promise<boolean>
  getSubscriptionRecommendation: () => Promise<UsageBasedRecommendation | null>
}