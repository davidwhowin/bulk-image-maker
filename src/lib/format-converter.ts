import type { 
  SupportedFormat, 
  FormatSupport, 
  FormatConversionOptions, 
  FormatConversionResult,
  BatchConversionProgress,
  MixedConversionRequest
} from '@/types/format-conversion';
import { formatErrorHandler } from './format-error-handler';

/**
 * Browser format support detection with caching
 */
export class BrowserFormatSupport {
  private supportCache = new Map<SupportedFormat, boolean>();
  private detectionPromises = new Map<SupportedFormat, Promise<boolean>>();

  /**
   * Check if a format is supported by the browser
   */
  isFormatSupported(format: SupportedFormat): boolean {
    // JPEG and PNG are always supported
    if (format === 'jpeg' || format === 'png') {
      return true;
    }

    // Return cached result if available
    if (this.supportCache.has(format)) {
      return this.supportCache.get(format)!;
    }

    // For synchronous calls, assume supported for modern formats
    // Real detection happens asynchronously
    return format === 'webp'; // Conservative default
  }

  /**
   * Detect WebP support asynchronously
   */
  async detectWebPSupport(): Promise<boolean> {
    if (this.detectionPromises.has('webp')) {
      return this.detectionPromises.get('webp')!;
    }

    const promise = this.createDetectionTest('image/webp');
    this.detectionPromises.set('webp', promise);
    
    const isSupported = await promise;
    this.supportCache.set('webp', isSupported);
    return isSupported;
  }

  /**
   * Detect AVIF support asynchronously
   */
  async detectAVIFSupport(): Promise<boolean> {
    if (this.detectionPromises.has('avif')) {
      return this.detectionPromises.get('avif')!;
    }

    const promise = this.createDetectionTest('image/avif');
    this.detectionPromises.set('avif', promise);
    
    const isSupported = await promise;
    this.supportCache.set('avif', isSupported);
    return isSupported;
  }

  /**
   * Get all supported formats
   */
  getSupportedFormats(): FormatSupport {
    return {
      jpeg: true,
      png: true,
      webp: this.supportCache.get('webp') ?? true, // Assume WebP support
      avif: this.supportCache.get('avif') ?? false, // Conservative for AVIF
    };
  }

  /**
   * Get fallback format for unsupported formats
   */
  getFallbackFormat(format: SupportedFormat): SupportedFormat {
    // Fallback hierarchy: AVIF -> WebP -> JPEG, PNG stays PNG
    const fallbacks: Record<SupportedFormat, SupportedFormat> = {
      avif: 'webp',
      webp: 'jpeg',
      jpeg: 'jpeg',
      png: 'png',
    };
    
    return fallbacks[format];
  }

  /**
   * Create format detection test using canvas
   */
  private createDetectionTest(mimeType: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(false);
          return;
        }

        // Try to create a blob in the target format
        canvas.toBlob(
          (blob) => {
            resolve(blob !== null && blob.type === mimeType);
          },
          mimeType,
          0.8
        );
      } catch {
        resolve(false);
      }
    });
  }
}

/**
 * Core format conversion engine
 */
export class FormatConverter {
  private abortController: AbortController | null = null;

  constructor() {
    // Initialize format converter
  }

  /**
   * Convert a single file to specified format
   */
  async convertFormat(
    file: File, 
    options: FormatConversionOptions
  ): Promise<FormatConversionResult> {
    const startTime = performance.now();
    const originalFormat = file.type.replace('image/', '') as SupportedFormat;
    
    try {
      // Validate options
      if (!this.isValidFormat(options.outputFormat)) {
        return formatErrorHandler.createErrorResult(
          originalFormat,
          options.outputFormat,
          new Error('Unsupported output format'),
          file.size,
          performance.now() - startTime
        );
      }

      // Check file size limits
      if (options.maxFileSize && file.size > options.maxFileSize) {
        return formatErrorHandler.createErrorResult(
          originalFormat,
          options.outputFormat,
          new Error(`File size (${file.size}) exceeds maximum (${options.maxFileSize})`),
          file.size,
          performance.now() - startTime
        );
      }

      // Perform conversion with memory management
      const result = await formatErrorHandler.handleMemoryExhaustion(
        () => this.performConversion(file, options),
        () => this.performLowMemoryConversion(file, options)
      );
      
      const endTime = performance.now();

      return {
        success: true,
        originalFormat,
        outputFormat: options.outputFormat,
        outputBlob: result.blob,
        originalSize: file.size,
        outputSize: result.blob.size,
        compressionRatio: result.blob.size / file.size,
        processingTime: endTime - startTime,
        preservedAlpha: result.preservedAlpha,
        preservedMetadata: options.preserveMetadata,
      };

    } catch (error) {
      const errorInfo = await formatErrorHandler.handleFormatConversionError(
        originalFormat,
        options.outputFormat,
        error instanceof Error ? error : new Error('Unknown error')
      );

      if (errorInfo.shouldRetry) {
        // Retry the conversion
        return this.convertFormat(file, options);
      }

      if (errorInfo.fallbackFormat && errorInfo.fallbackFormat !== options.outputFormat) {
        // Try with fallback format
        try {
          const fallbackOptions = { ...options, outputFormat: errorInfo.fallbackFormat };
          const fallbackResult = await this.convertFormat(file, fallbackOptions);
          if (fallbackResult.success) {
            return {
              ...fallbackResult,
              warnings: [`Original format ${options.outputFormat} not supported, used ${errorInfo.fallbackFormat} instead`],
            };
          }
        } catch (fallbackError) {
          // Fallback also failed, return original error
        }
      }

      return formatErrorHandler.createErrorResult(
        originalFormat,
        options.outputFormat,
        error instanceof Error ? error : new Error('Unknown error'),
        file.size,
        performance.now() - startTime
      );
    }
  }

  /**
   * Convert batch of files with optimized chunking
   */
  async convertBatch(
    files: File[],
    options: FormatConversionOptions,
    onProgress?: (progress: BatchConversionProgress) => void
  ): Promise<FormatConversionResult[]> {
    this.abortController = new AbortController();
    
    const results: FormatConversionResult[] = [];
    const startTime = Date.now();
    let failedCount = 0;
    
    // Calculate optimal batch size based on file sizes
    const avgFileSize = files.reduce((sum, f) => sum + f.size, 0) / files.length;
    const optimalBatchSize = this.getOptimalBatchSize(avgFileSize);
    
    try {
      // Process in chunks for better memory management
      for (let chunkStart = 0; chunkStart < files.length; chunkStart += optimalBatchSize) {
        if (this.abortController.signal.aborted) {
          break;
        }

        const chunkEnd = Math.min(chunkStart + optimalBatchSize, files.length);
        const chunk = files.slice(chunkStart, chunkEnd);

        // Process chunk sequentially to avoid memory exhaustion
        for (let i = 0; i < chunk.length; i++) {
          if (this.abortController.signal.aborted) {
            break;
          }

          const file = chunk[i];
          const overallIndex = chunkStart + i;
          
          try {
            // Update progress
            onProgress?.({
              totalFiles: files.length,
              completedFiles: overallIndex,
              currentFile: file.name,
              overallProgress: (overallIndex / files.length) * 100,
              currentFileProgress: 0,
              estimatedTimeRemaining: this.estimateRemainingTime(files.length - overallIndex, startTime),
            });

            // Convert file with error handling
            const result = await this.convertFormat(file, options);
            results.push(result);
            
            if (!result.success) {
              failedCount++;
            }

            // Update progress
            onProgress?.({
              totalFiles: files.length,
              completedFiles: overallIndex + 1,
              currentFile: file.name,
              overallProgress: ((overallIndex + 1) / files.length) * 100,
              currentFileProgress: 100,
              estimatedTimeRemaining: this.estimateRemainingTime(files.length - (overallIndex + 1), startTime),
            });

          } catch (error) {
            // Handle individual file errors
            const errorResult = formatErrorHandler.createErrorResult(
              file.type.replace('image/', '') as SupportedFormat,
              options.outputFormat,
              error instanceof Error ? error : new Error('Unknown error'),
              file.size,
              0
            );
            results.push(errorResult);
            failedCount++;

            // Check if we should continue processing
            const errorInfo = await formatErrorHandler.handleBatchError(
              error instanceof Error ? error : new Error('Unknown error'),
              overallIndex + 1,
              files.length
            );

            if (!errorInfo.shouldContinue) {
              console.warn(`Stopping batch processing: ${errorInfo.recommendation}`);
              break;
            }
          }
        }

        // Allow garbage collection between chunks
        if (chunkEnd < files.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Check overall failure rate
        const failureRate = failedCount / results.length;
        if (failureRate > 0.8 && results.length > 10) {
          console.warn('High failure rate detected, stopping batch processing');
          break;
        }
      }

      return results;
    } catch (error) {
      // Handle batch-level errors
      const errorInfo = await formatErrorHandler.handleBatchError(
        error instanceof Error ? error : new Error('Batch processing failed'),
        results.length,
        files.length
      );
      
      console.error(`Batch processing error: ${errorInfo.recommendation}`);
      return results; // Return partial results
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Convert files with individual options
   */
  async convertMixed(
    conversions: MixedConversionRequest[]
  ): Promise<FormatConversionResult[]> {
    const results = await Promise.all(
      conversions.map(({ file, options }) => this.convertFormat(file, options))
    );
    
    return results;
  }

  /**
   * Get optimal quality for format
   */
  getOptimalQuality(format: SupportedFormat): number {
    const qualityMap: Record<SupportedFormat, number> = {
      jpeg: 85,
      webp: 80,
      avif: 75,
      png: 100, // Lossless
    };

    return qualityMap[format];
  }

  /**
   * Estimate processing time for format and file size
   */
  estimateProcessingTime(format: SupportedFormat, fileSize: number): number {
    // Base processing time in ms per MB
    const baseTimes: Record<SupportedFormat, number> = {
      jpeg: 100,
      png: 150,
      webp: 200,
      avif: 500,
    };

    const fileSizeMB = fileSize / (1024 * 1024);
    return baseTimes[format] * fileSizeMB;
  }

  /**
   * Get optimal batch size based on available memory
   */
  getOptimalBatchSize(averageFileSize: number): number {
    // Conservative batch sizing
    const availableMemory = this.getAvailableMemory();
    const memoryPerFile = averageFileSize * 4; // Canvas uses 4x memory (RGBA)
    
    return Math.max(1, Math.min(50, Math.floor(availableMemory / memoryPerFile)));
  }

  /**
   * Abort current batch processing
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Check if format is valid
   */
  private isValidFormat(format: string): format is SupportedFormat {
    return ['jpeg', 'png', 'webp', 'avif'].includes(format);
  }

  /**
   * Perform low-memory conversion with reduced canvas size
   */
  private async performLowMemoryConversion(
    file: File, 
    options: FormatConversionOptions
  ): Promise<{ blob: Blob; preservedAlpha: boolean }> {
    // Force smaller canvas dimensions for memory-constrained conversion
    const lowMemoryOptions = {
      ...options,
      resizeOptions: {
        width: Math.min(options.resizeOptions?.width || 1920, 1920),
        height: Math.min(options.resizeOptions?.height || 1080, 1080),
        maintainAspectRatio: true,
      },
    };
    
    return this.performConversion(file, lowMemoryOptions);
  }

  /**
   * Perform actual format conversion using canvas
   */
  private async performConversion(
    file: File, 
    options: FormatConversionOptions
  ): Promise<{ blob: Blob; preservedAlpha: boolean }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      // Set timeout to prevent hanging
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

          // Apply resize options if specified
          const { width, height } = this.calculateOutputDimensions(
            img.width, 
            img.height, 
            options.resizeOptions
          );

          // Set canvas size
          canvas.width = width;
          canvas.height = height;

          // Draw image with potential resizing
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to target format
          const outputMimeType = this.getOutputMimeType(options.outputFormat);
          const quality = (options.quality ?? this.getOptimalQuality(options.outputFormat)) / 100;

          canvas.toBlob(
            (blob) => {
              // Cleanup immediately
              canvas.width = 0;
              canvas.height = 0;
              URL.revokeObjectURL(objectUrl);
              
              if (blob) {
                resolve({
                  blob,
                  preservedAlpha: this.formatSupportsAlpha(options.outputFormat),
                });
              } else {
                reject(new Error('Failed to convert format'));
              }
            },
            outputMimeType,
            quality
          );
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
   * Get MIME type for format
   */
  private getOutputMimeType(format: SupportedFormat): string {
    const mimeTypes: Record<SupportedFormat, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      avif: 'image/avif',
    };

    return mimeTypes[format];
  }

  /**
   * Check if format supports alpha channel
   */
  private formatSupportsAlpha(format: SupportedFormat): boolean {
    return ['png', 'webp', 'avif'].includes(format);
  }


  /**
   * Estimate remaining processing time
   */
  private estimateRemainingTime(remainingFiles: number, startTime: number): number {
    if (remainingFiles === 0) return 0;
    
    const elapsed = Date.now() - startTime;
    const avgTimePerFile = elapsed / (remainingFiles || 1);
    
    return remainingFiles * avgTimePerFile;
  }

  /**
   * Calculate output dimensions based on resize options
   */
  private calculateOutputDimensions(
    originalWidth: number,
    originalHeight: number,
    resizeOptions?: {
      width?: number;
      height?: number;
      maintainAspectRatio?: boolean;
    }
  ): { width: number; height: number } {
    if (!resizeOptions || (!resizeOptions.width && !resizeOptions.height)) {
      return { width: originalWidth, height: originalHeight };
    }

    const { width: targetWidth, height: targetHeight, maintainAspectRatio = true } = resizeOptions;

    if (!maintainAspectRatio) {
      return {
        width: targetWidth || originalWidth,
        height: targetHeight || originalHeight,
      };
    }

    // Maintain aspect ratio
    const aspectRatio = originalWidth / originalHeight;

    if (targetWidth && targetHeight) {
      // Both dimensions specified - choose the one that maintains aspect ratio
      const widthBasedHeight = targetWidth / aspectRatio;
      const heightBasedWidth = targetHeight * aspectRatio;

      if (widthBasedHeight <= targetHeight) {
        return { width: targetWidth, height: Math.round(widthBasedHeight) };
      } else {
        return { width: Math.round(heightBasedWidth), height: targetHeight };
      }
    } else if (targetWidth) {
      return { width: targetWidth, height: Math.round(targetWidth / aspectRatio) };
    } else if (targetHeight) {
      return { width: Math.round(targetHeight * aspectRatio), height: targetHeight };
    }

    return { width: originalWidth, height: originalHeight };
  }

  /**
   * Get available memory (rough estimate)
   */
  private getAvailableMemory(): number {
    // Use device memory API if available
    const deviceMemory = (navigator as any).deviceMemory;
    if (deviceMemory) {
      return (deviceMemory * 1024 * 1024 * 1024) * 0.1; // Use 10% of device memory
    }
    
    // Conservative default: 200MB
    return 200 * 1024 * 1024;
  }
}