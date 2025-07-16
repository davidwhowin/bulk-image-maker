import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAuthStore } from '../auth-store'
import type { User } from '@/types/auth'

// Mock Supabase
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      resend: vi.fn(),
      updateUser: vi.fn()
    }
  }
}))

describe('Auth Store - Tier Integration', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('Tier-related actions', () => {
    it('should initialize with default tier state', () => {
      const { result } = renderHook(() => useAuthStore())
      
      expect(result.current.userTier).toBe('free')
      expect(result.current.currentUsage).toBeNull()
      expect(result.current.tierLimits).toBeNull()
    })

    it('should check file upload limits for authenticated user', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      // Mock authenticated user
      const mockUser: User = {
        id: 'test-user',
        email: 'test@example.com',
        userTier: 'free',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      const testFiles = [
        new File(['test'], 'test1.jpg', { type: 'image/jpeg', size: 1024 * 1024 }) // 1MB
      ]

      const limitResult = await result.current.checkFileUploadLimits(testFiles)
      
      expect(limitResult.canProcess).toBe(true)
      expect(limitResult.upgradeRequired).toBe(false)
    })

    it('should reject files for unauthenticated user', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      // Ensure user is not set (unauthenticated)
      act(() => {
        result.current.setUser(null)
      })
      
      const testFiles = [
        new File(['test'], 'test1.jpg', { type: 'image/jpeg' })
      ]

      const limitResult = await result.current.checkFileUploadLimits(testFiles)
      
      expect(limitResult.canProcess).toBe(false)
      expect(limitResult.upgradeRequired).toBe(true)
      expect(limitResult.message).toContain('log in')
    })

    it('should update usage stats for authenticated user', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      // Mock authenticated user
      const mockUser: User = {
        id: 'test-user-usage',
        email: 'test@example.com',
        userTier: 'free',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      await act(async () => {
        await result.current.updateUsageStats(5, 1024 * 1024 * 5) // 5 images, 5MB
      })

      expect(result.current.currentUsage).toBeDefined()
      expect(result.current.currentUsage?.imagesProcessed).toBe(5)
      expect(result.current.currentUsage?.storageUsed).toBe(1024 * 1024 * 5)
    })

    it('should refresh usage stats and tier limits', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      // Mock authenticated user
      const mockUser: User = {
        id: 'test-user-refresh',
        email: 'test@example.com',
        userTier: 'pro',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      await act(async () => {
        await result.current.refreshUsageStats()
      })

      expect(result.current.currentUsage).toBeDefined()
      expect(result.current.tierLimits).toBeDefined()
      expect(result.current.tierLimits?.maxImagesPerMonth).toBe(3000) // Pro tier limit
    })

    it('should get tier limits for current user', () => {
      const { result } = renderHook(() => useAuthStore())
      
      act(() => {
        result.current.setUserTier('team')
      })

      const limits = result.current.getTierLimits()
      
      expect(limits).toBeDefined()
      expect(limits?.maxImagesPerMonth).toBe(15000) // Team tier limit
      expect(limits?.maxBatchSize).toBe(50)
      expect(limits?.teamFeatures).toBe(true)
    })
  })

  describe('File limit checking scenarios', () => {
    it('should reject oversized files for free tier', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      const mockUser: User = {
        id: 'test-user-oversize',
        email: 'test@example.com',
        userTier: 'free',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      const largeFile = new File(['x'.repeat(10 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg',
        size: 10 * 1024 * 1024 // 10MB, exceeds free tier 5MB limit
      })

      const limitResult = await result.current.checkFileUploadLimits([largeFile])
      
      expect(limitResult.canProcess).toBe(false)
      expect(limitResult.limitType).toBe('fileSize')
      expect(limitResult.upgradeRequired).toBe(true)
    })

    it('should reject unsupported formats for free tier', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      const mockUser: User = {
        id: 'test-user-format',
        email: 'test@example.com',
        userTier: 'free',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      const webpFile = new File(['test'], 'test.webp', { 
        type: 'image/webp',
        size: 1024 * 1024 // 1MB, within size limit but unsupported format
      })

      const limitResult = await result.current.checkFileUploadLimits([webpFile])
      
      expect(limitResult.canProcess).toBe(false)
      expect(limitResult.limitType).toBe('format')
      expect(limitResult.upgradeRequired).toBe(true)
    })

    it('should reject excessive batch size for free tier', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      const mockUser: User = {
        id: 'test-user-batch',
        email: 'test@example.com',
        userTier: 'free',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      const files = Array(5).fill(null).map((_, i) => 
        new File(['test'], `test${i}.jpg`, { type: 'image/jpeg', size: 1024 * 1024 })
      )

      const limitResult = await result.current.checkFileUploadLimits(files)
      
      expect(limitResult.canProcess).toBe(false)
      expect(limitResult.limitType).toBe('batchSize')
      expect(limitResult.upgradeRequired).toBe(true)
    })

    it('should allow larger batches for pro tier', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      const mockUser: User = {
        id: 'test-user-pro-batch',
        email: 'test@example.com',
        userTier: 'pro',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      const files = Array(5).fill(null).map((_, i) => 
        new File(['test'], `test${i}.jpg`, { type: 'image/jpeg', size: 1024 * 1024 })
      )

      const limitResult = await result.current.checkFileUploadLimits(files)
      
      expect(limitResult.canProcess).toBe(true)
      expect(limitResult.upgradeRequired).toBe(false)
    })
  })

  describe('Usage tracking over time', () => {
    it('should accumulate usage within the same month', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      const mockUser: User = {
        id: 'test-user-accumulate',
        email: 'test@example.com',
        userTier: 'free',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      // First batch
      await act(async () => {
        await result.current.updateUsageStats(3, 1024 * 1024 * 3)
      })

      // Second batch
      await act(async () => {
        await result.current.updateUsageStats(2, 1024 * 1024 * 2)
      })

      expect(result.current.currentUsage?.imagesProcessed).toBe(5)
      expect(result.current.currentUsage?.storageUsed).toBe(1024 * 1024 * 5)
    })

    it('should handle monthly usage limit enforcement', async () => {
      const { result } = renderHook(() => useAuthStore())
      
      const mockUser: User = {
        id: 'test-user-monthly',
        email: 'test@example.com',
        userTier: 'free',
        createdAt: new Date().toISOString()
      }

      act(() => {
        result.current.setUser(mockUser)
      })

      // Process 99 images (approaching limit)
      await act(async () => {
        await result.current.updateUsageStats(99, 1024 * 1024 * 99)
      })

      // Try to process 1 more within batch limit but would exceed monthly limit
      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg', size: 1024 * 1024 })]

      const limitResult = await result.current.checkFileUploadLimits(files)
      
      expect(limitResult.canProcess).toBe(true) // Should allow since 99 + 1 = 100 (exactly at limit)
      
      // Now try to process 1 more (would exceed limit since already at 99 + 1 = 100)
      await act(async () => {
        await result.current.updateUsageStats(1, 1024 * 1024) // Add the previous file
      })
      
      const moreFiles = [new File(['test'], 'test-exceed.jpg', { type: 'image/jpeg', size: 1024 * 1024 })]

      const limitResult2 = await result.current.checkFileUploadLimits(moreFiles)
      
      expect(limitResult2.canProcess).toBe(false)
      expect(limitResult2.limitType).toBe('images')
      expect(limitResult2.remainingImages).toBe(0) // 100 - 100
    })
  })
})