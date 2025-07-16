import { useAuthStore } from '@/lib/auth-store'
import { useNavigate, useLocation } from 'react-router-dom'

export function AuthHeader() {
  const { user, logout, userTier } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) return null

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800'
      case 'pro': return 'bg-blue-100 text-blue-800'
      case 'team': return 'bg-purple-100 text-purple-800'
      case 'enterprise': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const isPlansPage = location.pathname === '/plans'

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <button
              onClick={() => navigate('/')}
              className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              Bulk Image Optimizer
            </button>
            
            <nav className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className={`text-sm font-medium transition-colors ${
                  !isPlansPage ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => navigate('/plans')}
                className={`text-sm font-medium transition-colors ${
                  isPlansPage ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Plans
              </button>
            </nav>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-700">{user.email}</span>
              <button
                onClick={() => navigate('/plans')}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize cursor-pointer transition-colors hover:opacity-80 ${getTierBadgeColor(userTier)}`}
                title="Click to view and manage your plan"
              >
                {userTier}
              </button>
            </div>
            
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}