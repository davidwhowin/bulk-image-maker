import { useState } from 'react';
import { Layout } from '@/components';
import { UploadWorkflow } from '@/features/upload';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';

function App() {
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Bulk Image Optimizer
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Compress and optimize multiple images at once with advanced performance features.
            Upload your images, preview them with real-time thumbnails, and download optimized results.
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

        {/* Main Upload Workflow */}
        <div className="max-w-6xl mx-auto">
          <UploadWorkflow />
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

export default App;
