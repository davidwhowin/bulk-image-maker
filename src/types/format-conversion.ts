export type SupportedFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'svg' | 'jxl';

export interface FormatConversionOptions {
  outputFormat: SupportedFormat;
  quality?: number; // 1-100, format-specific optimal ranges
  preserveMetadata?: boolean;
  preserveAlpha?: boolean; // For formats that support transparency
  maxFileSize?: number; // Maximum output file size in bytes
  
  /** Enable lossless compression mode */
  lossless?: boolean;
  
  /** Lossless compression options */
  losslessOptions?: {
    /** PNG compression level (0-9) */
    compressionLevel?: number;
    
    /** Validate lossless quality */
    validateLossless?: boolean;
    
    /** Fallback format if lossless not supported */
    fallbackFormat?: SupportedFormat;
    
    /** Priority: 'quality' | 'speed' | 'size' */
    priority?: 'quality' | 'speed' | 'size';
  };
  
  resizeOptions?: {
    width?: number;
    height?: number;
    maintainAspectRatio?: boolean;
  };
}

export interface FormatConversionResult {
  success: boolean;
  originalFormat: string;
  outputFormat: SupportedFormat;
  outputBlob?: Blob;
  originalSize: number;
  outputSize?: number;
  compressionRatio?: number;
  processingTime: number;
  preservedAlpha?: boolean;
  preservedMetadata?: boolean;
  error?: string;
  warnings?: string[];
  recoverySuggestion?: string;
  fallbackRecommended?: SupportedFormat;
  retryCount?: number;
  errorDetails?: FormatConversionErrorDetails;
}

export interface BatchConversionProgress {
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  overallProgress: number; // 0-100
  estimatedTimeRemaining?: number; // milliseconds
  currentFileProgress: number; // 0-100
}

export interface FormatSupport {
  jpeg: boolean;
  png: boolean;
  webp: boolean;
  avif: boolean;
  svg: boolean;
  jxl: boolean;
}

export interface FormatCapabilities {
  lossy: boolean;
  lossless: boolean;
  transparency: boolean;
  animation: boolean;
  metadata: boolean;
  maxDimensions: {
    width: number;
    height: number;
  };
}

export interface FormatCharacteristics {
  [key: string]: FormatCapabilities;
  jpeg: FormatCapabilities;
  png: FormatCapabilities;
  webp: FormatCapabilities;
  avif: FormatCapabilities;
  svg: FormatCapabilities;
  jxl: FormatCapabilities;
}

export interface ConversionJob {
  id: string;
  file: File;
  options: FormatConversionOptions;
  priority: 'low' | 'normal' | 'high';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: FormatConversionResult;
  progress: number;
  startTime?: number;
  endTime?: number;
}

export interface FormatQualityRange {
  min: number;
  max: number;
  recommended: number;
  optimal: number;
}

export interface FormatPerformanceProfile {
  encodingSpeed: 'fast' | 'medium' | 'slow';
  compressionEfficiency: 'low' | 'medium' | 'high' | 'excellent';
  browserSupport: number; // percentage
  estimatedProcessingTime: (fileSize: number) => number; // milliseconds
}

export interface BatchConversionRequest {
  files: File[];
  options: FormatConversionOptions;
  batchSize?: number;
  priority?: 'low' | 'normal' | 'high';
  onProgress?: (progress: BatchConversionProgress) => void;
  onFileComplete?: (result: FormatConversionResult) => void;
  onError?: (error: string, file: File) => void;
}

export interface MixedConversionRequest {
  file: File;
  options: FormatConversionOptions;
}

export interface FormatRecommendation {
  format: SupportedFormat;
  quality: number;
  reasoning: string;
  estimatedSize: number;
  estimatedSavings: number;
  fallbackFormat?: SupportedFormat;
}

export interface ConversionMemoryUsage {
  estimated: number; // bytes
  peak: number; // bytes
  current: number; // bytes
  available: number; // bytes
  recommendations: {
    batchSize: number;
    shouldChunk: boolean;
    maxConcurrent: number;
  };
}

// Error types specific to format conversion
export type FormatConversionError = 
  | 'UNSUPPORTED_FORMAT'
  | 'BROWSER_INCOMPATIBLE'
  | 'FILE_TOO_LARGE'
  | 'CANVAS_SIZE_LIMIT'
  | 'MEMORY_EXHAUSTED'
  | 'ENCODING_FAILED'
  | 'INVALID_QUALITY'
  | 'NETWORK_ERROR'
  | 'OPERATION_CANCELLED';

export interface FormatConversionErrorDetails {
  type: FormatConversionError;
  message: string;
  code: string;
  recoverable: boolean;
  suggestion?: string;
  fallbackOptions?: FormatConversionOptions[];
}