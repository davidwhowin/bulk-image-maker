import { useState, useCallback } from 'react';
import { OptimizedComparisonGrid } from './OptimizedComparisonGrid';
import { ComparisonProcessor } from '@/lib/comparison-processor';
import { ComparisonExporter } from '@/lib/comparison-export';
import type { 
  ImageComparison, 
  ComparisonGridSettings,
  ComparisonExportOptions 
} from '@/types';

export function ComparisonDemo() {
  const [comparisons, setComparisons] = useState<ImageComparison[]>([]);
  const [selectedComparison, setSelectedComparison] = useState<ImageComparison | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const [gridSettings, setGridSettings] = useState<ComparisonGridSettings>({
    itemsPerRow: 3,
    itemHeight: 300,
    showMetrics: true,
    viewMode: 'side-by-side',
    sortBy: 'name',
    sortOrder: 'asc',
    filterBy: 'all',
  });

  // Initialize processor and exporter
  const processor = new ComparisonProcessor();
  const exporter = new ComparisonExporter();

  const handleAddComparison = useCallback(async (originalFile: File) => {
    try {
      // Create mock ImageFile for demo
      const imageFile = {
        id: `file-${Date.now()}`,
        file: originalFile,
        name: originalFile.name,
        size: originalFile.size,
        type: originalFile.type,
        status: 'completed' as const,
        progress: 100,
      };

      const comparison = await processor.createComparison(imageFile);
      setComparisons(prev => [...prev, comparison]);
    } catch (error) {
      console.error('Failed to create comparison:', error);
    }
  }, [processor]);

  const handleExport = useCallback(async (format: 'json' | 'csv' | 'html' | 'pdf') => {
    if (comparisons.length === 0) return;

    setIsExporting(true);
    try {
      const options: ComparisonExportOptions = {
        includeMetrics: true,
        includeImages: format === 'html',
        format,
        imageQuality: 80,
      };

      const result = await exporter.exportComparisons(comparisons, options);
      
      // Download the file
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`Exported ${result.includedComparisons} comparisons as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [comparisons, exporter]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    files.forEach(handleAddComparison);
  }, [handleAddComparison]);

  const handleClearComparisons = useCallback(() => {
    setComparisons([]);
    setSelectedComparison(null);
    processor.cleanup();
  }, [processor]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 text-white p-6">
          <h1 className="text-3xl font-bold mb-2">Image Comparison Demo</h1>
          <p className="text-primary-100">
            Side-by-side before/after comparison with advanced performance optimization
          </p>
        </div>

        {/* Controls */}
        <div className="p-6 border-b bg-gray-50">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Images
              </label>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Items per row:</label>
              <select
                value={gridSettings.itemsPerRow}
                onChange={(e) => setGridSettings(prev => ({ ...prev, itemsPerRow: Number(e.target.value) }))}
                className="rounded border-gray-300 text-sm"
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={gridSettings.sortBy}
                onChange={(e) => setGridSettings(prev => ({ ...prev, sortBy: e.target.value as any }))}
                className="rounded border-gray-300 text-sm"
              >
                <option value="name">Name</option>
                <option value="originalSize">Original Size</option>
                <option value="compressedSize">Compressed Size</option>
                <option value="compressionRatio">Compression Ratio</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={gridSettings.filterBy}
                onChange={(e) => setGridSettings(prev => ({ ...prev, filterBy: e.target.value as any }))}
                className="rounded border-gray-300 text-sm"
              >
                <option value="all">All</option>
                <option value="processed">Processed</option>
                <option value="pending">Pending</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="showMetrics"
                checked={gridSettings.showMetrics}
                onChange={(e) => setGridSettings(prev => ({ ...prev, showMetrics: e.target.checked }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="showMetrics" className="ml-2 text-sm text-gray-700">
                Show metrics
              </label>
            </div>
          </div>
        </div>

        {/* Export Controls */}
        <div className="p-6 border-b bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Export Options</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('json')}
                disabled={isExporting || comparisons.length === 0}
                className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
              >
                JSON
              </button>
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting || comparisons.length === 0}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                CSV
              </button>
              <button
                onClick={() => handleExport('html')}
                disabled={isExporting || comparisons.length === 0}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                HTML
              </button>
              <button
                onClick={handleClearComparisons}
                disabled={comparisons.length === 0}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Clear All
              </button>
            </div>
          </div>
          {isExporting && (
            <div className="mt-2 text-sm text-gray-600">Exporting...</div>
          )}
        </div>

        {/* Comparison Grid */}
        <div className="p-6">
          <OptimizedComparisonGrid
            comparisons={comparisons}
            settings={gridSettings}
            onSettingsChange={setGridSettings}
            onItemSelect={setSelectedComparison}
            onItemDoubleClick={(comparison) => {
              console.log('Double-clicked:', comparison.originalFile.name);
              // Could open fullscreen view
            }}
            onContextMenu={(comparison) => {
              console.log('Context menu:', comparison.originalFile.name);
              // Could show context menu
            }}
            className="min-h-[600px]"
            maxMemoryUsage={200 * 1024 * 1024} // 200MB
            enablePreloading={true}
          />
        </div>

        {/* Selected Comparison Details */}
        {selectedComparison && (
          <div className="p-6 border-t bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Selected: {selectedComparison.originalFile.name}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-700">Status</div>
                <div className="capitalize">{selectedComparison.status}</div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Original Size</div>
                <div>{(selectedComparison.comparisonMetrics.originalSize / 1024).toFixed(1)} KB</div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Compressed Size</div>
                <div>{(selectedComparison.comparisonMetrics.compressedSize / 1024).toFixed(1)} KB</div>
              </div>
              <div>
                <div className="font-medium text-gray-700">Savings</div>
                <div className="text-green-600">
                  {selectedComparison.comparisonMetrics.sizeSavingsPercent.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature List */}
        <div className="p-6 border-t bg-white">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Features Implemented</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">🎯 Core Features</h4>
              <ul className="space-y-1 text-gray-600">
                <li>✅ Side-by-side comparison</li>
                <li>✅ Overlay view mode</li>
                <li>✅ Zoom and pan controls</li>
                <li>✅ Metrics calculation</li>
                <li>✅ Error handling</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">⚡ Performance</h4>
              <ul className="space-y-1 text-gray-600">
                <li>✅ Virtual scrolling</li>
                <li>✅ Lazy loading</li>
                <li>✅ Memory management</li>
                <li>✅ Thumbnail caching</li>
                <li>✅ Debounced interactions</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">📊 Export & Data</h4>
              <ul className="space-y-1 text-gray-600">
                <li>✅ JSON export</li>
                <li>✅ CSV export</li>
                <li>✅ HTML reports</li>
                <li>✅ PDF generation</li>
                <li>✅ Comprehensive tests</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}