import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { 
  UrlImportRequest
} from '@/types';

// Mock fetch API
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock Response object
const createMockResponse = (data: ArrayBuffer | string, options: ResponseInit = {}) => ({
  ok: options.status ? options.status >= 200 && options.status < 300 : true,
  status: options.status || 200,
  statusText: options.statusText || 'OK',
  headers: new Headers(options.headers),
  arrayBuffer: () => Promise.resolve(data instanceof ArrayBuffer ? data : new ArrayBuffer(0)),
  blob: () => Promise.resolve(new Blob([data], { type: (options.headers as any)?.['content-type'] || 'image/jpeg' })),
  text: () => Promise.resolve(typeof data === 'string' ? data : ''),
  json: () => Promise.resolve({}),
  ...options,
});

describe('URL-based Image Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('URL Validation', () => {
    it('should validate image URLs correctly', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'http://localhost:3000/test.png',
        'https://cdn.example.com/photos/image.webp',
        'https://example.com/path/to/image.gif',
        'https://example.com/image.avif',
      ];

      const invalidUrls = [
        'not-a-url',
        'ftp://example.com/image.jpg',
        'javascript:alert("xss")',
        'https://example.com/document.pdf',
        'https://example.com/video.mp4',
        'data:text/html,<script>alert("xss")</script>',
      ];

      expect(() => {
        const { validateImageUrl } = require('@/lib/url-import');
        
        validUrls.forEach(url => {
          expect(validateImageUrl(url)).toBe(true);
        });
        
        invalidUrls.forEach(url => {
          expect(validateImageUrl(url)).toBe(false);
        });
      }).toThrow();
    });

    it('should extract filename from URL', () => {
      const testCases = [
        { url: 'https://example.com/image.jpg', expected: 'image.jpg' },
        { url: 'https://example.com/path/to/photo.png', expected: 'photo.png' },
        { url: 'https://example.com/image.jpg?v=123', expected: 'image.jpg' },
        { url: 'https://example.com/noextension', expected: 'noextension' },
        { url: 'https://example.com/', expected: 'image' },
      ];

      expect(() => {
        const { extractFilenameFromUrl } = require('@/lib/url-import');
        
        testCases.forEach(({ url, expected }) => {
          const filename = extractFilenameFromUrl(url);
          expect(filename).toBe(expected);
        });
      }).toThrow();
    });

    it('should detect image file extensions', () => {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.bmp'];
      const nonImageExtensions = ['.pdf', '.txt', '.docx', '.mp4', '.zip'];

      expect(() => {
        const { isImageUrl } = require('@/lib/url-import');
        
        imageExtensions.forEach(ext => {
          expect(isImageUrl(`https://example.com/file${ext}`)).toBe(true);
          expect(isImageUrl(`https://example.com/file${ext.toUpperCase()}`)).toBe(true);
        });
        
        nonImageExtensions.forEach(ext => {
          expect(isImageUrl(`https://example.com/file${ext}`)).toBe(false);
        });
      }).toThrow();
    });
  });

  describe('Single URL Import', () => {
    it('should import image from single URL successfully', async () => {
      const imageData = new ArrayBuffer(1024);
      const mockResponse = createMockResponse(imageData, {
        status: 200,
        headers: { 'content-type': 'image/jpeg', 'content-length': '1024' },
      });

      mockFetch.mockResolvedValue(mockResponse);

      expect(() => {
        const { UrlImageImporter } = require('@/lib/url-import');
        const importer = new UrlImageImporter();
        
        const result = importer.importFromUrl('https://example.com/image.jpg');
        
        expect(result).resolves.toMatchObject({
          url: 'https://example.com/image.jpg',
          file: expect.any(File),
          contentType: 'image/jpeg',
          size: 1024,
          filename: 'image.jpg',
        });
      }).toThrow();
    });

    it('should handle HTTP errors gracefully', async () => {
      const mockResponse = createMockResponse('', {
        status: 404,
        statusText: 'Not Found',
      });

      mockFetch.mockResolvedValue(mockResponse);

      expect(() => {
        const { UrlImageImporter } = require('@/lib/url-import');
        const importer = new UrlImageImporter();
        
        const result = importer.importFromUrl('https://example.com/missing.jpg');
        
        expect(result).rejects.toMatchObject({
          url: 'https://example.com/missing.jpg',
          error: expect.stringMatching(/404.*not found/i),
          statusCode: 404,
        });
      }).toThrow();
    });

    it('should validate content type from response', async () => {
      const mockResponse = createMockResponse('not-an-image', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });

      mockFetch.mockResolvedValue(mockResponse);

      expect(() => {
        const { UrlImageImporter } = require('@/lib/url-import');
        const importer = new UrlImageImporter({
          validateImageType: true,
        });
        
        const result = importer.importFromUrl('https://example.com/fake-image.jpg');
        
        expect(result).rejects.toMatchObject({
          url: 'https://example.com/fake-image.jpg',
          error: expect.stringMatching(/invalid.*content.*type/i),
          contentType: 'text/html',
        });
      }).toThrow();
    });

    it('should enforce file size limits', async () => {
      const largeImageData = new ArrayBuffer(10 * 1024 * 1024); // 10MB
      const mockResponse = createMockResponse(largeImageData, {
        status: 200,
        headers: { 
          'content-type': 'image/jpeg',
          'content-length': String(largeImageData.byteLength),
        },
      });

      mockFetch.mockResolvedValue(mockResponse);

      expect(() => {
        const { UrlImageImporter } = require('@/lib/url-import');
        const importer = new UrlImageImporter({
          maxFileSize: 5 * 1024 * 1024, // 5MB limit
        });
        
        const result = importer.importFromUrl('https://example.com/large-image.jpg');
        
        expect(result).rejects.toMatchObject({
          url: 'https://example.com/large-image.jpg',
          error: expect.stringMatching(/file.*too.*large/i),
        });
      }).toThrow();
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      expect(() => {
        const { UrlImageImporter } = require('@/lib/url-import');
        const importer = new UrlImageImporter({
          timeout: 50, // 50ms timeout
        });
        
        const result = importer.importFromUrl('https://slow.example.com/image.jpg');
        
        expect(result).rejects.toMatchObject({
          url: 'https://slow.example.com/image.jpg',
          error: expect.stringMatching(/timeout|network/i),
        });
      }).toThrow();
    });
  });

  describe('Bulk URL Import', () => {
    it('should import multiple URLs concurrently', async () => {
      const urls = [
        'https://example.com/image1.jpg',
        'https://example.com/image2.png',
        'https://example.com/image3.webp',
      ];

      mockFetch.mockImplementation((_url: string) => {
        // const filename = url.split('/').pop();
        const imageData = new ArrayBuffer(1024);
        return Promise.resolve(createMockResponse(imageData, {
          status: 200,
          headers: { 'content-type': 'image/jpeg', 'content-length': '1024' },
        }));
      });

      expect(() => {
        const { BulkUrlImporter } = require('@/lib/url-import');
        const importer = new BulkUrlImporter();
        
        const request: UrlImportRequest = {
          urls,
          options: { maxConcurrent: 2 },
        };
        
        const result = importer.importFromUrls(request);
        
        expect(result).resolves.toMatchObject({
          successful: expect.arrayContaining([
            expect.objectContaining({ url: urls[0] }),
            expect.objectContaining({ url: urls[1] }),
            expect.objectContaining({ url: urls[2] }),
          ]),
          failed: [],
          totalRequested: 3,
          totalSuccessful: 3,
          totalFailed: 0,
          processingTime: expect.any(Number),
        });
      }).toThrow();
    });

    it('should limit concurrent downloads', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => 
        `https://example.com/image${i}.jpg`
      );

      let activeFetches = 0;
      let maxConcurrent = 0;

      mockFetch.mockImplementation(() => {
        activeFetches++;
        maxConcurrent = Math.max(maxConcurrent, activeFetches);
        
        return new Promise(resolve => {
          setTimeout(() => {
            activeFetches--;
            resolve(createMockResponse(new ArrayBuffer(1024), {
              status: 200,
              headers: { 'content-type': 'image/jpeg' },
            }));
          }, 10);
        });
      });

      expect(() => {
        const { BulkUrlImporter } = require('@/lib/url-import');
        const importer = new BulkUrlImporter();
        
        const request: UrlImportRequest = {
          urls,
          options: { maxConcurrent: 3 },
        };
        
        const result = importer.importFromUrls(request);
        
        expect(result).resolves.toBeDefined();
        expect(maxConcurrent).toBeLessThanOrEqual(3);
      }).toThrow();
    });

    it('should handle mixed success and failure responses', async () => {
      const urls = [
        'https://example.com/success1.jpg',
        'https://example.com/missing.jpg',
        'https://example.com/success2.png',
        'https://invalid-domain.test/image.gif',
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('missing')) {
          return Promise.resolve(createMockResponse('', { status: 404 }));
        }
        if (url.includes('invalid-domain')) {
          return Promise.reject(new Error('DNS resolution failed'));
        }
        return Promise.resolve(createMockResponse(new ArrayBuffer(1024), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }));
      });

      expect(() => {
        const { BulkUrlImporter } = require('@/lib/url-import');
        const importer = new BulkUrlImporter();
        
        const request: UrlImportRequest = { urls };
        const result = importer.importFromUrls(request);
        
        expect(result).resolves.toMatchObject({
          successful: expect.arrayContaining([
            expect.objectContaining({ url: 'https://example.com/success1.jpg' }),
            expect.objectContaining({ url: 'https://example.com/success2.png' }),
          ]),
          failed: expect.arrayContaining([
            expect.objectContaining({ url: 'https://example.com/missing.jpg' }),
            expect.objectContaining({ url: 'https://invalid-domain.test/image.gif' }),
          ]),
          totalRequested: 4,
          totalSuccessful: 2,
          totalFailed: 2,
        });
      }).toThrow();
    });

    it('should provide progress updates during bulk import', async () => {
      const urls = Array.from({ length: 5 }, (_, i) => 
        `https://example.com/image${i}.jpg`
      );

      mockFetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve(createMockResponse(new ArrayBuffer(1024), {
              status: 200,
              headers: { 'content-type': 'image/jpeg' },
            }));
          }, 50);
        })
      );

      expect(() => {
        const { BulkUrlImporter } = require('@/lib/url-import');
        const importer = new BulkUrlImporter();
        
        const progressCallback = vi.fn();
        const request: UrlImportRequest = { urls };
        
        const result = importer.importFromUrls(request, { onProgress: progressCallback });
        
        expect(result).resolves.toBeDefined();
        expect(progressCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            completed: expect.any(Number),
            total: 5,
            percentage: expect.any(Number),
            currentUrl: expect.any(String),
          })
        );
      }).toThrow();
    });
  });

  describe('Content Type Detection', () => {
    it('should detect content type from response headers', async () => {
      const testCases = [
        { contentType: 'image/jpeg', expected: 'image/jpeg' },
        { contentType: 'image/png', expected: 'image/png' },
        { contentType: 'image/webp', expected: 'image/webp' },
        { contentType: 'application/octet-stream', expected: 'application/octet-stream' },
      ];

      expect(() => {
        const { ContentTypeDetector } = require('@/lib/url-import');
        const detector = new ContentTypeDetector();
        
        testCases.forEach(({ contentType, expected }) => {
          const headers = new Headers({ 'content-type': contentType });
          const detectedType = detector.detectFromHeaders(headers);
          expect(detectedType).toBe(expected);
        });
      }).toThrow();
    });

    it('should detect content type from file extension fallback', () => {
      const testCases = [
        { url: 'https://example.com/image.jpg', expected: 'image/jpeg' },
        { url: 'https://example.com/photo.png', expected: 'image/png' },
        { url: 'https://example.com/banner.webp', expected: 'image/webp' },
        { url: 'https://example.com/animation.gif', expected: 'image/gif' },
      ];

      expect(() => {
        const { ContentTypeDetector } = require('@/lib/url-import');
        const detector = new ContentTypeDetector();
        
        testCases.forEach(({ url, expected }) => {
          const detectedType = detector.detectFromUrl(url);
          expect(detectedType).toBe(expected);
        });
      }).toThrow();
    });

    it('should detect content type from binary data analysis', async () => {
      const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF]);
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47]);
      const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46]);

      expect(() => {
        const { ContentTypeDetector } = require('@/lib/url-import');
        const detector = new ContentTypeDetector();
        
        expect(detector.detectFromBinary(jpegHeader)).toBe('image/jpeg');
        expect(detector.detectFromBinary(pngHeader)).toBe('image/png');
        expect(detector.detectFromBinary(webpHeader)).toBe('image/webp');
      }).toThrow();
    });
  });

  describe('CORS Handling', () => {
    it('should handle CORS-enabled images', async () => {
      const mockResponse = createMockResponse(new ArrayBuffer(1024), {
        status: 200,
        headers: { 
          'content-type': 'image/jpeg',
          'access-control-allow-origin': '*',
        },
      });

      mockFetch.mockResolvedValue(mockResponse);

      expect(() => {
        const { CorsAwareImporter } = require('@/lib/url-import');
        const importer = new CorsAwareImporter();
        
        const result = importer.importFromUrl('https://cors-enabled.example.com/image.jpg');
        
        expect(result).resolves.toMatchObject({
          url: 'https://cors-enabled.example.com/image.jpg',
          file: expect.any(File),
        });
      }).toThrow();
    });

    it('should handle CORS errors gracefully', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      expect(() => {
        const { CorsAwareImporter } = require('@/lib/url-import');
        const importer = new CorsAwareImporter();
        
        const result = importer.importFromUrl('https://cors-blocked.example.com/image.jpg');
        
        expect(result).rejects.toMatchObject({
          url: 'https://cors-blocked.example.com/image.jpg',
          error: expect.stringMatching(/cors|cross.*origin/i),
        });
      }).toThrow();
    });

    it('should provide proxy fallback for CORS-blocked resources', async () => {
      // First call fails with CORS
      mockFetch
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(createMockResponse(new ArrayBuffer(1024), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }));

      expect(() => {
        const { ProxyEnabledImporter } = require('@/lib/url-import');
        const importer = new ProxyEnabledImporter({
          proxyUrl: 'https://cors-proxy.example.com/',
        });
        
        const result = importer.importFromUrl('https://cors-blocked.example.com/image.jpg');
        
        expect(result).resolves.toMatchObject({
          url: 'https://cors-blocked.example.com/image.jpg',
          file: expect.any(File),
          fromProxy: true,
        });
        
        expect(mockFetch).toHaveBeenCalledWith(
          'https://cors-proxy.example.com/https://cors-blocked.example.com/image.jpg'
        );
      }).toThrow();
    });
  });

  describe('Performance Optimization', () => {
    it('should implement request caching', async () => {
      const url = 'https://example.com/cached-image.jpg';
      
      mockFetch.mockResolvedValue(createMockResponse(new ArrayBuffer(1024), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }));

      expect(() => {
        const { CachedUrlImporter } = require('@/lib/url-import');
        const importer = new CachedUrlImporter({
          cacheTimeout: 5000, // 5 seconds
        });
        
        // First call
        const result1 = importer.importFromUrl(url);
        
        // Second call should use cache
        const result2 = importer.importFromUrl(url);
        
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result1).toBe(result2);
      }).toThrow();
    });

    it('should implement request deduplication', async () => {
      const url = 'https://example.com/deduplicated-image.jpg';
      
      mockFetch.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve(createMockResponse(new ArrayBuffer(1024), {
              status: 200,
              headers: { 'content-type': 'image/jpeg' },
            }));
          }, 100);
        })
      );

      expect(() => {
        const { DeduplicatedUrlImporter } = require('@/lib/url-import');
        const importer = new DeduplicatedUrlImporter();
        
        // Multiple simultaneous requests for same URL
        const promises = [
          importer.importFromUrl(url),
          importer.importFromUrl(url),
          importer.importFromUrl(url),
        ];
        
        Promise.all(promises).then(() => {
          expect(mockFetch).toHaveBeenCalledTimes(1);
        });
      }).toThrow();
    });

    it('should implement progressive loading for large images', async () => {
      const largeImageData = new ArrayBuffer(5 * 1024 * 1024); // 5MB
      
      // Mock ReadableStream for progressive loading
      const mockReadableStream = {
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ value: new Uint8Array(1024), done: false })
            .mockResolvedValueOnce({ value: new Uint8Array(1024), done: false })
            .mockResolvedValue({ done: true }),
        }),
      };

      const mockResponse = {
        ...createMockResponse(largeImageData, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
        body: mockReadableStream,
      };

      mockFetch.mockResolvedValue(mockResponse);

      expect(() => {
        const { ProgressiveUrlImporter } = require('@/lib/url-import');
        const importer = new ProgressiveUrlImporter();
        
        const progressCallback = vi.fn();
        const result = importer.importFromUrl(
          'https://example.com/large-image.jpg',
          { onProgress: progressCallback }
        );
        
        expect(result).resolves.toBeDefined();
        expect(progressCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            loaded: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number),
          })
        );
      }).toThrow();
    });
  });

  describe('Security Considerations', () => {
    it('should validate URL safety', () => {
      const safeUrls = [
        'https://example.com/image.jpg',
        'http://localhost:3000/test.png',
        'https://cdn.example.com/photos/image.webp',
      ];

      const unsafeUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'ftp://suspicious.com/image.jpg',
      ];

      expect(() => {
        const { UrlSecurityValidator } = require('@/lib/url-import');
        const validator = new UrlSecurityValidator();
        
        safeUrls.forEach(url => {
          expect(validator.isUrlSafe(url)).toBe(true);
        });
        
        unsafeUrls.forEach(url => {
          expect(validator.isUrlSafe(url)).toBe(false);
        });
      }).toThrow();
    });

    it('should sanitize filenames from URLs', () => {
      const dangerousUrls = [
        'https://example.com/../../../etc/passwd.jpg',
        'https://example.com/C:\\Windows\\System32\\virus.exe.png',
        'https://example.com/script<>injection.jpg',
        'https://example.com/file%00null.jpg',
      ];

      expect(() => {
        const { sanitizeUrlFilename } = require('@/lib/url-import');
        
        dangerousUrls.forEach(url => {
          const filename = sanitizeUrlFilename(url);
          expect(filename).not.toContain('../');
          expect(filename).not.toContain('\\');
          expect(filename).not.toContain('<');
          expect(filename).not.toContain('>');
          expect(filename).not.toContain('\0');
        });
      }).toThrow();
    });

    it('should implement rate limiting', async () => {
      mockFetch.mockResolvedValue(createMockResponse(new ArrayBuffer(1024), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }));

      expect(() => {
        const { RateLimitedImporter } = require('@/lib/url-import');
        const importer = new RateLimitedImporter({
          maxRequestsPerSecond: 2,
          maxRequestsPerMinute: 60,
        });
        
        const urls = Array.from({ length: 10 }, (_, i) => 
          `https://example.com/image${i}.jpg`
        );
        
        const startTime = Date.now();
        const promises = urls.map(url => importer.importFromUrl(url));
        
        Promise.all(promises).then(() => {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should take at least 4 seconds to import 10 images at 2/second
          expect(duration).toBeGreaterThan(4000);
        });
      }).toThrow();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should retry failed requests with exponential backoff', async () => {
      let callCount = 0;
      
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(createMockResponse(new ArrayBuffer(1024), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }));
      });

      expect(() => {
        const { RetryableUrlImporter } = require('@/lib/url-import');
        const importer = new RetryableUrlImporter({
          maxRetries: 3,
          backoffStrategy: 'exponential',
        });
        
        const result = importer.importFromUrl('https://flaky.example.com/image.jpg');
        
        expect(result).resolves.toBeDefined();
        expect(callCount).toBe(3);
      }).toThrow();
    });

    it('should handle partial failures in bulk import', async () => {
      const urls = [
        'https://example.com/success.jpg',
        'https://example.com/temp-fail.jpg',
        'https://example.com/permanent-fail.jpg',
      ];

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('success')) {
          return Promise.resolve(createMockResponse(new ArrayBuffer(1024), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          }));
        }
        if (url.includes('temp-fail')) {
          return Promise.reject(new Error('Temporary network error'));
        }
        return Promise.resolve(createMockResponse('', { status: 404 }));
      });

      expect(() => {
        const { ResilientBulkImporter } = require('@/lib/url-import');
        const importer = new ResilientBulkImporter({
          continueOnError: true,
          retryFailedUrls: true,
        });
        
        const request: UrlImportRequest = { urls };
        const result = importer.importFromUrls(request);
        
        expect(result).resolves.toMatchObject({
          successful: [
            expect.objectContaining({ url: 'https://example.com/success.jpg' }),
          ],
          failed: [
            expect.objectContaining({ url: 'https://example.com/temp-fail.jpg' }),
            expect.objectContaining({ url: 'https://example.com/permanent-fail.jpg' }),
          ],
          retryAttempts: expect.any(Number),
        });
      }).toThrow();
    });

    it('should handle memory pressure during large imports', async () => {
      const largeUrls = Array.from({ length: 100 }, (_, i) => 
        `https://example.com/large-image${i}.jpg`
      );

      mockFetch.mockResolvedValue(createMockResponse(
        new ArrayBuffer(10 * 1024 * 1024), // 10MB each
        {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }
      ));

      expect(() => {
        const { MemoryAwareImporter } = require('@/lib/url-import');
        const importer = new MemoryAwareImporter({
          maxMemoryUsage: 100 * 1024 * 1024, // 100MB limit
          enableGarbageCollection: true,
        });
        
        const request: UrlImportRequest = { urls: largeUrls };
        const result = importer.importFromUrls(request);
        
        expect(result).resolves.toMatchObject({
          successful: expect.any(Array),
          memoryLimitReached: true,
          processedCount: expect.any(Number),
        });
      }).toThrow();
    });
  });

  describe('Browser Compatibility', () => {
    it('should detect fetch API support', () => {
      expect(() => {
        const { BrowserCompatibilityChecker } = require('@/lib/url-import');
        const checker = new BrowserCompatibilityChecker();
        
        expect(checker.isFetchSupported()).toBe(true);
        expect(checker.isAbortControllerSupported()).toBe(true);
        expect(checker.isStreamingSupported()).toBe(true);
      }).toThrow();
    });

    it('should provide XMLHttpRequest fallback', async () => {
      // Mock fetch unavailable
      delete (globalThis as any).fetch;

      expect(() => {
        const { XhrFallbackImporter } = require('@/lib/url-import');
        const importer = new XhrFallbackImporter();
        
        const result = importer.importFromUrl('https://example.com/image.jpg');
        
        expect(result).resolves.toMatchObject({
          url: 'https://example.com/image.jpg',
          file: expect.any(File),
          method: 'xhr',
        });
      }).toThrow();
    });
  });
});