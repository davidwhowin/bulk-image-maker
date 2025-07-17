import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/lib/auth-store'

export interface UsageHistoryEntry {
  month: string
  images_processed: number
  storage_used: number
  last_updated: string
  created_at: string
}

export interface UserSearchResult {
  id: string
  email: string
  created_at: string
  user_tier: string
  current_images: number
  current_storage: number
  last_activity: string | null
}

export interface TopUserResult {
  user_id: string
  email: string
  user_tier: string
  images_processed: number
  storage_used: number
  last_updated: string
  created_at: string
}

export interface UsageStatsOverview {
  total_users: number
  active_users: number
  total_images: number
  total_storage: number
  avg_images_per_user: number
  avg_storage_per_user: number
  free_users: number
  pro_users: number
  premium_users: number
}

export interface SetUsageResult {
  success: boolean
  user_id?: string
  month?: string
  previous_images?: number
  new_images?: number
  previous_storage?: number
  new_storage?: number
  updated_at?: string
  error?: string
  error_code?: string
}

export interface BulkResetResult {
  success: boolean
  month?: string
  affected_users?: number
  reset_at?: string
  error?: string
  error_code?: string
}

export function useAdminUsageControls() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { refreshUsageStats } = useAuthStore()

  const setUserUsage = useCallback(async (
    userId: string,
    imagesCount: number,
    storageBytes: number,
    targetMonth?: string
  ): Promise<SetUsageResult> => {
    setIsLoading(true)
    setError(null)

    try {
      // Validate inputs
      if (!userId) {
        throw new Error('User ID is required')
      }

      if (imagesCount < 0) {
        throw new Error('Images count cannot be negative')
      }

      if (storageBytes < 0) {
        throw new Error('Storage bytes cannot be negative')
      }

      if (targetMonth && !/^\d{4}-\d{2}$/.test(targetMonth)) {
        throw new Error('Invalid month format. Use YYYY-MM (e.g., 2025-01)')
      }

      // Call the database function
      const { data, error: rpcError } = await supabase.rpc('set_usage_stats', {
        user_uuid: userId,
        images_count: imagesCount,
        storage_bytes: storageBytes,
        target_month: targetMonth || null
      })

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`)
      }

      const result = data as SetUsageResult

      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred')
      }

      // Refresh usage stats if it's for the current user
      const { user } = useAuthStore.getState()
      if (user && user.id === userId) {
        await refreshUsageStats()
      }

      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set usage stats'
      setError(errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setIsLoading(false)
    }
  }, [refreshUsageStats])

  const setUserUsageByEmail = useCallback(async (
    userEmail: string,
    imagesCount: number,
    storageBytes: number,
    targetMonth?: string
  ): Promise<SetUsageResult> => {
    setIsLoading(true)
    setError(null)

    try {
      // Validate inputs
      if (!userEmail) {
        throw new Error('User email is required')
      }

      if (imagesCount < 0) {
        throw new Error('Images count cannot be negative')
      }

      if (storageBytes < 0) {
        throw new Error('Storage bytes cannot be negative')
      }

      if (targetMonth && !/^\d{4}-\d{2}$/.test(targetMonth)) {
        throw new Error('Invalid month format. Use YYYY-MM (e.g., 2025-01)')
      }

      // Call the email-based database function
      const { data, error: rpcError } = await supabase.rpc('set_usage_stats_by_email', {
        user_email: userEmail,
        images_count: imagesCount,
        storage_bytes: storageBytes,
        target_month: targetMonth || null
      })

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`)
      }

      const result = data as SetUsageResult

      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred')
      }

      // Refresh usage stats if it's for the current user
      const { user } = useAuthStore.getState()
      if (user && user.email === userEmail) {
        await refreshUsageStats()
      }

      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set usage stats'
      setError(errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setIsLoading(false)
    }
  }, [refreshUsageStats])

  const resetUserUsage = useCallback(async (
    userId: string,
    targetMonth?: string
  ): Promise<SetUsageResult> => {
    return setUserUsage(userId, 0, 0, targetMonth)
  }, [setUserUsage])

  const resetUserUsageByEmail = useCallback(async (
    userEmail: string,
    targetMonth?: string
  ): Promise<SetUsageResult> => {
    return setUserUsageByEmail(userEmail, 0, 0, targetMonth)
  }, [setUserUsageByEmail])

  const getUserUsageHistory = useCallback(async (
    userId: string,
    monthsBack: number = 3
  ): Promise<UsageHistoryEntry[]> => {
    setIsLoading(true)
    setError(null)

    try {
      if (!userId) {
        throw new Error('User ID is required')
      }

      if (monthsBack < 1 || monthsBack > 12) {
        throw new Error('Months back must be between 1 and 12')
      }

      const { data, error: rpcError } = await supabase.rpc('get_usage_history', {
        user_uuid: userId,
        months_back: monthsBack
      })

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`)
      }

      return data || []

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get usage history'
      setError(errorMessage)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const bulkResetUsage = useCallback(async (
    targetMonth?: string
  ): Promise<BulkResetResult> => {
    setIsLoading(true)
    setError(null)

    try {
      if (targetMonth && !/^\d{4}-\d{2}$/.test(targetMonth)) {
        throw new Error('Invalid month format. Use YYYY-MM (e.g., 2025-01)')
      }

      // This is a destructive operation, so we should warn about it
      console.warn('Performing bulk reset of usage stats for month:', targetMonth || 'current')

      const { data, error: rpcError } = await supabase.rpc('bulk_reset_usage_stats', {
        target_month: targetMonth || null
      })

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`)
      }

      const result = data as BulkResetResult

      if (!result.success) {
        throw new Error(result.error || 'Unknown error occurred')
      }

      // Refresh usage stats for current user
      await refreshUsageStats()

      return result

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to bulk reset usage stats'
      setError(errorMessage)
      
      return {
        success: false,
        error: errorMessage
      }
    } finally {
      setIsLoading(false)
    }
  }, [refreshUsageStats])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Utility functions for formatting
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }, [])

  const formatMonth = useCallback((monthStr: string): string => {
    try {
      const [year, month] = monthStr.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    } catch {
      return monthStr
    }
  }, [])

  const getCurrentMonth = useCallback((): string => {
    return new Date().toISOString().slice(0, 7) // Returns YYYY-MM format
  }, [])

  const getUserByEmail = useCallback(async (userEmail: string): Promise<UserSearchResult | null> => {
    setIsLoading(true)
    setError(null)

    try {
      if (!userEmail) {
        throw new Error('User email is required')
      }

      const { data, error: rpcError } = await supabase.rpc('get_user_by_email', {
        user_email: userEmail
      })

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`)
      }

      return data && data.length > 0 ? data[0] : null

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get user by email'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const searchUsersByEmail = useCallback(async (
    emailPattern: string,
    limit: number = 10
  ): Promise<UserSearchResult[]> => {
    setIsLoading(true)
    setError(null)

    try {
      if (!emailPattern) {
        throw new Error('Email pattern is required')
      }

      const { data, error: rpcError } = await supabase.rpc('search_users_by_email', {
        email_pattern: emailPattern,
        limit_count: limit
      })

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`)
      }

      return data || []

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search users'
      setError(errorMessage)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getTopUsersByUsage = useCallback(async (
    targetMonth?: string,
    limit: number = 10,
    orderBy: 'images' | 'storage' = 'images'
  ): Promise<TopUserResult[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_top_users_by_usage', {
        target_month: targetMonth || null,
        limit_count: limit,
        order_by: orderBy
      })

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`)
      }

      return data || []

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get top users'
      setError(errorMessage)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getUsageStatsOverview = useCallback(async (
    targetMonth?: string
  ): Promise<UsageStatsOverview | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_usage_stats_by_month', {
        target_month: targetMonth || null
      })

      if (rpcError) {
        throw new Error(`Database error: ${rpcError.message}`)
      }

      return data && data.length > 0 ? data[0] : null

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get usage stats overview'
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    // Main functions
    setUserUsage,
    setUserUsageByEmail,
    resetUserUsage,
    resetUserUsageByEmail,
    getUserUsageHistory,
    bulkResetUsage,
    
    // New email-based functions
    getUserByEmail,
    searchUsersByEmail,
    getTopUsersByUsage,
    getUsageStatsOverview,
    
    // State
    isLoading,
    error,
    clearError,
    
    // Utilities
    formatFileSize,
    formatMonth,
    getCurrentMonth
  }
}

// Types are already exported above