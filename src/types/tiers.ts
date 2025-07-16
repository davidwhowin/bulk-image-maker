export type UserTier = 'free' | 'pro' | 'team' | 'enterprise'

export interface TierLimits {
  maxImagesPerMonth: number
  maxFileSize: number // in bytes
  maxBatchSize: number
  processingPriority: 'low' | 'normal' | 'high' | 'highest'
  processingDelay: number // in milliseconds
  supportedFormats: string[]
  teamFeatures: boolean
  prioritySupport: 'none' | 'email' | 'chat' | 'phone'
}

export interface UsageStats {
  userId: string
  currentMonth: string // YYYY-MM format
  imagesProcessed: number
  storageUsed: number // in bytes
  lastUpdated: string
}

export interface TierUsageResult {
  canProcess: boolean
  remainingImages: number
  remainingStorage: number
  upgradeRequired: boolean
  limitType?: 'images' | 'fileSize' | 'batchSize' | 'format'
  message?: string
}

export interface TierConfig {
  free: TierLimits
  pro: TierLimits
  team: TierLimits
  enterprise: TierLimits
}