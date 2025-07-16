import type { TierConfig } from '@/types/tiers'

export const TIER_LIMITS: TierConfig = {
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