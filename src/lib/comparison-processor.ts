import type { 
  ImageFile, 
  ComparisonMetrics, 
  ImageComparison
} from '@/types';

interface ThumbnailCache {
  [key: string]: string[];
}

interface ComparisonCache {
  [key: string]: ImageComparison;
}

export class ComparisonProcessor {
  private thumbnailCache: ThumbnailCache = {};
  private comparisonCache: ComparisonCache = {};
  private maxCacheSize = 100;

  async generateThumbnails(file: File, sizes: number[]): Promise<string[]> {
    const cacheKey = `${file.name}-${file.size}-${sizes.join(',')}`;
    
    // Check cache first
    if (this.thumbnailCache[cacheKey]) {
      return this.thumbnailCache[cacheKey];
    }

    try {
      const thumbnails: string[] = [];

      for (const size of sizes) {
        const thumbnail = await this.createThumbnail(file, size);
        thumbnails.push(thumbnail);
      }

      // Cache result
      this.thumbnailCache[cacheKey] = thumbnails;
      this.limitCacheSize();

      return thumbnails;
    } catch (error) {
      throw new Error('Failed to load image');
    }
  }

  private async createThumbnail(file: File, size: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        // Calculate dimensions maintaining aspect ratio
        const { width, height } = this.calculateThumbnailDimensions(
          img.width, 
          img.height, 
          size
        );

        canvas.width = width;
        canvas.height = height;

        // Draw and resize image
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);

        // Cleanup
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  private calculateThumbnailDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxSize: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;

    if (originalWidth > originalHeight) {
      return {
        width: Math.min(maxSize, originalWidth),
        height: Math.min(maxSize, originalWidth) / aspectRatio,
      };
    } else {
      return {
        width: Math.min(maxSize, originalHeight) * aspectRatio,
        height: Math.min(maxSize, originalHeight),
      };
    }
  }

  async calculateMetrics(original: File, compressed: Blob): Promise<ComparisonMetrics> {
    const startTime = performance.now();

    try {
      // Get image dimensions
      const originalDimensions = await this.getImageDimensions(original);
      const compressedDimensions = await this.getImageDimensions(compressed);

      // Calculate basic metrics
      const originalSize = original.size;
      const compressedSize = compressed.size;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 0;
      const sizeSavings = originalSize - compressedSize;
      const sizeSavingsPercent = originalSize > 0 ? (sizeSavings / originalSize) * 100 : 0;

      // Calculate quality score (simplified)
      const qualityScore = this.calculateQualityScore(compressionRatio, original.type, compressed.type);

      const processingTime = performance.now() - startTime;

      return {
        originalSize,
        compressedSize,
        compressionRatio,
        sizeSavings,
        sizeSavingsPercent,
        qualityScore,
        processingTime,
        dimensions: {
          original: originalDimensions,
          compressed: compressedDimensions,
        },
        formats: {
          original: this.getFormatName(original.type),
          compressed: this.getFormatName(compressed.type),
        },
      };
    } catch (error) {
      throw new Error('Failed to calculate metrics');
    }
  }

  private async getImageDimensions(file: File | Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        reject(new Error('Failed to get image dimensions'));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  private calculateQualityScore(compressionRatio: number, _originalType: string, compressedType: string): number {
    // Simplified quality score calculation
    // In reality, this would use more sophisticated metrics like SSIM or PSNR
    
    let baseScore = 1.0;

    // Penalize high compression
    if (compressionRatio < 0.3) {
      baseScore *= 0.7;
    } else if (compressionRatio < 0.5) {
      baseScore *= 0.85;
    } else if (compressionRatio < 0.7) {
      baseScore *= 0.95;
    }

    // Format-based adjustments
    if (compressedType.includes('webp')) {
      baseScore *= 1.1; // WebP generally maintains better quality
    } else if (compressedType.includes('avif')) {
      baseScore *= 1.15; // AVIF even better
    }

    return Math.min(1.0, Math.max(0.0, baseScore));
  }

  private getFormatName(mimeType: string): string {
    const formatMap: Record<string, string> = {
      'image/jpeg': 'JPEG',
      'image/jpg': 'JPEG',
      'image/png': 'PNG',
      'image/webp': 'WebP',
      'image/avif': 'AVIF',
      'image/gif': 'GIF',
      'image/bmp': 'BMP',
    };

    return formatMap[mimeType] || mimeType.replace('image/', '').toUpperCase();
  }

  async createComparison(originalFile: ImageFile): Promise<ImageComparison> {
    const id = `comparison-${originalFile.id}-${Date.now()}`;

    try {
      // Generate initial thumbnail
      const thumbnails = await this.generateThumbnails(originalFile.file, [300]);
      
      const comparison: ImageComparison = {
        id,
        originalFile,
        compressedFile: undefined,
        comparisonMetrics: {
          originalSize: originalFile.size,
          compressedSize: 0,
          compressionRatio: 0,
          sizeSavings: 0,
          sizeSavingsPercent: 0,
          qualityScore: undefined,
          processingTime: 0,
          dimensions: {
            original: { width: 0, height: 0 },
            compressed: { width: 0, height: 0 },
          },
          formats: {
            original: this.getFormatName(originalFile.type),
            compressed: '',
          },
        },
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
          original: thumbnails[0],
        },
        status: 'pending',
      };

      this.comparisonCache[id] = comparison;
      return comparison;
    } catch (error) {
      const comparison: ImageComparison = {
        id,
        originalFile,
        comparisonMetrics: {} as ComparisonMetrics,
        viewSettings: {} as any,
        thumbnails: {},
        status: 'error',
        error: 'Failed to generate thumbnails',
      };

      return comparison;
    }
  }

  async updateComparison(id: string, compressedFile: ImageFile): Promise<void> {
    const comparison = this.comparisonCache[id];
    if (!comparison) {
      throw new Error('Comparison not found');
    }

    try {
      // Generate compressed thumbnail
      const compressedThumbnails = await this.generateThumbnails(compressedFile.file, [300]);
      
      // Calculate metrics
      const metrics = await this.calculateMetrics(
        comparison.originalFile.file,
        compressedFile.file
      );

      // Update comparison
      comparison.compressedFile = compressedFile;
      comparison.comparisonMetrics = metrics;
      comparison.thumbnails.compressed = compressedThumbnails[0];
      comparison.status = 'ready';

    } catch (error) {
      comparison.status = 'error';
      comparison.error = `Failed to update comparison: ${  error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  removeComparison(id: string): void {
    const comparison = this.comparisonCache[id];
    if (comparison) {
      // Clean up object URLs
      if (comparison.thumbnails.original) {
        URL.revokeObjectURL(comparison.thumbnails.original);
      }
      if (comparison.thumbnails.compressed) {
        URL.revokeObjectURL(comparison.thumbnails.compressed);
      }

      delete this.comparisonCache[id];
    }
  }

  getCacheSize(): number {
    return Object.keys(this.thumbnailCache).length;
  }

  private limitCacheSize(): void {
    const keys = Object.keys(this.thumbnailCache);
    if (keys.length > this.maxCacheSize) {
      // Remove oldest entries (simplified LRU)
      const keysToRemove = keys.slice(0, keys.length - this.maxCacheSize);
      for (const key of keysToRemove) {
        delete this.thumbnailCache[key];
      }
    }
  }

  async processVisibleComparisons(files: ImageFile[], visibleIndices: number[]): Promise<void> {
    // Process visible items first for better perceived performance
    const visibleFiles = visibleIndices.map(i => files[i]).filter(Boolean);
    
    await Promise.all(
      visibleFiles.map(file => this.createComparison(file))
    );
  }

  // Cleanup method
  cleanup(): void {
    // Clean up all cached comparisons
    Object.keys(this.comparisonCache).forEach(id => {
      this.removeComparison(id);
    });

    // Clear thumbnail cache
    this.thumbnailCache = {};
  }
}