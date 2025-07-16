/**
 * Image processing pipeline for batch compression and optimization
 */

import type { ImageFile, CompressionSettings } from '@/types';

export interface ProcessingProgress {
  fileId: string;
  progress: number;
  status: 'processing' | 'completed' | 'error';
  error?: string;
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

export interface ProcessingResult {
  fileId: string;
  originalFile: File;
  processedBlob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  processingTime: number;
  actualFormat?: string;
}

export class ImageProcessor {
  private isProcessing = false;
  private abortController: AbortController | null = null;

  async processFiles(
    files: ImageFile[],
    settings: CompressionSettings,
    onProgress?: (progress: ProcessingProgress) => void,
    onComplete?: (results: ProcessingResult[]) => void
  ): Promise<ProcessingResult[]> {
    if (this.isProcessing) {
      throw new Error('Processing already in progress');
    }

    this.isProcessing = true;
    this.abortController = new AbortController();
    
    const results: ProcessingResult[] = [];
    const totalFiles = files.length;
    
    try {
      console.log(`Starting batch processing of ${totalFiles} files`);
      
      for (let i = 0; i < files.length; i++) {
        if (this.abortController.signal.aborted) {
          throw new Error('Processing cancelled');
        }

        const file = files[i];
        const startTime = performance.now();
        
        // Update progress to processing
        onProgress?.({
          fileId: file.id,
          progress: 0,
          status: 'processing'
        });

        try {
          // Simulate processing with actual compression
          const result = await this.processIndividualFile(file, settings, (progress) => {
            onProgress?.({
              fileId: file.id,
              progress,
              status: 'processing'
            });
          });

          const endTime = performance.now();
          const processingTime = endTime - startTime;
          
          const processedResult: ProcessingResult = {
            fileId: file.id,
            originalFile: file.file,
            processedBlob: result.blob,
            originalSize: file.size,
            compressedSize: result.blob.size,
            compressionRatio: ((file.size - result.blob.size) / file.size) * 100,
            processingTime,
            actualFormat: result.actualFormat
          };

          results.push(processedResult);

          // Update progress to completed
          onProgress?.({
            fileId: file.id,
            progress: 100,
            status: 'completed',
            originalSize: file.size,
            compressedSize: result.blob.size,
            compressionRatio: processedResult.compressionRatio
          });

          const sizeChange = processedResult.compressionRatio >= 0 ? 'reduction' : 'increase';
          console.log(`Processed ${file.name}: ${file.size} → ${result.blob.size} bytes (${Math.abs(processedResult.compressionRatio).toFixed(1)}% ${sizeChange})`);

        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);
          
          onProgress?.({
            fileId: file.id,
            progress: 0,
            status: 'error',
            error: error instanceof Error ? error.message : 'Processing failed'
          });
        }
      }

      onComplete?.(results);
      return results;

    } finally {
      this.isProcessing = false;
      this.abortController = null;
    }
  }

  private async processIndividualFile(
    file: ImageFile,
    settings: CompressionSettings,
    onProgress?: (progress: number) => void
  ): Promise<{ blob: Blob; actualFormat: string }> {
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = async () => {
        try {
          onProgress?.(25);

          // Calculate optimal dimensions for compression
          const maxDimension = this.getMaxDimension(settings);
          const { width, height } = this.calculateCompressedDimensions(
            img.width, 
            img.height, 
            maxDimension
          );

          // Set canvas dimensions (potentially smaller for compression)
          canvas.width = width;
          canvas.height = height;

          onProgress?.(50);

          // Draw image to canvas with potential resizing
          ctx.drawImage(img, 0, 0, width, height);

          onProgress?.(75);

          // Determine output format for best compression
          const { outputFormat, quality } = this.getOptimalSettings(file, settings);
          
          // Try to compress the image
          const compressedBlob = await this.compressToBlob(canvas, outputFormat, quality);
          
          onProgress?.(90);

          // Check if compression was beneficial, otherwise use original
          let finalBlob: Blob;
          let actualFormat: string;
          
          const compressionRatio = ((file.file.size - compressedBlob.size) / file.file.size) * 100;
          console.log(`${file.name}: ${file.file.size} → ${compressedBlob.size} bytes (${compressionRatio.toFixed(1)}% change), format: ${file.type} → ${outputFormat}, quality: ${quality}`);
          
          if (compressedBlob.size < file.file.size * 0.95) { // At least 5% reduction
            finalBlob = compressedBlob;
            actualFormat = compressedBlob.type.replace('image/', '');
            console.log(`✅ Using compressed version for ${file.name}`);
          } else {
            // Compression didn't help, use original
            finalBlob = file.file;
            actualFormat = file.type.replace('image/', '');
            console.log(`⚠️ Compression not beneficial for ${file.name}, using original`);
          }

          onProgress?.(100);
          resolve({ blob: finalBlob, actualFormat });

          // Clean up canvas
          canvas.width = 0;
          canvas.height = 0;
          URL.revokeObjectURL(img.src);

        } catch (error) {
          // Clean up on error
          canvas.width = 0;
          canvas.height = 0;
          URL.revokeObjectURL(img.src);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };

      // Create object URL and load image
      img.src = URL.createObjectURL(file.file);
    });
  }

  private getMaxDimension(settings: CompressionSettings): number {
    // Determine max dimension based on quality setting
    if (settings.quality >= 90) return 4096;  // High quality - minimal resize
    if (settings.quality >= 75) return 2560;  // Medium quality
    if (settings.quality >= 50) return 1920;  // Lower quality
    return 1280; // Very compressed
  }

  private calculateCompressedDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
    // If image is smaller than max, keep original dimensions
    if (width <= maxDimension && height <= maxDimension) {
      return { width, height };
    }

    // Calculate aspect ratio
    const aspectRatio = width / height;
    
    if (width > height) {
      return {
        width: Math.min(width, maxDimension),
        height: Math.round(Math.min(width, maxDimension) / aspectRatio)
      };
    } else {
      return {
        width: Math.round(Math.min(height, maxDimension) * aspectRatio),
        height: Math.min(height, maxDimension)
      };
    }
  }

  private getOptimalSettings(file: ImageFile, settings: CompressionSettings): { outputFormat: string; quality: number } {
    const originalFormat = file.type;
    let outputFormat: string;
    let quality = settings.quality / 100;

    if (settings.format === 'auto') {
      // Smart format selection based on original format and size
      if (originalFormat === 'image/png' && file.size > 500000) { // Large PNG
        outputFormat = 'image/jpeg'; // Convert large PNGs to JPEG
        quality = Math.max(0.7, quality); // Ensure decent quality for conversion
      } else if (originalFormat === 'image/jpeg') {
        outputFormat = 'image/jpeg';
        // For already compressed JPEGs, be more conservative with quality
        quality = Math.max(0.6, quality);
      } else {
        outputFormat = originalFormat; // Keep original format for other types
      }
    } else {
      outputFormat = this.getOutputMimeType(settings.format);
    }

    return { outputFormat, quality };
  }

  private compressToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create compressed blob'));
          }
        },
        format,
        quality
      );
    });
  }

  private getOutputMimeType(format: string): string {
    switch (format) {
      case 'auto':
        return 'auto'; // Special case - will be handled by caller
      case 'webp':
        return 'image/webp';
      case 'jpeg':
      case 'jpg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'avif':
        return 'image/avif';
      default:
        return 'image/webp'; // Default to WebP
    }
  }

  getProcessingStats(): {
    isProcessing: boolean;
    canAbort: boolean;
  } {
    return {
      isProcessing: this.isProcessing,
      canAbort: this.abortController !== null
    };
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      console.log('Processing aborted by user');
    }
  }
}

// Singleton instance
export const imageProcessor = new ImageProcessor();