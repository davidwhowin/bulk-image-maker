import { useMemo, useCallback, memo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { VirtualScroll } from '@/components/common/VirtualScroll';
import { ImageComparison } from './ImageComparison';
import { useComparisonMemoryManager } from '@/hooks/useComparisonMemoryManager';
import { useLazyLoading } from '@/hooks/useLazyLoading';
import type { 
  ImageComparison as ImageComparisonType, 
  ComparisonGridSettings,
  VirtualScrollConfig 
} from '@/types';

interface OptimizedComparisonGridProps {
  comparisons: ImageComparisonType[];
  settings: ComparisonGridSettings;
  onSettingsChange?: (settings: ComparisonGridSettings) => void;
  onItemSelect?: (comparison: ImageComparisonType) => void;
  onItemDoubleClick?: (comparison: ImageComparisonType) => void;
  onContextMenu?: (comparison: ImageComparisonType) => void;
  onScroll?: (scrollTop: number) => void;
  className?: string;
  maxMemoryUsage?: number; // In bytes
  enablePreloading?: boolean;
}

export const OptimizedComparisonGrid = memo(function OptimizedComparisonGrid({
  comparisons,
  settings,
  onSettingsChange,
  onItemSelect,
  onItemDoubleClick,
  onContextMenu,
  onScroll,
  className,
  maxMemoryUsage = 500 * 1024 * 1024, // 500MB default
  enablePreloading = true,
}: OptimizedComparisonGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastVisibleRangeRef = useRef({ start: 0, end: 0 });

  // Memory management
  const memoryManager = useComparisonMemoryManager(comparisons);

  // Lazy loading
  const lazyLoading = useLazyLoading(comparisons.length, {
    rootMargin: '100px',
    threshold: 0.1,
    enabled: enablePreloading,
  });

  // Filter and sort comparisons (memoized)
  const processedComparisons = useMemo(() => {
    let filtered = comparisons;

    // Apply status filter
    if (settings.filterBy !== 'all') {
      filtered = filtered.filter(comparison => {
        switch (settings.filterBy) {
          case 'processed':
            return comparison.status === 'ready';
          case 'pending':
            return comparison.status === 'pending' || comparison.status === 'loading';
          case 'error':
            return comparison.status === 'error';
          default:
            return true;
        }
      });
    }

    // Sort comparisons
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let valueA: number | string;
      let valueB: number | string;

      switch (settings.sortBy) {
        case 'name':
          valueA = a.originalFile.name.toLowerCase();
          valueB = b.originalFile.name.toLowerCase();
          break;
        case 'originalSize':
          valueA = a.comparisonMetrics.originalSize;
          valueB = b.comparisonMetrics.originalSize;
          break;
        case 'compressedSize':
          valueA = a.comparisonMetrics.compressedSize;
          valueB = b.comparisonMetrics.compressedSize;
          break;
        case 'compressionRatio':
          valueA = a.comparisonMetrics.compressionRatio;
          valueB = b.comparisonMetrics.compressionRatio;
          break;
        case 'processingTime':
          valueA = a.comparisonMetrics.processingTime;
          valueB = b.comparisonMetrics.processingTime;
          break;
        default:
          return 0;
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return settings.sortOrder === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      const numA = valueA as number;
      const numB = valueB as number;
      
      return settings.sortOrder === 'asc' ? numA - numB : numB - numA;
    });

    return sorted;
  }, [comparisons, settings.filterBy, settings.sortBy, settings.sortOrder]);

  // Virtual scroll configuration
  const virtualScrollConfig: VirtualScrollConfig = useMemo(() => ({
    itemHeight: settings.itemHeight,
    overscan: 3, // Reduced overscan for better memory usage
    bufferSize: 10, // Smaller buffer
    windowHeight: 600,
  }), [settings.itemHeight]);

  // Handle memory pressure
  useEffect(() => {
    if (memoryManager.memoryStats.memoryUsage > maxMemoryUsage) {
      console.warn('Memory usage high, triggering cleanup');
      memoryManager.handleMemoryPressure();
    }
  }, [memoryManager.memoryStats.memoryUsage, maxMemoryUsage, memoryManager]);

  // Preload images for visible range
  const handleVisibleRangeChange = useCallback((start: number, end: number) => {
    lastVisibleRangeRef.current = { start, end };
    lazyLoading.updateVisibleRange(start, end);

    if (enablePreloading) {
      // Preload images in visible range + small buffer
      const preloadStart = Math.max(0, start - 2);
      const preloadEnd = Math.min(processedComparisons.length - 1, end + 2);

      lazyLoading.preloadRange(preloadStart, preloadEnd, (index) => {
        const comparison = processedComparisons[index];
        return comparison?.thumbnails.original || '';
      });
    }
  }, [lazyLoading, enablePreloading, processedComparisons]);

  // Enhanced scroll handler with memory management
  const handleScroll = useCallback((scrollTop: number) => {
    onScroll?.(scrollTop);
    
    // Calculate visible range based on scroll position
    const itemHeight = settings.itemHeight;
    const containerHeight = containerRef.current?.clientHeight || 600;
    
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(
      processedComparisons.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    );

    handleVisibleRangeChange(start, end);
  }, [onScroll, settings.itemHeight, processedComparisons.length, handleVisibleRangeChange]);

  // Optimized item renderer with lazy loading
  const renderComparisonItem = useCallback((comparison: ImageComparisonType, index: number) => {
    const itemId = `${comparison.id}-${index}`;
    const loadingStatus = lazyLoading.getLoadingStatus(itemId);

    return (
      <div
        key={comparison.id}
        data-testid={`comparison-item-${comparison.id}`}
        data-file-name={comparison.originalFile.name}
        className="p-2 cursor-pointer hover:bg-gray-50 rounded transition-colors"
        onClick={() => onItemSelect?.(comparison)}
        onDoubleClick={() => onItemDoubleClick?.(comparison)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu?.(comparison);
        }}
        ref={(el) => {
          if (el && enablePreloading) {
            lazyLoading.observeElement(el, itemId);
          }
        }}
      >
        {loadingStatus === 'loading' ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
            <span className="ml-2 text-sm text-gray-600">Loading...</span>
          </div>
        ) : loadingStatus === 'failed' ? (
          <div className="flex items-center justify-center h-32 text-red-500">
            <span className="text-sm">Failed to load</span>
          </div>
        ) : (
          <ImageComparison 
            comparison={comparison} 
            className="h-full"
          />
        )}
      </div>
    );
  }, [lazyLoading, enablePreloading, onItemSelect, onItemDoubleClick, onContextMenu]);

  // Handle settings changes with debouncing
  const handleSortDirectionToggle = useCallback(() => {
    onSettingsChange?.({
      ...settings,
      sortOrder: settings.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  }, [settings, onSettingsChange]);

  // Empty state
  if (processedComparisons.length === 0) {
    return (
      <div data-testid="empty-state" className={cn('flex items-center justify-center h-64', className)}>
        <div className="text-center">
          <div className="text-gray-500 mb-2">No comparisons to display</div>
          <div className="text-sm text-gray-400">
            Upload some images to see before/after comparisons
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      data-testid="optimized-comparison-grid" 
      className={cn('h-full flex flex-col', className)} 
      role="grid" 
      aria-label="Optimized image comparison grid"
    >
      {/* Header with stats and controls */}
      <div className="mb-4 flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-4">
          <span aria-label={`${processedComparisons.length} image comparisons displayed`}>
            {processedComparisons.length} comparisons
          </span>
          
          {/* Memory usage indicator */}
          <div className="text-sm text-gray-600">
            Memory: {Math.round(memoryManager.memoryStats.memoryUsage / (1024 * 1024))}MB
          </div>
          
          {/* Loading stats */}
          <div className="text-sm text-gray-600">
            Loaded: {lazyLoading.state.loadedImages.size}/{processedComparisons.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            data-testid="sort-direction-button"
            onClick={handleSortDirectionToggle}
            className="text-sm text-primary-600 hover:text-primary-700 px-3 py-1 rounded border border-primary-200 hover:border-primary-300"
          >
            Sort {settings.sortOrder === 'asc' ? '↑' : '↓'}
          </button>

          {memoryManager.memoryStats.memoryUsage > maxMemoryUsage * 0.8 && (
            <button
              onClick={memoryManager.handleMemoryPressure}
              className="text-sm text-orange-600 hover:text-orange-700 px-3 py-1 rounded border border-orange-200 hover:border-orange-300"
            >
              Free Memory
            </button>
          )}
        </div>
      </div>

      {/* Virtual scrolled grid */}
      <div className="flex-1">
        <VirtualScroll
          items={processedComparisons}
          config={virtualScrollConfig}
          onScroll={handleScroll}
        >
          {renderComparisonItem as any}
        </VirtualScroll>
      </div>

      {/* Memory warning */}
      {memoryManager.memoryStats.memoryUsage > maxMemoryUsage && (
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-center">
            <span className="text-yellow-800 text-sm">
              ⚠️ High memory usage detected. Consider reducing the number of comparisons or clearing cache.
            </span>
          </div>
        </div>
      )}
    </div>
  );
});