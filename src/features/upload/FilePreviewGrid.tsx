import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { cn, formatFileSize } from '@/lib/utils';
import {
  createOptimizedIntersectionObserver,
  performanceMonitor,
  MemoryManager,
} from '@/lib/performance-utils';
import { FilePreviewItem } from './FilePreviewItem';
import type { ImageFile } from '@/types';

interface FilePreviewGridProps {
  files: ImageFile[];
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
}

const ITEMS_PER_PAGE = 20;

export const FilePreviewGrid = memo(function FilePreviewGrid({
  files,
  onRemoveFile,
  onClearAll,
}: FilePreviewGridProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [visibleItems, setVisibleItems] = useState(new Set<string>());
  const gridRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Memoize expensive calculations
  const { totalSize, statusCounts } = useMemo(() => {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const statusCounts = files.reduce(
      (acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return { totalSize, statusCounts };
  }, [files]);

  // Memoize displayed files to prevent unnecessary recalculation
  const displayedFiles = useMemo(
    () => files.slice(0, visibleCount),
    [files, visibleCount]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, fileId: string) => {
      if (e.key === 'Delete') {
        onRemoveFile(fileId);
      }
    },
    [onRemoveFile]
  );

  // Performance monitoring
  useEffect(() => {
    performanceMonitor.updateFileCounts(files.length, visibleItems.size);
    performanceMonitor.recordMemoryUsage();

    // Check if cleanup is needed
    const memoryManager = MemoryManager.getInstance();
    if (memoryManager.shouldCleanup()) {
      console.warn('Memory threshold reached, consider clearing caches');
    }
  }, [files.length, visibleItems.size]);

  // Optimized intersection observer for lazy loading
  useEffect(() => {
    const observer = createOptimizedIntersectionObserver(
      (entries) => {
        performanceMonitor.measureRenderTime(() => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const itemId = entry.target.getAttribute('data-file-id');
              if (itemId) {
                setVisibleItems((prev) => new Set([...prev, itemId]));
              }
            }
          });
        });
      },
      {
        threshold: 0.1,
        rootMargin: '100px',
        throttleDelay: 150,
      }
    );

    // Observe file items
    const fileItems = gridRef.current?.querySelectorAll('[data-file-id]');
    fileItems?.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [files, visibleCount]);

  // Load more observer with performance optimization
  useEffect(() => {
    const observer = createOptimizedIntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < files.length) {
          performanceMonitor.measureRenderTime(() => {
            setVisibleCount((prev) =>
              Math.min(prev + ITEMS_PER_PAGE, files.length)
            );
          });
        }
      },
      {
        threshold: 0.1,
        throttleDelay: 200,
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [files.length, visibleCount]);

  if (files.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">No files uploaded yet</p>
        <div role="status" aria-live="polite" className="sr-only">
          No files
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* File Summary */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-gray-900">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </h3>
          <p className="text-sm text-gray-600">
            {formatFileSize(totalSize)} total
          </p>
          {Object.keys(statusCounts).length > 1 && (
            <div className="space-x-4 text-xs text-gray-500">
              {statusCounts.pending && (
                <span>{statusCounts.pending} pending</span>
              )}
              {statusCounts.processing && (
                <span>{statusCounts.processing} processing</span>
              )}
              {statusCounts.completed && (
                <span>{statusCounts.completed} completed</span>
              )}
              {statusCounts.error && <span>{statusCounts.error} error</span>}
            </div>
          )}
        </div>

        <button
          onClick={() => setShowClearConfirm(true)}
          className="btn-secondary text-sm"
          aria-label="Clear all files"
        >
          Clear All
        </button>
      </div>

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 max-w-sm rounded-lg bg-white p-6">
            <h3 className="mb-2 text-lg font-medium text-gray-900">
              Clear All Files
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Are you sure you want to clear all files? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAll();
                  setShowClearConfirm(false);
                }}
                className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Grid */}
      <div
        ref={gridRef}
        data-testid="file-preview-grid"
        className={cn(
          'grid gap-4',
          'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
        )}
      >
        {displayedFiles.map((file) => (
          <div key={file.id} data-file-id={file.id}>
            <FilePreviewItem
              file={file}
              onRemoveFile={onRemoveFile}
              onKeyDown={handleKeyDown}
              isVisible={visibleItems.has(file.id)}
            />
          </div>
        ))}
      </div>

      {/* Load More Indicator */}
      {visibleCount < files.length && (
        <div ref={loadMoreRef} className="py-4 text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500">
              Loading more files... ({visibleCount} of {files.length})
            </p>
          </div>
        </div>
      )}

      {/* All loaded indicator */}
      {visibleCount >= files.length && files.length > ITEMS_PER_PAGE && (
        <div className="py-4 text-center">
          <p className="text-sm text-gray-500">
            All {files.length} files loaded
          </p>
        </div>
      )}

      {/* Status for Screen Reader */}
      <div role="status" aria-live="polite" className="sr-only">
        {files.length > 0
          ? `${files.length} file${files.length !== 1 ? 's' : ''}`
          : 'No files'}
      </div>
    </div>
  );
});
