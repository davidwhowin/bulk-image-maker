import { useState } from 'react'
import { Check, Zap, Users, Building2 } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { TIER_LIMITS } from '@/lib/tier-config'
import type { UserTier } from '@/types/tiers'

interface PlanFeature {
  name: string
  included: boolean
}

interface Plan {
  id: UserTier
  name: string
  description: string
  price: string
  originalPrice?: string
  features: PlanFeature[]
  icon: React.ComponentType<any>
  popular?: boolean
  buttonText: string
  buttonVariant: 'primary' | 'secondary' | 'outline'
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out our image optimization',
    price: 'Free',
    features: [
      { name: '100 images per month', included: true },
      { name: '5MB max file size', included: true },
      { name: '1 image batch processing', included: true },
      { name: 'JPEG & PNG formats', included: true },
      { name: 'Basic processing speed', included: true },
      { name: 'Email support', included: false },
      { name: 'Team features', included: false },
      { name: 'Priority support', included: false }
    ],
    icon: Zap,
    buttonText: 'Current Plan',
    buttonVariant: 'outline'
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For professionals who need more power',
    price: 'Free',
    originalPrice: '$29/month',
    features: [
      { name: '3,000 images per month', included: true },
      { name: '25MB max file size', included: true },
      { name: '10 image batch processing', included: true },
      { name: 'All image formats', included: true },
      { name: 'Fast processing (10-15s)', included: true },
      { name: 'Email support', included: true },
      { name: 'Team features', included: false },
      { name: 'Priority support', included: false }
    ],
    icon: Zap,
    popular: true,
    buttonText: 'Upgrade to Pro',
    buttonVariant: 'primary'
  },
  {
    id: 'team',
    name: 'Team',
    description: 'Perfect for teams and small businesses',
    price: 'Free',
    originalPrice: '$149/month',
    features: [
      { name: '15,000 images per month', included: true },
      { name: '100MB max file size', included: true },
      { name: '50 image batch processing', included: true },
      { name: 'All formats + early access', included: true },
      { name: 'Very fast processing (3-5s)', included: true },
      { name: 'Live chat support', included: true },
      { name: 'Team collaboration', included: true },
      { name: 'Priority support', included: false }
    ],
    icon: Users,
    buttonText: 'Upgrade to Team',
    buttonVariant: 'primary'
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    price: 'Free',
    originalPrice: '$499/month',
    features: [
      { name: '75,000 images per month', included: true },
      { name: '500MB max file size', included: true },
      { name: '500 image batch processing', included: true },
      { name: 'All formats + custom', included: true },
      { name: 'Ultra-fast processing (1-2s)', included: true },
      { name: 'Phone + dedicated manager', included: true },
      { name: 'Advanced team features', included: true },
      { name: '24/7 priority support', included: true }
    ],
    icon: Building2,
    buttonText: 'Upgrade to Enterprise',
    buttonVariant: 'primary'
  }
]

export default function PlansPage() {
  const { userTier, upgradeUserTier, currentUsage, tierLimits, error } = useAuthStore()
  const [upgrading, setUpgrading] = useState<UserTier | null>(null)

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(0)} ${units[unitIndex]}`
  }

  const handleUpgrade = async (targetTier: UserTier) => {
    if (targetTier === userTier) return

    setUpgrading(targetTier)
    try {
      console.log(`Attempting to upgrade to ${targetTier}...`)
      const success = await upgradeUserTier(targetTier)
      if (success) {
        // Upgrade successful - the store will update automatically
        console.log(`Successfully upgraded to ${targetTier}`)
      } else {
        console.error('Upgrade failed. Error details:', error)
        alert(`Upgrade failed: ${error?.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Upgrade error:', error)
      alert(`Upgrade error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setUpgrading(null)
    }
  }

  const getCurrentPlanStatus = (planId: UserTier) => {
    if (planId === userTier) return 'current'
    if (plans.findIndex(p => p.id === planId) < plans.findIndex(p => p.id === userTier)) return 'downgrade'
    return 'upgrade'
  }

  const getButtonText = (plan: Plan) => {
    const status = getCurrentPlanStatus(plan.id)
    if (status === 'current') return 'Current Plan'
    if (status === 'downgrade') return `Downgrade to ${plan.name}`
    return `Upgrade to ${plan.name}`
  }

  const getButtonVariant = (plan: Plan): 'primary' | 'secondary' | 'outline' => {
    const status = getCurrentPlanStatus(plan.id)
    if (status === 'current') return 'outline'
    if (status === 'downgrade') return 'secondary'
    return 'primary'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Optimize more images with the perfect plan for your needs
          </p>
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
            🎉 All plans are currently FREE for testing!
          </div>
        </div>

        {/* Current Usage Stats */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Usage</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Images This Month</div>
              <div className="text-2xl font-bold text-blue-900">
                {currentUsage?.imagesProcessed || 0} / {tierLimits?.maxImagesPerMonth || 0}
              </div>
              <div className="text-sm text-blue-600">
                {Math.round(((currentUsage?.imagesProcessed || 0) / (tierLimits?.maxImagesPerMonth || 1)) * 100)}% used
              </div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium">Current Plan</div>
              <div className="text-2xl font-bold text-purple-900 capitalize">{userTier}</div>
              <div className="text-sm text-purple-600">
                Max file size: {formatFileSize(tierLimits?.maxFileSize || 0)}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Batch Processing</div>
              <div className="text-2xl font-bold text-green-900">
                {tierLimits?.maxBatchSize || 0} images
              </div>
              <div className="text-sm text-green-600">Per batch</div>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const IconComponent = plan.icon
            const status = getCurrentPlanStatus(plan.id)
            const isUpgrading = upgrading === plan.id

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-xl shadow-sm border-2 p-6 ${
                  plan.popular ? 'border-blue-500 shadow-lg scale-105' : 'border-gray-200'
                } ${status === 'current' ? 'ring-2 ring-green-500' : ''}`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Current Plan Badge */}
                {status === 'current' && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Current
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <IconComponent className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-600">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    {plan.originalPrice && (
                      <span className="text-lg text-gray-500 line-through">{plan.originalPrice}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <Check 
                        className={`h-4 w-4 ${
                          feature.included ? 'text-green-500' : 'text-gray-300'
                        }`} 
                      />
                      <span 
                        className={`text-sm ${
                          feature.included ? 'text-gray-700' : 'text-gray-400'
                        }`}
                      >
                        {feature.name}
                      </span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={status === 'current' || isUpgrading}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    getButtonVariant(plan) === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                      : getButtonVariant(plan) === 'secondary'
                      ? 'bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400'
                      : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 disabled:bg-gray-100'
                  }`}
                >
                  {isUpgrading ? 'Processing...' : getButtonText(plan)}
                </button>
              </div>
            )
          })}
        </div>

        {/* Testing Note */}
        <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Testing Mode</h3>
          <p className="text-yellow-700 mb-4">
            All plans are currently free for testing. You can upgrade between any tier to test the functionality.
            To change pricing later, update the plans array in <code className="bg-yellow-100 px-2 py-1 rounded">src/pages/PlansPage.tsx</code>.
          </p>
          <div className="text-sm text-yellow-600">
            <strong>To enable real pricing:</strong> Replace "Free" with actual prices and integrate with your payment provider.
          </div>
        </div>
      </div>
    </div>
  )
}