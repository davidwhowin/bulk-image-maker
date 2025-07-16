import { useState, useEffect, useCallback } from 'react'
import { tierConfigManager } from '@/lib/tier-config-manager'
import type { TierConfig, TierLimits, UserTier } from '@/types/tiers'

interface UseTierConfigReturn {
  // Current configuration
  config: TierConfig
  isLoading: boolean
  error: string | null
  
  // Configuration actions
  updateTierConfig: (tier: UserTier, limits: TierLimits) => Promise<boolean>
  updateFullConfig: (newConfig: TierConfig) => Promise<boolean>
  resetToDefaults: () => void
  
  // Import/Export
  exportConfig: () => string
  importConfig: (jsonString: string) => Promise<boolean>
  clearStoredConfig: () => void
  
  // Validation
  validateConfig: (config: TierConfig) => { isValid: boolean; errors: string[] }
  
  // Utilities
  getConfigSummary: () => Array<{
    tier: string
    maxImages: number
    maxFileSize: string
    formats: number
  }>
  formatFileSize: (bytes: number) => string
  
  // Status
  hasUnsavedChanges: boolean
}

export function useTierConfig(): UseTierConfigReturn {
  const [config, setConfig] = useState<TierConfig>(() => tierConfigManager.getConfiguration())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Subscribe to configuration changes
  useEffect(() => {
    const unsubscribe = tierConfigManager.subscribe((newConfig) => {
      setConfig(newConfig)
      setHasUnsavedChanges(false)
    })

    return unsubscribe
  }, [])

  const updateTierConfig = useCallback(async (tier: UserTier, limits: TierLimits): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const success = tierConfigManager.updateTierConfiguration(tier, limits)
      if (success) {
        setHasUnsavedChanges(false)
      }
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update tier configuration'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const updateFullConfig = useCallback(async (newConfig: TierConfig): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const success = tierConfigManager.updateConfiguration(newConfig)
      if (success) {
        setHasUnsavedChanges(false)
      }
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const resetToDefaults = useCallback(() => {
    setIsLoading(true)
    setError(null)

    try {
      tierConfigManager.resetToDefaults()
      setHasUnsavedChanges(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset configuration'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const exportConfig = useCallback((): string => {
    return tierConfigManager.exportConfiguration()
  }, [])

  const importConfig = useCallback(async (jsonString: string): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      const success = tierConfigManager.importConfiguration(jsonString)
      if (success) {
        setHasUnsavedChanges(false)
      }
      return success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import configuration'
      setError(errorMessage)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearStoredConfig = useCallback(() => {
    setIsLoading(true)
    setError(null)

    try {
      tierConfigManager.clearStoredConfiguration()
      setHasUnsavedChanges(false)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear stored configuration'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const validateConfig = useCallback((configToValidate: TierConfig): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []

    try {
      // Basic structure validation
      const requiredTiers = ['free', 'pro', 'team', 'enterprise'] as const
      for (const tier of requiredTiers) {
        if (!configToValidate[tier]) {
          errors.push(`Missing ${tier} tier configuration`)
          continue
        }

        const tierConfig = configToValidate[tier]
        
        // Validate required fields
        if (typeof tierConfig.maxImagesPerMonth !== 'number' || tierConfig.maxImagesPerMonth < 0) {
          errors.push(`${tier}: Invalid maxImagesPerMonth`)
        }
        if (typeof tierConfig.maxFileSize !== 'number' || tierConfig.maxFileSize < 1024) {
          errors.push(`${tier}: Invalid maxFileSize`)
        }
        if (typeof tierConfig.maxBatchSize !== 'number' || tierConfig.maxBatchSize < 1) {
          errors.push(`${tier}: Invalid maxBatchSize`)
        }
        if (!Array.isArray(tierConfig.supportedFormats) || tierConfig.supportedFormats.length === 0) {
          errors.push(`${tier}: Invalid supportedFormats`)
        }
      }

      // Validate tier hierarchy
      const tiers = [configToValidate.free, configToValidate.pro, configToValidate.team, configToValidate.enterprise]
      for (let i = 1; i < tiers.length; i++) {
        if (tiers[i].maxImagesPerMonth < tiers[i - 1].maxImagesPerMonth) {
          errors.push(`Tier hierarchy violation: ${requiredTiers[i]} has fewer images than ${requiredTiers[i - 1]}`)
        }
        if (tiers[i].maxFileSize < tiers[i - 1].maxFileSize) {
          errors.push(`Tier hierarchy violation: ${requiredTiers[i]} has smaller file size than ${requiredTiers[i - 1]}`)
        }
        if (tiers[i].maxBatchSize < tiers[i - 1].maxBatchSize) {
          errors.push(`Tier hierarchy violation: ${requiredTiers[i]} has smaller batch size than ${requiredTiers[i - 1]}`)
        }
      }

    } catch (err) {
      errors.push('Configuration validation failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }, [])

  const getConfigSummary = useCallback(() => {
    return tierConfigManager.getConfigurationSummary()
  }, [])

  const formatFileSize = useCallback((bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    // Current state
    config,
    isLoading,
    error,
    hasUnsavedChanges,
    
    // Actions
    updateTierConfig,
    updateFullConfig,
    resetToDefaults,
    
    // Import/Export
    exportConfig,
    importConfig,
    clearStoredConfig,
    
    // Validation
    validateConfig,
    
    // Utilities
    getConfigSummary,
    formatFileSize,
    
    // Additional utilities
    clearError
  }
}

// Helper hook for getting current tier limits
export function useTierLimits(tier: UserTier) {
  const { config } = useTierConfig()
  return config[tier]
}

// Helper hook for checking if a tier configuration is valid
export function useTierValidation() {
  const { validateConfig } = useTierConfig()
  
  const validateTierLimits = useCallback((limits: TierLimits): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    if (limits.maxImagesPerMonth < 0 || limits.maxImagesPerMonth > 1000000) {
      errors.push('Max images per month must be between 0 and 1,000,000')
    }
    if (limits.maxFileSize < 1024 || limits.maxFileSize > 1024 * 1024 * 1024) {
      errors.push('Max file size must be between 1KB and 1GB')
    }
    if (limits.maxBatchSize < 1 || limits.maxBatchSize > 10000) {
      errors.push('Max batch size must be between 1 and 10,000')
    }
    if (!Array.isArray(limits.supportedFormats) || limits.supportedFormats.length === 0) {
      errors.push('At least one supported format is required')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }, [])
  
  return {
    validateConfig,
    validateTierLimits
  }
}