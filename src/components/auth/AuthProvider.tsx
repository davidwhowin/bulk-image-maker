import { useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthErrorBoundary } from './AuthErrorBoundary'
import { ResetPasswordHandler } from './ResetPasswordHandler'

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <AuthErrorBoundary>
      <ResetPasswordHandler>
        <ProtectedRoute>
          {children}
        </ProtectedRoute>
      </ResetPasswordHandler>
    </AuthErrorBoundary>
  )
}