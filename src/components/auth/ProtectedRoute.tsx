import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { EmailVerificationScreen } from './EmailVerificationScreen'
import { ForgotPasswordForm } from './ForgotPasswordForm'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, needsEmailVerification } = useAuthStore()
  const [isRegistering, setIsRegistering] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  if (isLoading) {
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

  return <>{children}</>
}