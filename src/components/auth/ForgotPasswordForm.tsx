import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'

interface ForgotPasswordFormProps {
  onBackToLogin: () => void
}

export function ForgotPasswordForm({ onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  
  const { requestPasswordReset, isLoading, error } = useAuthStore()

  // Check for persistent success state on mount
  useEffect(() => {
    const savedResetState = localStorage.getItem('password-reset-success')
    if (savedResetState) {
      try {
        const { email: savedEmail, timestamp } = JSON.parse(savedResetState)
        // Show message if it's less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setEmail(savedEmail)
          setEmailSent(true)
          setShowSuccessMessage(true)
        } else {
          // Clear expired state
          localStorage.removeItem('password-reset-success')
        }
      } catch {
        localStorage.removeItem('password-reset-success')
      }
    }
  }, [])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!email) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm() || cooldown > 0) return
    
    setIsSubmitting(true)
    try {
      await requestPasswordReset(email)
      
      // Show success message - auth store handles security properly
      setEmailSent(true)
      setShowSuccessMessage(true)
      setErrors({})
      
      // Save success state to localStorage for persistence across refreshes
      localStorage.setItem('password-reset-success', JSON.stringify({
        email,
        timestamp: Date.now()
      }))
      
      // Start cooldown timer
      setCooldown(60)
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      console.error('Password reset failed:', error)
      // The error will be shown from the auth store error state
      
      // If it's a rate limit error, start cooldown anyway
      if (error instanceof Error && error.message.includes('rate limit')) {
        setCooldown(60)
        const timer = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (emailSent) {
    return (
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6">
          {/* Email Icon */}
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Password reset email sent
          </h2>
          <p className="text-sm text-gray-600 mb-1">
            We've sent a password reset link to
          </p>
          <p className="text-lg font-medium text-blue-600 mb-3">
            {email}
          </p>
          <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
            <p className="text-sm text-green-800 font-medium">
              ✅ Email sent successfully!
            </p>
            <p className="text-xs text-green-700 mt-1">
              Check your inbox and click the reset link to create a new password.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">
                What's next?
              </h4>
              <div className="mt-1 text-sm text-blue-700">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the password reset link in the email</li>
                  <li>Create a new password when prompted</li>
                  <li>Sign in with your new password</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem('password-reset-success')
            onBackToLogin()
          }}
          className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          ← Back to sign in
        </button>

        <div className="text-center mt-4">
          <p className="text-xs text-gray-500">
            Didn't receive the email? Check your spam folder or contact support.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Reset your password
        </h2>
        <p className="text-sm text-gray-600">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your email address"
            autoComplete="email"
          />
          {errors.email && (
            <p className="mt-1 text-sm text-red-600">{errors.email}</p>
          )}
        </div>

        {/* Success Display */}
        {showSuccessMessage && !error && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-green-800">✅ Password reset email sent!</h4>
                <p className="text-sm text-green-700 mt-1">
                  Check your email for the password reset link.
                  {cooldown > 0 && ` You can request another in ${cooldown} seconds.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-red-800">Reset failed</h4>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || isLoading || cooldown > 0}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting || isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending reset email...
            </>
          ) : cooldown > 0 ? (
            `Wait ${cooldown}s before trying again`
          ) : (
            '📧 Send reset email'
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('password-reset-success')
            onBackToLogin()
          }}
          className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          ← Back to sign in
        </button>
      </form>

      <div className="text-center mt-6">
        <p className="text-xs text-gray-500">
          Remember your password? <button onClick={() => {
            localStorage.removeItem('password-reset-success')
            onBackToLogin()
          }} className="text-blue-600 hover:text-blue-500 font-medium">Sign in</button>
        </p>
      </div>
    </div>
  )
}