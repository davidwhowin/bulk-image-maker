/**
 * Types for folder upload and organization functionality
 */

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FolderNode[];
  file?: File;
  size?: number;
  isImage?: boolean;
  isSelected?: boolean;
  isExpanded?: boolean;
  depth: number;
}

export interface ImageFileWithPath {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  folderPath: string;
  relativePath: string;
  folderNode?: FolderNode;
}

export interface FolderUploadResult {
  totalFiles: number;
  imageFiles: number;
  folders: number;
  rootFolders: FolderNode[];
  allImageFiles: ImageFileWithPath[];
  folderStructure: Map<string, FolderNode>;
  largestFolder?: {
    path: string;
    fileCount: number;
  };
  warnings: string[];
}

export interface FolderProcessingOptions {
  maxFiles?: number;
  maxDepth?: number;
  maxFileSize?: number;
  preserveStructure?: boolean;
  skipEmptyFolders?: boolean;
  allowedExtensions?: string[];
}

export interface FolderStats {
  totalSize: number;
  fileCount: number;
  imageCount: number;
  folderCount: number;
  averageFileSize: number;
  largestFile: {
    name: string;
    size: number;
  } | null;
}

export interface SelectionState {
  selectedFiles: Set<string>;
  selectedFolders: Set<string>;
  selectAll: boolean;
  indeterminate: boolean;
}