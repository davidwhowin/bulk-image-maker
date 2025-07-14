import { useState, useEffect, useRef, useCallback } from 'react';
import { cn, formatFileSize } from '@/lib/utils';
import { createOptimizedIntersectionObserver, performanceMonitor, MemoryManager } from '@/lib/performance-utils';
import { FilePreviewItem } from './FilePreviewItem';
import type { ImageFile } from '@/types';

interface FilePreviewGridProps {
  files: ImageFile[];
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
}

const ITEMS_PER_PAGE = 20;

export function FilePreviewGrid({ files, onRemoveFile, onClearAll }: FilePreviewGridProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [visibleItems, setVisibleItems] = useState(new Set<string>());
  const gridRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Calculate totals
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const statusCounts = files.reduce((acc, file) => {
    acc[file.status] = (acc[file.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, fileId: string) => {
    if (e.key === 'Delete') {
      onRemoveFile(fileId);
    }
  }, [onRemoveFile]);

  // Performance monitoring
  useEffect(() => {
    performanceMonitor.updateFileCounts(files.length, visibleItems.size);
    performanceMonitor.recordMemoryUsage();
    
    // Check if cleanup is needed
    const memoryManager = MemoryManager.getInstance();
    if (memoryManager.shouldCleanup()) {
      console.log('Memory threshold reached, consider clearing caches');
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
                setVisibleItems(prev => new Set([...prev, itemId]));
              }
            }
          });
        });
      },
      { 
        threshold: 0.1, 
        rootMargin: '100px',
        throttleDelay: 150
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
            setVisibleCount(prev => Math.min(prev + ITEMS_PER_PAGE, files.length));
          });
        }
      },
      { 
        threshold: 0.1,
        throttleDelay: 200
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [files.length, visibleCount]);

  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No files uploaded yet</p>
        <div role="status" aria-live="polite" className="sr-only">
          No files
        </div>
      </div>
    );
  }

  // Get files to display (with virtual scrolling)
  const displayedFiles = files.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      {/* File Summary */}
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-medium text-gray-900">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </h3>
          <p className="text-sm text-gray-600">
            {formatFileSize(totalSize)} total
          </p>
          {Object.keys(statusCounts).length > 1 && (
            <div className="text-xs text-gray-500 space-x-4">
              {statusCounts.pending && <span>{statusCounts.pending} pending</span>}
              {statusCounts.processing && <span>{statusCounts.processing} processing</span>}
              {statusCounts.completed && <span>{statusCounts.completed} completed</span>}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Clear All Files
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to clear all files? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
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
                className="bg-red-600 text-white px-3 py-2 rounded-md text-sm hover:bg-red-700"
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
        <div ref={loadMoreRef} className="text-center py-4">
          <div className="inline-flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-500">
              Loading more files... ({visibleCount} of {files.length})
            </p>
          </div>
        </div>
      )}

      {/* All loaded indicator */}
      {visibleCount >= files.length && files.length > ITEMS_PER_PAGE && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            All {files.length} files loaded
          </p>
        </div>
      )}

      {/* Status for Screen Reader */}
      <div role="status" aria-live="polite" className="sr-only">
        {files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : 'No files'}
      </div>
    </div>
  );
}