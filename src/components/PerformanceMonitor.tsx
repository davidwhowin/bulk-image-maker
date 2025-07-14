import { useState, useEffect } from 'react';
import { performanceMonitor, MemoryManager } from '@/lib/performance-utils';
import { useImageWorker } from '@/hooks/useImageWorker';

interface PerformanceMonitorProps {
  isVisible?: boolean;
  onClose?: () => void;
}

export function PerformanceMonitor({ isVisible = false, onClose }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState(performanceMonitor.getMetrics());
  const [memoryStats, setMemoryStats] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<{ size: number; keys: string[] } | null>(null);
  const { getCacheStats, clearCache, forceMemoryCleanup, isSupported: workerSupported } = useImageWorker();
  const memoryManager = MemoryManager.getInstance();

  useEffect(() => {
    if (!isVisible) return;

    const updateMetrics = () => {
      setMetrics(performanceMonitor.getMetrics());
      setMemoryStats(memoryManager.getMemoryStats());
      
      if (workerSupported) {
        getCacheStats().then(setCacheStats).catch(() => setCacheStats(null));
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000);

    return () => clearInterval(interval);
  }, [isVisible, memoryManager, getCacheStats, workerSupported]);

  const handleClearCache = async () => {
    try {
      await clearCache();
      memoryManager.revokeAllObjectUrls();
      setMetrics(performanceMonitor.getMetrics());
      setCacheStats(null);
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  const handleResetMetrics = () => {
    performanceMonitor.reset();
    setMetrics(performanceMonitor.getMetrics());
  };

  const handleForceCleanup = async () => {
    try {
      // Clear worker cache
      await clearCache();
      
      // Force memory cleanup
      await forceMemoryCleanup();
      
      // Clear main thread cache
      memoryManager.revokeAllObjectUrls();
      memoryManager.forceGarbageCollection();
      
      // Reset metrics
      performanceMonitor.reset();
      
      // Update displays
      setMetrics(performanceMonitor.getMetrics());
      setMemoryStats(memoryManager.getMemoryStats());
      setCacheStats(null);
    } catch (error) {
      console.error('Error during force cleanup:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTime = (ms: number) => {
    return `${ms.toFixed(1)}ms`;
  };

  if (!isVisible) return null;

  const recommendations = performanceMonitor.getRecommendations();
  const isPerformanceDegrading = performanceMonitor.isPerformanceDegrading();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto mx-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Performance Monitor</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close performance monitor"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* File Processing Stats */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">File Processing</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Files:</span>
                <span className="text-sm font-medium">{metrics.totalFiles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Processed:</span>
                <span className="text-sm font-medium">{metrics.processedFiles}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Cache Hit Rate:</span>
                <span className="text-sm font-medium">{metrics.cacheHitRate.toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Performance</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Thumbnail Time:</span>
                <span className="text-sm font-medium">{formatTime(metrics.averageThumbnailTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Avg Render Time:</span>
                <span className="text-sm font-medium">{formatTime(metrics.averageRenderTime)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Performance Status:</span>
                <span className={`text-sm font-medium ${isPerformanceDegrading ? 'text-red-600' : 'text-green-600'}`}>
                  {isPerformanceDegrading ? 'Degrading' : 'Good'}
                </span>
              </div>
            </div>
          </div>

          {/* Memory Stats */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Memory Usage</h3>
            <div className="space-y-2">
              {memoryStats ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Current:</span>
                    <span className="text-sm font-medium">{formatBytes(memoryStats.used)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total:</span>
                    <span className="text-sm font-medium">{formatBytes(memoryStats.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Object URLs:</span>
                    <span className="text-sm font-medium">{memoryStats.objectUrls}</span>
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-500">Memory stats not available</div>
              )}
            </div>
          </div>

          {/* Cache Stats */}
          {workerSupported && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Worker Cache</h3>
              <div className="space-y-2">
                {cacheStats ? (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cached Items:</span>
                      <span className="text-sm font-medium">{cacheStats.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cache Keys:</span>
                      <span className="text-sm font-medium">{cacheStats.keys.length}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-gray-500">Cache stats not available</div>
                )}
              </div>
            </div>
          )}

          {/* Performance Chart Placeholder */}
          <div className="bg-gray-50 rounded-lg p-4 md:col-span-2">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Performance Trends</h3>
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Recent Thumbnail Times:</div>
              <div className="flex space-x-1 h-8 items-end">
                {metrics.thumbnailGenerationTime.slice(-20).map((time, i) => (
                  <div
                    key={i}
                    className="bg-blue-500 w-2"
                    style={{ height: `${Math.min((time / 1000) * 32, 32)}px` }}
                    title={`${formatTime(time)}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-yellow-800 mb-2">Performance Recommendations</h3>
            <ul className="list-disc list-inside space-y-1">
              {recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-yellow-700">{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={handleClearCache}
            className="btn-secondary text-sm"
          >
            Clear Cache
          </button>
          <button
            onClick={handleResetMetrics}
            className="btn-secondary text-sm"
          >
            Reset Metrics
          </button>
          <button
            onClick={() => {
              memoryManager.forceGarbageCollection();
              setMetrics(performanceMonitor.getMetrics());
            }}
            className="btn-secondary text-sm"
          >
            Force GC
          </button>
          <button
            onClick={handleForceCleanup}
            className="bg-red-600 text-white px-3 py-2 rounded-md text-sm hover:bg-red-700"
            title="Aggressive memory cleanup - clears all caches and forces garbage collection"
          >
            Force Memory Cleanup
          </button>
        </div>
      </div>
    </div>
  );
}