import type { SvgMemoryInfo, SvgOptimizationOptions } from '@/types/svg-optimization';

/**
 * Performance optimization utilities for SVG processing
 */
export class SvgPerformanceOptimizer {
  private static instance: SvgPerformanceOptimizer;
  private memoryCache = new Map<string, any>();
  private performanceMetrics = new Map<string, number>();

  static getInstance(): SvgPerformanceOptimizer {
    if (!this.instance) {
      this.instance = new SvgPerformanceOptimizer();
    }
    return this.instance;
  }

  /**
   * Get memory information for SVG processing
   */
  getMemoryInfo(svgSizes: number[], options: SvgOptimizationOptions): SvgMemoryInfo {
    const totalSize = svgSizes.reduce((sum, size) => sum + size, 0);
    const availableMemory = this.getAvailableMemory();
    
    // Estimate memory usage based on SVG complexity
    const baseMultiplier = this.getComplexityMultiplier(options);
    const estimatedUsage = totalSize * baseMultiplier;
    
    const canProceed = estimatedUsage < availableMemory * 0.8; // 80% safety margin
    const recommendedBatchSize = this.calculateOptimalBatchSize(svgSizes, availableMemory);

    return {
      availableMemory,
      estimatedUsage,
      canProceed,
      recommendedBatchSize,
      breakdown: {
        parsing: estimatedUsage * 0.3,
        optimization: estimatedUsage * 0.4,
        serialization: estimatedUsage * 0.2,
        overhead: estimatedUsage * 0.1
      }
    };
  }

  /**
   * Calculate optimal batch size for processing
   */
  calculateOptimalBatchSize(svgSizes: number[], availableMemory: number): number {
    if (svgSizes.length === 0) return 1;

    const averageSize = svgSizes.reduce((sum, size) => sum + size, 0) / svgSizes.length;
    const memoryPerSvg = averageSize * 4; // Conservative estimate
    const maxConcurrent = Math.floor(availableMemory * 0.6 / memoryPerSvg);
    
    return Math.max(1, Math.min(maxConcurrent, 50)); // Limit to 50 max for UI responsiveness
  }

  /**
   * Get complexity multiplier based on optimization options
   */
  private getComplexityMultiplier(options: SvgOptimizationOptions): number {
    let multiplier = 2; // Base multiplier for DOM parsing

    if (options.simplifyPaths) multiplier += 1;
    if (options.optimizeColors) multiplier += 0.5;
    if (options.optimizeTransforms) multiplier += 0.5;
    if (options.aggressiveness === 'aggressive') multiplier += 1;

    return multiplier;
  }

  /**
   * Get available memory estimate
   */
  private getAvailableMemory(): number {
    // Use device memory API if available
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory) {
      return (deviceMemory * 1024 * 1024 * 1024) * 0.15; // Use 15% of device memory
    }
    
    // Conservative default based on performance.memory if available
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      if (memInfo && memInfo.jsHeapSizeLimit) {
        return memInfo.jsHeapSizeLimit * 0.3; // Use 30% of heap limit
      }
    }
    
    // Fallback: 300MB
    return 300 * 1024 * 1024;
  }

  /**
   * Track performance metrics
   */
  trackMetric(name: string, value: number): void {
    this.performanceMetrics.set(name, value);
  }

  /**
   * Get performance metrics
   */
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.performanceMetrics);
  }

  /**
   * Clear performance metrics
   */
  clearMetrics(): void {
    this.performanceMetrics.clear();
  }

  /**
   * Cache optimization result
   */
  cacheResult(key: string, result: any): void {
    // Simple LRU cache with size limit
    if (this.memoryCache.size >= 100) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    this.memoryCache.set(key, result);
  }

  /**
   * Get cached result
   */
  getCachedResult(key: string): any {
    return this.memoryCache.get(key);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.memoryCache.clear();
  }
}

/**
 * SVG processing queue for better performance management
 */
export class SvgProcessingQueue {
  private queue: Array<{
    id: string;
    svg: string;
    options: SvgOptimizationOptions;
    priority: number;
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }> = [];

  private processing = false;
  private maxConcurrent = 3;
  private currentlyProcessing = 0;

  /**
   * Add SVG to processing queue
   */
  async add(
    svg: string, 
    options: SvgOptimizationOptions, 
    priority: number = 1
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = `svg-${Date.now()}-${Math.random()}`;
      this.queue.push({
        id,
        svg,
        options,
        priority,
        resolve,
        reject
      });

      // Sort by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  /**
   * Process queue items
   */
  private async processQueue(): Promise<void> {
    if (this.currentlyProcessing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.currentlyProcessing++;

    try {
      // Import optimizer dynamically to avoid circular imports
      const { SvgOptimizer } = await import('./svg-optimization');
      const optimizer = new SvgOptimizer();
      const result = await optimizer.optimize(item.svg, item.options);
      
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.currentlyProcessing--;
      
      // Process next item
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 0);
      }
    }
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Get queue status
   */
  getStatus(): { queueLength: number; processing: number } {
    return {
      queueLength: this.queue.length,
      processing: this.currentlyProcessing
    };
  }
}

/**
 * Web Worker wrapper for CPU-intensive SVG operations
 */
export class SvgWorkerManager {
  private workers: Worker[] = [];
  private workerQueue: Array<{
    resolve: (result: any) => void;
    reject: (error: any) => void;
    data: any;
  }> = [];
  private maxWorkers = Math.min(4, navigator.hardwareConcurrency || 2);

  constructor() {
    this.initializeWorkers();
  }

  /**
   * Initialize web workers
   */
  private initializeWorkers(): void {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported');
      return;
    }

    // Create worker blob for SVG optimization
    const workerCode = `
      self.onmessage = function(e) {
        const { svg, options, id } = e.data;
        
        try {
          // Perform SVG optimization in worker
          // This is a simplified version - in production you'd need full SVG parsing
          let optimized = svg;
          
          if (options.minify) {
            optimized = optimized.replace(/\\s+/g, ' ').trim();
          }
          
          if (options.removeComments) {
            optimized = optimized.replace(/<!--[\\s\\S]*?-->/g, '');
          }
          
          self.postMessage({
            id,
            success: true,
            result: {
              success: true,
              optimizedSvg: optimized,
              originalSize: svg.length,
              optimizedSize: optimized.length,
              compressionRatio: optimized.length / svg.length,
              processingTime: 10
            }
          });
        } catch (error) {
          self.postMessage({
            id,
            success: false,
            error: error.message
          });
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);

    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = new Worker(workerUrl);
        worker.onmessage = this.handleWorkerMessage.bind(this);
        worker.onerror = this.handleWorkerError.bind(this);
        this.workers.push(worker);
      } catch (error) {
        console.warn('Failed to create worker:', error);
        break;
      }
    }

    URL.revokeObjectURL(workerUrl);
  }

  /**
   * Process SVG using web worker
   */
  async processSvg(svg: string, options: SvgOptimizationOptions): Promise<any> {
    if (this.workers.length === 0) {
      throw new Error('No workers available');
    }

    return new Promise((resolve, reject) => {
      const id = `worker-${Date.now()}-${Math.random()}`;
      
      this.workerQueue.push({ resolve, reject, data: { svg, options, id } });
      this.processWorkerQueue();
    });
  }

  /**
   * Process worker queue
   */
  private processWorkerQueue(): void {
    if (this.workerQueue.length === 0 || this.workers.length === 0) {
      return;
    }

    const availableWorker = this.workers.find(worker => !(worker as any).busy);
    if (!availableWorker) {
      return;
    }

    const task = this.workerQueue.shift();
    if (!task) return;

    (availableWorker as any).busy = true;
    (availableWorker as any).currentTask = task;
    
    availableWorker.postMessage(task.data);
  }

  /**
   * Handle worker message
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const worker = event.target as Worker;
    const task = (worker as any).currentTask;
    
    if (!task) return;

    (worker as any).busy = false;
    (worker as any).currentTask = null;

    if (event.data.success) {
      task.resolve(event.data.result);
    } else {
      task.reject(new Error(event.data.error));
    }

    // Process next task
    this.processWorkerQueue();
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Worker error:', error);
    
    const worker = error.target as Worker;
    const task = (worker as any).currentTask;
    
    if (task) {
      (worker as any).busy = false;
      (worker as any).currentTask = null;
      task.reject(new Error(`Worker error: ${  error.message}`));
    }
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    this.workers.forEach(worker => worker.terminate());
    this.workers = [];
    
    this.workerQueue.forEach(task => {
      task.reject(new Error('Workers terminated'));
    });
    this.workerQueue = [];
  }
}