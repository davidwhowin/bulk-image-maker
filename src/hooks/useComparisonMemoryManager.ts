import { useEffect, useCallback, useRef } from 'react';
import type { ImageComparison } from '@/types';

interface MemoryStats {
  totalComparisons: number;
  activeComparisons: number;
  memoryUsage: number;
  cacheSize: number;
}

export function useComparisonMemoryManager(comparisons: ImageComparison[]) {
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const memoryStatsRef = useRef<MemoryStats>({
    totalComparisons: 0,
    activeComparisons: 0,
    memoryUsage: 0,
    cacheSize: 0,
  });

  // Track object URLs for cleanup
  const trackObjectUrl = useCallback((url: string) => {
    objectUrlsRef.current.add(url);
  }, []);

  const revokeObjectUrl = useCallback((url: string) => {
    if (objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  }, []);

  // Clean up all object URLs
  const cleanupAllUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => {
      URL.revokeObjectURL(url);
    });
    objectUrlsRef.current.clear();
  }, []);

  // Force garbage collection (if available in browser)
  const forceGarbageCollection = useCallback(() => {
    if ('gc' in window && typeof window.gc === 'function') {
      window.gc();
    }
  }, []);

  // Calculate memory usage estimation
  const calculateMemoryUsage = useCallback(() => {
    let totalSize = 0;
    
    comparisons.forEach(comparison => {
      // Estimate memory usage based on file sizes and thumbnails
      totalSize += comparison.originalFile.size;
      if (comparison.compressedFile) {
        totalSize += comparison.compressedFile.size;
      }
      
      // Add estimated thumbnail sizes (rough estimate)
      if (comparison.thumbnails.original) {
        totalSize += 50 * 1024; // ~50KB per thumbnail
      }
      if (comparison.thumbnails.compressed) {
        totalSize += 50 * 1024;
      }
    });

    return totalSize;
  }, [comparisons]);

  // Update memory stats
  useEffect(() => {
    memoryStatsRef.current = {
      totalComparisons: comparisons.length,
      activeComparisons: comparisons.filter(c => c.status === 'ready').length,
      memoryUsage: calculateMemoryUsage(),
      cacheSize: objectUrlsRef.current.size,
    };
  }, [comparisons, calculateMemoryUsage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAllUrls();
    };
  }, [cleanupAllUrls]);

  // Memory pressure management
  const handleMemoryPressure = useCallback(() => {
    // Remove thumbnails from comparisons that are not currently visible
    // This would be implemented based on visible comparison indices
    forceGarbageCollection();
  }, [forceGarbageCollection]);

  return {
    trackObjectUrl,
    revokeObjectUrl,
    cleanupAllUrls,
    forceGarbageCollection,
    handleMemoryPressure,
    memoryStats: memoryStatsRef.current,
  };
}