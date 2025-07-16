import type { UsageStats, UserTier } from '@/types/tiers'

export interface TierPerformanceMetrics {
  cacheHitRate: number
  averageResponseTime: number
  memoryUsage: number
  errorRate: number
  throughput: number // operations per second
}

export class TierPerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  private errors: number = 0
  private totalOperations: number = 0
  private cacheHits: number = 0
  private cacheRequests: number = 0

  recordOperation(operationType: string, duration: number, success: boolean = true): void {
    if (!this.metrics.has(operationType)) {
      this.metrics.set(operationType, [])
    }
    
    this.metrics.get(operationType)!.push(duration)
    this.totalOperations++
    
    if (!success) {
      this.errors++
    }
  }

  recordCacheHit(isHit: boolean): void {
    this.cacheRequests++
    if (isHit) {
      this.cacheHits++
    }
  }

  getMetrics(): TierPerformanceMetrics {
    const allDurations = Array.from(this.metrics.values()).flat()
    const averageResponseTime = allDurations.length > 0 
      ? allDurations.reduce((sum, duration) => sum + duration, 0) / allDurations.length 
      : 0

    return {
      cacheHitRate: this.cacheRequests > 0 ? this.cacheHits / this.cacheRequests : 0,
      averageResponseTime,
      memoryUsage: this.estimateMemoryUsage(),
      errorRate: this.totalOperations > 0 ? this.errors / this.totalOperations : 0,
      throughput: this.calculateThroughput()
    }
  }

  reset(): void {
    this.metrics.clear()
    this.errors = 0
    this.totalOperations = 0
    this.cacheHits = 0
    this.cacheRequests = 0
  }

  private estimateMemoryUsage(): number {
    // Rough estimate of memory usage in bytes
    let totalSize = 0
    
    // Metrics storage
    for (const [key, values] of this.metrics) {
      totalSize += key.length * 2 // string size
      totalSize += values.length * 8 // number array
    }
    
    return totalSize
  }

  private calculateThroughput(): number {
    // Simple throughput calculation (operations per second)
    const timeWindow = 60000 // 1 minute window
    return this.totalOperations / (timeWindow / 1000)
  }
}

export class TierCacheOptimizer {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly maxSize = 1000 // Maximum cache entries
  private readonly defaultTTL = 5 * 60 * 1000 // 5 minutes

  set(key: string, data: any, ttl: number = this.defaultTTL): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  getSize(): number {
    return this.cache.size
  }

  private evictOldest(): void {
    let oldestKey: string | null = null
    let oldestTimestamp = Date.now()

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }
}

// Singleton instances for global use
export const tierPerformanceMonitor = new TierPerformanceMonitor()
export const tierCacheOptimizer = new TierCacheOptimizer()

// Utility functions for measuring performance
export function measureTierOperation<T>(
  operationType: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  
  return operation()
    .then(result => {
      const duration = Date.now() - startTime
      tierPerformanceMonitor.recordOperation(operationType, duration, true)
      return result
    })
    .catch(error => {
      const duration = Date.now() - startTime
      tierPerformanceMonitor.recordOperation(operationType, duration, false)
      throw error
    })
}

export function createTierCacheKey(userId: string, operation: string, ...params: any[]): string {
  return `tier:${userId}:${operation}:${params.join(':')}`
}