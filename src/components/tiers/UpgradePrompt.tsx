import { useAuthStore } from '@/lib/auth-store'
import { TIER_LIMITS } from '@/lib/tier-config'
import type { UserTier } from '@/types/auth'

interface UpgradePromptProps {
  currentTier: UserTier
  suggestedTier?: UserTier
  reason?: string
  onUpgrade?: (tier: UserTier) => void
  onDismiss?: () => void
  className?: string
}

const TIER_PRICING = {
  pro: { price: 29, period: 'month' },
  team: { price: 149, period: 'month' },
  enterprise: { price: 499, period: 'month' }
}

export function UpgradePrompt({ 
  currentTier, 
  suggestedTier = 'pro', 
  reason,
  onUpgrade,
  onDismiss,
  className = ''
}: UpgradePromptProps) {
  const { userTier } = useAuthStore()
  
  const currentLimits = TIER_LIMITS[currentTier]
  const suggestedLimits = TIER_LIMITS[suggestedTier]
  const pricing = TIER_PRICING[suggestedTier as keyof typeof TIER_PRICING]

  const formatNumber = (num: number) => num.toLocaleString()

  const features = [
    {
      name: 'Images per month',
      current: formatNumber(currentLimits.maxImagesPerMonth),
      upgraded: formatNumber(suggestedLimits.maxImagesPerMonth),
      icon: '📸'
    },
    {
      name: 'Max file size',
      current: `${(currentLimits.maxFileSize / (1024 * 1024)).toFixed(0)}MB`,
      upgraded: `${(suggestedLimits.maxFileSize / (1024 * 1024)).toFixed(0)}MB`,
      icon: '📁'
    },
    {
      name: 'Batch processing',
      current: `${currentLimits.maxBatchSize} files`,
      upgraded: `${suggestedLimits.maxBatchSize} files`,
      icon: '⚡'
    },
    {
      name: 'Processing speed',
      current: '2-3 minutes',
      upgraded: suggestedTier === 'pro' ? '10-15 seconds' : suggestedTier === 'team' ? '3-5 seconds' : '1-2 seconds',
      icon: '🚀'
    },
    {
      name: 'Supported formats',
      current: 'JPEG, PNG',
      upgraded: suggestedTier === 'pro' ? 'All formats' : 'All + early access',
      icon: '🎨'
    }
  ]

  if (suggestedTier === 'team' || suggestedTier === 'enterprise') {
    features.push({
      name: 'Team features',
      current: '❌',
      upgraded: '✅',
      icon: '👥'
    })
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Upgrade to {suggestedTier.charAt(0).toUpperCase() + suggestedTier.slice(1)}
            </h3>
            {reason && (
              <p className="text-sm text-gray-600 mt-1">{reason}</p>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        <div className="mb-6">
          <div className="flex items-baseline">
            {pricing && (
              <>
                <span className="text-3xl font-bold text-gray-900">${pricing.price}</span>
                <span className="text-gray-600 ml-1">/{pricing.period}</span>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900">What you'll get:</h4>
          
          <div className="space-y-3">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-lg mr-3">{feature.icon}</span>
                  <span className="text-sm text-gray-700">{feature.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">{feature.current}</span>
                  <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="text-sm font-medium text-green-600">{feature.upgraded}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            ✨ 30-day money-back guarantee
          </div>
          <div className="flex space-x-3">
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Maybe Later
              </button>
            )}
            <button
              onClick={() => onUpgrade?.(suggestedTier)}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Upgrade Now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}