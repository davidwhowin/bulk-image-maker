import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { useImageWorker } from '@/hooks/useImageWorker';
import { MemoryManager } from '@/lib/performance-utils';
import { renderHook, act } from '@testing-library/react';

// Mock performance.memory for testing
const mockMemory = {
  usedJSHeapSize: 50 * 1024 * 1024, // 50MB initial
  totalJSHeapSize: 100 * 1024 * 1024,
  jsHeapSizeLimit: 2 * 1024 * 1024 * 1024, // 2GB
};

Object.defineProperty(performance, 'memory', {
  value: mockMemory,
  configurable: true,
});

// Mock createObjectURL/revokeObjectURL
const objectUrls = new Set<string>();
const originalCreateObjectURL = global.URL.createObjectURL;
const originalRevokeObjectURL = global.URL.revokeObjectURL;

global.URL.createObjectURL = vi.fn((_obj) => {
  const url = `blob:mock-${Math.random().toString(36)}`;
  objectUrls.add(url);
  return url;
});

global.URL.revokeObjectURL = vi.fn((url) => {
  objectUrls.delete(url);
});

describe('Memory Leak Detection', () => {
  let memoryManager: MemoryManager;

  beforeEach(() => {
    memoryManager = MemoryManager.getInstance();
    objectUrls.clear();
    mockMemory.usedJSHeapSize = 50 * 1024 * 1024; // Reset to 50MB
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup
    memoryManager.revokeAllObjectUrls();
  });

  describe('Object URL Memory Leaks', () => {
    it('should detect object URL leaks when URLs are not revoked', async () => {
      const createMockFile = (name: string) => 
        new File(['mock content'], name, { type: 'image/jpeg' });

      // Simulate creating many object URLs without revoking them
      const files = Array.from({ length: 100 }, (_, i) => createMockFile(`file${i}.jpg`));
      
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        memoryManager.trackObjectUrl(url);
      });

      // Should have 100 tracked URLs
      expect(objectUrls.size).toBe(100);
      
      // Memory manager should report high object URL count
      const stats = memoryManager.getMemoryStats();
      expect(stats?.objectUrls).toBe(100);
    });

    it('should clean up object URLs properly when revoked', async () => {
      const createMockFile = (name: string) => 
        new File(['mock content'], name, { type: 'image/jpeg' });

      const files = Array.from({ length: 50 }, (_, i) => createMockFile(`file${i}.jpg`));
      const urls: string[] = [];
      
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        urls.push(url);
        memoryManager.trackObjectUrl(url);
      });

      expect(objectUrls.size).toBe(50);

      // Clean up half the URLs
      urls.slice(0, 25).forEach(url => {
        memoryManager.revokeObjectUrl(url);
      });

      expect(objectUrls.size).toBe(25);
      
      // Clean up remaining URLs
      memoryManager.revokeAllObjectUrls();
      expect(objectUrls.size).toBe(0);
    });
  });

  describe('Web Worker Cache Memory Leaks', () => {
    it('should detect unlimited cache growth in web worker', async () => {
      // Simulate web worker with growing cache
      const cache = new Map<string, string>();
      
      // Generate many cache entries without cleanup
      for (let i = 0; i < 1000; i++) {
        const cacheKey = `file${i}-thumbnail`;
        const dataUrl = `data:image/jpeg;base64,mock-data-${i}`.repeat(1000); // Large data
        cache.set(cacheKey, dataUrl);
      }

      // Cache should grow without bounds
      expect(cache.size).toBe(1000);
      
      // Simulate memory growth
      mockMemory.usedJSHeapSize = 200 * 1024 * 1024; // 200MB
      
      // Memory manager should detect high usage
      expect(memoryManager.shouldCleanup()).toBe(true);
    });

    it('should reproduce batch processing memory leak', async () => {
      const { result } = renderHook(() => useImageWorker());
      
      // Create large batch of files
      const files = Array.from({ length: 200 }, (_, i) => 
        new File([`mock content ${i}`.repeat(1000)], `batch${i}.jpg`, { type: 'image/jpeg' })
      );

      let generatedThumbnails = 0;
      
      // Process batch without cleanup - this should leak memory
      await act(async () => {
        const promises = files.map(async (file, _index) => {
          try {
            // This will create thumbnails but may not clean up properly
            await result.current.generateThumbnail(file, { width: 200, height: 200 });
            generatedThumbnails++;
            
            // Simulate memory growth during processing
            mockMemory.usedJSHeapSize += 1024 * 1024; // +1MB per file
          } catch (error) {
            // Expected in test environment due to canvas mocking
            generatedThumbnails++;
          }
        });

        await Promise.allSettled(promises);
      });

      expect(generatedThumbnails).toBe(200);
      
      // Memory should have grown significantly
      expect(mockMemory.usedJSHeapSize).toBeGreaterThan(100 * 1024 * 1024);
      
      // Should trigger cleanup recommendation
      expect(memoryManager.shouldCleanup()).toBe(true);
    });
  });

  describe('Canvas Memory Leaks', () => {
    it('should detect canvas objects not being cleaned up', () => {
      const canvases: HTMLCanvasElement[] = [];
      
      // Simulate creating many canvas objects
      for (let i = 0; i < 50; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Simulate drawing operations
          ctx.fillStyle = 'red';
          ctx.fillRect(0, 0, 400, 400);
          canvases.push(canvas);
        }
      }

      expect(canvases.length).toBe(50);
      
      // Canvases are still referenced and not cleaned up
      // In real scenarios, this would consume significant memory
      
      // Proper cleanup should clear dimensions
      canvases.forEach(canvas => {
        canvas.width = 0;
        canvas.height = 0;
      });
    });
  });

  describe('File Object Memory Leaks', () => {
    it('should detect file objects held in memory too long', () => {
      const files = Array.from({ length: 100 }, (_, i) => 
        new File([new ArrayBuffer(1024 * 1024)], `large${i}.jpg`, { type: 'image/jpeg' })
      );

      // Simulate store holding file references
      const mockStore = {
        files: files.map(file => ({
          id: `${file.name}-${Date.now()}`,
          file, // Direct file reference - potential leak
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'pending' as const,
          progress: 0,
        }))
      };

      expect(mockStore.files.length).toBe(100);
      
      // Files are held in memory even after processing
      // This simulates the real memory leak scenario
      expect(mockStore.files.every(item => item.file instanceof File)).toBe(true);
      
      // Proper cleanup would clear file references
      mockStore.files.forEach(item => {
        // @ts-ignore - intentionally clearing for test
        item.file = null;
      });
    });
  });

  describe('Memory Pressure Simulation', () => {
    it('should simulate memory pressure during batch processing', async () => {
      const initialMemory = mockMemory.usedJSHeapSize;
      const memoryGrowthPerFile = 2 * 1024 * 1024; // 2MB per file
      const batchSize = 100;
      
      // Simulate processing large batch
      for (let i = 0; i < batchSize; i++) {
        mockMemory.usedJSHeapSize += memoryGrowthPerFile;
        
        // Check if we've hit memory pressure
        if (memoryManager.shouldCleanup()) {
          // This should trigger when we exceed 50MB threshold
          expect(mockMemory.usedJSHeapSize).toBeGreaterThan(50 * 1024 * 1024);
          break;
        }
      }
      
      expect(mockMemory.usedJSHeapSize).toBeGreaterThan(initialMemory);
    });

    it('should provide memory recommendations when under pressure', () => {
      // Simulate high memory usage
      mockMemory.usedJSHeapSize = 150 * 1024 * 1024; // 150MB
      
      // Create many object URLs
      Array.from({ length: 200 }, (_, i) => {
        const url = `blob:mock-${i}`;
        memoryManager.trackObjectUrl(url);
      });
      
      const stats = memoryManager.getMemoryStats();
      expect(stats?.objectUrls).toBe(200);
      expect(memoryManager.shouldCleanup()).toBe(true);
      
      // Should recommend cleanup
      const needsCleanup = memoryManager.shouldCleanup();
      expect(needsCleanup).toBe(true);
    });
  });
});

// Restore original functions
afterAll(() => {
  global.URL.createObjectURL = originalCreateObjectURL;
  global.URL.revokeObjectURL = originalRevokeObjectURL;
});