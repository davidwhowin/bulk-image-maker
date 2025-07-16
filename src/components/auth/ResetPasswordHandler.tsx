import { useEffect, useState } from 'react'
import { ResetPasswordForm } from './ResetPasswordForm'

interface ResetPasswordHandlerProps {
  children: React.ReactNode
}

export function ResetPasswordHandler({ children }: ResetPasswordHandlerProps) {
  const [isResetPasswordFlow, setIsResetPasswordFlow] = useState(false)
  const [isCheckingResetFlow, setIsCheckingResetFlow] = useState(true)

  useEffect(() => {
    // Check if we're in a password reset flow
    const urlParams = new URLSearchParams(window.location.search)
    const isResetFlow = window.location.pathname === '/reset-password' || 
                       urlParams.has('type') && urlParams.get('type') === 'recovery'
    
    setIsResetPasswordFlow(isResetFlow)
    setIsCheckingResetFlow(false)
  }, [])

  const handleResetSuccess = () => {
    // Clear the URL parameters and redirect to main app
    window.history.replaceState({}, document.title, window.location.pathname)
    setIsResetPasswordFlow(false)
  }

  if (isCheckingResetFlow) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (isResetPasswordFlow) {
    return <ResetPasswordForm onSuccess={handleResetSuccess} />
  }

  return <>{children}</>
}