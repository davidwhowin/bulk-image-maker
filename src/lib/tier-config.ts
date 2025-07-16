import type { TierConfig } from '@/types/tiers'
import { tierConfigManager } from './tier-config-manager'

// Dynamic tier limits - now uses the configuration manager
export const TIER_LIMITS: TierConfig = tierConfigManager.getConfiguration()

// Function to get current tier limits (always up-to-date)
export const getTierLimits = (): TierConfig => {
  return tierConfigManager.getConfiguration()
}

// Subscribe to tier configuration changes
export const subscribeTierConfigChanges = (callback: (config: TierConfig) => void): (() => void) => {
  return tierConfigManager.subscribe(callback)
}

export const getCurrentMonth = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
}

export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`
}