import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComparisonProcessor } from './comparison-processor';
import type { ImageFile } from '@/types';

// Mock canvas and image APIs
global.HTMLCanvasElement.prototype.getContext = vi.fn();
global.Image = class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';
  width = 0;
  height = 0;

  constructor() {
    setTimeout(() => {
      this.width = 1920;
      this.height = 1080;
      this.onload?.();
    }, 10);
  }
} as any;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-object-url');
global.URL.revokeObjectURL = vi.fn();

// Mock FileReader
global.FileReader = class MockFileReader {
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: (() => void) | null = null;
  result: string | ArrayBuffer | null = null;

  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = `data:${file.type};base64,mock-base64-data`;
      this.onload?.({ target: this } as ProgressEvent<FileReader>);
    }, 10);
  }
} as any;

describe('ComparisonProcessor', () => {
  let processor: ComparisonProcessor;

  const createMockFile = (name: string, type: string, size: number): File => {
    const file = new File(['mock content'], name, { type });
    Object.defineProperty(file, 'size', { value: size, writable: false });
    return file;
  };

  const createMockImageFile = (name: string, size: number): ImageFile => ({
    id: `test-${name}`,
    file: createMockFile(name, 'image/jpeg', size),
    name,
    size,
    type: 'image/jpeg',
    status: 'completed',
    progress: 100,
  });

  beforeEach(() => {
    processor = new ComparisonProcessor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('generateThumbnails', () => {
    it('should generate thumbnails for multiple sizes', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 100000);
      const sizes = [150, 300, 600];

      const thumbnails = await processor.generateThumbnails(file, sizes);

      expect(thumbnails).toHaveLength(3);
      expect(thumbnails[0]).toMatch(/^data:image\/jpeg;base64,/);
      expect(thumbnails[1]).toMatch(/^data:image\/jpeg;base64,/);
      expect(thumbnails[2]).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should handle thumbnail generation errors gracefully', async () => {
      const file = createMockFile('corrupt.jpg', 'image/jpeg', 100000);
      
      // Mock image load error
      global.Image = class MockImage {
        onerror: (() => void) | null = null;
        src = '';
        constructor() {
          setTimeout(() => this.onerror?.(), 10);
        }
      } as any;

      const sizes = [150];
      
      await expect(processor.generateThumbnails(file, sizes)).rejects.toThrow('Failed to load image');
    });

    it('should maintain aspect ratio in thumbnails', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 100000);
      const sizes = [300];

      // Mock canvas context
      const mockContext = {
        drawImage: vi.fn(),
        canvas: { toDataURL: vi.fn(() => 'data:image/jpeg;base64,mock-thumbnail') },
      };
      
      global.HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext);

      await processor.generateThumbnails(file, sizes);

      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    it('should cache thumbnails to avoid regeneration', async () => {
      const file = createMockFile('test.jpg', 'image/jpeg', 100000);
      const sizes = [150];

      // Generate thumbnails twice
      await processor.generateThumbnails(file, sizes);
      const thumbnails2 = await processor.generateThumbnails(file, sizes);

      // Should return cached result on second call
      expect(thumbnails2).toHaveLength(1);
    });
  });

  describe('calculateMetrics', () => {
    it('should calculate compression metrics accurately', async () => {
      const originalFile = createMockFile('test.jpg', 'image/jpeg', 100000);
      const compressedBlob = new Blob(['compressed'], { type: 'image/webp' });
      Object.defineProperty(compressedBlob, 'size', { value: 50000, writable: false });

      const metrics = await processor.calculateMetrics(originalFile, compressedBlob);

      expect(metrics).toEqual({
        originalSize: 100000,
        compressedSize: 50000,
        compressionRatio: 0.5,
        sizeSavings: 50000,
        sizeSavingsPercent: 50,
        qualityScore: expect.any(Number),
        processingTime: expect.any(Number),
        dimensions: {
          original: { width: 1920, height: 1080 },
          compressed: { width: 1920, height: 1080 },
        },
        formats: {
          original: 'JPEG',
          compressed: 'WebP',
        },
      });
    });

    it('should handle zero-size files', async () => {
      const originalFile = createMockFile('empty.jpg', 'image/jpeg', 0);
      const compressedBlob = new Blob([], { type: 'image/webp' });

      const metrics = await processor.calculateMetrics(originalFile, compressedBlob);

      expect(metrics.compressionRatio).toBe(0);
      expect(metrics.sizeSavingsPercent).toBe(0);
    });

    it('should calculate quality score based on compression ratio and format', async () => {
      const originalFile = createMockFile('test.jpg', 'image/jpeg', 100000);
      const compressedBlob = new Blob(['compressed'], { type: 'image/webp' });
      Object.defineProperty(compressedBlob, 'size', { value: 75000, writable: false });

      const metrics = await processor.calculateMetrics(originalFile, compressedBlob);

      expect(metrics.qualityScore).toBeGreaterThan(0);
      expect(metrics.qualityScore).toBeLessThanOrEqual(1);
    });

    it('should handle negative compression (file size increase)', async () => {
      const originalFile = createMockFile('small.jpg', 'image/jpeg', 50000);
      const compressedBlob = new Blob(['larger compressed'], { type: 'image/png' });
      Object.defineProperty(compressedBlob, 'size', { value: 75000, writable: false });

      const metrics = await processor.calculateMetrics(originalFile, compressedBlob);

      expect(metrics.sizeSavings).toBe(-25000);
      expect(metrics.sizeSavingsPercent).toBe(-50);
      expect(metrics.compressionRatio).toBe(1.5);
    });
  });

  describe('createComparison', () => {
    it('should create a comparison object for an image file', async () => {
      const originalFile = createMockImageFile('test.jpg', 100000);

      const comparison = await processor.createComparison(originalFile);

      expect(comparison).toEqual({
        id: expect.any(String),
        originalFile,
        compressedFile: undefined,
        comparisonMetrics: expect.any(Object),
        viewSettings: {
          viewMode: 'side-by-side',
          showMetrics: true,
          showFileNames: true,
          zoomLevel: 1,
          panPosition: { x: 0, y: 0 },
          overlayOpacity: 0.5,
          splitPosition: 50,
        },
        thumbnails: {
          original: expect.stringMatching(/^data:image/),
        },
        status: 'pending',
      });
    });

    it('should generate initial thumbnails', async () => {
      const originalFile = createMockImageFile('test.jpg', 100000);

      const comparison = await processor.createComparison(originalFile);

      expect(comparison.thumbnails.original).toMatch(/^data:image/);
    });

    it('should set initial metrics to zero values', async () => {
      const originalFile = createMockImageFile('test.jpg', 100000);

      const comparison = await processor.createComparison(originalFile);

      expect(comparison.comparisonMetrics.compressedSize).toBe(0);
      expect(comparison.comparisonMetrics.compressionRatio).toBe(0);
    });

    it('should handle file processing errors', async () => {
      const originalFile = createMockImageFile('corrupt.jpg', 100000);
      
      // Mock thumbnail generation failure
      vi.spyOn(processor, 'generateThumbnails').mockRejectedValue(new Error('Thumbnail failed'));

      const comparison = await processor.createComparison(originalFile);

      expect(comparison.status).toBe('error');
      expect(comparison.error).toBe('Failed to generate thumbnails');
    });
  });

  describe('updateComparison', () => {
    it('should update comparison with compressed file data', async () => {
      const originalFile = createMockImageFile('test.jpg', 100000);
      const compressedFile = createMockImageFile('test-compressed.webp', 50000);
      
      const comparison = await processor.createComparison(originalFile);
      await processor.updateComparison(comparison.id, compressedFile);

      expect(comparison.compressedFile).toBe(compressedFile);
      expect(comparison.status).toBe('ready');
      expect(comparison.comparisonMetrics.compressedSize).toBe(50000);
      expect(comparison.thumbnails.compressed).toMatch(/^data:image/);
    });

    it('should recalculate metrics when compressed file is added', async () => {
      const originalFile = createMockImageFile('test.jpg', 100000);
      const compressedFile = createMockImageFile('test-compressed.webp', 40000);
      
      const comparison = await processor.createComparison(originalFile);
      await processor.updateComparison(comparison.id, compressedFile);

      expect(comparison.comparisonMetrics.sizeSavings).toBe(60000);
      expect(comparison.comparisonMetrics.sizeSavingsPercent).toBe(60);
      expect(comparison.comparisonMetrics.compressionRatio).toBe(0.4);
    });

    it('should handle update errors gracefully', async () => {
      const originalFile = createMockImageFile('test.jpg', 100000);
      const compressedFile = createMockImageFile('corrupt-compressed.webp', 50000);
      
      // Mock metrics calculation failure
      vi.spyOn(processor, 'calculateMetrics').mockRejectedValue(new Error('Metrics failed'));

      const comparison = await processor.createComparison(originalFile);
      await processor.updateComparison(comparison.id, compressedFile);

      expect(comparison.status).toBe('error');
      expect(comparison.error).toContain('Failed to update comparison');
    });

    it('should throw error for non-existent comparison', async () => {
      const compressedFile = createMockImageFile('test-compressed.webp', 50000);

      await expect(
        processor.updateComparison('non-existent-id', compressedFile)
      ).rejects.toThrow('Comparison not found');
    });
  });

  describe('Memory Management', () => {
    it('should clean up object URLs when comparison is removed', async () => {
      const originalFile = createMockImageFile('test.jpg', 100000);
      const comparison = await processor.createComparison(originalFile);

      processor.removeComparison(comparison.id);

      expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should handle large numbers of comparisons without memory leaks', async () => {
      const comparisons = [];
      
      // Create many comparisons
      for (let i = 0; i < 100; i++) {
        const file = createMockImageFile(`test-${i}.jpg`, 100000);
        const comparison = await processor.createComparison(file);
        comparisons.push(comparison);
      }

      // Clean up
      for (const comparison of comparisons) {
        processor.removeComparison(comparison.id);
      }

      expect(global.URL.revokeObjectURL).toHaveBeenCalledTimes(100);
    });

    it('should limit thumbnail cache size to prevent memory bloat', async () => {
      const files = Array.from({ length: 200 }, (_, i) => 
        createMockFile(`test-${i}.jpg`, 'image/jpeg', 100000)
      );

      // Generate thumbnails for many files
      for (const file of files) {
        await processor.generateThumbnails(file, [150]);
      }

      // Cache should be limited
      expect(processor.getCacheSize()).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance', () => {
    it('should process comparisons in parallel when possible', async () => {
      const files = Array.from({ length: 5 }, (_, i) => 
        createMockImageFile(`test-${i}.jpg`, 100000)
      );

      const startTime = performance.now();
      const promises = files.map(file => processor.createComparison(file));
      await Promise.all(promises);
      const endTime = performance.now();

      // Parallel processing should be faster than sequential
      expect(endTime - startTime).toBeLessThan(files.length * 100);
    });

    it('should debounce rapid metric calculations', async () => {
      const originalFile = createMockImageFile('test.jpg', 100000);
      const comparison = await processor.createComparison(originalFile);

      const calculateSpy = vi.spyOn(processor, 'calculateMetrics');

      // Rapid updates
      const compressedFile1 = createMockImageFile('test1.webp', 50000);
      const compressedFile2 = createMockImageFile('test2.webp', 45000);
      const compressedFile3 = createMockImageFile('test3.webp', 55000);

      await Promise.all([
        processor.updateComparison(comparison.id, compressedFile1),
        processor.updateComparison(comparison.id, compressedFile2),
        processor.updateComparison(comparison.id, compressedFile3),
      ]);

      // Should debounce rapid calculations
      expect(calculateSpy).toHaveBeenCalledTimes(1);
    });

    it('should prioritize visible comparisons for processing', async () => {
      const files = Array.from({ length: 20 }, (_, i) => 
        createMockImageFile(`test-${i}.jpg`, 100000)
      );

      const visibleIndices = [0, 1, 2, 3, 4]; // First 5 are visible
      const processSpy = vi.spyOn(processor, 'createComparison');

      await processor.processVisibleComparisons(files, visibleIndices);

      // Visible items should be processed first
      expect(processSpy).toHaveBeenNthCalledWith(1, files[0]);
      expect(processSpy).toHaveBeenNthCalledWith(2, files[1]);
    });
  });
});