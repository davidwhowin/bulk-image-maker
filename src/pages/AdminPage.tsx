import { useState } from 'react'
import { Layout } from '@/components'
import { TierConfigAdmin } from '@/components/admin'
import { AdminUsageControls } from '@/components/admin'
import { AdminTopUsers } from '@/components/admin'

type AdminTab = 'tier-config' | 'usage-controls' | 'top-users'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('tier-config')

  // No need for admin checks here - ProtectedRoute handles it

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">
            Manage tier configurations, user usage, and system settings
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('tier-config')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'tier-config'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                🎯 Tier Configuration
              </button>
              
              <button
                onClick={() => setActiveTab('usage-controls')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'usage-controls'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                📊 Usage Controls
              </button>
              
              <button
                onClick={() => setActiveTab('top-users')}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === 'top-users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                🏆 Top Users
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'tier-config' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Tier Configuration</h2>
                  <p className="text-sm text-gray-600">
                    Adjust subscription plan limits including max images per month, file sizes, and supported formats.
                    Changes are saved automatically and take effect immediately.
                  </p>
                </div>
                <TierConfigAdmin />
              </div>
            )}

            {activeTab === 'usage-controls' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Usage Controls</h2>
                  <p className="text-sm text-gray-600">
                    Manually adjust individual user usage statistics, reset monthly limits, and manage user accounts.
                  </p>
                </div>
                <AdminUsageControls />
              </div>
            )}

            {activeTab === 'top-users' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Top Users Dashboard</h2>
                  <p className="text-sm text-gray-600">
                    View top users by usage statistics and monthly analytics overview.
                  </p>
                </div>
                <AdminTopUsers />
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600">📈</span>
              </div>
              <h3 className="font-medium text-gray-900">Quick Stats</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Free Plan Max Images:</span>
                <span className="font-medium">Dynamic</span>
              </div>
              <div className="flex justify-between">
                <span>Configuration Source:</span>
                <span className="font-medium">Admin Panel</span>
              </div>
              <div className="flex justify-between">
                <span>Auto-Save:</span>
                <span className="font-medium text-green-600">Enabled</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-green-600">✅</span>
              </div>
              <h3 className="font-medium text-gray-900">Features</h3>
            </div>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>✓ Real-time tier adjustments</li>
              <li>✓ Visual comparison charts</li>
              <li>✓ Import/export configurations</li>
              <li>✓ User usage management</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-orange-600">⚡</span>
              </div>
              <h3 className="font-medium text-gray-900">Quick Actions</h3>
            </div>
            <div className="space-y-2">
              <button 
                onClick={() => setActiveTab('tier-config')}
                className="w-full text-left text-sm text-blue-600 hover:text-blue-700"
              >
                → Adjust free plan limits
              </button>
              <button 
                onClick={() => setActiveTab('usage-controls')}
                className="w-full text-left text-sm text-blue-600 hover:text-blue-700"
              >
                → Reset user usage
              </button>
              <button 
                onClick={() => setActiveTab('top-users')}
                className="w-full text-left text-sm text-blue-600 hover:text-blue-700"
              >
                → View top users
              </button>
              <button className="w-full text-left text-sm text-blue-600 hover:text-blue-700">
                → Export configuration
              </button>
            </div>
          </div>
        </div>

        {/* Warning Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Admin Access Required</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This page should only be accessible to system administrators. Configuration changes affect all users immediately.
                Make sure to test changes in a development environment first.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}