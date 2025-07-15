import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormatConverter, BrowserFormatSupport } from './format-converter';
import type { FormatConversionOptions, FormatConversionResult } from '@/types/format-conversion';

// Mock canvas and URL APIs
const mockCanvas = {
  toBlob: vi.fn(),
  getContext: vi.fn(() => ({
    drawImage: vi.fn(),
  })),
  width: 0,
  height: 0,
};

const mockImage = {
  onload: null as any,
  onerror: null as any,
  src: '',
  width: 800,
  height: 600,
};

// Mock DOM APIs
Object.defineProperty(global, 'Image', {
  value: vi.fn(() => {
    const img = { ...mockImage };
    // Simulate successful image load after a short delay
    setTimeout(() => {
      if (img.onload) {
        img.onload(new Event('load'));
      }
    }, 0);
    return img;
  }),
});

Object.defineProperty(document, 'createElement', {
  value: vi.fn((tag: string) => {
    if (tag === 'canvas') return mockCanvas;
    return {};
  }),
});

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  },
});

describe('BrowserFormatSupport', () => {
  let formatSupport: BrowserFormatSupport;

  beforeEach(() => {
    vi.clearAllMocks();
    formatSupport = new BrowserFormatSupport();
  });

  describe('format detection', () => {
    it('should detect JPEG support (always supported)', () => {
      expect(formatSupport.isFormatSupported('jpeg')).toBe(true);
    });

    it('should detect PNG support (always supported)', () => {
      expect(formatSupport.isFormatSupported('png')).toBe(true);
    });

    it('should detect WebP support based on canvas capability', async () => {
      // Mock successful WebP encoding
      mockCanvas.toBlob.mockImplementation((callback) => {
        setTimeout(() => callback(new Blob(['webp-data'], { type: 'image/webp' })), 1);
      });

      const isSupported = await formatSupport.detectWebPSupport();
      expect(isSupported).toBe(true);
    });

    it('should detect AVIF support based on canvas capability', async () => {
      // Mock successful AVIF encoding
      mockCanvas.toBlob.mockImplementation((callback) => {
        setTimeout(() => callback(new Blob(['avif-data'], { type: 'image/avif' })), 1);
      });

      const isSupported = await formatSupport.detectAVIFSupport();
      expect(isSupported).toBe(true);
    });

    it('should return false for unsupported formats', () => {
      expect(formatSupport.isFormatSupported('bmp' as any)).toBe(false);
      expect(formatSupport.isFormatSupported('tiff' as any)).toBe(false);
    });
  });

  describe('fallback mechanisms', () => {
    it('should provide WebP fallback to JPEG for older browsers', () => {
      const fallback = formatSupport.getFallbackFormat('webp');
      expect(fallback).toBe('jpeg');
    });

    it('should provide AVIF fallback to WebP/JPEG based on support', async () => {
      // Mock WebP as supported
      mockCanvas.toBlob.mockImplementation((callback, type) => {
        if (type === 'image/webp') {
          setTimeout(() => callback(new Blob(['webp-data'], { type: 'image/webp' })), 1);
        } else {
          callback(null);
        }
      });

      await formatSupport.detectWebPSupport();
      const fallback = formatSupport.getFallbackFormat('avif');
      expect(fallback).toBe('webp');
    });

    it('should return same format if supported', () => {
      const fallback = formatSupport.getFallbackFormat('jpeg');
      expect(fallback).toBe('jpeg');
    });
  });
});

describe('FormatConverter', () => {
  let converter: FormatConverter;
  let mockFile: File;

  beforeEach(() => {
    vi.clearAllMocks();
    converter = new FormatConverter();
    mockFile = new File(['mock-image-data'], 'test.jpg', { type: 'image/jpeg' });
  });

  describe('basic format conversion', () => {
    it('should convert JPEG to WebP', async () => {
      const options: FormatConversionOptions = {
        outputFormat: 'webp',
        quality: 80,
        preserveMetadata: false,
      };

      // Mock successful conversion
      mockCanvas.toBlob.mockImplementation((callback) => {
        setTimeout(() => callback(new Blob(['webp-data'], { type: 'image/webp' })), 1);
      });

      const result = await converter.convertFormat(mockFile, options);

      expect(result.success).toBe(true);
      expect(result.outputBlob?.type).toBe('image/webp');
      expect(result.originalFormat).toBe('jpeg');
      expect(result.outputFormat).toBe('webp');
    });

    it('should convert PNG to AVIF with transparency', async () => {
      mockFile = new File(['png-data'], 'test.png', { type: 'image/png' });
      
      const options: FormatConversionOptions = {
        outputFormat: 'avif',
        quality: 75,
        preserveMetadata: true,
      };

      mockCanvas.toBlob.mockImplementation((callback) => {
        setTimeout(() => callback(new Blob(['avif-data'], { type: 'image/avif' })), 1);
      });

      const result = await converter.convertFormat(mockFile, options);

      expect(result.success).toBe(true);
      expect(result.outputFormat).toBe('avif');
      expect(result.preservedAlpha).toBe(true);
    });

    it('should handle quality settings correctly', async () => {
      const options: FormatConversionOptions = {
        outputFormat: 'jpeg',
        quality: 95,
        preserveMetadata: false,
      };

      mockCanvas.toBlob.mockImplementation((callback, type, quality) => {
        expect(quality).toBe(0.95); // Quality should be normalized to 0-1
        setTimeout(() => callback(new Blob(['jpeg-data'], { type: 'image/jpeg' })), 1);
      });

      await converter.convertFormat(mockFile, options);
      expect(mockCanvas.toBlob).toHaveBeenCalledWith(
        expect.any(Function),
        'image/jpeg',
        0.95
      );
    });
  });

  describe('batch conversion', () => {
    it('should convert multiple files to same format', async () => {
      const files = [
        new File(['img1'], 'img1.jpg', { type: 'image/jpeg' }),
        new File(['img2'], 'img2.png', { type: 'image/png' }),
      ];

      const options: FormatConversionOptions = {
        outputFormat: 'webp',
        quality: 80,
        preserveMetadata: false,
      };

      mockCanvas.toBlob.mockImplementation((callback) => {
        setTimeout(() => callback(new Blob(['webp-data'], { type: 'image/webp' })), 1);
      });

      const results = await converter.convertBatch(files, options);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(results[0].outputFormat).toBe('webp');
      expect(results[1].outputFormat).toBe('webp');
    });

    it('should handle mixed format conversion with individual settings', async () => {
      const conversions = [
        { file: mockFile, options: { outputFormat: 'webp' as const, quality: 80 } },
        { file: new File(['png'], 'test.png', { type: 'image/png' }), options: { outputFormat: 'avif' as const, quality: 75 } },
      ];

      mockCanvas.toBlob.mockImplementation((callback, type) => {
        const mockType = type === 'image/webp' ? 'image/webp' : 'image/avif';
        setTimeout(() => callback(new Blob(['converted'], { type: mockType })), 1);
      });

      const results = await converter.convertMixed(conversions);

      expect(results).toHaveLength(2);
      expect(results[0].outputFormat).toBe('webp');
      expect(results[1].outputFormat).toBe('avif');
    });

    it('should track progress during batch conversion', async () => {
      const files = Array.from({ length: 5 }, (_, i) => 
        new File([`img${i}`], `img${i}.jpg`, { type: 'image/jpeg' })
      );

      const options: FormatConversionOptions = {
        outputFormat: 'webp',
        quality: 80,
      };

      const progressEvents: any[] = [];
      const onProgress = (progress: any) => {
        progressEvents.push(progress);
      };

      mockCanvas.toBlob.mockImplementation((callback) => {
        setTimeout(() => callback(new Blob(['webp'], { type: 'image/webp' })), 1);
      });

      await converter.convertBatch(files, options, onProgress);

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].overallProgress).toBe(100);
    });
  });

  describe('error handling', () => {
    it('should handle unsupported format conversion gracefully', async () => {
      const options: FormatConversionOptions = {
        outputFormat: 'bmp' as any,
        quality: 80,
      };

      const result = await converter.convertFormat(mockFile, options);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/format.*not supported|unsupported/i);
    });

    it('should handle canvas toBlob failure', async () => {
      const options: FormatConversionOptions = {
        outputFormat: 'webp',
        quality: 80,
      };

      // Mock toBlob failure
      mockCanvas.toBlob.mockImplementation((callback) => {
        setTimeout(() => callback(null), 1);
      });

      const result = await converter.convertFormat(mockFile, options);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/format.*not supported|conversion.*failed|failed.*convert/i);
    });

    it('should handle image load failure', async () => {
      const options: FormatConversionOptions = {
        outputFormat: 'webp',
        quality: 80,
      };

      // Use vi.mocked to temporarily override the Image constructor
      const originalImageConstructor = vi.mocked(global.Image);
      vi.mocked(global.Image).mockImplementation(() => {
        const img = { ...mockImage };
        setTimeout(() => {
          if (img.onerror) {
            img.onerror(new Event('error'));
          }
        }, 0);
        return img;
      });

      const result = await converter.convertFormat(mockFile, options);

      // Restore original behavior
      originalImageConstructor.mockRestore();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to load image');
    });

    it('should handle large file size limits', async () => {
      // Create a mock large file without actually storing large data
      Object.defineProperty(mockFile, 'size', {
        value: 100 * 1024 * 1024, // 100MB
        writable: false
      });

      const options: FormatConversionOptions = {
        outputFormat: 'webp',
        quality: 80,
        maxFileSize: 50 * 1024 * 1024, // 50MB limit
      };

      const result = await converter.convertFormat(mockFile, options);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/File size.*exceeds maximum/);
    });
  });

  describe('performance optimization', () => {
    it('should use format-specific optimal quality settings', () => {
      expect(converter.getOptimalQuality('jpeg')).toBe(85);
      expect(converter.getOptimalQuality('webp')).toBe(80);
      expect(converter.getOptimalQuality('avif')).toBe(75);
      expect(converter.getOptimalQuality('png')).toBe(100); // Lossless
    });

    it('should estimate processing time based on format and file size', () => {
      const estimates = [
        { format: 'jpeg' as const, size: 1024 * 1024, expected: 100 },
        { format: 'webp' as const, size: 1024 * 1024, expected: 200 },
        { format: 'avif' as const, size: 1024 * 1024, expected: 500 },
      ];

      estimates.forEach(({ format, size, expected }) => {
        const estimate = converter.estimateProcessingTime(format, size);
        expect(estimate).toBeCloseTo(expected, -1); // Within 10ms
      });
    });

    it('should suggest optimal batch size based on available memory', () => {
      // Mock memory API
      (navigator as any).deviceMemory = 8; // 8GB device

      const batchSize = converter.getOptimalBatchSize(1024 * 1024); // 1MB files
      expect(batchSize).toBeGreaterThan(1);
      expect(batchSize).toBeLessThanOrEqual(50);
    });
  });
});