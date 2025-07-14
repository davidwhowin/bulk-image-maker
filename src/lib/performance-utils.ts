/**
 * Performance monitoring and optimization utilities
 */

interface PerformanceMetrics {
  thumbnailGenerationTime: number[];
  memoryUsage: number[];
  renderTime: number[];
  cacheHitRate: number;
  totalFiles: number;
  processedFiles: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    thumbnailGenerationTime: [],
    memoryUsage: [],
    renderTime: [],
    cacheHitRate: 0,
    totalFiles: 0,
    processedFiles: 0,
  };

  private cacheHits = 0;
  private cacheRequests = 0;

  // Measure thumbnail generation time
  measureThumbnailGeneration<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    
    return operation().then(result => {
      const endTime = performance.now();
      this.metrics.thumbnailGenerationTime.push(endTime - startTime);
      
      // Keep only last 100 measurements
      if (this.metrics.thumbnailGenerationTime.length > 100) {
        this.metrics.thumbnailGenerationTime.shift();
      }
      
      return result;
    });
  }

  // Measure render time
  measureRenderTime<T>(operation: () => T): T {
    const startTime = performance.now();
    const result = operation();
    const endTime = performance.now();
    
    this.metrics.renderTime.push(endTime - startTime);
    
    // Keep only last 100 measurements
    if (this.metrics.renderTime.length > 100) {
      this.metrics.renderTime.shift();
    }
    
    return result;
  }

  // Record cache hit/miss
  recordCacheAccess(isHit: boolean) {
    this.cacheRequests++;
    if (isHit) this.cacheHits++;
    
    this.metrics.cacheHitRate = this.cacheRequests > 0 
      ? (this.cacheHits / this.cacheRequests) * 100 
      : 0;
  }

  // Monitor memory usage
  recordMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage.push(memory.usedJSHeapSize);
      
      // Keep only last 50 measurements
      if (this.metrics.memoryUsage.length > 50) {
        this.metrics.memoryUsage.shift();
      }
    }
  }

  // Update file counts
  updateFileCounts(total: number, processed: number) {
    this.metrics.totalFiles = total;
    this.metrics.processedFiles = processed;
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics & {
    averageThumbnailTime: number;
    averageRenderTime: number;
    currentMemoryUsage: number;
    peakMemoryUsage: number;
  } {
    const avgThumbnailTime = this.metrics.thumbnailGenerationTime.length > 0
      ? this.metrics.thumbnailGenerationTime.reduce((a, b) => a + b, 0) / this.metrics.thumbnailGenerationTime.length
      : 0;

    const avgRenderTime = this.metrics.renderTime.length > 0
      ? this.metrics.renderTime.reduce((a, b) => a + b, 0) / this.metrics.renderTime.length
      : 0;

    const currentMemory = this.metrics.memoryUsage.length > 0
      ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1]
      : 0;

    const peakMemory = this.metrics.memoryUsage.length > 0
      ? Math.max(...this.metrics.memoryUsage)
      : 0;

    return {
      ...this.metrics,
      averageThumbnailTime: avgThumbnailTime,
      averageRenderTime: avgRenderTime,
      currentMemoryUsage: currentMemory,
      peakMemoryUsage: peakMemory,
    };
  }

  // Reset metrics
  reset() {
    this.metrics = {
      thumbnailGenerationTime: [],
      memoryUsage: [],
      renderTime: [],
      cacheHitRate: 0,
      totalFiles: 0,
      processedFiles: 0,
    };
    this.cacheHits = 0;
    this.cacheRequests = 0;
  }

  // Check if performance is degrading
  isPerformanceDegrading(): boolean {
    const recentThumbnailTimes = this.metrics.thumbnailGenerationTime.slice(-10);
    const recentRenderTimes = this.metrics.renderTime.slice(-10);
    
    if (recentThumbnailTimes.length < 5) return false;
    
    const avgRecentThumbnail = recentThumbnailTimes.reduce((a, b) => a + b, 0) / recentThumbnailTimes.length;
    const avgRecentRender = recentRenderTimes.reduce((a, b) => a + b, 0) / recentRenderTimes.length;
    
    // Consider performance degraded if average times are > 500ms for thumbnails or > 16ms for renders
    return avgRecentThumbnail > 500 || avgRecentRender > 16;
  }

  // Get performance recommendations
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getMetrics();
    
    if (metrics.cacheHitRate < 50) {
      recommendations.push('Consider increasing cache size or improving cache strategy');
    }
    
    if (metrics.averageThumbnailTime > 300) {
      recommendations.push('Thumbnail generation is slow - consider reducing quality or size');
    }
    
    if (metrics.averageRenderTime > 16) {
      recommendations.push('Rendering is slow - consider virtual scrolling or reducing visible items');
    }
    
    if (metrics.currentMemoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected - consider clearing caches');
    }
    
    return recommendations;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Memory management utilities
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private objectUrls = new Set<string>();
  private memoryThreshold = 50 * 1024 * 1024; // 50MB

  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }

  // Track object URLs for cleanup
  trackObjectUrl(url: string) {
    this.objectUrls.add(url);
  }

  // Clean up object URLs
  revokeObjectUrl(url: string) {
    if (this.objectUrls.has(url)) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(url);
    }
  }

  // Clean up all tracked URLs
  revokeAllObjectUrls() {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();
  }

  // Check if memory cleanup is needed
  shouldCleanup(): boolean {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize > this.memoryThreshold;
    }
    return false;
  }

  // Force garbage collection if available
  forceGarbageCollection() {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
    }
  }

  // Get memory stats
  getMemoryStats() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        objectUrls: this.objectUrls.size,
      };
    }
    return null;
  }
}

/**
 * Optimized event throttling with immediate first call
 */
export function throttleImmediate<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;
  let isWaiting = false;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (!isWaiting) {
      // Execute immediately on first call or after delay period
      func(...args);
      lastExecTime = currentTime;
      isWaiting = true;
      
      timeoutId = setTimeout(() => {
        isWaiting = false;
      }, delay);
    } else if (currentTime - lastExecTime >= delay) {
      // Execute if enough time has passed
      if (timeoutId) clearTimeout(timeoutId);
      func(...args);
      lastExecTime = currentTime;
      
      timeoutId = setTimeout(() => {
        isWaiting = false;
      }, delay);
    }
  };
}

/**
 * Debounce with leading edge option
 */
export function debounceLeading<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  leading = false
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime = 0;

  return (...args: Parameters<T>) => {
    const currentTime = Date.now();

    if (leading && (!lastCallTime || currentTime - lastCallTime >= delay)) {
      func(...args);
      lastCallTime = currentTime;
    }

    if (timeoutId) clearTimeout(timeoutId);
    
    timeoutId = setTimeout(() => {
      if (!leading || currentTime - lastCallTime < delay) {
        func(...args);
      }
      lastCallTime = Date.now();
    }, delay);
  };
}

/**
 * Create a performance-optimized intersection observer
 */
export function createOptimizedIntersectionObserver(
  callback: IntersectionObserverCallback,
  options: IntersectionObserverInit & { throttleDelay?: number } = {}
): IntersectionObserver {
  const { throttleDelay = 100, ...observerOptions } = options;
  
  const throttledCallback = throttleImmediate(callback, throttleDelay);
  
  return new IntersectionObserver(throttledCallback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...observerOptions,
  });
}