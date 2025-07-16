import type { TierConfig, TierLimits } from '@/types/tiers'

// Default tier configuration (fallback)
export const DEFAULT_TIER_CONFIG: TierConfig = {
  free: {
    maxImagesPerMonth: 100,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxBatchSize: 1,
    processingPriority: 'low',
    processingDelay: 2 * 60 * 1000, // 2 minutes
    supportedFormats: ['image/jpeg', 'image/png'],
    teamFeatures: false,
    prioritySupport: 'none'
  },
  pro: {
    maxImagesPerMonth: 3000,
    maxFileSize: 25 * 1024 * 1024, // 25MB
    maxBatchSize: 10,
    processingPriority: 'normal',
    processingDelay: 10 * 1000, // 10 seconds
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jxl'],
    teamFeatures: false,
    prioritySupport: 'email'
  },
  team: {
    maxImagesPerMonth: 15000,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxBatchSize: 50,
    processingPriority: 'high',
    processingDelay: 3 * 1000, // 3 seconds
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jxl', 'image/svg+xml'],
    teamFeatures: true,
    prioritySupport: 'chat'
  },
  enterprise: {
    maxImagesPerMonth: 75000,
    maxFileSize: 500 * 1024 * 1024, // 500MB
    maxBatchSize: 500,
    processingPriority: 'highest',
    processingDelay: 1000, // 1 second
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/jxl', 'image/svg+xml', 'image/gif'],
    teamFeatures: true,
    prioritySupport: 'phone'
  }
}

const STORAGE_KEY = 'admin_tier_config'

export class TierConfigManager {
  private static instance: TierConfigManager
  private currentConfig: TierConfig
  private listeners: ((config: TierConfig) => void)[] = []

  private constructor() {
    this.currentConfig = this.loadConfiguration()
  }

  static getInstance(): TierConfigManager {
    if (!TierConfigManager.instance) {
      TierConfigManager.instance = new TierConfigManager()
    }
    return TierConfigManager.instance
  }

  /**
   * Load configuration from localStorage or environment variables
   */
  private loadConfiguration(): TierConfig {
    try {
      // First try to load from localStorage (admin overrides)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (this.validateConfiguration(parsed)) {
          return parsed
        }
      }
    } catch (error) {
      console.warn('Failed to load stored tier configuration:', error)
    }

    // Try to load from environment variables
    try {
      const envConfig = this.loadFromEnvironment()
      if (envConfig) {
        return envConfig
      }
    } catch (error) {
      console.warn('Failed to load tier configuration from environment:', error)
    }

    // Fallback to default configuration
    return { ...DEFAULT_TIER_CONFIG }
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): TierConfig | null {
    // Check if environment overrides are available
    const freeMaxImages = import.meta.env.VITE_TIER_FREE_MAX_IMAGES
    const proMaxImages = import.meta.env.VITE_TIER_PRO_MAX_IMAGES
    
    if (freeMaxImages || proMaxImages) {
      const config = { ...DEFAULT_TIER_CONFIG }
      
      if (freeMaxImages) {
        config.free.maxImagesPerMonth = parseInt(freeMaxImages, 10)
      }
      if (proMaxImages) {
        config.pro.maxImagesPerMonth = parseInt(proMaxImages, 10)
      }
      
      // Add more environment variable mappings as needed
      return config
    }
    
    return null
  }

  /**
   * Validate tier configuration structure and values
   */
  private validateConfiguration(config: any): config is TierConfig {
    if (!config || typeof config !== 'object') return false

    const requiredTiers = ['free', 'pro', 'team', 'enterprise']
    const requiredFields = [
      'maxImagesPerMonth',
      'maxFileSize', 
      'maxBatchSize',
      'processingPriority',
      'processingDelay',
      'supportedFormats',
      'teamFeatures',
      'prioritySupport'
    ]

    for (const tier of requiredTiers) {
      if (!config[tier]) return false
      
      for (const field of requiredFields) {
        if (config[tier][field] === undefined) return false
      }

      // Validate specific field types and ranges
      const tierConfig = config[tier]
      
      if (tierConfig.maxImagesPerMonth < 0 || tierConfig.maxImagesPerMonth > 1000000) return false
      if (tierConfig.maxFileSize < 1024 || tierConfig.maxFileSize > 1024 * 1024 * 1024) return false
      if (tierConfig.maxBatchSize < 1 || tierConfig.maxBatchSize > 10000) return false
      if (!Array.isArray(tierConfig.supportedFormats)) return false
      if (typeof tierConfig.teamFeatures !== 'boolean') return false
    }

    return true
  }

  /**
   * Get current tier configuration
   */
  getConfiguration(): TierConfig {
    return { ...this.currentConfig }
  }

  /**
   * Update tier configuration
   */
  updateConfiguration(newConfig: TierConfig): boolean {
    if (!this.validateConfiguration(newConfig)) {
      throw new Error('Invalid tier configuration provided')
    }

    // Validate tier hierarchy (higher tiers should have better limits)
    if (!this.validateTierHierarchy(newConfig)) {
      throw new Error('Invalid tier hierarchy: higher tiers must have better limits than lower tiers')
    }

    this.currentConfig = { ...newConfig }
    this.saveConfiguration()
    this.notifyListeners()
    
    return true
  }

  /**
   * Update specific tier configuration
   */
  updateTierConfiguration(tier: keyof TierConfig, limits: TierLimits): boolean {
    const newConfig = { ...this.currentConfig }
    newConfig[tier] = { ...limits }
    
    return this.updateConfiguration(newConfig)
  }

  /**
   * Validate that tier hierarchy makes sense (Pro > Free, etc.)
   */
  private validateTierHierarchy(config: TierConfig): boolean {
    const tiers = [config.free, config.pro, config.team, config.enterprise]
    
    // Check that images per month increases with tier level
    for (let i = 1; i < tiers.length; i++) {
      if (tiers[i].maxImagesPerMonth < tiers[i - 1].maxImagesPerMonth) {
        return false
      }
      if (tiers[i].maxFileSize < tiers[i - 1].maxFileSize) {
        return false
      }
      if (tiers[i].maxBatchSize < tiers[i - 1].maxBatchSize) {
        return false
      }
    }
    
    return true
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfiguration(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentConfig))
    } catch (error) {
      console.error('Failed to save tier configuration:', error)
    }
  }

  /**
   * Reset to default configuration
   */
  resetToDefaults(): void {
    this.currentConfig = { ...DEFAULT_TIER_CONFIG }
    this.saveConfiguration()
    this.notifyListeners()
  }

  /**
   * Export configuration as JSON
   */
  exportConfiguration(): string {
    return JSON.stringify(this.currentConfig, null, 2)
  }

  /**
   * Import configuration from JSON
   */
  importConfiguration(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString)
      return this.updateConfiguration(parsed)
    } catch (error) {
      throw new Error('Invalid JSON configuration')
    }
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(listener: (config: TierConfig) => void): () => void {
    this.listeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify all listeners of configuration changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.currentConfig)
      } catch (error) {
        console.error('Error in tier config listener:', error)
      }
    })
  }

  /**
   * Clear all stored configuration (reset to environment/defaults)
   */
  clearStoredConfiguration(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
      this.currentConfig = this.loadConfiguration()
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to clear stored configuration:', error)
    }
  }

  /**
   * Get configuration summary for display
   */
  getConfigurationSummary(): {
    tier: string
    maxImages: number
    maxFileSize: string
    formats: number
  }[] {
    const formatFileSize = (bytes: number): string => {
      const units = ['B', 'KB', 'MB', 'GB']
      let size = bytes
      let unitIndex = 0
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex++
      }
      
      return `${size.toFixed(1)} ${units[unitIndex]}`
    }

    return Object.entries(this.currentConfig).map(([tier, config]) => ({
      tier: tier.charAt(0).toUpperCase() + tier.slice(1),
      maxImages: config.maxImagesPerMonth,
      maxFileSize: formatFileSize(config.maxFileSize),
      formats: config.supportedFormats.length
    }))
  }
}

// Export singleton instance
export const tierConfigManager = TierConfigManager.getInstance()