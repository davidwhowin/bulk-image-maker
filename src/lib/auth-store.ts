import { create } from 'zustand'
import { supabase } from './supabase'
import type { User, UserTier, AuthError, AuthState, AuthActions } from '@/types/auth'
import type { TierUsageResult, UsageStats } from '@/types/tiers'
import type { UsageBasedRecommendation } from '@/types/subscription'
import { tierService } from './tier-service'
import { subscriptionService } from './subscription-service'

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  userTier: 'free',
  isAdmin: false,
  error: null,
  needsEmailVerification: false,
  pendingVerificationEmail: null,
  currentUsage: null,
  tierLimits: null
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  ...initialState,

  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null })
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        // Handle different types of authentication errors
        if (error.message.includes('Invalid login credentials')) {
          // For invalid credentials, just show a generic error message
          // Don't try to guess if it's wrong password vs non-existent user
          throw {
            ...error,
            message: 'Invalid email or password. Please check your credentials or use "Forgot password" if needed.',
            code: 'invalid_credentials'
          }
        }
        
        // Handle email not confirmed error specifically
        if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
          set({
            error: null,
            isLoading: false,
            isAuthenticated: false,
            user: null,
            needsEmailVerification: true,
            pendingVerificationEmail: email
          })
          return
        }
        
        throw error
      }

      if (data.user) {
        // Fetch user profile to get tier information
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_tier, is_admin')
          .eq('id', data.user.id)
          .single()

        if (profileError) {
          console.error('Profile fetch error:', profileError)
          // If profile doesn't exist, create it
          if (profileError.code === 'PGRST116') {
            console.log('Creating user profile for new user')
            const { error: createError } = await supabase
              .from('user_profiles')
              .insert({
                id: data.user.id,
                user_tier: 'free',
                is_admin: false
              })
            
            if (createError) {
              console.error('Failed to create user profile:', createError)
            }
            
            // Also create default subscription
            const { error: subError } = await supabase
              .from('subscriptions')
              .insert({
                user_id: data.user.id,
                tier: 'free',
                status: 'active',
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 1000 * 365 * 24 * 60 * 60 * 1000).toISOString(), // Far future for free
                cancel_at_period_end: false
              })
            
            if (subError) {
              console.error('Failed to create default subscription:', subError)
            }
          }
        }

        const user: User = {
          id: data.user.id,
          email: data.user.email!,
          userTier: profile?.user_tier || 'free',
          isAdmin: profile?.is_admin || false,
          createdAt: data.user.created_at,
          lastLoginAt: new Date().toISOString()
        }

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          userTier: user.userTier,
          isAdmin: user.isAdmin || false,
          needsEmailVerification: false,
          pendingVerificationEmail: null
        })

        // Load usage stats after successful login
        get().refreshUsageStats()
      }
    } catch (error: any) {
      set({
        error: { message: error.message, code: error.code },
        isLoading: false,
        isAuthenticated: false,
        user: null,
        needsEmailVerification: false,
        pendingVerificationEmail: null
      })
      throw error
    }
  },

  register: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null })
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) throw error

      if (data.user) {
        // Check if email confirmation is required
        if (!data.user.email_confirmed_at) {
          // User needs to verify email
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            needsEmailVerification: true,
            pendingVerificationEmail: email,
            error: null
          })
        } else {
          // Email already confirmed (shouldn't happen with new registrations)
          // Fetch user profile to get tier information
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('user_tier, is_admin')
            .eq('id', data.user.id)
            .single()

          if (profileError) {
            console.error('Profile fetch error during registration:', profileError)
            // If profile doesn't exist, create it (same as login)
            if (profileError.code === 'PGRST116') {
              const { error: createError } = await supabase
                .from('user_profiles')
                .insert({
                  id: data.user.id,
                  user_tier: 'free',
                is_admin: false
                })
              
              if (createError) {
                console.error('Failed to create user profile during registration:', createError)
              }
            }
          }

          const user: User = {
            id: data.user.id,
            email: data.user.email!,
            userTier: profile?.user_tier || 'free',
          isAdmin: profile?.is_admin || false,
            createdAt: data.user.created_at
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            userTier: user.userTier,
            needsEmailVerification: false,
            pendingVerificationEmail: null
          })
        }
      }
    } catch (error: any) {
      set({
        error: { message: error.message, code: error.code },
        isLoading: false,
        isAuthenticated: false,
        user: null,
        needsEmailVerification: false,
        pendingVerificationEmail: null
      })
      throw error
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true })
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        userTier: 'free',
        error: null,
        needsEmailVerification: false,
        pendingVerificationEmail: null
      })
    } catch (error: any) {
      set({
        error: { message: error.message, code: error.code },
        isLoading: false
      })
      throw error
    }
  },

  setUser: (user: User | null) => {
    set({
      user,
      isAuthenticated: !!user,
      userTier: user?.userTier || 'free'
    })
  },

  setUserTier: async (tier: UserTier) => {
    const { user } = get()
    if (user) {
      try {
        // Update user tier in database
        const { error } = await supabase
          .from('user_profiles')
          .update({ user_tier: tier })
          .eq('id', user.id)

        if (error) {
          console.error('Failed to update user tier in database:', error)
          return
        }

        set({
          userTier: tier,
          user: { ...user, userTier: tier }
        })
      } catch (error) {
        console.error('Failed to update user tier:', error)
      }
    }
  },

  setLoading: (isLoading: boolean) => {
    set({ isLoading })
  },

  setError: (error: AuthError | null) => {
    set({ error })
  },

  setNeedsEmailVerification: (needs: boolean, email?: string) => {
    set({ 
      needsEmailVerification: needs,
      pendingVerificationEmail: email || null
    })
  },

  resendVerificationEmail: async (email: string) => {
    try {
      set({ isLoading: true, error: null })
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email
      })

      if (error) throw error

      set({ isLoading: false })
    } catch (error: any) {
      set({
        error: { message: error.message, code: error.code },
        isLoading: false
      })
      throw error
    }
  },

  requestPasswordReset: async (email: string) => {
    try {
      set({ isLoading: true, error: null })
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        // Show rate limiting errors to user (actionable feedback)
        if (error.message.includes('you can only request this after') || 
            error.message.includes('rate limit') ||
            error.message.includes('too many requests')) {
          set({
            error: { 
              message: 'Please wait before requesting another password reset. You can only request this once per minute.', 
              code: 'rate_limit' 
            },
            isLoading: false
          })
          throw error
        }
        
        // Hide "user not found" type errors for security (prevent email enumeration)
        if (error.message.includes('User not found') || 
            error.message.includes('Invalid email') ||
            error.message.includes('not registered')) {
          console.warn('Password reset error (hidden for security):', error.message)
          // Show success for security - don't throw error
          set({ isLoading: false, error: null })
          return // Exit successfully for security
        } else {
          // Show other technical errors
          set({
            error: { message: error.message, code: error.code || 'unknown_error' },
            isLoading: false
          })
          throw error
        }
      }

      // Show success for valid requests
      set({ isLoading: false, error: null })
    } catch (error: any) {
      // Re-throw if we already set an error above, otherwise handle unexpected errors
      if (!get().error) {
        console.error('Password reset technical error:', error)
        set({
          error: { message: 'Unable to send reset email. Please try again.', code: 'network_error' },
          isLoading: false
        })
        throw error
      } else {
        // Error already set, just throw to let component handle it
        throw error
      }
    }
  },

  updatePassword: async (newPassword: string) => {
    try {
      set({ isLoading: true, error: null })
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      set({ isLoading: false })
    } catch (error: any) {
      set({
        error: { message: error.message, code: error.code },
        isLoading: false
      })
      throw error
    }
  },

  reset: () => {
    set(initialState)
  },

  initialize: async () => {
    try {
      set({ isLoading: true })
      
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        // Fetch user profile to get tier information
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('user_tier, is_admin')
          .eq('id', session.user.id)
          .single()

        if (profileError) {
          console.error('Profile fetch error during initialization:', profileError)
        }

        const user: User = {
          id: session.user.id,
          email: session.user.email!,
          userTier: profile?.user_tier || 'free',
          isAdmin: profile?.is_admin || false,
          createdAt: session.user.created_at,
          lastLoginAt: new Date().toISOString()
        }

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
          userTier: user.userTier
        })

        // Load usage stats
        get().refreshUsageStats()
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          userTier: 'free',
          needsEmailVerification: false,
          pendingVerificationEmail: null
        })
      }

      // Set up auth state listener
      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Fetch user profile to get tier information
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('user_tier, is_admin')
            .eq('id', session.user.id)
            .single()

          if (profileError) {
            console.error('Profile fetch error during auth state change:', profileError)
          }

          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            userTier: profile?.user_tier || 'free',
          isAdmin: profile?.is_admin || false,
            createdAt: session.user.created_at,
            lastLoginAt: new Date().toISOString()
          }

          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            userTier: user.userTier,
            needsEmailVerification: false,
            pendingVerificationEmail: null
          })
        } else if (event === 'SIGNED_OUT') {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            userTier: 'free',
            error: null,
            needsEmailVerification: false,
            pendingVerificationEmail: null
          })
        }
      })
    } catch (error: any) {
      set({
        error: { message: error.message, code: error.code },
        isLoading: false,
        isAuthenticated: false,
        user: null
      })
    }
  },

  // Tier-related actions
  checkFileUploadLimits: async (files: File[]): Promise<TierUsageResult> => {
    const { user, userTier } = get()
    if (!user) {
      return {
        canProcess: false,
        remainingImages: 0,
        remainingStorage: 0,
        upgradeRequired: true,
        message: 'Please log in to process files'
      }
    }

    return tierService.canProcessFiles(user.id, userTier, files)
  },

  updateUsageStats: async (imageCount: number, storageUsed: number): Promise<void> => {
    const { user } = get()
    if (!user) return

    try {
      await tierService.updateUsage(user.id, imageCount, storageUsed)
      
      // Refresh usage stats in store
      const updatedUsage = await tierService.getUserUsage(user.id)
      set({ currentUsage: updatedUsage })
    } catch (error) {
      console.error('Failed to update usage stats:', error)
    }
  },

  refreshUsageStats: async (): Promise<void> => {
    const { user, userTier } = get()
    if (!user) return

    try {
      const usage = await tierService.getUserUsage(user.id)
      const limits = tierService.getTierLimits(userTier)
      
      set({ 
        currentUsage: usage,
        tierLimits: limits
      })
    } catch (error) {
      console.error('Failed to refresh usage stats:', error)
    }
  },

  getTierLimits: () => {
    const { userTier } = get()
    return tierService.getTierLimits(userTier)
  },

  // Subscription-related actions
  upgradeUserTier: async (targetTier: UserTier, paymentMethodId?: string): Promise<boolean> => {
    const { user } = get()
    if (!user) {
      console.error('No user found for upgrade')
      return false
    }

    try {
      console.log(`Upgrading user ${user.id} to ${targetTier}`)
      const result = await subscriptionService.upgradeSubscription(user.id, targetTier, paymentMethodId)
      console.log('Subscription service result:', result)
      
      if (result.success) {
        console.log('Upgrade successful, updating store...')
        // Update user tier in store
        set(state => ({
          userTier: targetTier,
          user: state.user ? { ...state.user, userTier: targetTier } : null
        }))
        
        // Refresh usage stats with new tier limits
        get().refreshUsageStats()
        
        return true
      } else {
        console.error('Subscription service returned failure:', result.error)
        set({
          error: { 
            message: result.error || 'Upgrade failed', 
            code: result.requiresPaymentMethod ? 'payment_required' : 'upgrade_failed' 
          }
        })
        return false
      }
    } catch (error) {
      console.error('Upgrade failed with exception:', error)
      set({
        error: { 
          message: 'Unable to upgrade subscription. Please try again.', 
          code: 'network_error' 
        }
      })
      return false
    }
  },

  cancelSubscription: async (immediate = false): Promise<boolean> => {
    const { user } = get()
    if (!user) return false

    try {
      const result = await subscriptionService.cancelSubscription(user.id, immediate)
      
      if (result.success && result.subscription) {
        // Update user tier if immediate cancellation
        if (immediate || result.subscription.tier === 'free') {
          set(state => ({
            userTier: 'free',
            user: state.user ? { ...state.user, userTier: 'free' } : null
          }))
          
          // Refresh usage stats with free tier limits
          get().refreshUsageStats()
        }
        
        return true
      } else {
        set({
          error: { 
            message: result.error || 'Cancellation failed', 
            code: 'cancellation_failed' 
          }
        })
        return false
      }
    } catch (error) {
      console.error('Cancellation failed:', error)
      set({
        error: { 
          message: 'Unable to cancel subscription. Please try again.', 
          code: 'network_error' 
        }
      })
      return false
    }
  },

  checkIsAdmin: async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('is_admin')
      
      if (error) {
        console.error('Error checking admin status:', error)
        return false
      }
      
      const isAdminResult = data || false
      
      // Update the auth store with admin status
      set(state => ({
        ...state,
        isAdmin: isAdminResult,
        user: state.user ? { ...state.user, isAdmin: isAdminResult } : null
      }))
      
      return isAdminResult
    } catch (error) {
      console.error('Error checking admin status:', error)
      return false
    }
  },

  getSubscriptionRecommendation: async (): Promise<UsageBasedRecommendation | null> => {
    const { user, userTier, currentUsage } = get()
    if (!user || !currentUsage) return null

    try {
      return await subscriptionService.getUsageBasedRecommendation(user.id, userTier, currentUsage)
    } catch (error) {
      console.error('Failed to get subscription recommendation:', error)
      return null
    }
  }
}))