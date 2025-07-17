import { useState, useEffect } from 'react'
import { useAdminUsageControls } from '@/hooks/useAdminUsageControls'
import type { TopUserResult, UsageStatsOverview } from '@/hooks/useAdminUsageControls'

interface AdminTopUsersProps {
  className?: string
}

export function AdminTopUsers({ className = '' }: AdminTopUsersProps) {
  const [topUsers, setTopUsers] = useState<TopUserResult[]>([])
  const [statsOverview, setStatsOverview] = useState<UsageStatsOverview | null>(null)
  const [targetMonth, setTargetMonth] = useState('')
  const [orderBy, setOrderBy] = useState<'images' | 'storage'>('images')
  const [limit, setLimit] = useState(10)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const {
    getTopUsersByUsage,
    getUsageStatsOverview,
    isLoading,
    error,
    clearError,
    formatFileSize,
    formatMonth,
    getCurrentMonth
  } = useAdminUsageControls()

  useEffect(() => {
    const fetchData = async () => {
      clearError()
      
      // Fetch top users and stats overview in parallel
      const [usersResult, statsResult] = await Promise.all([
        getTopUsersByUsage(targetMonth || undefined, limit, orderBy),
        getUsageStatsOverview(targetMonth || undefined)
      ])
      
      setTopUsers(usersResult)
      setStatsOverview(statsResult)
    }

    void fetchData()
  }, [targetMonth, orderBy, limit, refreshTrigger, getTopUsersByUsage, getUsageStatsOverview, clearError])

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  const displayMonth = targetMonth || getCurrentMonth()

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Top Users Dashboard</h3>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <p className="text-sm text-gray-600">
          View top users by usage and monthly statistics overview.
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

      <div className="space-y-6">
        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="target-month" className="block text-sm font-medium text-gray-700 mb-2">
              Target Month
            </label>
            <input
              id="target-month"
              type="text"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              placeholder={`Current month: ${getCurrentMonth()}`}
              pattern="\\d{4}-\\d{2}"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="order-by" className="block text-sm font-medium text-gray-700 mb-2">
              Order By
            </label>
            <select
              id="order-by"
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value as 'images' | 'storage')}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="images">Images Processed</option>
              <option value="storage">Storage Used</option>
            </select>
          </div>

          <div>
            <label htmlFor="limit" className="block text-sm font-medium text-gray-700 mb-2">
              Limit
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
            </select>
          </div>
        </div>

        {/* Stats Overview */}
        {statsOverview && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-md font-semibold text-gray-900 mb-3">
              Overview for {formatMonth(displayMonth)}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statsOverview.total_users}</div>
                <div className="text-sm text-gray-600">Total Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{statsOverview.active_users}</div>
                <div className="text-sm text-gray-600">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{statsOverview.total_images.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Total Images</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{formatFileSize(statsOverview.total_storage)}</div>
                <div className="text-sm text-gray-600">Total Storage</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <span className="font-medium">Free:</span> {statsOverview.free_users} users
                </div>
                <div className="text-center">
                  <span className="font-medium">Pro:</span> {statsOverview.pro_users} users
                </div>
                <div className="text-center">
                  <span className="font-medium">Premium:</span> {statsOverview.premium_users} users
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Users Table */}
        <div>
          <h4 className="text-md font-semibold text-gray-900 mb-3">
            Top {limit} Users by {orderBy === 'images' ? 'Images Processed' : 'Storage Used'}
          </h4>
          
          {topUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {isLoading ? 'Loading top users...' : 'No usage data found for this month.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tier
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Images
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Storage
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {topUsers.map((user, index) => (
                    <tr key={user.user_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        #{index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="font-medium">{user.email}</div>
                        <div className="text-xs text-gray-500">{user.user_id}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.user_tier === 'PREMIUM' 
                            ? 'bg-purple-100 text-purple-800'
                            : user.user_tier === 'PRO'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {user.user_tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {user.images_processed.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatFileSize(user.storage_used)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(user.last_updated).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}