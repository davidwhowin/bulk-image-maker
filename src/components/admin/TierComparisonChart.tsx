import { useMemo } from 'react'
import type { TierConfig, UserTier } from '@/types/tiers'

interface TierComparisonChartProps {
  config: TierConfig
  className?: string
  showDetails?: boolean
}

interface TierData {
  tier: UserTier
  name: string
  color: string
  maxImages: number
  maxFileSize: number
  maxBatchSize: number
  formatCount: number
  formats: string[]
}

export function TierComparisonChart({ 
  config, 
  className = '',
  showDetails = true 
}: TierComparisonChartProps) {
  const tierData: TierData[] = useMemo(() => {
    return [
      {
        tier: 'free',
        name: 'Free',
        color: 'bg-gray-500',
        maxImages: config.free.maxImagesPerMonth,
        maxFileSize: config.free.maxFileSize,
        maxBatchSize: config.free.maxBatchSize,
        formatCount: config.free.supportedFormats.length,
        formats: config.free.supportedFormats
      },
      {
        tier: 'pro',
        name: 'Pro',
        color: 'bg-blue-500',
        maxImages: config.pro.maxImagesPerMonth,
        maxFileSize: config.pro.maxFileSize,
        maxBatchSize: config.pro.maxBatchSize,
        formatCount: config.pro.supportedFormats.length,
        formats: config.pro.supportedFormats
      },
      {
        tier: 'team',
        name: 'Team',
        color: 'bg-green-500',
        maxImages: config.team.maxImagesPerMonth,
        maxFileSize: config.team.maxFileSize,
        maxBatchSize: config.team.maxBatchSize,
        formatCount: config.team.supportedFormats.length,
        formats: config.team.supportedFormats
      },
      {
        tier: 'enterprise',
        name: 'Enterprise',
        color: 'bg-purple-500',
        maxImages: config.enterprise.maxImagesPerMonth,
        maxFileSize: config.enterprise.maxFileSize,
        maxBatchSize: config.enterprise.maxBatchSize,
        formatCount: config.enterprise.supportedFormats.length,
        formats: config.enterprise.supportedFormats
      }
    ]
  }, [config])

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`
  }

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`
    }
    return num.toString()
  }

  const maxImages = Math.max(...tierData.map(t => t.maxImages))
  const maxFileSize = Math.max(...tierData.map(t => t.maxFileSize))
  const maxBatchSize = Math.max(...tierData.map(t => t.maxBatchSize))

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Tier Comparison</h3>
        <p className="text-sm text-gray-600">
          Visual comparison of limits across all subscription tiers
        </p>
      </div>

      <div className="space-y-8">
        {/* Images per Month Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Max Images per Month</h4>
          <div className="space-y-3">
            {tierData.map((tier) => {
              const percentage = maxImages > 0 ? (tier.maxImages / maxImages) * 100 : 0
              return (
                <div key={tier.tier} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-medium text-gray-700">
                    {tier.name}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full ${tier.color} transition-all duration-500 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-difference">
                      {formatNumber(tier.maxImages)}
                    </div>
                  </div>
                  <div className="w-16 text-right text-xs text-gray-600">
                    {percentage.toFixed(0)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* File Size Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Max File Size</h4>
          <div className="space-y-3">
            {tierData.map((tier) => {
              const percentage = maxFileSize > 0 ? (tier.maxFileSize / maxFileSize) * 100 : 0
              return (
                <div key={tier.tier} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-medium text-gray-700">
                    {tier.name}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full ${tier.color} transition-all duration-500 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-difference">
                      {formatFileSize(tier.maxFileSize)}
                    </div>
                  </div>
                  <div className="w-16 text-right text-xs text-gray-600">
                    {percentage.toFixed(0)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Batch Size Chart */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Max Batch Size</h4>
          <div className="space-y-3">
            {tierData.map((tier) => {
              const percentage = maxBatchSize > 0 ? (tier.maxBatchSize / maxBatchSize) * 100 : 0
              return (
                <div key={tier.tier} className="flex items-center gap-3">
                  <div className="w-20 text-sm font-medium text-gray-700">
                    {tier.name}
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 relative overflow-hidden">
                    <div
                      className={`h-full ${tier.color} transition-all duration-500 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white mix-blend-difference">
                      {tier.maxBatchSize}
                    </div>
                  </div>
                  <div className="w-16 text-right text-xs text-gray-600">
                    {percentage.toFixed(0)}%
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Format Support Matrix */}
        {showDetails && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Format Support</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {tierData.map((tier) => (
                <div key={tier.tier} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${tier.color}`} />
                    <span className="text-sm font-medium text-gray-700">{tier.name}</span>
                  </div>
                  <div className="text-xs text-gray-600">
                    {tier.formatCount} format{tier.formatCount !== 1 ? 's' : ''}
                  </div>
                  <div className="space-y-1">
                    {tier.formats.map((format) => {
                      const formatName = format.replace('image/', '').toUpperCase()
                      return (
                        <div
                          key={format}
                          className="text-xs bg-gray-100 rounded px-2 py-1 inline-block mr-1"
                        >
                          {formatName}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
          {tierData.map((tier) => (
            <div key={tier.tier} className="text-center p-4 bg-gray-50 rounded-lg">
              <div className={`w-4 h-4 rounded mx-auto mb-2 ${tier.color}`} />
              <div className="text-sm font-medium text-gray-900 mb-1">{tier.name}</div>
              <div className="space-y-1 text-xs text-gray-600">
                <div>{formatNumber(tier.maxImages)} images</div>
                <div>{formatFileSize(tier.maxFileSize)} files</div>
                <div>{tier.maxBatchSize} batch</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Compact version for smaller spaces
export function TierComparisonMini({ config, className = '' }: { config: TierConfig; className?: string }) {
  const tierData = [
    { name: 'Free', value: config.free.maxImagesPerMonth, color: 'bg-gray-500' },
    { name: 'Pro', value: config.pro.maxImagesPerMonth, color: 'bg-blue-500' },
    { name: 'Team', value: config.team.maxImagesPerMonth, color: 'bg-green-500' },
    { name: 'Enterprise', value: config.enterprise.maxImagesPerMonth, color: 'bg-purple-500' }
  ]

  const maxValue = Math.max(...tierData.map(t => t.value))

  const formatNumber = (num: number): string => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`
    }
    return num.toString()
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
      <h4 className="text-sm font-medium text-gray-700 mb-3">Images per Month</h4>
      <div className="space-y-2">
        {tierData.map((tier) => {
          const percentage = maxValue > 0 ? (tier.value / maxValue) * 100 : 0
          return (
            <div key={tier.name} className="flex items-center gap-2">
              <div className="w-12 text-xs text-gray-600">{tier.name}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
                <div
                  className={`h-full ${tier.color} transition-all duration-300`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="w-10 text-xs text-gray-600 text-right">
                {formatNumber(tier.value)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}