import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import type { TierUsageResult } from '@/types/tiers'
import { formatFileSize } from '@/lib/tier-config'

interface TierLimitCheckerProps {
  files: File[]
  onLimitCheckResult: (result: TierUsageResult) => void
  children: React.ReactNode
}

export function TierLimitChecker({ files, onLimitCheckResult, children }: TierLimitCheckerProps) {
  const { checkFileUploadLimits, userTier } = useAuthStore()
  const [limitResult, setLimitResult] = useState<TierUsageResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (files.length === 0) {
      setLimitResult(null)
      onLimitCheckResult({ canProcess: true, remainingImages: 0, remainingStorage: 0, upgradeRequired: false })
      return
    }

    const checkLimits = async () => {
      setIsChecking(true)
      try {
        const result = await checkFileUploadLimits(files)
        setLimitResult(result)
        onLimitCheckResult(result)
      } catch (error) {
        console.error('Error checking tier limits:', error)
        const errorResult: TierUsageResult = {
          canProcess: false,
          remainingImages: 0,
          remainingStorage: 0,
          upgradeRequired: false,
          message: 'Unable to check limits. Please try again.'
        }
        setLimitResult(errorResult)
        onLimitCheckResult(errorResult)
      } finally {
        setIsChecking(false)
      }
    }

    checkLimits()
  }, [files, checkFileUploadLimits, onLimitCheckResult])

  if (isChecking) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-blue-700">Checking tier limits...</span>
        </div>
      </div>
    )
  }

  if (limitResult && !limitResult.canProcess) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">
              {getLimitTitle(limitResult.limitType, userTier)}
            </h3>
            <p className="text-sm text-red-700 mt-1">
              {limitResult.message}
            </p>
            {limitResult.upgradeRequired && (
              <div className="mt-3">
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Upgrade to {getUpgradeTarget(userTier)}
                </button>
                <span className="ml-3 text-sm text-red-600">
                  or remove some files to continue
                </span>
              </div>
            )}
            {renderLimitDetails(limitResult, files)}
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function getLimitTitle(limitType?: string, userTier?: string): string {
  switch (limitType) {
    case 'images': return 'Monthly image limit exceeded'
    case 'fileSize': return 'File size limit exceeded'
    case 'batchSize': return 'Batch size limit exceeded'
    case 'format': return 'Unsupported file format'
    default: return `${userTier?.charAt(0).toUpperCase()}${userTier?.slice(1)} plan limit reached`
  }
}

function getUpgradeTarget(userTier?: string): string {
  switch (userTier) {
    case 'free': return 'Pro'
    case 'pro': return 'Team'
    case 'team': return 'Enterprise'
    default: return 'Pro'
  }
}

function renderLimitDetails(result: TierUsageResult, files: File[]) {
  if (result.limitType === 'fileSize') {
    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024) // Free tier limit
    if (oversizedFiles.length > 0) {
      return (
        <div className="mt-3 text-sm text-red-700">
          <p className="font-medium">Large files detected:</p>
          <ul className="mt-1 list-disc list-inside">
            {oversizedFiles.slice(0, 3).map((file, index) => (
              <li key={index}>{file.name} ({formatFileSize(file.size)})</li>
            ))}
            {oversizedFiles.length > 3 && (
              <li>...and {oversizedFiles.length - 3} more</li>
            )}
          </ul>
        </div>
      )
    }
  }

  if (result.limitType === 'format') {
    const unsupportedFiles = files.filter(file => 
      !['image/jpeg', 'image/png'].includes(file.type)
    )
    if (unsupportedFiles.length > 0) {
      return (
        <div className="mt-3 text-sm text-red-700">
          <p className="font-medium">Unsupported formats:</p>
          <ul className="mt-1 list-disc list-inside">
            {unsupportedFiles.slice(0, 3).map((file, index) => (
              <li key={index}>{file.name} ({file.type})</li>
            ))}
            {unsupportedFiles.length > 3 && (
              <li>...and {unsupportedFiles.length - 3} more</li>
            )}
          </ul>
        </div>
      )
    }
  }

  return null
}