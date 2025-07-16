/**
 * Lossless compression types and interfaces
 */

export type LosslessFormat = 'png' | 'webp' | 'avif' | 'jpeg';

export interface LosslessCompressionOptions {
  /** Target format for lossless compression */
  format: LosslessFormat;
  
  /** Enable true lossless mode (WebP/AVIF only) */
  lossless?: boolean;
  
  /** PNG compression level (0-9, 9 = maximum compression) */
  compressionLevel?: number;
  
  /** WebP/AVIF effort level (0-9, higher = better compression) */
  effort?: number;
  
  /** JPEG quality for near-lossless (90-100) */
  quality?: number;
  
  /** Preserve image metadata (EXIF, ICC profiles) */
  preserveMetadata?: boolean;
  
  /** Preserve transparency channel */
  preserveTransparency?: boolean;
  
  /** Preserve animation frames (WebP only) */
  preserveAnimation?: boolean;
  
  /** Fallback format if primary format unsupported */
  fallbackFormat?: LosslessFormat;
  
  /** Warn user that JPEG is not truly lossless */
  warnNearLossless?: boolean;
  
  /** Track memory usage during compression */
  trackMemory?: boolean;
  
  /** Validate lossless quality through pixel comparison */
  validateLossless?: boolean;
  
  /** Prioritize compression speed over file size */
  prioritizeSpeed?: boolean;
  
  /** Maximum memory usage in bytes */
  maxMemoryUsage?: number;
  
  /** Compression timeout in milliseconds */
  timeout?: number;
}

export interface LosslessCompressionResult {
  /** Compression was successful */
  success: boolean;
  
  /** Original format of the input file */
  originalFormat: string;
  
  /** Output format used (may differ from requested due to fallbacks) */
  outputFormat: LosslessFormat;
  
  /** Compressed image blob */
  outputBlob?: Blob;
  
  /** Original file size in bytes */
  originalSize: number;
  
  /** Output file size in bytes */
  outputSize: number;
  
  /** Compression ratio (outputSize / originalSize) */
  compressionRatio: number;
  
  /** Processing time in milliseconds */
  processingTime: number;
  
  /** Memory peak usage in bytes */
  memoryUsage?: number;
  
  /** Whether transparency was preserved */
  preservedTransparency: boolean;
  
  /** Whether animation was preserved */
  preservedAnimation: boolean;
  
  /** Whether metadata was preserved */
  preservedMetadata: boolean;
  
  /** Pixel-perfect validation result */
  isPixelPerfect?: boolean;
  
  /** Warnings about compression quality */
  warnings?: string[];
  
  /** Error message if compression failed */
  error?: string;
  
  /** Fallback format used (if any) */
  fallbackUsed?: LosslessFormat;
}

export interface LosslessProcessingStats {
  /** Total files processed */
  totalFiles: number;
  
  /** Successfully processed files */
  successfulFiles: number;
  
  /** Failed files */
  failedFiles: number;
  
  /** Total original size */
  totalOriginalSize: number;
  
  /** Total output size */
  totalOutputSize: number;
  
  /** Overall compression ratio */
  overallCompressionRatio: number;
  
  /** Total processing time */
  totalProcessingTime: number;
  
  /** Peak memory usage */
  peakMemoryUsage: number;
  
  /** Average processing time per file */
  averageProcessingTime: number;
  
  /** Formats used and their frequency */
  formatUsage: Record<LosslessFormat, number>;
  
  /** Fallbacks used */
  fallbacksUsed: number;
}

export interface LosslessFormatComparison {
  /** Format being compared */
  format: LosslessFormat;
  
  /** Estimated output size */
  estimatedSize: number;
  
  /** Estimated processing time */
  estimatedTime: number;
  
  /** Browser support percentage */
  browserSupport: number;
  
  /** Compression efficiency score (0-100) */
  efficiency: number;
  
  /** Supports transparency */
  supportsTransparency: boolean;
  
  /** Supports animation */
  supportsAnimation: boolean;
  
  /** Recommended for this image type */
  recommended: boolean;
  
  /** Pros and cons */
  pros: string[];
  cons: string[];
}

export interface LosslessMemoryInfo {
  /** Available memory in bytes */
  availableMemory: number;
  
  /** Estimated memory usage for operation */
  estimatedUsage: number;
  
  /** Whether operation is safe to proceed */
  canProceed: boolean;
  
  /** Recommended batch size */
  recommendedBatchSize: number;
  
  /** Memory usage breakdown */
  breakdown: {
    imageData: number;
    canvas: number;
    compression: number;
    overhead: number;
  };
}

export interface LosslessQualityValidator {
  /** Enable pixel-perfect validation */
  enabled: boolean;
  
  /** Tolerance for near-lossless formats (JPEG) */
  tolerance: number;
  
  /** Sample percentage for large images (0.1-1.0) */
  samplePercentage: number;
  
  /** Validation method */
  method: 'pixel-perfect' | 'statistical' | 'perceptual';
}

export interface LosslessCompressionPreset {
  /** Preset name */
  name: string;
  
  /** Description */
  description: string;
  
  /** Target use case */
  useCase: 'archival' | 'print' | 'web' | 'development';
  
  /** Preset options */
  options: LosslessCompressionOptions;
  
  /** Expected compression ratio range */
  expectedRatio: [number, number];
  
  /** Expected processing time multiplier */
  timeMultiplier: number;
}

export type LosslessCompressionMode = 
  | 'maximum-compression'  // Best compression ratio, slowest
  | 'balanced'            // Good compression, reasonable speed
  | 'fast'                // Faster compression, larger files
  | 'ultra-fast';         // Fastest compression, largest files

export interface LosslessProgressInfo {
  /** Current file being processed */
  currentFile: string;
  
  /** Files completed */
  completedFiles: number;
  
  /** Total files to process */
  totalFiles: number;
  
  /** Overall progress percentage */
  overallProgress: number;
  
  /** Current file progress percentage */
  currentFileProgress: number;
  
  /** Estimated time remaining */
  estimatedTimeRemaining: number;
  
  /** Current memory usage */
  currentMemoryUsage: number;
  
  /** Current compression mode */
  currentMode: LosslessCompressionMode;
  
  /** Current format being processed */
  currentFormat: LosslessFormat;
}