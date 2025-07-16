export interface SvgOptimizationOptions {
  /** Remove unnecessary attributes and elements */
  removeUnnecessaryData?: boolean;
  
  /** Remove comments and metadata */
  removeComments?: boolean;
  
  /** Remove or optimize unused definitions */
  cleanupDefs?: boolean;
  
  /** Simplify paths by removing redundant points */
  simplifyPaths?: boolean;
  
  /** Reduce coordinate precision (number of decimal places) */
  coordinatePrecision?: number;
  
  /** Optimize colors (convert to shorter formats) */
  optimizeColors?: boolean;
  
  /** Remove whitespace and minify */
  minify?: boolean;
  
  /** Merge similar elements and optimize transformations */
  optimizeTransforms?: boolean;
  
  /** Remove invisible elements */
  removeInvisibleElements?: boolean;
  
  /** Convert CSS styles to attributes */
  inlineStyles?: boolean;
  
  /** Remove empty groups and containers */
  removeEmptyContainers?: boolean;
  
  /** Optimization aggressiveness level */
  aggressiveness?: 'conservative' | 'moderate' | 'aggressive';
  
  /** Preserve specific attributes/elements */
  preserve?: {
    comments?: string[];
    attributes?: string[];
    elements?: string[];
  };
  
  /** Enable/disable specific plugins */
  plugins?: {
    [key: string]: boolean | object;
  };
}

export interface SvgOptimizationResult {
  success: boolean;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  processingTime: number;
  optimizedSvg?: string;
  originalSvg?: string;
  error?: string;
  warnings?: string[];
  optimizations?: SvgOptimizationReport;
}

export interface SvgOptimizationReport {
  /** Number of elements removed */
  elementsRemoved: number;
  
  /** Number of attributes removed */
  attributesRemoved: number;
  
  /** Number of paths simplified */
  pathsSimplified: number;
  
  /** Number of coordinates rounded */
  coordinatesRounded: number;
  
  /** Number of colors optimized */
  colorsOptimized: number;
  
  /** Number of transformations optimized */
  transformsOptimized: number;
  
  /** Size reduction breakdown */
  sizeReduction: {
    whitespace: number;
    attributes: number;
    paths: number;
    colors: number;
    other: number;
  };
  
  /** Performance metrics */
  performance: {
    parseTime: number;
    optimizationTime: number;
    serializationTime: number;
  };
}

export interface SvgValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  structure: {
    hasValidRoot: boolean;
    hasViewBox: boolean;
    elementCount: number;
    pathCount: number;
    complexityScore: number;
  };
}

export interface SvgComplexityAnalysis {
  /** Overall complexity score (0-100) */
  complexityScore: number;
  
  /** Number of elements */
  elementCount: number;
  
  /** Number of path elements */
  pathCount: number;
  
  /** Total path data length */
  pathDataLength: number;
  
  /** Number of unique colors */
  colorCount: number;
  
  /** Estimated optimization potential (0-100) */
  optimizationPotential: number;
  
  /** Recommended optimization strategy */
  recommendedStrategy: 'light' | 'moderate' | 'aggressive';
  
  /** Estimated processing time in milliseconds */
  estimatedProcessingTime: number;
}

export interface SvgBatchOptimizationProgress {
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  overallProgress: number;
  currentFileProgress: number;
  estimatedTimeRemaining?: number;
  totalSizeReduction: number;
  averageCompressionRatio: number;
}

export interface SvgPreviewComparison {
  original: {
    svg: string;
    size: number;
    complexity: SvgComplexityAnalysis;
  };
  optimized: {
    svg: string;
    size: number;
    complexity: SvgComplexityAnalysis;
  };
  visualDifference: {
    hasVisibleChanges: boolean;
    differenceScore: number; // 0-100, 0 = identical
    affectedElements: string[];
  };
}

export type SvgOptimizationMode = 'fast' | 'balanced' | 'maximum';

export interface SvgOptimizationPresets {
  [key: string]: SvgOptimizationOptions;
  conservative: SvgOptimizationOptions;
  web: SvgOptimizationOptions;
  print: SvgOptimizationOptions;
  icon: SvgOptimizationOptions;
  illustration: SvgOptimizationOptions;
}

export interface SvgMemoryInfo {
  availableMemory: number;
  estimatedUsage: number;
  canProceed: boolean;
  recommendedBatchSize: number;
  breakdown: {
    parsing: number;
    optimization: number;
    serialization: number;
    overhead: number;
  };
}

export interface SvgErrorDetails {
  type: 'PARSE_ERROR' | 'INVALID_SVG' | 'OPTIMIZATION_FAILED' | 'MEMORY_ERROR' | 'TIMEOUT';
  message: string;
  line?: number;
  column?: number;
  element?: string;
  recoverable: boolean;
  suggestion?: string;
}