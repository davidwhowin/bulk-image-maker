import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { subscriptionService, SUBSCRIPTION_PLANS } from '@/lib/subscription-service'
import type { SubscriptionPlan, PlanComparison, UsageBasedRecommendation } from '@/types/subscription'
import type { UserTier } from '@/types/auth'

interface SubscriptionManagerProps {
  onUpgradeSuccess?: (tier: UserTier) => void
  className?: string
}

export function SubscriptionManager({ onUpgradeSuccess, className = '' }: SubscriptionManagerProps) {
  const { 
    userTier, 
    currentUsage, 
    upgradeUserTier, 
    getSubscriptionRecommendation,
    isLoading 
  } = useAuthStore()
  
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<UserTier | null>(null)
  const [planComparison, setPlanComparison] = useState<PlanComparison | null>(null)
  const [recommendation, setRecommendation] = useState<UsageBasedRecommendation | null>(null)
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    loadPlans()
    loadRecommendation()
  }, [userTier, currentUsage])

  const loadPlans = async () => {
    try {
      const availablePlans = await subscriptionService.getAvailablePlans()
      setPlans(availablePlans)
    } catch (error) {
      console.error('Failed to load plans:', error)
    }
  }

  const loadRecommendation = async () => {
    try {
      const rec = await getSubscriptionRecommendation()
      setRecommendation(rec)
    } catch (error) {
      console.error('Failed to load recommendation:', error)
    }
  }

  const handlePlanSelect = async (targetTier: UserTier) => {
    if (targetTier === userTier) return
    
    setSelectedPlan(targetTier)
    
    try {
      const comparison = await subscriptionService.comparePlans(userTier, targetTier)
      setPlanComparison(comparison)
      setShowComparison(true)
    } catch (error) {
      console.error('Failed to compare plans:', error)
    }
  }

  const handleUpgrade = async () => {
    if (!selectedPlan) return
    
    setIsUpgrading(true)
    try {
      const success = await upgradeUserTier(selectedPlan)
      if (success) {
        setShowComparison(false)
        setSelectedPlan(null)
        onUpgradeSuccess?.(selectedPlan)
      }
    } catch (error) {
      console.error('Upgrade failed:', error)
    } finally {
      setIsUpgrading(false)
    }
  }

  const getPlanStatus = (plan: SubscriptionPlan) => {
    if (plan.tier === userTier) return 'current'
    const tierOrder = ['free', 'pro', 'team', 'enterprise']
    const currentIndex = tierOrder.indexOf(userTier)
    const planIndex = tierOrder.indexOf(plan.tier)
    return planIndex > currentIndex ? 'upgrade' : 'downgrade'
  }

  const formatPrice = (price: number) => {
    return price === 0 ? 'Free' : `$${price}/month`
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Recommendation Banner */}
      {recommendation && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-blue-800">
                Recommendation: {recommendation.recommendedTier.charAt(0).toUpperCase() + recommendation.recommendedTier.slice(1)}
              </h3>
              <p className="text-sm text-blue-700 mt-1">{recommendation.reason}</p>
              {recommendation.potentialSavings && (
                <p className="text-sm text-green-700 mt-1">
                  💰 Potential annual savings: ${recommendation.potentialSavings}
                </p>
              )}
              <button
                onClick={() => handlePlanSelect(recommendation.recommendedTier)}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                View {recommendation.recommendedTier} plan →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Current Usage Summary */}
      {currentUsage && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Current Usage</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Images this month:</span>
              <span className="ml-2 font-medium">{currentUsage.imagesProcessed.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Storage used:</span>
              <span className="ml-2 font-medium">{(currentUsage.storageUsed / (1024 * 1024)).toFixed(1)} MB</span>
            </div>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const status = getPlanStatus(plan)
          
          return (
            <div
              key={plan.id}
              className={`relative bg-white border rounded-lg p-6 cursor-pointer transition-all duration-200 ${
                status === 'current' 
                  ? 'border-blue-500 ring-2 ring-blue-200' 
                  : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
              } ${plan.popular ? 'ring-2 ring-blue-400' : ''}`}
              onClick={() => handlePlanSelect(plan.tier)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {status === 'current' && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                
                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">{formatPrice(plan.price)}</span>
                  {plan.price > 0 && <span className="text-gray-600 text-sm">/month</span>}
                </div>

                <ul className="mt-6 space-y-2 text-sm text-left">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {status === 'current' ? (
                    <div className="text-sm text-green-600 font-medium">✓ Your current plan</div>
                  ) : (
                    <button
                      className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        status === 'upgrade'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      disabled={isLoading}
                    >
                      {status === 'upgrade' ? 'Upgrade' : 'Switch to'} {plan.name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Plan Comparison Modal */}
      {showComparison && planComparison && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {planComparison.isUpgrade ? 'Upgrade' : 'Switch'} to {planComparison.targetPlan.name}
              </h3>
              <button
                onClick={() => setShowComparison(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900">Current: {planComparison.currentPlan.name}</h4>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatPrice(planComparison.currentPlan.price)}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900">New: {planComparison.targetPlan.name}</h4>
                  <p className="text-2xl font-bold text-blue-900 mt-2">{formatPrice(planComparison.targetPlan.price)}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Price change:</span>
                  <span className={`font-medium ${planComparison.priceChange > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {planComparison.priceChange > 0 ? '+' : ''}${planComparison.priceChange}/month
                  </span>
                </div>
                {planComparison.prorationAmount && planComparison.prorationAmount > 0 && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-700">Prorated amount:</span>
                    <span className="font-medium">${planComparison.prorationAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  onClick={() => setShowComparison(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpgrade}
                  disabled={isUpgrading}
                  className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpgrading ? 'Processing...' : `Confirm ${planComparison.isUpgrade ? 'Upgrade' : 'Switch'}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}