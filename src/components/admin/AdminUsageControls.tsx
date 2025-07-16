import { useState } from 'react'
import { useAdminUsageControls } from '@/hooks/useAdminUsageControls'
import type { UsageHistoryEntry } from '@/hooks/useAdminUsageControls'

interface AdminUsageControlsProps {
  userId?: string
  className?: string
}

export function AdminUsageControls({ userId = '', className = '' }: AdminUsageControlsProps) {
  const [inputUserId, setInputUserId] = useState(userId)
  const [imagesCount, setImagesCount] = useState(0)
  const [storageBytes, setStorageBytes] = useState(0)
  const [targetMonth, setTargetMonth] = useState('')
  const [usageHistory, setUsageHistory] = useState<UsageHistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    setUserUsage,
    resetUserUsage,
    getUserUsageHistory,
    bulkResetUsage,
    isLoading,
    error,
    clearError,
    formatFileSize,
    formatMonth,
    getCurrentMonth
  } = useAdminUsageControls()

  const handleSetUsage = async () => {
    if (!inputUserId.trim()) {
      alert('Please enter a user ID')
      return
    }

    clearError()
    setSuccessMessage(null)

    const result = await setUserUsage(
      inputUserId.trim(),
      imagesCount,
      storageBytes,
      targetMonth || undefined
    )

    if (result.success) {
      setSuccessMessage(
        `Successfully updated usage: ${result.previous_images} → ${result.new_images} images, ` +
        `${formatFileSize(result.previous_storage || 0)} → ${formatFileSize(result.new_storage || 0)}`
      )
    }
  }

  const handleResetUsage = async () => {
    if (!inputUserId.trim()) {
      alert('Please enter a user ID')
      return
    }

    if (!confirm(`Are you sure you want to reset usage stats for user ${inputUserId}?`)) {
      return
    }

    clearError()
    setSuccessMessage(null)

    const result = await resetUserUsage(inputUserId.trim(), targetMonth || undefined)

    if (result.success) {
      setSuccessMessage(`Successfully reset usage stats for user ${inputUserId}`)
    }
  }

  const handleGetHistory = async () => {
    if (!inputUserId.trim()) {
      alert('Please enter a user ID')
      return
    }

    clearError()
    setSuccessMessage(null)

    const history = await getUserUsageHistory(inputUserId.trim(), 6)
    setUsageHistory(history)
    setShowHistory(true)
  }

  const handleBulkReset = async () => {
    const monthToReset = targetMonth || getCurrentMonth()
    
    if (!confirm(
      `⚠️ WARNING: This will reset usage stats for ALL USERS in ${formatMonth(monthToReset)}. ` +
      `This action cannot be undone. Are you absolutely sure?`
    )) {
      return
    }

    clearError()
    setSuccessMessage(null)

    const result = await bulkResetUsage(targetMonth || undefined)

    if (result.success) {
      setSuccessMessage(
        `Successfully reset usage stats for ${result.affected_users} users in ${formatMonth(result.month || monthToReset)}`
      )
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Admin Usage Controls</h3>
        <p className="text-sm text-gray-600">
          Manage user monthly image processing usage statistics. Use with caution.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-sm text-red-700">{error}</div>
          <button
            onClick={clearError}
            className="mt-1 text-xs text-red-600 hover:text-red-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Success Display */}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-3">
          <div className="text-sm text-green-700">{successMessage}</div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="mt-1 text-xs text-green-600 hover:text-green-800 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* User ID Input */}
        <div>
          <label htmlFor="user-id" className="block text-sm font-medium text-gray-700 mb-2">
            User ID (UUID)
          </label>
          <input
            id="user-id"
            type="text"
            value={inputUserId}
            onChange={(e) => setInputUserId(e.target.value)}
            placeholder="Enter user UUID..."
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Target Month */}
        <div>
          <label htmlFor="target-month" className="block text-sm font-medium text-gray-700 mb-2">
            Target Month (optional)
          </label>
          <input
            id="target-month"
            type="text"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            placeholder={`Current month: ${getCurrentMonth()}`}
            pattern="\d{4}-\d{2}"
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Format: YYYY-MM (e.g., 2025-01). Leave blank for current month.
          </p>
        </div>

        {/* Set Usage Values */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="images-count" className="block text-sm font-medium text-gray-700 mb-2">
              Images Count
            </label>
            <input
              id="images-count"
              type="number"
              min="0"
              value={imagesCount}
              onChange={(e) => setImagesCount(parseInt(e.target.value) || 0)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="storage-bytes" className="block text-sm font-medium text-gray-700 mb-2">
              Storage (bytes)
            </label>
            <input
              id="storage-bytes"
              type="number"
              min="0"
              value={storageBytes}
              onChange={(e) => setStorageBytes(parseInt(e.target.value) || 0)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Current: {formatFileSize(storageBytes)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void handleSetUsage()}
            disabled={isLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Setting...' : 'Set Usage'}
          </button>

          <button
            onClick={() => void handleResetUsage()}
            disabled={isLoading}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Resetting...' : 'Reset to Zero'}
          </button>

          <button
            onClick={() => void handleGetHistory()}
            disabled={isLoading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Loading...' : 'Get History'}
          </button>

          <button
            onClick={() => void handleBulkReset()}
            disabled={isLoading}
            className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Resetting...' : '⚠️ Bulk Reset All Users'}
          </button>
        </div>

        {/* Usage History Display */}
        {showHistory && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-900">Usage History</h4>
              <button
                onClick={() => setShowHistory(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Hide
              </button>
            </div>

            {usageHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No usage history found for this user.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Month
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Images
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Storage
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {usageHistory.map((entry) => (
                      <tr key={entry.month}>
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">
                          {formatMonth(entry.month)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {entry.images_processed.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {formatFileSize(entry.storage_used)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {new Date(entry.last_updated).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}