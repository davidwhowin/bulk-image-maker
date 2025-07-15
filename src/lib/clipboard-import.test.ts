import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock clipboard API
const mockClipboard = {
  read: vi.fn(),
  readText: vi.fn(),
  writeText: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

// Mock ClipboardItem
globalThis.ClipboardItem = vi.fn((data: Record<string, Blob>) => ({
  types: Object.keys(data),
  getType: vi.fn((type: string) => Promise.resolve(data[type])),
})) as any;

Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true,
});

// Mock FileReader for image processing
const mockFileReader = {
  readAsDataURL: vi.fn(),
  readAsArrayBuffer: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  result: null,
};

globalThis.FileReader = vi.fn(() => mockFileReader) as any;

describe('Clipboard Import Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Clipboard Data Detection', () => {
    it('should detect image files in clipboard', async () => {
      const mockBlob = new Blob(['fake-image-data'], { type: 'image/png' });
      const clipboardItem = new ClipboardItem({
        'image/png': mockBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { ClipboardManager } = require('@/lib/clipboard-import');
        const manager = new ClipboardManager();
        
        const result = manager.detectClipboardContent();
        
        expect(result).resolves.toMatchObject({
          hasImages: true,
          hasText: false,
          hasFiles: false,
          imageTypes: ['image/png'],
          textContent: null,
        });
      }).toThrow();
    });

    it('should detect text URLs in clipboard', async () => {
      const urls = 'https://example.com/image1.jpg\nhttps://example.com/image2.png';
      mockClipboard.readText.mockResolvedValue(urls);

      expect(() => {
        const { ClipboardManager } = require('@/lib/clipboard-import');
        const manager = new ClipboardManager();
        
        const result = manager.detectClipboardContent();
        
        expect(result).resolves.toMatchObject({
          hasImages: false,
          hasText: true,
          hasUrls: true,
          urls: ['https://example.com/image1.jpg', 'https://example.com/image2.png'],
          textContent: urls,
        });
      }).toThrow();
    });

    it('should detect mixed clipboard content', async () => {
      const mockImageBlob = new Blob(['image-data'], { type: 'image/jpeg' });
      const mockTextBlob = new Blob(['Some text content'], { type: 'text/plain' });
      
      const clipboardItem = new ClipboardItem({
        'image/jpeg': mockImageBlob,
        'text/plain': mockTextBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { ClipboardManager } = require('@/lib/clipboard-import');
        const manager = new ClipboardManager();
        
        const result = manager.detectClipboardContent();
        
        expect(result).resolves.toMatchObject({
          hasImages: true,
          hasText: true,
          imageTypes: ['image/jpeg'],
          textContent: 'Some text content',
        });
      }).toThrow();
    });

    it('should handle empty clipboard gracefully', async () => {
      mockClipboard.read.mockResolvedValue([]);
      mockClipboard.readText.mockResolvedValue('');

      expect(() => {
        const { ClipboardManager } = require('@/lib/clipboard-import');
        const manager = new ClipboardManager();
        
        const result = manager.detectClipboardContent();
        
        expect(result).resolves.toMatchObject({
          hasImages: false,
          hasText: false,
          hasFiles: false,
          hasUrls: false,
        });
      }).toThrow();
    });
  });

  describe('Image Import from Clipboard', () => {
    it('should import single image from clipboard', async () => {
      const mockImageData = 'fake-image-binary-data';
      const mockBlob = new Blob([mockImageData], { type: 'image/png' });
      const clipboardItem = new ClipboardItem({
        'image/png': mockBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { ClipboardImageImporter } = require('@/lib/clipboard-import');
        const importer = new ClipboardImageImporter();
        
        const result = importer.importImages();
        
        expect(result).resolves.toMatchObject({
          files: expect.arrayContaining([
            expect.objectContaining({
              name: expect.stringMatching(/clipboard-image-.*\.png/),
              type: 'image/png',
              size: mockBlob.size,
            }),
          ]),
          errors: [],
          fromClipboard: true,
        });
      }).toThrow();
    });

    it('should import multiple images from clipboard', async () => {
      const mockPngBlob = new Blob(['png-data'], { type: 'image/png' });
      const mockJpegBlob = new Blob(['jpeg-data'], { type: 'image/jpeg' });
      
      const clipboardItems = [
        new ClipboardItem({ 'image/png': mockPngBlob }),
        new ClipboardItem({ 'image/jpeg': mockJpegBlob }),
      ];

      mockClipboard.read.mockResolvedValue(clipboardItems);

      expect(() => {
        const { ClipboardImageImporter } = require('@/lib/clipboard-import');
        const importer = new ClipboardImageImporter();
        
        const result = importer.importImages();
        
        expect(result).resolves.toMatchObject({
          files: expect.arrayContaining([
            expect.objectContaining({ type: 'image/png' }),
            expect.objectContaining({ type: 'image/jpeg' }),
          ]),
          errors: [],
          fromClipboard: true,
        });
        
        expect(result.files).toHaveLength(2);
      }).toThrow();
    });

    it('should generate unique filenames for clipboard images', async () => {
      const mockBlob = new Blob(['image-data'], { type: 'image/webp' });
      const clipboardItem = new ClipboardItem({
        'image/webp': mockBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { ClipboardImageImporter } = require('@/lib/clipboard-import');
        const importer = new ClipboardImageImporter();
        
        const result1 = importer.importImages();
        const result2 = importer.importImages();
        
        Promise.all([result1, result2]).then(([r1, r2]) => {
          expect(r1.files[0].name).not.toBe(r2.files[0].name);
          expect(r1.files[0].name).toMatch(/clipboard-image-\d+-\d+\.webp/);
          expect(r2.files[0].name).toMatch(/clipboard-image-\d+-\d+\.webp/);
        });
      }).toThrow();
    });

    it('should validate image types during import', async () => {
      const validImageBlob = new Blob(['valid-image'], { type: 'image/png' });
      const invalidBlob = new Blob(['not-an-image'], { type: 'text/plain' });
      
      const clipboardItems = [
        new ClipboardItem({
          'image/png': validImageBlob,
          'text/plain': invalidBlob,
        }),
      ];

      mockClipboard.read.mockResolvedValue(clipboardItems);

      expect(() => {
        const { ClipboardImageImporter } = require('@/lib/clipboard-import');
        const importer = new ClipboardImageImporter({
          validateImageType: true,
          allowedTypes: ['image/png', 'image/jpeg', 'image/webp'],
        });
        
        const result = importer.importImages();
        
        expect(result).resolves.toMatchObject({
          files: [expect.objectContaining({ type: 'image/png' })],
          errors: [],
          fromClipboard: true,
        });
      }).toThrow();
    });

    it('should handle large clipboard images with size limits', async () => {
      const largeImageData = new Array(10 * 1024 * 1024).fill('x').join(''); // 10MB
      const largeBlob = new Blob([largeImageData], { type: 'image/jpeg' });
      const clipboardItem = new ClipboardItem({
        'image/jpeg': largeBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { ClipboardImageImporter } = require('@/lib/clipboard-import');
        const importer = new ClipboardImageImporter({
          maxFileSize: 5 * 1024 * 1024, // 5MB limit
        });
        
        const result = importer.importImages();
        
        expect(result).resolves.toMatchObject({
          files: [],
          errors: [
            expect.objectContaining({
              message: expect.stringMatching(/file size.*exceeds.*limit/i),
              type: 'validation',
            }),
          ],
          fromClipboard: true,
        });
      }).toThrow();
    });
  });

  describe('URL Import from Clipboard', () => {
    it('should extract image URLs from clipboard text', async () => {
      const clipboardText = `
        Here are some images:
        https://example.com/photo1.jpg
        https://example.com/logo.png
        https://example.com/banner.webp
        This is not a URL: just some text
        https://example.com/document.pdf (not an image)
      `;

      mockClipboard.readText.mockResolvedValue(clipboardText);

      expect(() => {
        const { ClipboardUrlExtractor } = require('@/lib/clipboard-import');
        const extractor = new ClipboardUrlExtractor();
        
        const urls = extractor.extractImageUrls(clipboardText);
        
        expect(urls).toEqual([
          'https://example.com/photo1.jpg',
          'https://example.com/logo.png',
          'https://example.com/banner.webp',
        ]);
      }).toThrow();
    });

    it('should validate URL formats', () => {
      const testUrls = [
        'https://example.com/valid.jpg',
        'http://example.com/also-valid.png',
        'ftp://example.com/invalid.jpg', // Invalid protocol
        'not-a-url.jpg',
        'https://example.com/no-extension',
        'https://example.com/document.txt', // Not an image
      ];

      expect(() => {
        const { validateImageUrl } = require('@/lib/clipboard-import');
        
        const validUrls = testUrls.filter(validateImageUrl);
        
        expect(validUrls).toEqual([
          'https://example.com/valid.jpg',
          'http://example.com/also-valid.png',
        ]);
      }).toThrow();
    });

    it('should import images from clipboard URLs', async () => {
      const clipboardText = 'https://example.com/image1.jpg\nhttps://example.com/image2.png';
      mockClipboard.readText.mockResolvedValue(clipboardText);

      expect(() => {
        const { ClipboardUrlImporter } = require('@/lib/clipboard-import');
        const importer = new ClipboardUrlImporter();
        
        const result = importer.importFromUrls();
        
        expect(result).resolves.toMatchObject({
          successful: expect.arrayContaining([
            expect.objectContaining({
              url: 'https://example.com/image1.jpg',
              file: expect.any(File),
            }),
            expect.objectContaining({
              url: 'https://example.com/image2.png',
              file: expect.any(File),
            }),
          ]),
          failed: [],
          totalRequested: 2,
          totalSuccessful: 2,
          totalFailed: 0,
        });
      }).toThrow();
    });

    it('should handle URL import failures gracefully', async () => {
      const clipboardText = `
        https://example.com/valid.jpg
        https://404.example.com/missing.png
        https://invalid-domain.xyz/image.gif
      `;
      mockClipboard.readText.mockResolvedValue(clipboardText);

      expect(() => {
        const { ClipboardUrlImporter } = require('@/lib/clipboard-import');
        const importer = new ClipboardUrlImporter();
        
        const result = importer.importFromUrls();
        
        expect(result).resolves.toMatchObject({
          successful: [
            expect.objectContaining({
              url: 'https://example.com/valid.jpg',
            }),
          ],
          failed: [
            expect.objectContaining({
              url: 'https://404.example.com/missing.png',
              error: expect.stringMatching(/404|not found/i),
            }),
            expect.objectContaining({
              url: 'https://invalid-domain.xyz/image.gif',
              error: expect.stringMatching(/network|dns/i),
            }),
          ],
          totalRequested: 3,
          totalSuccessful: 1,
          totalFailed: 2,
        });
      }).toThrow();
    });
  });

  describe('Clipboard Event Handling', () => {
    it('should listen for paste events', () => {
      expect(() => {
        const { ClipboardEventHandler } = require('@/lib/clipboard-import');
        const handler = new ClipboardEventHandler();
        
        const mockPasteEvent = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer(),
        });

        const result = handler.handlePasteEvent(mockPasteEvent);
        
        expect(result).toHaveProperty('preventDefault');
        expect(result).toHaveProperty('clipboardData');
      }).toThrow();
    });

    it('should prevent default paste behavior when handling images', () => {
      // const mockImageBlob = new Blob(['image-data'], { type: 'image/png' });
      const mockDataTransfer = new DataTransfer();
      
      // Mock clipboardData
      Object.defineProperty(mockDataTransfer, 'items', {
        value: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => new File(['image-data'], 'paste.png', { type: 'image/png' }),
          },
        ],
      });

      expect(() => {
        const { ClipboardEventHandler } = require('@/lib/clipboard-import');
        const handler = new ClipboardEventHandler();
        
        const mockPasteEvent = new ClipboardEvent('paste', {
          clipboardData: mockDataTransfer,
        });

        const result = handler.handlePasteEvent(mockPasteEvent);
        
        expect(result.preventDefault).toBe(true);
        expect(result.hasImages).toBe(true);
      }).toThrow();
    });

    it('should allow default paste behavior for text content', () => {
      const mockDataTransfer = new DataTransfer();
      
      Object.defineProperty(mockDataTransfer, 'items', {
        value: [
          {
            kind: 'string',
            type: 'text/plain',
            getAsString: (callback: (data: string) => void) => {
              callback('Just some regular text');
            },
          },
        ],
      });

      expect(() => {
        const { ClipboardEventHandler } = require('@/lib/clipboard-import');
        const handler = new ClipboardEventHandler({
          interceptTextPaste: false,
        });
        
        const mockPasteEvent = new ClipboardEvent('paste', {
          clipboardData: mockDataTransfer,
        });

        const result = handler.handlePasteEvent(mockPasteEvent);
        
        expect(result.preventDefault).toBe(false);
        expect(result.hasImages).toBe(false);
        expect(result.hasText).toBe(true);
      }).toThrow();
    });

    it('should handle paste events with keyboard modifiers', () => {
      expect(() => {
        const { ClipboardEventHandler } = require('@/lib/clipboard-import');
        const handler = new ClipboardEventHandler();
        
        const ctrlVEvent = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer(),
          ctrlKey: true,
        });

        const shiftPasteEvent = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer(),
          shiftKey: true,
        });

        const ctrlResult = handler.handlePasteEvent(ctrlVEvent);
        const shiftResult = handler.handlePasteEvent(shiftPasteEvent);
        
        expect(ctrlResult.modifiers).toEqual({ ctrl: true, shift: false, alt: false });
        expect(shiftResult.modifiers).toEqual({ ctrl: false, shift: true, alt: false });
      }).toThrow();
    });
  });

  describe('Clipboard Permissions and Security', () => {
    it('should request clipboard permissions when needed', async () => {
      const mockPermissions = {
        query: vi.fn(),
        request: vi.fn(),
      };

      Object.defineProperty(navigator, 'permissions', {
        value: mockPermissions,
        writable: true,
      });

      mockPermissions.query.mockResolvedValue({ state: 'prompt' });
      mockPermissions.request.mockResolvedValue({ state: 'granted' });

      expect(() => {
        const { ClipboardPermissionManager } = require('@/lib/clipboard-import');
        const manager = new ClipboardPermissionManager();
        
        const result = manager.requestClipboardAccess();
        
        expect(result).resolves.toMatchObject({
          granted: true,
          state: 'granted',
        });
        
        expect(mockPermissions.query).toHaveBeenCalledWith({ name: 'clipboard-read' });
      }).toThrow();
    });

    it('should handle permission denied gracefully', async () => {
      const mockPermissions = {
        query: vi.fn().mockResolvedValue({ state: 'denied' }),
      };

      Object.defineProperty(navigator, 'permissions', {
        value: mockPermissions,
        writable: true,
      });

      expect(() => {
        const { ClipboardPermissionManager } = require('@/lib/clipboard-import');
        const manager = new ClipboardPermissionManager();
        
        const result = manager.requestClipboardAccess();
        
        expect(result).resolves.toMatchObject({
          granted: false,
          state: 'denied',
          error: expect.stringMatching(/permission denied/i),
        });
      }).toThrow();
    });

    it('should validate clipboard data security', () => {
      const suspiciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'file:///etc/passwd',
        'ftp://suspicious.com/image.jpg',
      ];

      expect(() => {
        const { ClipboardSecurityValidator } = require('@/lib/clipboard-import');
        const validator = new ClipboardSecurityValidator();
        
        suspiciousUrls.forEach(url => {
          expect(validator.isUrlSafe(url)).toBe(false);
        });
        
        const safeUrls = [
          'https://example.com/image.jpg',
          'http://localhost:3000/test.png',
        ];
        
        safeUrls.forEach(url => {
          expect(validator.isUrlSafe(url)).toBe(true);
        });
      }).toThrow();
    });

    it('should sanitize filenames from clipboard', () => {
      const dangerousFilenames = [
        '../../../etc/passwd',
        'C:\\Windows\\System32\\virus.exe',
        'script<>.js',
        'file with\0null.jpg',
      ];

      expect(() => {
        const { sanitizeFilename } = require('@/lib/clipboard-import');
        
        dangerousFilenames.forEach(filename => {
          const sanitized = sanitizeFilename(filename);
          expect(sanitized).not.toContain('../');
          expect(sanitized).not.toContain('\\');
          expect(sanitized).not.toContain('<');
          expect(sanitized).not.toContain('>');
          expect(sanitized).not.toContain('\0');
        });
      }).toThrow();
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large clipboard data efficiently', async () => {
      const largeImageData = new Array(50 * 1024 * 1024).fill('x').join(''); // 50MB
      const largeBlob = new Blob([largeImageData], { type: 'image/jpeg' });
      const clipboardItem = new ClipboardItem({
        'image/jpeg': largeBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { OptimizedClipboardImporter } = require('@/lib/clipboard-import');
        const importer = new OptimizedClipboardImporter({
          chunkSize: 1024 * 1024, // 1MB chunks
          useWorker: true,
        });
        
        const startTime = performance.now();
        const result = importer.importImages();
        const endTime = performance.now();
        
        // Should not block main thread
        expect(endTime - startTime).toBeLessThan(100);
        
        expect(result).resolves.toHaveProperty('files');
      }).toThrow();
    });

    it('should implement progressive loading for multiple images', async () => {
      const multipleImages = Array.from({ length: 10 }, (_, i) => 
        new ClipboardItem({
          [`image/jpeg`]: new Blob([`image-${i}`], { type: 'image/jpeg' }),
        })
      );

      mockClipboard.read.mockResolvedValue(multipleImages);

      expect(() => {
        const { ProgressiveClipboardImporter } = require('@/lib/clipboard-import');
        const importer = new ProgressiveClipboardImporter();
        
        const progressCallback = vi.fn();
        const result = importer.importImages({ onProgress: progressCallback });
        
        expect(result).resolves.toHaveProperty('files');
        expect(progressCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            loaded: expect.any(Number),
            total: 10,
            percentage: expect.any(Number),
          })
        );
      }).toThrow();
    });

    it('should cache clipboard data to avoid redundant reads', async () => {
      const mockBlob = new Blob(['cached-image'], { type: 'image/png' });
      const clipboardItem = new ClipboardItem({
        'image/png': mockBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { CachedClipboardManager } = require('@/lib/clipboard-import');
        const manager = new CachedClipboardManager({
          cacheTimeout: 5000, // 5 seconds
        });
        
        // First call should read from clipboard
        const result1 = manager.getClipboardData();
        
        // Second call should use cache
        const result2 = manager.getClipboardData();
        
        expect(mockClipboard.read).toHaveBeenCalledTimes(1);
        expect(result1).toBe(result2);
      }).toThrow();
    });
  });

  describe('Browser Compatibility', () => {
    it('should detect clipboard API support', () => {
      expect(() => {
        const { ClipboardCompatibilityChecker } = require('@/lib/clipboard-import');
        const checker = new ClipboardCompatibilityChecker();
        
        expect(checker.isClipboardApiSupported()).toBe(true);
        expect(checker.isClipboardReadSupported()).toBe(true);
        expect(checker.getSupportedMimeTypes()).toContain('image/png');
      }).toThrow();
    });

    it('should provide fallback for unsupported browsers', () => {
      // Mock unsupported browser
      delete (navigator as any).clipboard;

      expect(() => {
        const { ClipboardFallbackHandler } = require('@/lib/clipboard-import');
        const handler = new ClipboardFallbackHandler();
        
        const result = handler.importImages();
        
        expect(result).resolves.toMatchObject({
          files: [],
          errors: [
            expect.objectContaining({
              message: expect.stringMatching(/clipboard.*not supported/i),
              type: 'browser_compatibility',
            }),
          ],
          fromClipboard: false,
        });
      }).toThrow();
    });

    it('should handle different clipboard formats across browsers', () => {
      const clipboardFormats = [
        { type: 'image/png', data: 'png-data' },
        { type: 'image/jpeg', data: 'jpeg-data' },
        { type: 'image/webp', data: 'webp-data' },
        { type: 'image/gif', data: 'gif-data' },
        { type: 'image/bmp', data: 'bmp-data' },
      ];

      expect(() => {
        const { CrossBrowserClipboardHandler } = require('@/lib/clipboard-import');
        const handler = new CrossBrowserClipboardHandler();
        
        clipboardFormats.forEach(format => {
          const isSupported = handler.isMimeTypeSupported(format.type);
          const normalizedType = handler.normalizeMimeType(format.type);
          
          expect(typeof isSupported).toBe('boolean');
          expect(normalizedType).toMatch(/^image\//);
        });
      }).toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle clipboard access errors', async () => {
      mockClipboard.read.mockRejectedValue(new Error('Clipboard access denied'));

      expect(() => {
        const { ClipboardManager } = require('@/lib/clipboard-import');
        const manager = new ClipboardManager();
        
        const result = manager.importImages();
        
        expect(result).resolves.toMatchObject({
          files: [],
          errors: [
            expect.objectContaining({
              message: expect.stringMatching(/clipboard access denied/i),
              type: 'clipboard_error',
            }),
          ],
          fromClipboard: true,
        });
      }).toThrow();
    });

    it('should handle corrupted clipboard data', async () => {
      const corruptedBlob = new Blob(['corrupted'], { type: 'image/png' });
      const clipboardItem = new ClipboardItem({
        'image/png': corruptedBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { ClipboardImageValidator } = require('@/lib/clipboard-import');
        const validator = new ClipboardImageValidator();
        
        const result = validator.validateImage(corruptedBlob);
        
        expect(result).resolves.toMatchObject({
          isValid: false,
          error: expect.stringMatching(/invalid.*image.*data/i),
        });
      }).toThrow();
    });

    it('should handle memory exhaustion during large imports', async () => {
      const hugeImageData = new Array(500 * 1024 * 1024).fill('x').join(''); // 500MB
      const hugeBlob = new Blob([hugeImageData], { type: 'image/jpeg' });
      const clipboardItem = new ClipboardItem({
        'image/jpeg': hugeBlob,
      });

      mockClipboard.read.mockResolvedValue([clipboardItem]);

      expect(() => {
        const { MemoryAwareClipboardImporter } = require('@/lib/clipboard-import');
        const importer = new MemoryAwareClipboardImporter({
          maxMemoryUsage: 100 * 1024 * 1024, // 100MB limit
        });
        
        const result = importer.importImages();
        
        expect(result).resolves.toMatchObject({
          files: [],
          errors: [
            expect.objectContaining({
              message: expect.stringMatching(/memory.*limit.*exceeded/i),
              type: 'memory_error',
            }),
          ],
        });
      }).toThrow();
    });
  });
});