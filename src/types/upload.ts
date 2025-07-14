export interface UploadValidationRules {
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  acceptedFileTypes?: string[];
  allowFolders?: boolean;
}

export interface UploadError {
  file?: File;
  fileName: string;
  message: string;
  type: 'validation' | 'processing' | 'network' | 'unknown';
}

export interface UploadResult {
  validFiles: File[];
  errors: UploadError[];
  totalSize: number;
  fileCount: number;
  folderResult?: import('./folder').FolderUploadResult;
}

export interface UserUploadAreaProps {
  onFilesSelected: (result: UploadResult) => void;
  validationRules?: UploadValidationRules;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  showFileCount?: boolean;
  showProgress?: boolean;
  multiple?: boolean;
}

export interface DragState {
  isDragOver: boolean;
  isDragActive: boolean;
  dragCounter: number;
}

export interface UploadAreaState extends DragState {
  isProcessing: boolean;
  errors: UploadError[];
  lastUploadResult?: UploadResult;
}