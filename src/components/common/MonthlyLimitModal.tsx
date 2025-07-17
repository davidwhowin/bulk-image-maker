import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight } from 'lucide-react'

interface MonthlyLimitModalProps {
  isOpen: boolean
  onClose: () => void
  message: string
  currentUsage?: number
  maxImages?: number
}

export function MonthlyLimitModal({ 
  isOpen, 
  onClose, 
  message, 
  currentUsage, 
  maxImages 
}: MonthlyLimitModalProps) {
  const navigate = useNavigate()

  if (!isOpen) return null

  const handleUpgrade = () => {
    onClose()
    navigate('/plans')
  }

  const usagePercentage = currentUsage && maxImages 
    ? Math.round((currentUsage / maxImages) * 100) 
    : 100

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 p-6 border-b border-gray-200">
          <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Monthly Limit Reached</h3>
            <p className="text-sm text-gray-600">Unable to process more images</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-gray-700 mb-4">
              {message || 'You have reached your monthly image processing limit.'}
            </p>

            {/* Usage Progress Bar */}
            {currentUsage && maxImages && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Images this month</span>
                  <span>{currentUsage.toLocaleString()} / {maxImages.toLocaleString()}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <div className="text-xs text-red-600 mt-1">
                  {usagePercentage}% of monthly limit used
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                Upgrade to continue processing
              </h4>
              <p className="text-sm text-blue-700">
                Get higher limits and unlock premium features with our Pro plan.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpgrade}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            View Plans
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}