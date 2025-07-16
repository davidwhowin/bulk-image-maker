import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useAdminUsageControls } from '../useAdminUsageControls'

// Mock Supabase
const mockRpc = vi.fn()
const mockSupabase = {
  rpc: mockRpc
}

// Mock auth store
const mockRefreshUsageStats = vi.fn()
const mockGetState = vi.fn(() => ({
  user: { id: 'test-user-id' }
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}))

vi.mock('@/lib/auth-store', () => ({
  useAuthStore: {
    getState: mockGetState
  }
}))

describe('useAdminUsageControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRefreshUsageStats.mockResolvedValue(undefined)
  })

  describe('setUserUsage', () => {
    it('should successfully set user usage', async () => {
      const mockResult = {
        success: true,
        user_id: 'test-user-id',
        month: '2025-01',
        previous_images: 0,
        new_images: 50,
        previous_storage: 0,
        new_storage: 1048576,
        updated_at: '2025-01-16T12:00:00Z'
      }

      mockRpc.mockResolvedValue({ data: mockResult, error: null })

      const { result } = renderHook(() => useAdminUsageControls())

      let response
      await act(async () => {
        response = await result.current.setUserUsage('test-user-id', 50, 1048576)
      })

      expect(mockRpc).toHaveBeenCalledWith('set_usage_stats', {
        user_uuid: 'test-user-id',
        images_count: 50,
        storage_bytes: 1048576,
        target_month: null
      })

      expect(response).toEqual(mockResult)
      expect(result.current.error).toBeNull()
    })

    it('should handle validation errors', async () => {
      const { result } = renderHook(() => useAdminUsageControls())

      let response
      await act(async () => {
        response = await result.current.setUserUsage('', 50, 1048576)
      })

      expect(response.success).toBe(false)
      expect(response.error).toBe('User ID is required')
      expect(result.current.error).toBe('User ID is required')
    })

    it('should handle negative values', async () => {
      const { result } = renderHook(() => useAdminUsageControls())

      let response
      await act(async () => {
        response = await result.current.setUserUsage('test-user-id', -10, 1048576)
      })

      expect(response.success).toBe(false)
      expect(response.error).toBe('Images count cannot be negative')
    })

    it('should handle database errors', async () => {
      mockRpc.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database connection failed' } 
      })

      const { result } = renderHook(() => useAdminUsageControls())

      let response
      await act(async () => {
        response = await result.current.setUserUsage('test-user-id', 50, 1048576)
      })

      expect(response.success).toBe(false)
      expect(response.error).toBe('Database error: Database connection failed')
    })

    it('should handle function error responses', async () => {
      const mockErrorResult = {
        success: false,
        error: 'User does not exist'
      }

      mockRpc.mockResolvedValue({ data: mockErrorResult, error: null })

      const { result } = renderHook(() => useAdminUsageControls())

      let response
      await act(async () => {
        response = await result.current.setUserUsage('invalid-user-id', 50, 1048576)
      })

      expect(response.success).toBe(false)
      expect(response.error).toBe('User does not exist')
    })
  })

  describe('resetUserUsage', () => {
    it('should reset user usage to zero', async () => {
      const mockResult = {
        success: true,
        user_id: 'test-user-id',
        month: '2025-01',
        previous_images: 100,
        new_images: 0,
        previous_storage: 2097152,
        new_storage: 0,
        updated_at: '2025-01-16T12:00:00Z'
      }

      mockRpc.mockResolvedValue({ data: mockResult, error: null })

      const { result } = renderHook(() => useAdminUsageControls())

      let response
      await act(async () => {
        response = await result.current.resetUserUsage('test-user-id')
      })

      expect(mockRpc).toHaveBeenCalledWith('set_usage_stats', {
        user_uuid: 'test-user-id',
        images_count: 0,
        storage_bytes: 0,
        target_month: null
      })

      expect(response).toEqual(mockResult)
    })
  })

  describe('getUserUsageHistory', () => {
    it('should get user usage history', async () => {
      const mockHistoryData = [
        {
          month: '2025-01',
          images_processed: 50,
          storage_used: 1048576,
          last_updated: '2025-01-16T12:00:00Z',
          created_at: '2025-01-01T00:00:00Z'
        },
        {
          month: '2024-12',
          images_processed: 75,
          storage_used: 2097152,
          last_updated: '2024-12-31T12:00:00Z',
          created_at: '2024-12-01T00:00:00Z'
        }
      ]

      mockRpc.mockResolvedValue({ data: mockHistoryData, error: null })

      const { result } = renderHook(() => useAdminUsageControls())

      let response
      await act(async () => {
        response = await result.current.getUserUsageHistory('test-user-id', 6)
      })

      expect(mockRpc).toHaveBeenCalledWith('get_usage_history', {
        user_uuid: 'test-user-id',
        months_back: 6
      })

      expect(response).toEqual(mockHistoryData)
    })

    it('should handle empty history', async () => {
      mockRpc.mockResolvedValue({ data: [], error: null })

      const { result } = renderHook(() => useAdminUsageControls())

      let response
      await act(async () => {
        response = await result.current.getUserUsageHistory('test-user-id')
      })

      expect(response).toEqual([])
    })
  })

  describe('utility functions', () => {
    it('should format file sizes correctly', () => {
      const { result } = renderHook(() => useAdminUsageControls())

      expect(result.current.formatFileSize(0)).toBe('0 B')
      expect(result.current.formatFileSize(1024)).toBe('1.0 KB')
      expect(result.current.formatFileSize(1048576)).toBe('1.0 MB')
      expect(result.current.formatFileSize(1073741824)).toBe('1.0 GB')
    })

    it('should format months correctly', () => {
      const { result } = renderHook(() => useAdminUsageControls())

      expect(result.current.formatMonth('2025-01')).toBe('January 2025')
      expect(result.current.formatMonth('2024-12')).toBe('December 2024')
    })

    it('should get current month in correct format', () => {
      const { result } = renderHook(() => useAdminUsageControls())
      const currentMonth = result.current.getCurrentMonth()
      
      expect(currentMonth).toMatch(/^\d{4}-\d{2}$/)
    })
  })

  describe('error handling', () => {
    it('should clear errors', () => {
      const { result } = renderHook(() => useAdminUsageControls())

      act(() => {
        // Simulate an error by calling setUserUsage with invalid data
        result.current.setUserUsage('', 0, 0)
      })

      // Error should be set
      expect(result.current.error).toBeTruthy()

      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })
})