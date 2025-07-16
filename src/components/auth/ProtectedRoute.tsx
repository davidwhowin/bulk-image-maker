import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { supabase } from '@/lib/supabase'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { EmailVerificationScreen } from './EmailVerificationScreen'
import { ForgotPasswordForm } from './ForgotPasswordForm'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  fallback?: React.ReactNode
}

export function ProtectedRoute({ children, requireAdmin = false, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, needsEmailVerification, user } = useAuthStore()
  const [isRegistering, setIsRegistering] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [adminCheckLoading, setAdminCheckLoading] = useState(false)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user || !requireAdmin) {
        setIsAdmin(false)
        return
      }

      // Only check if we haven't checked yet or admin status is null
      if (isAdmin !== null) return

      setAdminCheckLoading(true)
      try {
        const { data, error } = await supabase.rpc('is_admin')
        
        if (error) {
          console.error('Error checking admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(data || false)
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setAdminCheckLoading(false)
      }
    }

    checkAdminStatus()
  }, [user, requireAdmin]) // Keep dependencies but add null check above

  if (isLoading || (requireAdmin && adminCheckLoading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div data-testid="auth-loading" className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Show email verification screen if needed
  if (needsEmailVerification) {
    return <EmailVerificationScreen />
  }

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <ForgotPasswordForm onBackToLogin={() => setShowForgotPassword(false)} />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="flex justify-center mb-6">
              <img
                className="h-12 w-auto"
                src="data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-4.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z' /%3e%3c/svg%3e"
                alt="Bulk Image Optimizer"
              />
            </div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              {isRegistering ? 'Create your account' : 'Sign in to your account'}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {isRegistering 
                ? 'Get started with professional image optimization'
                : 'Access your professional image optimization tools'
              }
            </p>
          </div>

          {/* Auth Mode Toggle */}
          <div className="flex justify-center">
            <div className="bg-gray-100 p-1 rounded-lg inline-flex">
              <button
                onClick={() => setIsRegistering(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !isRegistering
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsRegistering(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isRegistering
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Auth Forms */}
          {isRegistering ? (
            <RegisterForm />
          ) : (
            <LoginForm 
              onSwitchToRegister={() => setIsRegistering(true)}
              onForgotPassword={() => setShowForgotPassword(true)}
            />
          )}

          {/* Additional Links */}
          <div className="text-center">
            {isRegistering ? (
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <button
                  onClick={() => setIsRegistering(false)}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign in here
                </button>
              </p>
            ) : (
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button
                  onClick={() => setIsRegistering(true)}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Sign up for free
                </button>
              </p>
            )}
          </div>

          {/* Features Preview */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              {isRegistering ? '🚀 Get Started with:' : '✨ Features include:'}
            </h3>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Bulk image compression and optimization</li>
              <li>• Modern format conversion (WebP, AVIF, JPEG XL)</li>
              <li>• Folder structure preservation</li>
              <li>• Professional quality controls</li>
              {isRegistering && (
                <li className="text-blue-600 font-medium">• Free tier: 100 images/month</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Authenticated but not admin (when admin required)
  if (requireAdmin && isAdmin === false) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md border border-gray-200 p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">
              You don't have permission to access this page. Administrator privileges are required.
            </p>
          </div>
          
          <div className="space-y-3">
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Home
            </button>
            <button 
              onClick={() => window.history.back()}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
            >
              Go Back
            </button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              If you believe you should have access, please contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}