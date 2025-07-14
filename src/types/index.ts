export interface ImageFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  preview?: string;
  compressed?: CompressedImage;
  // Folder structure preservation
  folderPath?: string;
  relativePath?: string;
}

export interface CompressedImage {
  blob: Blob;
  size: number;
  format: string;
  quality: number;
  compressionRatio: number;
  preview?: string;
}

export interface CompressionSettings {
  format: 'jpeg' | 'webp' | 'avif' | 'png';
  quality: number;
  effort: number;
  resize?: ResizeSettings;
  stripMetadata: boolean;
}

export interface ResizeSettings {
  enabled: boolean;
  width?: number;
  height?: number;
  maintainAspectRatio: boolean;
}

export interface ProcessingStats {
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalOriginalSize: number;
  totalCompressedSize: number;
  compressionRatio: number;
  processingTime: number;
}

// Re-export upload types
export type {
  UploadValidationRules,
  UploadError,
  UploadResult,
  UserUploadAreaProps,
  DragState,
  UploadAreaState,
} from './upload';
