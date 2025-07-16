import { useState, useRef } from 'react'
import { useTierConfig } from '@/hooks/useTierConfig'
import { TierComparisonChart, TierComparisonMini } from './TierComparisonChart'
import { ImageLimitSlider, FileSizeSlider, BatchSizeSlider } from './TierLimitSlider'
import { FormatSelector } from './FormatSelector'
import type { UserTier, TierLimits } from '@/types/tiers'

interface TierConfigAdminProps {
  className?: string
  showComparison?: boolean
  compactMode?: boolean
}

const TIER_INFO = {
  free: { name: 'Free Plan', color: 'gray' as const, description: 'Basic features for personal use' },
  pro: { name: 'Pro Plan', color: 'blue' as const, description: 'Advanced features for professionals' },
  team: { name: 'Team Plan', color: 'green' as const, description: 'Collaboration features for teams' },
  enterprise: { name: 'Enterprise Plan', color: 'purple' as const, description: 'Full features for organizations' }
}

export function TierConfigAdmin({ 
  className = '', 
  showComparison = true,
  compactMode = false 
}: TierConfigAdminProps) {
  const {
    config,
    isLoading,
    error,
    hasUnsavedChanges,
    updateTierConfig,
    resetToDefaults,
    exportConfig,
    importConfig,
    clearStoredConfig,
    validateConfig,
    clearError
  } = useTierConfig()

  const [activeTab, setActiveTab] = useState<UserTier>('free')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [importText, setImportText] = useState('')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleTierUpdate = async (tier: UserTier, field: keyof TierLimits, value: any) => {
    const currentLimits = config[tier]
    const newLimits = { ...currentLimits, [field]: value }
    
    const success = await updateTierConfig(tier, newLimits)
    if (success) {
      setSaveMessage(`${TIER_INFO[tier].name} updated successfully`)
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }

  const handleExport = () => {
    const configJson = exportConfig()
    const blob = new Blob([configJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tier-config-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    try {
      const success = await importConfig(importText)
      if (success) {
        setShowImportDialog(false)
        setImportText('')
        setSaveMessage('Configuration imported successfully')
        setTimeout(() => setSaveMessage(null), 3000)
      }
    } catch (err) {
      // Error is handled by the hook
    }
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        setImportText(content)
        setShowImportDialog(true)
      }
      reader.readAsText(file)
    }
  }

  const validation = validateConfig(config)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Tier Configuration</h2>
            <p className="text-sm text-gray-600 mt-1">
              Manage subscription plan limits and features
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              📁 Import
            </button>
            
            <button
              onClick={handleExport}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              📤 Export
            </button>
            
            <button
              onClick={clearStoredConfig}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              🔄 Reset Storage
            </button>
            
            <button
              onClick={resetToDefaults}
              className="px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              ⚠️ Reset to Defaults
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-red-700">{error}</div>
              <button
                onClick={clearError}
                className="text-red-500 hover:text-red-700"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {saveMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-sm text-green-700">{saveMessage}</div>
          </div>
        )}

        {!validation.isValid && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="text-sm text-yellow-700">
              <div className="font-medium mb-1">Configuration Issues:</div>
              <ul className="list-disc list-inside space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {hasUnsavedChanges && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-sm text-blue-700">
              ✓ Changes saved automatically
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className={compactMode ? 'space-y-4' : 'grid grid-cols-1 xl:grid-cols-3 gap-6'}>
        {/* Tier Configuration Panel */}
        <div className={compactMode ? '' : 'xl:col-span-2'}>
          <div className="bg-white rounded-lg border border-gray-200">
            {/* Tier Tabs */}
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto">
                {Object.entries(TIER_INFO).map(([tier, info]) => (
                  <button
                    key={tier}
                    onClick={() => setActiveTab(tier as UserTier)}
                    className={`
                      flex-1 min-w-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                      ${activeTab === tier
                        ? `border-${info.color}-500 text-${info.color}-600 bg-${info.color}-50`
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="truncate">{info.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tier Configuration Content */}
            <div className="p-6">
              {Object.entries(TIER_INFO).map(([tier, info]) => {
                if (activeTab !== tier) return null
                
                const tierConfig = config[tier as UserTier]
                const tierColor = info.color

                return (
                  <div key={tier} className="space-y-6">
                    {/* Tier Header */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{info.name}</h3>
                      <p className="text-sm text-gray-600">{info.description}</p>
                    </div>

                    {/* Image Limit */}
                    <ImageLimitSlider
                      value={tierConfig.maxImagesPerMonth}
                      onChange={(value) => handleTierUpdate(tier as UserTier, 'maxImagesPerMonth', value)}
                      disabled={isLoading}
                      color={tierColor}
                    />

                    {/* File Size Limit */}
                    <FileSizeSlider
                      value={tierConfig.maxFileSize}
                      onChange={(value) => handleTierUpdate(tier as UserTier, 'maxFileSize', value)}
                      disabled={isLoading}
                      color={tierColor}
                    />

                    {/* Batch Size Limit */}
                    <BatchSizeSlider
                      value={tierConfig.maxBatchSize}
                      onChange={(value) => handleTierUpdate(tier as UserTier, 'maxBatchSize', value)}
                      disabled={isLoading}
                      color={tierColor}
                    />

                    {/* Processing Priority */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Processing Priority
                      </label>
                      <select
                        value={tierConfig.processingPriority}
                        onChange={(e) => handleTierUpdate(tier as UserTier, 'processingPriority', e.target.value)}
                        disabled={isLoading}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="low">Low Priority</option>
                        <option value="normal">Normal Priority</option>
                        <option value="high">High Priority</option>
                        <option value="highest">Highest Priority</option>
                      </select>
                    </div>

                    {/* Team Features Toggle */}
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Team Features</label>
                        <p className="text-xs text-gray-600">Enable collaboration and team management</p>
                      </div>
                      <button
                        onClick={() => handleTierUpdate(tier as UserTier, 'teamFeatures', !tierConfig.teamFeatures)}
                        disabled={isLoading}
                        className={`
                          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                          ${tierConfig.teamFeatures ? 'bg-blue-600' : 'bg-gray-200'}
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${tierConfig.teamFeatures ? 'translate-x-6' : 'translate-x-1'}
                          `}
                        />
                      </button>
                    </div>

                    {/* Priority Support */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority Support
                      </label>
                      <select
                        value={tierConfig.prioritySupport}
                        onChange={(e) => handleTierUpdate(tier as UserTier, 'prioritySupport', e.target.value)}
                        disabled={isLoading}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="none">No Support</option>
                        <option value="email">Email Support</option>
                        <option value="chat">Live Chat Support</option>
                        <option value="phone">Phone Support</option>
                      </select>
                    </div>

                    {/* Format Selector */}
                    <FormatSelector
                      selectedFormats={tierConfig.supportedFormats}
                      onChange={(formats) => handleTierUpdate(tier as UserTier, 'supportedFormats', formats)}
                      disabled={isLoading}
                      tierColor={tierColor}
                      showCategories={!compactMode}
                      showDescriptions={!compactMode}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Comparison Chart */}
        {showComparison && (
          <div className={compactMode ? '' : 'xl:col-span-1'}>
            {compactMode ? (
              <TierComparisonMini config={config} />
            ) : (
              <TierComparisonChart config={config} />
            )}
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileImport}
        className="hidden"
      />

      {/* Import Dialog */}
      {showImportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Import Configuration</h3>
              <button
                onClick={() => setShowImportDialog(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Configuration JSON
              </label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none"
                placeholder="Paste your configuration JSON here..."
              />
            </div>
            
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={() => setShowImportDialog(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleImport()}
                disabled={!importText.trim() || isLoading}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}