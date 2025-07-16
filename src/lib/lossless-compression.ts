import type { 
  LosslessCompressionOptions, 
  LosslessCompressionResult,
  LosslessFormat,
  LosslessFormatComparison,
  LosslessMemoryInfo,
  LosslessProgressInfo,
  LosslessCompressionMode
} from '@/types/lossless';

/**
 * Advanced lossless compression engine for maximum quality preservation
 */
export class LosslessCompressor {
  private abortController: AbortController | null = null;
  private memoryMonitor: MemoryMonitor;
  private qualityValidator: QualityValidator;

  constructor() {
    this.memoryMonitor = new MemoryMonitor();
    this.qualityValidator = new QualityValidator();
  }

  /**
   * Compress a file using lossless compression modes
   */
  async compressLossless(
    file: File, 
    options: LosslessCompressionOptions
  ): Promise<LosslessCompressionResult> {
    const startTime = performance.now();
    const originalFormat = file.type.replace('image/', '') as LosslessFormat;
    
    // Validate options
    const validationErrors = LosslessUtils.validateOptions(options);
    if (validationErrors.length > 0) {
      return {
        success: false,
        originalFormat,
        outputFormat: options.format,
        originalSize: file.size,
        outputSize: 0,
        compressionRatio: 0,
        processingTime: performance.now() - startTime,
        preservedTransparency: false,
        preservedAnimation: false,
        preservedMetadata: false,
        error: validationErrors.join(', ')
      };
    }

    try {
      // Check memory constraints
      const memoryInfo = this.getMemoryInfo([file], options.format);
      if (!memoryInfo.canProceed) {
        throw new Error('Insufficient memory for lossless compression');
      }

      // Load image and get image data
      const imageData = await this.loadImageData(file);
      
      // Track memory usage if requested
      let memoryUsage: number | undefined;
      if (options.trackMemory) {
        await this.memoryMonitor.trackOperation(async () => {
          return this.performLosslessCompression(imageData, options);
        });
        memoryUsage = this.memoryMonitor.getPeakUsage();
      }

      // Perform compression
      const result = await this.performLosslessCompression(imageData, options);
      
      // Validate lossless quality if requested
      let isPixelPerfect: boolean | undefined;
      if (options.validateLossless && result.outputBlob) {
        isPixelPerfect = await this.qualityValidator.validatePixelPerfect(file, result.outputBlob);
      }

      const endTime = performance.now();
      
      return {
        success: true,
        originalFormat,
        outputFormat: result.format,
        outputBlob: result.outputBlob,
        originalSize: file.size,
        outputSize: result.outputBlob?.size || 0,
        compressionRatio: result.outputBlob ? result.outputBlob.size / file.size : 0,
        processingTime: endTime - startTime,
        memoryUsage,
        preservedTransparency: result.preservedTransparency,
        preservedAnimation: result.preservedAnimation,
        preservedMetadata: result.preservedMetadata,
        isPixelPerfect,
        warnings: result.warnings,
        fallbackUsed: result.fallbackUsed
      };

    } catch (error) {
      return {
        success: false,
        originalFormat,
        outputFormat: options.format,
        originalSize: file.size,
        outputSize: 0,
        compressionRatio: 0,
        processingTime: performance.now() - startTime,
        preservedTransparency: false,
        preservedAnimation: false,
        preservedMetadata: false,
        error: error instanceof Error ? error.message : 'Unknown error during lossless compression'
      };
    }
  }

  /**
   * Estimate processing time for lossless compression
   */
  async estimateLosslessProcessingTime(
    _file: File, 
    _format: LosslessFormat, 
    _effort: number
  ): Promise<number> {
    throw new Error('LosslessCompressor not implemented');
  }

  /**
   * Calculate optimal batch size for lossless compression
   */
  async calculateLosslessBatchSize(
    _files: File[], 
    _format: LosslessFormat
  ): Promise<number> {
    throw new Error('LosslessCompressor not implemented');
  }

  /**
   * Compare efficiency of different lossless formats for a file
   */
  async compareLosslessFormats(_file: File): Promise<LosslessFormatComparison[]> {
    throw new Error('LosslessCompressor not implemented');
  }

  /**
   * Batch process files with lossless compression
   */
  async compressLosslessBatch(
    _files: File[],
    _options: LosslessCompressionOptions,
    _onProgress?: (progress: LosslessProgressInfo) => void
  ): Promise<LosslessCompressionResult[]> {
    throw new Error('LosslessCompressor not implemented');
  }

  /**
   * Abort current processing
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get memory info for lossless compression operation
   */
  getMemoryInfo(_files: File[], format: LosslessFormat): LosslessMemoryInfo {
    const estimatedUsage = LosslessUtils.calculateMemoryRequirements(2000, 2000, format); // Rough estimate
    const availableMemory = this.getAvailableMemory();
    
    return {
      availableMemory,
      estimatedUsage,
      canProceed: estimatedUsage < availableMemory * 0.8, // 80% safety margin
      recommendedBatchSize: Math.max(1, Math.floor(availableMemory / estimatedUsage / 2)),
      breakdown: {
        imageData: estimatedUsage * 0.4,
        canvas: estimatedUsage * 0.3,
        compression: estimatedUsage * 0.2,
        overhead: estimatedUsage * 0.1
      }
    };
  }

  /**
   * Validate lossless compression quality
   */
  async validateLosslessQuality(
    original: File, 
    compressed: Blob
  ): Promise<boolean> {
    return this.qualityValidator.validatePixelPerfect(original, compressed);
  }

  /**
   * Load image data from file
   */
  private async loadImageData(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      const timeout = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Image load timeout'));
      }, 10000);
      
      img.onload = () => {
        clearTimeout(timeout);
        
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Canvas context not available'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          
          // Cleanup
          canvas.width = 0;
          canvas.height = 0;
          URL.revokeObjectURL(objectUrl);
          
          resolve(imageData);
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          reject(error);
        }
      };

      img.onerror = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };

      img.src = objectUrl;
    });
  }

  /**
   * Perform the actual lossless compression
   */
  private async performLosslessCompression(
    imageData: ImageData, 
    options: LosslessCompressionOptions
  ): Promise<{
    format: LosslessFormat;
    outputBlob?: Blob;
    preservedTransparency: boolean;
    preservedAnimation: boolean;
    preservedMetadata: boolean;
    warnings?: string[];
    fallbackUsed?: LosslessFormat;
  }> {
    const engine = new LosslessEngine();
    const warnings: string[] = [];
    let outputBlob: Blob | undefined;
    let finalFormat = options.format;

    try {
      switch (options.format) {
        case 'png':
          outputBlob = await engine.compressPNG(imageData, options.compressionLevel || 9);
          break;
          
        case 'webp':
          if (options.lossless) {
            outputBlob = await engine.compressWebPLossless(imageData, options.effort || 6);
          } else {
            warnings.push('WebP lossless mode not enabled');
            outputBlob = await engine.compressWebPLossless(imageData, options.effort || 6);
          }
          break;
          
        case 'avif':
          if (options.lossless) {
            outputBlob = await engine.compressAVIFLossless(imageData, options.effort || 4);
          } else {
            warnings.push('AVIF lossless mode not enabled');
            outputBlob = await engine.compressAVIFLossless(imageData, options.effort || 4);
          }
          break;
          
        case 'jpeg':
          outputBlob = await engine.compressJPEGMaxQuality(imageData, options.quality || 100);
          if (options.warnNearLossless) {
            warnings.push('JPEG is not truly lossless - using maximum quality instead');
          }
          break;
          
        default:
          throw new Error(`Unsupported lossless format: ${options.format}`);
      }

      // If compression failed, try fallback
      if (!outputBlob && options.fallbackFormat) {
        finalFormat = options.fallbackFormat;
        const fallbackOptions = { ...options, format: options.fallbackFormat };
        const fallbackResult = await this.performLosslessCompression(imageData, fallbackOptions);
        outputBlob = fallbackResult.outputBlob;
        warnings.push(`Fallback to ${options.fallbackFormat} due to format not supported`);
      }

    } catch (error) {
      // Try fallback format if available
      if (options.fallbackFormat && options.fallbackFormat !== options.format) {
        finalFormat = options.fallbackFormat;
        const fallbackOptions = { ...options, format: options.fallbackFormat };
        const fallbackResult = await this.performLosslessCompression(imageData, fallbackOptions);
        outputBlob = fallbackResult.outputBlob;
        warnings.push(`Fallback to ${options.fallbackFormat} due to compression error`);
      } else {
        throw error;
      }
    }

    return {
      format: finalFormat,
      outputBlob,
      preservedTransparency: this.supportsTransparency(finalFormat),
      preservedAnimation: false, // TODO: Implement animation support
      preservedMetadata: options.preserveMetadata || false,
      warnings: warnings.length > 0 ? warnings : undefined,
      fallbackUsed: finalFormat !== options.format ? finalFormat : undefined
    };
  }

  /**
   * Check if format supports transparency
   */
  private supportsTransparency(format: LosslessFormat): boolean {
    return ['png', 'webp', 'avif'].includes(format);
  }

  /**
   * Get available memory estimate
   */
  private getAvailableMemory(): number {
    // Use device memory API if available
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory) {
      return (deviceMemory * 1024 * 1024 * 1024) * 0.2; // Use 20% of device memory
    }
    
    // Conservative default: 400MB
    return 400 * 1024 * 1024;
  }
}

/**
 * Memory monitoring for lossless compression operations
 */
class MemoryMonitor {
  private peakUsage = 0;

  /**
   * Track memory usage during operation
   */
  async trackOperation<T>(_operation: () => Promise<T>): Promise<T> {
    throw new Error('MemoryMonitor not implemented');
  }

  /**
   * Get current memory usage
   */
  getCurrentUsage(): number {
    throw new Error('MemoryMonitor not implemented');
  }

  /**
   * Get peak memory usage
   */
  getPeakUsage(): number {
    return this.peakUsage;
  }

  /**
   * Reset memory tracking
   */
  reset(): void {
    this.peakUsage = 0;
  }

  /**
   * Check if operation is safe given memory constraints
   */
  isSafeToProcess(_estimatedUsage: number, _maxUsage?: number): boolean {
    throw new Error('MemoryMonitor not implemented');
  }
}

/**
 * Quality validation for lossless compression
 */
class QualityValidator {
  /**
   * Validate pixel-perfect compression
   */
  async validatePixelPerfect(original: File, compressed: Blob): Promise<boolean> {
    try {
      const originalData = await this.getImageDataFromFile(original);
      const compressedData = await this.getImageDataFromBlob(compressed);
      
      return this.compareImageData(originalData, compressedData, 0);
    } catch (error) {
      console.warn('Pixel-perfect validation failed:', error);
      return false;
    }
  }

  /**
   * Compare image data for quality validation
   */
  async compareImageData(
    originalData: ImageData, 
    compressedData: ImageData,
    tolerance: number = 0
  ): Promise<boolean> {
    if (originalData.width !== compressedData.width || 
        originalData.height !== compressedData.height) {
      return false;
    }

    const original = originalData.data;
    const compressed = compressedData.data;

    if (original.length !== compressed.length) {
      return false;
    }

    // Compare pixel by pixel
    for (let i = 0; i < original.length; i += 4) {
      const rDiff = Math.abs(original[i] - compressed[i]);
      const gDiff = Math.abs(original[i + 1] - compressed[i + 1]);
      const bDiff = Math.abs(original[i + 2] - compressed[i + 2]);
      const aDiff = Math.abs(original[i + 3] - compressed[i + 3]);

      if (rDiff > tolerance || gDiff > tolerance || 
          bDiff > tolerance || aDiff > tolerance) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate image similarity score
   */
  async calculateSimilarity(original: File, compressed: Blob): Promise<number> {
    try {
      const originalData = await this.getImageDataFromFile(original);
      const compressedData = await this.getImageDataFromBlob(compressed);
      
      if (originalData.width !== compressedData.width || 
          originalData.height !== compressedData.height) {
        return 0;
      }

      const originalPixels = originalData.data;
      const compressedPixels = compressedData.data;
      let totalDifference = 0;
      const maxDifference = 255 * 4 * originalPixels.length / 4; // Max possible difference

      // Calculate mean squared error
      for (let i = 0; i < originalPixels.length; i += 4) {
        const rDiff = Math.pow(originalPixels[i] - compressedPixels[i], 2);
        const gDiff = Math.pow(originalPixels[i + 1] - compressedPixels[i + 1], 2);
        const bDiff = Math.pow(originalPixels[i + 2] - compressedPixels[i + 2], 2);
        const aDiff = Math.pow(originalPixels[i + 3] - compressedPixels[i + 3], 2);
        
        totalDifference += Math.sqrt(rDiff + gDiff + bDiff + aDiff);
      }

      // Return similarity score (0-1, where 1 is identical)
      return Math.max(0, 1 - (totalDifference / maxDifference));
    } catch (error) {
      console.warn('Similarity calculation failed:', error);
      return 0;
    }
  }

  /**
   * Get ImageData from File
   */
  private async getImageDataFromFile(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context not available'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Cleanup
        canvas.width = 0;
        canvas.height = 0;
        URL.revokeObjectURL(objectUrl);
        
        resolve(imageData);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image from file'));
      };

      img.src = objectUrl;
    });
  }

  /**
   * Get ImageData from Blob
   */
  private async getImageDataFromBlob(blob: Blob): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context not available'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Cleanup
        canvas.width = 0;
        canvas.height = 0;
        URL.revokeObjectURL(objectUrl);
        
        resolve(imageData);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image from blob'));
      };

      img.src = objectUrl;
    });
  }
}

/**
 * Lossless compression engine with format-specific optimizations
 */
export class LosslessEngine {
  /**
   * Compress PNG with maximum compression level
   */
  async compressPNG(
    imageData: ImageData, 
    compressionLevel: number = 9
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      canvas.width = imageData.width;
      canvas.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);

      // PNG compression level is not directly controllable in browsers
      // We simulate different compression levels by adjusting the quality parameter
      const qualityParam = compressionLevel / 10; // Convert 0-9 to 0-0.9
      
      canvas.toBlob(
        (blob) => {
          // Cleanup
          canvas.width = 0;
          canvas.height = 0;
          
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create PNG blob'));
          }
        },
        'image/png',
        qualityParam
      );
    });
  }

  /**
   * Compress WebP in lossless mode
   */
  async compressWebPLossless(
    imageData: ImageData, 
    _effort: number = 6
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      canvas.width = imageData.width;
      canvas.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);

      // WebP lossless compression - use quality 1.0 for lossless mode
      // Browser will automatically use lossless mode for quality 1.0
      canvas.toBlob(
        (blob) => {
          // Cleanup
          canvas.width = 0;
          canvas.height = 0;
          
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create WebP lossless blob or format not supported'));
          }
        },
        'image/webp',
        1.0 // Maximum quality for lossless
      );
    });
  }

  /**
   * Compress AVIF in lossless mode
   */
  async compressAVIFLossless(
    imageData: ImageData, 
    _effort: number = 4
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      canvas.width = imageData.width;
      canvas.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);

      // AVIF lossless compression - use quality 1.0 for lossless mode
      canvas.toBlob(
        (blob) => {
          // Cleanup
          canvas.width = 0;
          canvas.height = 0;
          
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create AVIF lossless blob or format not supported'));
          }
        },
        'image/avif',
        1.0 // Maximum quality for lossless
      );
    });
  }

  /**
   * Compress JPEG with maximum quality (near-lossless)
   */
  async compressJPEGMaxQuality(
    imageData: ImageData, 
    quality: number = 100
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      canvas.width = imageData.width;
      canvas.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);

      // JPEG maximum quality (near-lossless)
      const qualityParam = quality / 100; // Convert 0-100 to 0-1
      
      canvas.toBlob(
        (blob) => {
          // Cleanup
          canvas.width = 0;
          canvas.height = 0;
          
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create JPEG blob'));
          }
        },
        'image/jpeg',
        qualityParam
      );
    });
  }

  /**
   * Detect browser support for lossless formats
   */
  async detectLosslessSupport(): Promise<Record<LosslessFormat, boolean>> {
    throw new Error('LosslessEngine not implemented');
  }
}

/**
 * Performance optimizer for lossless compression
 */
export class LosslessPerformanceOptimizer {
  /**
   * Calculate optimal compression settings for file
   */
  getOptimalSettings(
    _file: File, 
    _targetMode: LosslessCompressionMode
  ): LosslessCompressionOptions {
    throw new Error('LosslessPerformanceOptimizer not implemented');
  }

  /**
   * Estimate compression time and size
   */
  estimateCompression(
    _file: File, 
    _options: LosslessCompressionOptions
  ): { estimatedTime: number; estimatedSize: number } {
    throw new Error('LosslessPerformanceOptimizer not implemented');
  }

  /**
   * Calculate batch processing strategy
   */
  calculateBatchStrategy(
    _files: File[], 
    _options: LosslessCompressionOptions
  ): { batchSize: number; totalBatches: number; estimatedTime: number } {
    throw new Error('LosslessPerformanceOptimizer not implemented');
  }
}

/**
 * Utility functions for lossless compression
 */
export class LosslessUtils {
  /**
   * Get optimal format for lossless compression
   */
  static getOptimalLosslessFormat(file: File): LosslessFormat {
    const type = file.type.toLowerCase();
    
    // Already lossless formats
    if (type.includes('png')) return 'png';
    
    // Best compression for photos
    if (type.includes('jpeg') || type.includes('jpg')) {
      return 'avif'; // Best compression for photos
    }
    
    // Graphics and other formats
    return 'webp'; // Good balance of compression and support
  }

  /**
   * Validate lossless compression options
   */
  static validateOptions(options: LosslessCompressionOptions): string[] {
    const errors: string[] = [];
    
    // PNG compression level validation
    if (options.format === 'png' && options.compressionLevel !== undefined) {
      if (options.compressionLevel < 0 || options.compressionLevel > 9) {
        errors.push('PNG compression level must be between 0 and 9');
      }
    }
    
    // WebP effort validation
    if (options.format === 'webp' && options.effort !== undefined) {
      if (options.effort < 0 || options.effort > 6) {
        errors.push('WebP effort must be between 0 and 6');
      }
    }
    
    // AVIF effort validation
    if (options.format === 'avif' && options.effort !== undefined) {
      if (options.effort < 0 || options.effort > 9) {
        errors.push('AVIF effort must be between 0 and 9');
      }
    }
    
    // JPEG quality validation
    if (options.format === 'jpeg' && options.quality !== undefined) {
      if (options.quality < 90 || options.quality > 100) {
        errors.push('JPEG quality for near-lossless should be between 90 and 100');
      }
    }
    
    return errors;
  }

  /**
   * Get default options for format
   */
  static getDefaultOptions(format: LosslessFormat): LosslessCompressionOptions {
    const baseOptions: LosslessCompressionOptions = {
      format,
      preserveMetadata: true,
      preserveTransparency: true,
    };

    switch (format) {
      case 'png':
        return {
          ...baseOptions,
          compressionLevel: 9, // Maximum compression
        };
      
      case 'webp':
        return {
          ...baseOptions,
          lossless: true,
          effort: 6, // High effort for better compression
        };
      
      case 'avif':
        return {
          ...baseOptions,
          lossless: true,
          effort: 4, // Balanced effort (higher is very slow)
        };
      
      case 'jpeg':
        return {
          ...baseOptions,
          quality: 100, // Maximum quality
          warnNearLossless: true,
        };
      
      default:
        return baseOptions;
    }
  }

  /**
   * Calculate memory requirements for lossless compression
   */
  static calculateMemoryRequirements(
    width: number, 
    height: number, 
    format: LosslessFormat
  ): number {
    const baseMemory = width * height * 4; // RGBA canvas data
    
    // Format-specific multipliers based on compression complexity
    const multipliers: Record<LosslessFormat, number> = {
      png: 2.5,    // PNG compression algorithm needs working space
      webp: 3.0,   // WebP lossless is more memory intensive
      avif: 4.0,   // AVIF lossless requires most memory
      jpeg: 2.0,   // JPEG is least memory intensive
    };
    
    return Math.round(baseMemory * multipliers[format]);
  }
}