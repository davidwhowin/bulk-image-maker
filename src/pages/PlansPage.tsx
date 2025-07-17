import { useState, useMemo, useEffect } from 'react'
import { Check, Zap, Users, Building2, CreditCard, Settings } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'
import { useTierConfig } from '@/hooks/useTierConfig'
import { subscriptionService, SUBSCRIPTION_PLANS } from '@/lib/subscription-service'
import type { UserTier } from '@/types/tiers'

interface PlanFeature {
  name: string
  included: boolean
}

interface Plan {
  id: string
  tier: UserTier
  name: string
  description: string
  price: string
  originalPrice?: string
  features: PlanFeature[]
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  popular?: boolean
  buttonText: string
  buttonVariant: 'primary' | 'secondary' | 'outline'
  interval: 'month' | 'year'
  stripePriceId?: string
}

export default function PlansPage() {
  const { userTier, upgradeUserTier, currentUsage, tierLimits, error, user } = useAuthStore()
  const { config, formatFileSize } = useTierConfig()
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month')
  const [canManageSubscription, setCanManageSubscription] = useState(false)

  // Check if user has an active subscription they can manage
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user?.id) return
      
      const subscription = await subscriptionService.getCurrentSubscription(user.id)
      setCanManageSubscription(!!subscription?.stripeCustomerId)
    }
    
    checkSubscription()
  }, [user?.id])

  // Handle success/cancel from Stripe checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const canceled = urlParams.get('canceled')
    const tier = urlParams.get('tier')

    if (success === 'true') {
      // Show success message
      const message = tier 
        ? `Successfully upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan!`
        : 'Payment successful!'
      
      console.log('Payment successful, refreshing user data...')
      
      // Clean up URL first
      window.history.replaceState({}, '', '/plans')
      
      // Force refresh user data from database
      if (user?.id) {
        // Extract tier from URL parameter since webhook might fail
        const targetTier = tier as UserTier || 'pro'
        
        // Add a small delay to ensure webhook has processed
        setTimeout(async () => {
          // Use the new refreshSubscriptionStatus method to get latest tier from database
          await useAuthStore.getState().refreshSubscriptionStatus()
          
          const currentTier = useAuthStore.getState().userTier
          console.log('User data refreshed, new tier:', currentTier)
          
          // If tier is still 'free', the webhook failed - manually update it
          if (currentTier === 'free') {
            console.log('❌ Webhook failed - tier still free, manually updating...')
            
            // Call the backend to manually update the tier
            try {
              const response = await fetch('http://localhost:3001/api/manual-tier-update', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: user.id,
                  tier: targetTier
                })
              })
              
              if (response.ok) {
                console.log('✅ Manual tier update successful')
                // Refresh again to get updated tier
                await useAuthStore.getState().refreshSubscriptionStatus()
                alert(`Successfully upgraded to ${targetTier.charAt(0).toUpperCase() + targetTier.slice(1)} plan!`)
              } else {
                console.error('❌ Manual tier update failed')
                alert('Payment successful, but tier update failed. Please refresh the page.')
              }
            } catch (error) {
              console.error('❌ Manual tier update error:', error)
              alert('Payment successful, but tier update failed. Please refresh the page.')
            }
          } else {
            alert(message)
          }
          
          // Force re-render by setting a state update
          window.location.reload()
        }, 3000) // 3 second delay to ensure webhook processing
      }
    } else if (canceled === 'true') {
      alert('Payment was canceled. You can try again anytime.')
      
      // Clean up URL
      window.history.replaceState({}, '', '/plans')
    }
  }, [user?.id])

  const getProcessingSpeedText = (priority: string): string => {
    switch (priority) {
      case 'low': return 'Basic processing speed'
      case 'normal': return 'Standard processing speed'
      case 'high': return 'Fast processing speed'
      case 'highest': return 'Ultra-fast processing speed'
      default: return 'Standard processing speed'
    }
  }

  const getSupportTypeText = (support: string): string => {
    switch (support) {
      case 'none': return 'Community support'
      case 'email': return 'Email support'
      case 'chat': return 'Live chat support'
      case 'phone': return 'Phone + dedicated manager'
      default: return 'Email support'
    }
  }

  // Generate plans from subscription plans
  const plans = useMemo<Plan[]>(() => {
    return SUBSCRIPTION_PLANS
      .filter(plan => plan.interval === billingInterval)
      .map(plan => {
        const tierConfig = config[plan.tier]
        const isCurrentTier = plan.tier === userTier
        const isTestingMode = subscriptionService.isTestingMode()
        
        return {
          id: plan.id,
          tier: plan.tier,
          name: plan.name,
          description: plan.description,
          price: isTestingMode ? 'Free' : plan.price === 0 ? 'Free' : `$${plan.price}${billingInterval === 'year' ? '/year' : '/month'}`,
          originalPrice: isTestingMode && plan.price > 0 ? `$${plan.price}${billingInterval === 'year' ? '/year' : '/month'}` : undefined,
          features: [
            { name: `${tierConfig.maxImagesPerMonth.toLocaleString()} images per month`, included: true },
            { name: `${formatFileSize(tierConfig.maxFileSize)} max file size`, included: true },
            { name: `${tierConfig.maxBatchSize} image batch processing`, included: true },
            { name: `${tierConfig.supportedFormats.length} formats supported`, included: true },
            { name: getProcessingSpeedText(tierConfig.processingPriority), included: true },
            { name: getSupportTypeText(tierConfig.prioritySupport), included: tierConfig.prioritySupport !== 'none' },
            { name: plan.tier === 'free' ? 'Basic features' : 'Team features', included: tierConfig.teamFeatures || plan.tier === 'free' },
            { name: 'Priority support', included: tierConfig.prioritySupport === 'phone' || tierConfig.prioritySupport === 'chat' }
          ],
          icon: plan.tier === 'enterprise' ? Building2 : plan.tier === 'team' ? Users : Zap,
          popular: plan.popular || false,
          buttonText: isCurrentTier ? 'Current Plan' : `Upgrade to ${plan.tier.charAt(0).toUpperCase() + plan.tier.slice(1)}`,
          buttonVariant: isCurrentTier ? 'outline' : 'primary',
          interval: plan.interval,
          stripePriceId: plan.stripePriceId
        } as Plan
      })
  }, [config, formatFileSize, getProcessingSpeedText, getSupportTypeText, billingInterval, userTier])


  const handleUpgrade = async (plan: Plan) => {
    if (plan.tier === userTier) return

    setUpgrading(plan.id)
    try {
      if (subscriptionService.isTestingMode()) {
        // Testing mode - use existing upgrade function
        const success = await upgradeUserTier(plan.tier, plan.id)
        if (!success) {
          alert(`Upgrade failed: ${error?.message || 'Unknown error'}`)
        }
      } else {
        // Production mode - use auth store which handles Stripe
        const success = await upgradeUserTier(plan.tier, plan.id)
        if (!success) {
          alert(`Upgrade failed: ${error?.message || 'Unknown error'}`)
        }
      }
    } catch (err) {
      alert(`Upgrade error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUpgrading(null)
    }
  }

  const handleManageSubscription = async () => {
    if (!user?.id) return

    try {
      await subscriptionService.manageSubscription(user.id)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Failed to open subscription management'}`)
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
          
          {/* Billing Interval Toggle */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => setBillingInterval('month')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                billingInterval === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('year')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                billingInterval === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Yearly
              <span className="ml-1 text-xs bg-green-500 text-white px-2 py-1 rounded-full">
                Save 2 months
              </span>
            </button>
          </div>

          {/* Testing Mode Notice */}
          {subscriptionService.isTestingMode() && (
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
              🎉 All plans are currently FREE for testing!
            </div>
          )}

          {/* Manage Subscription Button */}
          {canManageSubscription && !subscriptionService.isTestingMode() && (
            <div className="mt-4">
              <button
                onClick={handleManageSubscription}
                className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Manage Subscription
              </button>
            </div>
          )}
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
                  onClick={() => handleUpgrade(plan)}
                  disabled={plan.tier === userTier || isUpgrading}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                    plan.buttonVariant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400'
                      : plan.buttonVariant === 'secondary'
                      ? 'bg-gray-600 text-white hover:bg-gray-700 disabled:bg-gray-400'
                      : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200 disabled:bg-gray-100'
                  }`}
                >
                  {plan.tier !== 'free' && !subscriptionService.isTestingMode() && (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {isUpgrading ? 'Processing...' : plan.buttonText}
                </button>
              </div>
            )
          })}
        </div>

        {/* Testing Note */}
        {subscriptionService.isTestingMode() && (
          <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Testing Mode</h3>
            <p className="text-yellow-700 mb-4">
              All plans are currently free for testing. You can upgrade between any tier to test the functionality.
              To enable real Stripe payments, set <code className="bg-yellow-100 px-2 py-1 rounded">testingMode = false</code> in the SubscriptionService.
            </p>
            <div className="text-sm text-yellow-600">
              <strong>To enable real pricing:</strong> Stripe integration is ready. Update your Stripe Price IDs in the environment variables and disable testing mode.
            </div>
          </div>
        )}

        {/* Stripe Integration Info */}
        {!subscriptionService.isTestingMode() && (
          <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">💳 Secure Payments</h3>
            <p className="text-blue-700 mb-2">
              Payments are processed securely through Stripe. Your payment information is never stored on our servers.
            </p>
            <div className="text-sm text-blue-600 space-y-1">
              <div>• 256-bit SSL encryption</div>
              <div>• PCI DSS compliant</div>
              <div>• Cancel anytime</div>
              <div>• Instant activation</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}