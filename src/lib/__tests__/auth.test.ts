import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock Supabase with factory function
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      resend: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn()
    }
  }
}))

import { useAuthStore } from '../auth-store'
import { supabase } from '../supabase'

// Type the mocks
const mockAuth = supabase.auth as any

// Mock successful responses
beforeEach(() => {
  mockAuth.signInWithPassword.mockResolvedValue({
    data: {
      user: {
        id: '123',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00.000Z'
      }
    },
    error: null
  })

  mockAuth.signUp.mockResolvedValue({
    data: {
      user: {
        id: '456',
        email: 'newuser@example.com',
        created_at: '2023-01-01T00:00:00.000Z',
        email_confirmed_at: null // Requires email verification
      }
    },
    error: null
  })

  mockAuth.signOut.mockResolvedValue({
    error: null
  })

  mockAuth.getSession.mockResolvedValue({
    data: { session: null }
  })

  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } }
  })

  mockAuth.resend.mockResolvedValue({ error: null })
  
  mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null })
  
  mockAuth.updateUser.mockResolvedValue({
    data: { user: { id: '123', email: 'test@example.com' } },
    error: null
  })
})

describe('Auth Store', () => {
  beforeEach(() => {
    useAuthStore.getState().reset()
    vi.clearAllMocks()
  })

  it('should initialize with null user and loading state', () => {
    const { result } = renderHook(() => useAuthStore())
    
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(true)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.needsEmailVerification).toBe(false)
    expect(result.current.pendingVerificationEmail).toBeNull()
  })

  it('should handle login with email and password', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    await act(async () => {
      await result.current.login('test@example.com', 'password123')
    })
    
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user?.email).toBe('test@example.com')
  })

  it('should handle registration with email and password', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    await act(async () => {
      await result.current.register('newuser@example.com', 'password123')
    })
    
    // Should require email verification (not immediately authenticated)
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.needsEmailVerification).toBe(true)
    expect(result.current.pendingVerificationEmail).toBe('newuser@example.com')
  })

  it('should handle logout', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // First login
    await act(async () => {
      await result.current.login('test@example.com', 'password123')
    })
    
    // Then logout
    await act(async () => {
      await result.current.logout()
    })
    
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('should handle auth errors properly', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock an error for this test
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid credentials', code: 'invalid_credentials' }
    })
    
    await act(async () => {
      try {
        await result.current.login('invalid@email.com', 'wrongpassword')
      } catch (error: any) {
        expect(error).toBeDefined()
        expect(error.message).toBe('Invalid credentials')
      }
    })
    
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('should set user tier correctly', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // First login a user
    await act(async () => {
      await result.current.login('test@example.com', 'password123')
    })
    
    // Then set user tier
    act(() => {
      result.current.setUserTier('pro')
    })
    
    expect(result.current.userTier).toBe('pro')
    expect(result.current.user?.userTier).toBe('pro')
  })

  it('should track authentication state changes', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    expect(result.current.isLoading).toBe(true)
    
    // Simulate session loading completion
    act(() => {
      result.current.setLoading(false)
    })
    
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle email verification flow', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock registration response without email confirmation
    mockAuth.signUp.mockResolvedValueOnce({
      data: {
        user: {
          id: '123',
          email: 'test@example.com',
          created_at: '2023-01-01T00:00:00.000Z',
          email_confirmed_at: null // Not confirmed
        }
      },
      error: null
    })
    
    await act(async () => {
      await result.current.register('test@example.com', 'password123')
    })
    
    // Should require email verification
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.needsEmailVerification).toBe(true)
    expect(result.current.pendingVerificationEmail).toBe('test@example.com')
    expect(result.current.user).toBeNull()
  })

  it('should handle resend verification email', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock successful resend
    mockAuth.resend.mockResolvedValueOnce({ error: null })
    
    await act(async () => {
      await result.current.resendVerificationEmail('test@example.com')
    })
    
    expect(mockAuth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'test@example.com'
    })
  })

  it('should detect unverified user on login and redirect to verification', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock login failure with email not confirmed error
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Email not confirmed' }
    })
    
    await act(async () => {
      await result.current.login('unverified@example.com', 'password123')
    })
    
    // Should redirect to email verification
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.needsEmailVerification).toBe(true)
    expect(result.current.pendingVerificationEmail).toBe('unverified@example.com')
  })

  it('should show generic error for invalid credentials', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock login failure with invalid credentials
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' }
    })
    
    await act(async () => {
      try {
        await result.current.login('user@example.com', 'wrongpassword')
      } catch (error: any) {
        expect(error.message).toContain('Invalid email or password')
        expect(error.message).toContain('Forgot password')
        expect(error.code).toBe('invalid_credentials')
      }
    })
    
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should handle forgot password request', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock successful password reset request
    mockAuth.resetPasswordForEmail = vi.fn().mockResolvedValueOnce({ error: null })
    
    await act(async () => {
      await result.current.requestPasswordReset('test@example.com')
    })
    
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com', {
      redirectTo: `${window.location.origin}/reset-password`
    })
  })

  it('should handle password reset request with user not found (security)', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock password reset with "user not found" error
    mockAuth.resetPasswordForEmail = vi.fn().mockResolvedValueOnce({
      error: { message: 'User not found', code: 'user_not_found' }
    })
    
    await act(async () => {
      // Should not throw error for security reasons (prevent email enumeration)
      await result.current.requestPasswordReset('nonexistent@example.com')
    })
    
    // Should appear successful to user even if email doesn't exist
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle password reset rate limiting', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock rate limit error
    mockAuth.resetPasswordForEmail = vi.fn().mockResolvedValueOnce({
      error: { message: 'For security purposes, you can only request this after 49 seconds.', code: 'rate_limit' }
    })
    
    await act(async () => {
      try {
        await result.current.requestPasswordReset('test@example.com')
      } catch (error: any) {
        expect(error.message).toContain('For security purposes')
      }
    })
    
    // Should show rate limit error to user
    expect(result.current.error?.message).toContain('wait before requesting another')
    expect(result.current.error?.code).toBe('rate_limit')
  })

  it('should handle password update with new password', async () => {
    const { result } = renderHook(() => useAuthStore())
    
    // Mock successful password update
    mockAuth.updateUser = vi.fn().mockResolvedValueOnce({
      data: { user: { id: '123', email: 'test@example.com' } },
      error: null
    })
    
    await act(async () => {
      await result.current.updatePassword('newpassword123')
    })
    
    expect(mockAuth.updateUser).toHaveBeenCalledWith({
      password: 'newpassword123'
    })
  })
})