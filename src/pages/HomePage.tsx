import { useState } from 'react';
import { Layout } from '@/components';
import { UploadWorkflow } from '@/features/upload';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { TierStatusDisplay } from '@/components/tiers';
import { useAuthStore } from '@/lib/auth-store';

export default function HomePage() {
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const { isAuthenticated } = useAuthStore();

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Professional Image Processing
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Compress, optimize, and convert multiple images at once with intelligent format selection and quality controls.
          </p>
        </div>

        {/* Performance Monitor Toggle */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowPerformanceMonitor(true)}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
            title="View performance metrics and optimization stats"
          >
            📊 Performance Monitor
          </button>
        </div>

        {/* Main Workflow */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-3">
              <UploadWorkflow />
            </div>
            
            {/* Sidebar - Tier Status (only if authenticated) */}
            {isAuthenticated && (
              <div className="lg:col-span-1">
                <TierStatusDisplay />
              </div>
            )}
          </div>
        </div>

        {/* Performance Monitor Modal */}
        <PerformanceMonitor
          isVisible={showPerformanceMonitor}
          onClose={() => setShowPerformanceMonitor(false)}
        />
      </div>
    </Layout>
  );
}

