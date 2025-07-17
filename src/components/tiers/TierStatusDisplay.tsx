import { useAuthStore } from '@/lib/auth-store'
import { formatFileSize } from '@/lib/tier-config'
import { useNavigate } from 'react-router-dom'

interface TierStatusDisplayProps {
  className?: string
}

export function TierStatusDisplay({ className = '' }: TierStatusDisplayProps) {
  const { userTier, currentUsage, tierLimits } = useAuthStore()
  const navigate = useNavigate()

  if (!tierLimits || !currentUsage) {
    return null
  }

  const usagePercentage = (currentUsage.imagesProcessed / tierLimits.maxImagesPerMonth) * 100
  const isNearLimit = usagePercentage > 80
  const isAtLimit = usagePercentage >= 100

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'free': return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'pro': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'team': return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'enterprise': return 'bg-gold-100 text-gold-800 border-gold-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getTierDisplayName = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1)
  }

  return (
    <div className={`bg-white rounded-lg border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Current Plan</h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTierColor(userTier)}`}>
          {getTierDisplayName(userTier)}
        </span>
      </div>

      <div className="space-y-3">
        {/* Monthly Images Usage */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Images this month</span>
            <span className={`font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-900'}`}>
              {currentUsage.imagesProcessed.toLocaleString()} / {tierLimits.maxImagesPerMonth.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Plan Features */}
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
          <div>
            <span className="block font-medium text-gray-900">Max File Size</span>
            {formatFileSize(tierLimits.maxFileSize)}
          </div>
          <div>
            <span className="block font-medium text-gray-900">Batch Size</span>
            {tierLimits.maxBatchSize} files
          </div>
        </div>

        {/* Upgrade prompt if needed */}
        {(isNearLimit || isAtLimit) && userTier === 'free' && (
          <div className={`p-3 rounded-md ${isAtLimit ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-start">
              <div className={`flex-shrink-0 ${isAtLimit ? 'text-red-400' : 'text-yellow-400'}`}>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h4 className={`text-sm font-medium ${isAtLimit ? 'text-red-800' : 'text-yellow-800'}`}>
                  {isAtLimit ? 'Monthly limit reached' : 'Approaching monthly limit'}
                </h4>
                <p className={`text-sm mt-1 ${isAtLimit ? 'text-red-700' : 'text-yellow-700'}`}>
                  {isAtLimit 
                    ? 'Upgrade to Pro to process more images this month.'
                    : 'Consider upgrading to Pro for unlimited processing.'
                  }
                </p>
                <button 
                  onClick={() => navigate('/plans')}
                  className={`mt-2 text-sm font-medium ${isAtLimit ? 'text-red-600 hover:text-red-500' : 'text-yellow-600 hover:text-yellow-500'} underline`}
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}