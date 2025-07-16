import type { UserTier, TierUsageResult, UsageStats, TierLimits } from '@/types/tiers'
import { TIER_LIMITS, getCurrentMonth } from './tier-config'
import { 
  TierErrorHandler, 
  TierErrorCode, 
  validateUsageStats, 
  validateFileList,
  handleAsyncTierOperation 
} from './tier-error-handler'
import { supabase } from './supabase'

export class TierService {
  getTierLimits(tier: UserTier): TierLimits {
    return TIER_LIMITS[tier]
  }

  async checkUsageLimit(
    userId: string,
    tier: UserTier,
    imageCount: number,
    totalFileSize: number
  ): Promise<TierUsageResult> {
    return handleAsyncTierOperation(async () => {
      // Validate inputs
      if (!userId || typeof userId !== 'string') {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USER_ID,
          'Invalid user ID provided',
          'Please sign out and sign back in to continue.'
        )
      }

      if (typeof imageCount !== 'number' || imageCount < 0) {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USAGE_DATA,
          'Invalid image count provided',
          'Invalid request. Please try again.'
        )
      }

      if (typeof totalFileSize !== 'number' || totalFileSize < 0) {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USAGE_DATA,
          'Invalid file size provided',
          'Invalid file size. Please try again.'
        )
      }

      const limits = this.getTierLimits(tier)
      const usage = await this.getUserUsage(userId)
      
      const currentUsage = usage?.imagesProcessed || 0
      const totalImagesAfterProcessing = currentUsage + imageCount

      // Check monthly image limit
      if (totalImagesAfterProcessing > limits.maxImagesPerMonth) {
        return {
          canProcess: false,
          remainingImages: Math.max(0, limits.maxImagesPerMonth - currentUsage),
          remainingStorage: 0,
          upgradeRequired: true,
          limitType: 'images',
          message: `Monthly limit of ${limits.maxImagesPerMonth} images reached. Upgrade your plan to process more images.`
        }
      }

      // Check file size limit  
      if (totalFileSize > limits.maxFileSize) {
        return {
          canProcess: false,
          remainingImages: Math.max(0, limits.maxImagesPerMonth - currentUsage),
          remainingStorage: 0,
          upgradeRequired: true,
          limitType: 'fileSize',
          message: `File size exceeds ${this.formatFileSize(limits.maxFileSize)} limit. Upgrade to process larger files.`
        }
      }

      return {
        canProcess: true,
        remainingImages: limits.maxImagesPerMonth - totalImagesAfterProcessing,
        remainingStorage: limits.maxFileSize - totalFileSize,
        upgradeRequired: false
      }
    }, 'checkUsageLimit')
  }

  async canProcessFiles(userId: string, tier: UserTier, files: File[]): Promise<TierUsageResult> {
    return handleAsyncTierOperation(async () => {
      // Validate inputs
      if (!userId || typeof userId !== 'string') {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USER_ID,
          'Invalid user ID provided',
          'Please sign out and sign back in to continue.'
        )
      }

      validateFileList(files)

      const limits = this.getTierLimits(tier)

      // Check batch size limit
      if (files.length > limits.maxBatchSize) {
        return {
          canProcess: false,
          remainingImages: 0,
          remainingStorage: 0,
          upgradeRequired: true,
          limitType: 'batchSize',
          message: `Batch size of ${files.length} exceeds limit of ${limits.maxBatchSize}. Upgrade to process more files at once.`
        }
      }

      // Check format support
      for (const file of files) {
        if (!limits.supportedFormats.includes(file.type)) {
          return {
            canProcess: false,
            remainingImages: 0,
            remainingStorage: 0,
            upgradeRequired: true,
            limitType: 'format',
            message: `Format ${file.type} is not supported in your current plan. Upgrade to access more formats.`
          }
        }
      }

      // Check individual file sizes and total usage
      const totalFileSize = files.reduce((sum, file) => sum + file.size, 0)
      const largestFile = Math.max(...files.map(f => f.size))

      if (largestFile > limits.maxFileSize) {
        return {
          canProcess: false,
          remainingImages: 0,
          remainingStorage: 0,
          upgradeRequired: true,
          limitType: 'fileSize',
          message: `File size exceeds ${this.formatFileSize(limits.maxFileSize)} limit.`
        }
      }

      return this.checkUsageLimit(userId, tier, files.length, totalFileSize)
    }, 'canProcessFiles')
  }

  async updateUsage(userId: string, imageCount: number, storageUsed: number): Promise<void> {
    return handleAsyncTierOperation(async () => {
      // Validate inputs
      if (!userId || typeof userId !== 'string') {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USER_ID,
          'Invalid user ID provided for usage update',
          'Unable to track usage. Please sign out and sign back in.'
        )
      }

      if (typeof imageCount !== 'number' || imageCount < 0) {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USAGE_DATA,
          'Invalid image count for usage update',
          'Unable to track usage. Please try again.'
        )
      }

      if (typeof storageUsed !== 'number' || storageUsed < 0) {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USAGE_DATA,
          'Invalid storage amount for usage update',
          'Unable to track usage. Please try again.'
        )
      }

      try {
        const { error } = await supabase.rpc('update_usage_stats', {
          user_uuid: userId,
          additional_images: imageCount,
          additional_storage: storageUsed
        })

        if (error) {
          throw TierErrorHandler.createError(
            TierErrorCode.DATABASE_ERROR,
            `Database error: ${error.message}`,
            'Unable to update usage statistics. Please try again.'
          )
        }
      } catch (error: any) {
        if (error.code) {
          // Re-throw TierErrorHandler errors
          throw error
        }
        
        console.error('Supabase usage update failed:', error)
        throw TierErrorHandler.createError(
          TierErrorCode.DATABASE_ERROR,
          `Failed to update usage: ${error.message}`,
          'Unable to track usage. Please try again.'
        )
      }
    }, 'updateUsage')
  }

  async getUserUsage(userId: string): Promise<UsageStats | null> {
    return handleAsyncTierOperation(async () => {
      if (!userId || typeof userId !== 'string') {
        throw TierErrorHandler.createError(
          TierErrorCode.INVALID_USER_ID,
          'Invalid user ID provided for usage retrieval',
          'Unable to retrieve usage data. Please sign out and sign back in.'
        )
      }

      try {
        const { data, error } = await supabase.rpc('get_current_usage', {
          user_uuid: userId
        })

        if (error) {
          throw TierErrorHandler.createError(
            TierErrorCode.DATABASE_ERROR,
            `Database error: ${error.message}`,
            'Unable to retrieve usage statistics. Please try again.'
          )
        }

        if (!data || data.length === 0) {
          // Return zero usage if no data found
          const currentMonth = getCurrentMonth()
          return {
            userId,
            currentMonth,
            imagesProcessed: 0,
            storageUsed: 0,
            lastUpdated: new Date().toISOString()
          }
        }

        const usage = data[0]
        const usageStats: UsageStats = {
          userId,
          currentMonth: usage.current_month,
          imagesProcessed: usage.images_processed,
          storageUsed: usage.storage_used,
          lastUpdated: usage.last_updated
        }

        try {
          validateUsageStats(usageStats)
          return usageStats
        } catch (error) {
          // If data is corrupted, return zero usage and log warning
          console.warn('Corrupted usage data detected during retrieval:', error)
          const currentMonth = getCurrentMonth()
          return {
            userId,
            currentMonth,
            imagesProcessed: 0,
            storageUsed: 0,
            lastUpdated: new Date().toISOString()
          }
        }
      } catch (error: any) {
        if (error.code) {
          // Re-throw TierErrorHandler errors
          throw error
        }
        
        console.error('Supabase usage retrieval failed:', error)
        throw TierErrorHandler.createError(
          TierErrorCode.DATABASE_ERROR,
          `Failed to retrieve usage: ${error.message}`,
          'Unable to retrieve usage data. Please try again.'
        )
      }
    }, 'getUserUsage')
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }
}

// Export singleton instance
export const tierService = new TierService()