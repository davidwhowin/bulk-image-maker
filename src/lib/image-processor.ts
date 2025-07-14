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
            processingTime
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

          console.log(`Processed ${file.name}: ${file.size} → ${result.blob.size} bytes (${processedResult.compressionRatio.toFixed(1)}% reduction)`);

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
  ): Promise<{ blob: Blob }> {
    
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      img.onload = () => {
        try {
          onProgress?.(25);

          // Set canvas dimensions
          canvas.width = img.width;
          canvas.height = img.height;

          onProgress?.(50);

          // Draw image to canvas
          ctx.drawImage(img, 0, 0);

          onProgress?.(75);

          // Convert to desired format with quality setting
          const outputFormat = this.getOutputMimeType(settings.format);
          const quality = settings.quality / 100; // Convert to 0-1 range

          canvas.toBlob(
            (blob) => {
              if (blob) {
                onProgress?.(100);
                resolve({ blob });
              } else {
                reject(new Error('Failed to create blob'));
              }

              // Clean up canvas
              canvas.width = 0;
              canvas.height = 0;
              URL.revokeObjectURL(img.src);
            },
            outputFormat,
            quality
          );

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

  private getOutputMimeType(format: string): string {
    switch (format) {
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