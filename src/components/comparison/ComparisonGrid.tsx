import { useMemo, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import { VirtualScroll } from '@/components/common/VirtualScroll';
import { ImageComparison } from './ImageComparison';
import type { 
  ImageComparison as ImageComparisonType, 
  ComparisonGridSettings,
  VirtualScrollConfig 
} from '@/types';

interface ComparisonGridProps {
  comparisons: ImageComparisonType[];
  settings: ComparisonGridSettings;
  onSettingsChange?: (settings: ComparisonGridSettings) => void;
  onItemSelect?: (comparison: ImageComparisonType) => void;
  onItemDoubleClick?: (comparison: ImageComparisonType) => void;
  onContextMenu?: (comparison: ImageComparisonType) => void;
  onScroll?: (scrollTop: number) => void;
  itemRenderer?: (comparison: ImageComparisonType, index: number) => React.ReactNode;
  className?: string;
}

export const ComparisonGrid = memo(function ComparisonGrid({
  comparisons,
  settings,
  onSettingsChange,
  onItemSelect,
  onItemDoubleClick,
  onContextMenu,
  onScroll,
  itemRenderer,
  className,
}: ComparisonGridProps) {
  // Filter comparisons based on settings
  const filteredComparisons = useMemo(() => {
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

    return filtered;
  }, [comparisons, settings.filterBy]);

  // Sort comparisons based on settings
  const sortedComparisons = useMemo(() => {
    const sorted = [...filteredComparisons];

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
  }, [filteredComparisons, settings.sortBy, settings.sortOrder]);

  // Virtual scroll configuration
  const virtualScrollConfig: VirtualScrollConfig = useMemo(() => ({
    itemHeight: settings.itemHeight,
    overscan: 5,
    bufferSize: 20,
    windowHeight: 600, // This would be dynamic based on container
  }), [settings.itemHeight]);

  const handleSortDirectionToggle = useCallback(() => {
    onSettingsChange?.({
      ...settings,
      sortOrder: settings.sortOrder === 'asc' ? 'desc' : 'asc',
    });
  }, [settings, onSettingsChange]);

  const handleItemClick = useCallback((comparison: ImageComparisonType) => {
    onItemSelect?.(comparison);
  }, [onItemSelect]);

  const handleItemDoubleClick = useCallback((comparison: ImageComparisonType) => {
    onItemDoubleClick?.(comparison);
  }, [onItemDoubleClick]);

  const handleItemContextMenu = useCallback((comparison: ImageComparisonType) => {
    onContextMenu?.(comparison);
  }, [onContextMenu]);

  // Default item renderer
  const defaultItemRenderer = useCallback((comparison: ImageComparisonType, _index: number) => (
    <div
      key={comparison.id}
      data-testid={`comparison-item-${comparison.id}`}
      data-file-name={comparison.originalFile.name}
      className="p-2 cursor-pointer hover:bg-gray-50 rounded"
      onClick={() => handleItemClick(comparison)}
      onDoubleClick={() => handleItemDoubleClick(comparison)}
      onContextMenu={(e) => {
        e.preventDefault();
        handleItemContextMenu(comparison);
      }}
    >
      {comparison.status === 'loading' ? (
        <div data-testid={`loading-item-${comparison.id}`} className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
        </div>
      ) : (
        <ImageComparison comparison={comparison} className="h-full" />
      )}
    </div>
  ), [handleItemClick, handleItemDoubleClick, handleItemContextMenu]);

  const renderItem = itemRenderer || defaultItemRenderer;

  // Empty state
  if (sortedComparisons.length === 0) {
    return (
      <div data-testid="empty-state" className={cn('flex items-center justify-center h-64', className)}>
        <div className="text-gray-500">No comparisons to display</div>
      </div>
    );
  }

  // Use virtual scrolling for large datasets
  if (sortedComparisons.length > 50) {
    return (
      <div data-testid="comparison-grid" className={cn('h-full', className)} role="grid" aria-label="Image comparison grid">
        <div className="mb-4 flex items-center justify-between">
          <span aria-label={`${sortedComparisons.length} image comparisons displayed`}>
            {sortedComparisons.length} comparisons
          </span>
          <button
            data-testid="sort-direction-button"
            onClick={handleSortDirectionToggle}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Sort {settings.sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
        
        <VirtualScroll
          items={sortedComparisons}
          config={virtualScrollConfig}
          onScroll={onScroll}
        >
          {renderItem as any}
        </VirtualScroll>
      </div>
    );
  }

  // Regular grid for smaller datasets
  return (
    <div data-testid="comparison-grid" className={cn('h-full', className)} role="grid" aria-label="Image comparison grid">
      <div className="mb-4 flex items-center justify-between">
        <span aria-label={`${sortedComparisons.length} image comparisons displayed`}>
          {sortedComparisons.length} comparisons
        </span>
        <button
          data-testid="sort-direction-button"
          onClick={handleSortDirectionToggle}
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          Sort {settings.sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div 
        data-testid="scroll-container"
        className="grid gap-4 overflow-auto"
        style={{
          gridTemplateColumns: `repeat(${settings.itemsPerRow}, 1fr)`,
        }}
      >
        {sortedComparisons.map((comparison, index) => renderItem(comparison, index))}
      </div>
    </div>
  );
});