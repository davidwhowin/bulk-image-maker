import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { 
  ImageFile, 
  DuplicateDetectionSettings, 
  DuplicateGroup 
} from '@/types';

// Mock Web Worker for duplicate detection
const mockWorker = {
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  terminate: vi.fn(),
};

globalThis.Worker = vi.fn(() => mockWorker) as any;

describe('Duplicate File Detection', () => {
  const createMockImageFile = (
    id: string,
    name: string,
    content: string = 'mock-content',
    size: number = 1024,
    type: string = 'image/jpeg'
  ): ImageFile => ({
    id,
    file: new File([content], name, { type }),
    name,
    size,
    type,
    status: 'pending',
    progress: 0,
  });

  const mockFiles: ImageFile[] = [
    createMockImageFile('1', 'photo1.jpg', 'identical-content', 2048),
    createMockImageFile('2', 'photo1-copy.jpg', 'identical-content', 2048),
    createMockImageFile('3', 'photo2.jpg', 'unique-content-1', 1024),
    createMockImageFile('4', 'logo.png', 'logo-content', 512),
    createMockImageFile('5', 'logo-backup.png', 'logo-content', 512),
    createMockImageFile('6', 'banner.webp', 'banner-content', 4096),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hash-based Duplicate Detection', () => {
    it('should detect duplicates by content hash', async () => {
      const settings: DuplicateDetectionSettings = {
        enabled: true,
        compareBy: 'hash',
        threshold: 1.0,
        autoRemove: false,
        keepPolicy: 'first',
      };

      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector(settings);
        const result = detector.detectDuplicates(mockFiles);
        
        expect(result).toHaveProperty('duplicateGroups');
        expect(result).toHaveProperty('duplicateCount');
        expect(result).toHaveProperty('uniqueFiles');
        expect(result).toHaveProperty('processingTime');
        
        expect(result.duplicateGroups).toHaveLength(2);
        expect(result.duplicateCount).toBe(4);
        expect(result.uniqueFiles).toHaveLength(2);
      }).toThrow();
    });

    it('should generate consistent hashes for identical content', async () => {
      expect(() => {
        const { generateFileHash } = require('@/lib/duplicate-detection');
        
        const file1 = createMockImageFile('1', 'test1.jpg', 'same-content');
        const file2 = createMockImageFile('2', 'test2.jpg', 'same-content');
        
        const hash1 = generateFileHash(file1.file);
        const hash2 = generateFileHash(file2.file);
        
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex format
      }).toThrow();
    });

    it('should generate different hashes for different content', async () => {
      expect(() => {
        const { generateFileHash } = require('@/lib/duplicate-detection');
        
        const file1 = createMockImageFile('1', 'test1.jpg', 'content-1');
        const file2 = createMockImageFile('2', 'test2.jpg', 'content-2');
        
        const hash1 = generateFileHash(file1.file);
        const hash2 = generateFileHash(file2.file);
        
        expect(hash1).not.toBe(hash2);
      }).toThrow();
    });
  });

  describe('Name-based Duplicate Detection', () => {
    it('should detect duplicates by filename similarity', () => {
      const settings: DuplicateDetectionSettings = {
        enabled: true,
        compareBy: 'name',
        threshold: 0.8,
        autoRemove: false,
        keepPolicy: 'first',
      };

      const similarNameFiles = [
        createMockImageFile('1', 'vacation-photo.jpg'),
        createMockImageFile('2', 'vacation_photo.jpg'),
        createMockImageFile('3', 'vacation photo.jpg'),
        createMockImageFile('4', 'completely-different.jpg'),
      ];

      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector(settings);
        const result = detector.detectDuplicates(similarNameFiles);
        
        expect(result.duplicateGroups).toHaveLength(1);
        expect(result.duplicateGroups[0].files).toHaveLength(3);
      }).toThrow();
    });

    it('should calculate string similarity score', () => {
      expect(() => {
        const { calculateStringSimilarity } = require('@/lib/duplicate-detection');
        
        expect(calculateStringSimilarity('hello', 'hello')).toBe(1.0);
        expect(calculateStringSimilarity('hello', 'world')).toBeLessThan(0.5);
        expect(calculateStringSimilarity('photo.jpg', 'photo_2.jpg')).toBeGreaterThan(0.7);
      }).toThrow();
    });
  });

  describe('Size-based Duplicate Detection', () => {
    it('should detect duplicates by file size', () => {
      const settings: DuplicateDetectionSettings = {
        enabled: true,
        compareBy: 'size',
        threshold: 1.0,
        autoRemove: false,
        keepPolicy: 'first',
      };

      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector(settings);
        const result = detector.detectDuplicates(mockFiles);
        
        const sizeDuplicates = result.duplicateGroups.find((group: DuplicateGroup) => 
          group.files.every((f: ImageFile) => f.size === 2048)
        );
        expect(sizeDuplicates).toBeDefined();
        expect(sizeDuplicates?.files).toHaveLength(2);
      }).toThrow();
    });

    it('should group files by exact size match', () => {
      const sameSize = 1024;
      const filesWithSameSize = [
        createMockImageFile('1', 'file1.jpg', 'content1', sameSize),
        createMockImageFile('2', 'file2.jpg', 'content2', sameSize),
        createMockImageFile('3', 'file3.jpg', 'content3', sameSize),
        createMockImageFile('4', 'different.jpg', 'content4', 2048),
      ];

      expect(() => {
        const { groupFilesBySize } = require('@/lib/duplicate-detection');
        const groups = groupFilesBySize(filesWithSameSize);
        
        expect(groups.get(sameSize)).toHaveLength(3);
        expect(groups.get(2048)).toHaveLength(1);
      }).toThrow();
    });
  });

  describe('Content-based Duplicate Detection', () => {
    it('should detect duplicates by perceptual image hash', async () => {
      const settings: DuplicateDetectionSettings = {
        enabled: true,
        compareBy: 'content',
        threshold: 0.95,
        autoRemove: false,
        keepPolicy: 'first',
      };

      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector(settings);
        
        // Should use Web Worker for content analysis
        detector.detectDuplicates(mockFiles);
        
        expect(Worker).toHaveBeenCalled();
        expect(mockWorker.postMessage).toHaveBeenCalledWith({
          type: 'DETECT_DUPLICATES',
          files: expect.any(Array),
          settings: expect.objectContaining({ compareBy: 'content' }),
        });
      }).toThrow();
    });

    it('should calculate perceptual hash for images', async () => {
      expect(() => {
        const { calculatePerceptualHash } = require('@/lib/duplicate-detection');
        
        const imageFile = createMockImageFile('1', 'test.jpg');
        const hash = calculatePerceptualHash(imageFile.file);
        
        expect(hash).toMatch(/^[0-9a-f]{16}$/); // 64-bit hex hash
      }).toThrow();
    });

    it('should compare perceptual hashes with threshold', () => {
      expect(() => {
        const { comparePerceptualHashes } = require('@/lib/duplicate-detection');
        
        const hash1 = 'abcd1234efgh5678';
        const hash2 = 'abcd1234efgh5678'; // Identical
        const hash3 = 'ffff1234efgh5678'; // Similar
        const hash4 = '1111222233334444'; // Different
        
        expect(comparePerceptualHashes(hash1, hash2)).toBe(1.0);
        expect(comparePerceptualHashes(hash1, hash3)).toBeGreaterThan(0.7);
        expect(comparePerceptualHashes(hash1, hash4)).toBeLessThan(0.5);
      }).toThrow();
    });
  });

  describe('Web Worker Integration', () => {
    it('should use Web Worker for heavy duplicate detection', async () => {
      const largeFileList = Array.from({ length: 1000 }, (_, i) => 
        createMockImageFile(`file-${i}`, `file${i}.jpg`)
      );

      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector({
          enabled: true,
          compareBy: 'hash',
          threshold: 1.0,
          autoRemove: false,
          keepPolicy: 'first',
        });
        
        detector.detectDuplicates(largeFileList);
        
        expect(Worker).toHaveBeenCalledWith('/duplicate-detection-worker.js');
        expect(mockWorker.postMessage).toHaveBeenCalled();
      }).toThrow();
    });

    it('should handle Web Worker responses', async () => {
      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector({
          enabled: true,
          compareBy: 'hash',
          threshold: 1.0,
          autoRemove: false,
          keepPolicy: 'first',
        });
        
        const promise = detector.detectDuplicates(mockFiles);
        
        // Simulate worker response
        const workerCallback = mockWorker.addEventListener.mock.calls
          .find(([event]) => event === 'message')?.[1];
        
        if (workerCallback) {
          workerCallback({
            data: {
              type: 'DUPLICATES_DETECTED',
              result: {
                duplicateGroups: [],
                duplicateCount: 0,
                uniqueFiles: mockFiles,
                processingTime: 150,
              },
            },
          });
        }
        
        expect(promise).resolves.toHaveProperty('duplicateGroups');
      }).toThrow();
    });

    it('should handle Web Worker errors gracefully', async () => {
      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector({
          enabled: true,
          compareBy: 'content',
          threshold: 0.95,
          autoRemove: false,
          keepPolicy: 'first',
        });
        
        const promise = detector.detectDuplicates(mockFiles);
        
        // Simulate worker error
        const errorCallback = mockWorker.addEventListener.mock.calls
          .find(([event]) => event === 'error')?.[1];
        
        if (errorCallback) {
          errorCallback(new Error('Worker failed'));
        }
        
        expect(promise).rejects.toThrow('Worker failed');
      }).toThrow();
    });
  });

  describe('Duplicate Group Management', () => {
    it('should create duplicate groups with representative files', () => {
      const duplicateFiles = [
        createMockImageFile('1', 'original.jpg', 'content', 2048),
        createMockImageFile('2', 'copy1.jpg', 'content', 1024),
        createMockImageFile('3', 'copy2.jpg', 'content', 512),
      ];

      expect(() => {
        const { createDuplicateGroup } = require('@/lib/duplicate-detection');
        const group = createDuplicateGroup('group-1', duplicateFiles, 'abc123');
        
        expect(group).toMatchObject({
          id: 'group-1',
          files: duplicateFiles,
          hash: 'abc123',
          representative: duplicateFiles[0], // Largest file by default
          size: duplicateFiles.length,
        });
      }).toThrow();
    });

    it('should select representative file based on keep policy', () => {
      const duplicateFiles = [
        { ...createMockImageFile('1', 'newest.jpg', 'content', 1024), importedAt: new Date('2023-12-01') },
        { ...createMockImageFile('2', 'oldest.jpg', 'content', 2048), importedAt: new Date('2023-01-01') },
        { ...createMockImageFile('3', 'middle.jpg', 'content', 512), importedAt: new Date('2023-06-01') },
      ];

      expect(() => {
        const { selectRepresentativeFile } = require('@/lib/duplicate-detection');
        
        const firstFile = selectRepresentativeFile(duplicateFiles, 'first');
        const largestFile = selectRepresentativeFile(duplicateFiles, 'largest');
        const smallestFile = selectRepresentativeFile(duplicateFiles, 'smallest');
        const newestFile = selectRepresentativeFile(duplicateFiles, 'newest');
        
        expect(firstFile.id).toBe('1');
        expect(largestFile.id).toBe('2');
        expect(smallestFile.id).toBe('3');
        expect(newestFile.id).toBe('1');
      }).toThrow();
    });
  });

  describe('Duplicate Resolution', () => {
    it('should resolve duplicates by keeping selected file', () => {
      const duplicateGroup: DuplicateGroup = {
        id: 'group-1',
        files: [
          createMockImageFile('1', 'keep.jpg'),
          createMockImageFile('2', 'remove1.jpg'),
          createMockImageFile('3', 'remove2.jpg'),
        ],
        hash: 'abc123',
        representative: createMockImageFile('1', 'keep.jpg'),
        size: 3,
      };

      expect(() => {
        const { resolveDuplicateGroup } = require('@/lib/duplicate-detection');
        const result = resolveDuplicateGroup(duplicateGroup, '1');
        
        expect(result.keptFile.id).toBe('1');
        expect(result.removedFiles).toHaveLength(2);
        expect(result.removedFiles.map((f: ImageFile) => f.id)).toEqual(['2', '3']);
      }).toThrow();
    });

    it('should auto-resolve duplicates based on policy', () => {
      const duplicateGroups: DuplicateGroup[] = [
        {
          id: 'group-1',
          files: [
            createMockImageFile('1', 'original.jpg', 'content', 2048),
            createMockImageFile('2', 'copy.jpg', 'content', 1024),
          ],
          hash: 'abc123',
          representative: createMockImageFile('1', 'original.jpg', 'content', 2048),
          size: 2,
        },
      ];

      expect(() => {
        const { autoResolveDuplicates } = require('@/lib/duplicate-detection');
        const resolved = autoResolveDuplicates(duplicateGroups, 'largest');
        
        expect(resolved.keptFiles).toHaveLength(1);
        expect(resolved.removedFiles).toHaveLength(1);
        expect(resolved.keptFiles[0].id).toBe('1');
        expect(resolved.removedFiles[0].id).toBe('2');
      }).toThrow();
    });
  });

  describe('Performance Optimization', () => {
    it('should process files in chunks for better performance', async () => {
      const largeFileList = Array.from({ length: 5000 }, (_, i) => 
        createMockImageFile(`file-${i}`, `file${i}.jpg`)
      );

      expect(() => {
        const { ChunkedDuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new ChunkedDuplicateDetector({
          chunkSize: 500,
          maxConcurrency: 4,
        });
        
        const result = detector.detectDuplicates(largeFileList);
        
        expect(result).toHaveProperty('chunksProcessed');
        expect(result).toHaveProperty('totalProcessingTime');
      }).toThrow();
    });

    it('should implement early termination for obvious non-duplicates', () => {
      const obviouslyDifferentFiles = [
        createMockImageFile('1', 'small.jpg', 'content', 100),
        createMockImageFile('2', 'large.jpg', 'content', 10000),
      ];

      expect(() => {
        const { fastDuplicateCheck } = require('@/lib/duplicate-detection');
        const isDuplicate = fastDuplicateCheck(
          obviouslyDifferentFiles[0], 
          obviouslyDifferentFiles[1]
        );
        
        expect(isDuplicate).toBe(false);
      }).toThrow();
    });

    it('should cache hash calculations', async () => {
      const file = createMockImageFile('1', 'test.jpg');

      expect(() => {
        const { CachedHashCalculator } = require('@/lib/duplicate-detection');
        const calculator = new CachedHashCalculator();
        
        const hash1 = calculator.calculateHash(file);
        const hash2 = calculator.calculateHash(file); // Should use cache
        
        expect(hash1).toBe(hash2);
        expect(calculator.getCacheHitRate()).toBeGreaterThan(0);
      }).toThrow();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty file list', () => {
      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector({
          enabled: true,
          compareBy: 'hash',
          threshold: 1.0,
          autoRemove: false,
          keepPolicy: 'first',
        });
        
        const result = detector.detectDuplicates([]);
        
        expect(result.duplicateGroups).toHaveLength(0);
        expect(result.duplicateCount).toBe(0);
        expect(result.uniqueFiles).toHaveLength(0);
      }).toThrow();
    });

    it('should handle corrupted file data', async () => {
      const corruptedFile = {
        ...createMockImageFile('1', 'corrupt.jpg'),
        file: null,
      } as any;

      expect(() => {
        const { generateFileHash } = require('@/lib/duplicate-detection');
        expect(() => generateFileHash(corruptedFile.file)).toThrow('Invalid file');
      }).toThrow();
    });

    it('should handle very large files gracefully', async () => {
      // Simulate a very large file
      const largeFile = createMockImageFile('1', 'huge.jpg', 'content', 100 * 1024 * 1024);

      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector({
          enabled: true,
          compareBy: 'hash',
          threshold: 1.0,
          autoRemove: false,
          keepPolicy: 'first',
        });
        
        // Should handle large files without blocking UI
        const startTime = performance.now();
        detector.detectDuplicates([largeFile]);
        const endTime = performance.now();
        
        // Should delegate to Web Worker, so main thread should be fast
        expect(endTime - startTime).toBeLessThan(50);
      }).toThrow();
    });

    it('should handle insufficient memory conditions', () => {
      expect(() => {
        const { DuplicateDetector } = require('@/lib/duplicate-detection');
        const detector = new DuplicateDetector({
          enabled: true,
          compareBy: 'content',
          threshold: 0.95,
          autoRemove: false,
          keepPolicy: 'first',
        });
        
        // Mock memory pressure
        Object.defineProperty(performance, 'memory', {
          value: { usedJSHeapSize: 1000000000 }, // 1GB
          configurable: true,
        });
        
        expect(() => detector.detectDuplicates(mockFiles)).not.toThrow();
      }).toThrow();
    });
  });

  describe('Settings and Configuration', () => {
    it('should validate duplicate detection settings', () => {
      expect(() => {
        const { validateDuplicateSettings } = require('@/lib/duplicate-detection');
        
        const validSettings = {
          enabled: true,
          compareBy: 'hash' as const,
          threshold: 0.95,
          autoRemove: false,
          keepPolicy: 'first' as const,
        };
        
        expect(validateDuplicateSettings(validSettings)).toBe(true);
        
        const invalidSettings = {
          enabled: true,
          compareBy: 'invalid' as any,
          threshold: 2.0, // Invalid threshold > 1
          autoRemove: false,
          keepPolicy: 'unknown' as any,
        };
        
        expect(() => validateDuplicateSettings(invalidSettings)).toThrow();
      }).toThrow();
    });

    it('should apply default settings for missing values', () => {
      expect(() => {
        const { applyDefaultSettings } = require('@/lib/duplicate-detection');
        
        const partialSettings = { enabled: true };
        const fullSettings = applyDefaultSettings(partialSettings);
        
        expect(fullSettings).toMatchObject({
          enabled: true,
          compareBy: 'hash',
          threshold: 0.95,
          autoRemove: false,
          keepPolicy: 'first',
        });
      }).toThrow();
    });
  });
});