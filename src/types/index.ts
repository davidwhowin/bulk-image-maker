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
  // Selection and filtering
  selected?: boolean;
  isDuplicate?: boolean;
  duplicateGroup?: string;
  hash?: string;
  // URL import metadata
  sourceUrl?: string;
  importedAt?: Date;
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
  format: 'auto' | 'jpeg' | 'webp' | 'avif' | 'png';
  quality: number;
  effort: number;
  resize?: ResizeSettings;
  stripMetadata: boolean;
  progressive?: boolean; // For JPEG progressive loading
  preserveAlpha?: boolean; // For PNG/WebP transparency
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

// File filtering and organization
export interface FileFilter {
  searchQuery?: string;
  fileTypes?: string[];
  sizeRange?: { min: number; max: number };
  statusFilter?: ImageFile['status'][];
  showDuplicatesOnly?: boolean;
  folderPath?: string;
}

export interface FilterState {
  activeFilters: FileFilter;
  filteredFiles: ImageFile[];
  totalFiles: number;
  isFiltering: boolean;
}

// Bulk selection
export interface SelectionState {
  selectedFiles: Set<string>;
  isAllSelected: boolean;
  isSelectionMode: boolean;
  selectionCount: number;
}

export interface BulkActions {
  selectAll: () => void;
  deselectAll: () => void;
  selectFiltered: () => void;
  invertSelection: () => void;
  removeSelected: () => void;
  processSelected: () => void;
}

// Duplicate detection
export interface DuplicateDetectionResult {
  duplicateGroups: DuplicateGroup[];
  duplicateCount: number;
  uniqueFiles: ImageFile[];
  processingTime: number;
}

export interface DuplicateGroup {
  id: string;
  files: ImageFile[];
  hash: string;
  representative: ImageFile; // First or best quality file
  size: number;
}

export interface DuplicateDetectionSettings {
  enabled: boolean;
  compareBy: 'hash' | 'name' | 'size' | 'content';
  threshold: number; // For content-based comparison
  autoRemove: boolean;
  keepPolicy: 'first' | 'largest' | 'smallest' | 'newest' | 'manual';
}

// Clipboard support
export interface ClipboardData {
  files: File[];
  urls: string[];
  images: ClipboardItem[];
}

export interface ClipboardImportResult {
  files: File[];
  errors: Array<{
    fileName: string;
    message: string;
    type: 'validation' | 'processing' | 'clipboard_error' | 'browser_compatibility';
  }>;
  fromClipboard: boolean;
}

// URL import
export interface UrlImportRequest {
  urls: string[];
  options?: UrlImportOptions;
}

export interface UrlImportOptions {
  maxConcurrent?: number;
  timeout?: number;
  validateImageType?: boolean;
  maxFileSize?: number;
  userAgent?: string;
}

export interface UrlImportResult {
  successful: UrlImportSuccess[];
  failed: UrlImportError[];
  totalRequested: number;
  totalSuccessful: number;
  totalFailed: number;
  processingTime: number;
}

export interface UrlImportSuccess {
  url: string;
  file: File;
  contentType: string;
  size: number;
  filename: string;
}

export interface UrlImportError {
  url: string;
  error: string;
  statusCode?: number;
  contentType?: string;
}

// Image comparison and before/after views
export interface ImageComparison {
  id: string;
  originalFile: ImageFile;
  compressedFile?: ImageFile;
  comparisonMetrics: ComparisonMetrics;
  viewSettings: ComparisonViewSettings;
  thumbnails: ComparisonThumbnails;
  status: 'pending' | 'loading' | 'ready' | 'error';
  error?: string;
}

export interface ComparisonMetrics {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  sizeSavings: number;
  sizeSavingsPercent: number;
  qualityScore?: number;
  processingTime: number;
  dimensions: {
    original: { width: number; height: number };
    compressed: { width: number; height: number };
  };
  formats: {
    original: string;
    compressed: string;
  };
}

export interface ComparisonViewSettings {
  viewMode: 'side-by-side' | 'overlay' | 'split' | 'slider';
  showMetrics: boolean;
  showFileNames: boolean;
  zoomLevel: number;
  panPosition: { x: number; y: number };
  overlayOpacity: number;
  splitPosition: number; // 0-100 for split view
}

export interface ComparisonThumbnails {
  original?: string; // Object URL or data URL
  compressed?: string;
  lowRes?: {
    original?: string;
    compressed?: string;
  };
}

export interface ComparisonGridSettings {
  itemsPerRow: number;
  itemHeight: number;
  showMetrics: boolean;
  viewMode: ComparisonViewSettings['viewMode'];
  sortBy: 'name' | 'originalSize' | 'compressedSize' | 'compressionRatio' | 'processingTime';
  sortOrder: 'asc' | 'desc';
  filterBy: 'all' | 'processed' | 'pending' | 'error';
}

export interface ComparisonExportOptions {
  includeMetrics: boolean;
  includeImages: boolean;
  format: 'pdf' | 'html' | 'json' | 'csv';
  imageQuality: number;
  pageSize?: 'a4' | 'letter' | 'custom';
  customSize?: { width: number; height: number };
}

export interface ComparisonExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  size: number;
  includedComparisons: number;
}

// Virtual scrolling for performance
export interface VirtualScrollItem {
  index: number;
  height: number;
  offset: number;
  comparison: ImageComparison;
}

export interface VirtualScrollConfig {
  itemHeight: number;
  overscan: number;
  bufferSize: number;
  windowHeight: number;
}

// Lazy loading
export interface LazyLoadingState {
  loadedImages: Set<string>;
  loadingImages: Set<string>;
  failedImages: Set<string>;
  visibleRange: { start: number; end: number };
}

// Image processing for comparisons
export interface ComparisonProcessor {
  generateThumbnails: (file: File, sizes: number[]) => Promise<string[]>;
  calculateMetrics: (original: File, compressed: Blob) => Promise<ComparisonMetrics>;
  createComparison: (originalFile: ImageFile) => Promise<ImageComparison>;
  updateComparison: (id: string, compressedFile: ImageFile) => Promise<void>;
}

// Error handling
export interface ComparisonError {
  id: string;
  type: 'loading' | 'processing' | 'memory' | 'network' | 'format';
  message: string;
  recoverable: boolean;
  retryCount: number;
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
