import { useCallback, useRef, useState } from 'react';
import { cn, isSupportedImageType, formatFileSize } from '@/lib/utils';
import { FolderProcessor } from '@/lib/folder-processor';
import { UrlImportModal } from './UrlImportModal';
import { useStore } from '@/store';
import type {
  UserUploadAreaProps,
  UploadAreaState,
  UploadResult,
  UploadError,
  UploadValidationRules,
  UrlImportRequest,
} from '@/types';

const DEFAULT_VALIDATION_RULES: UploadValidationRules = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 500,
  acceptedFileTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
  ],
  allowFolders: true,
};

// Helper function to recursively traverse folder structure from drag & drop
async function traverseFileTree(entry: FileSystemEntry, path: string = ''): Promise<File[]> {
  const files: File[] = [];
  
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve) => {
      fileEntry.file((file) => {
        // Add the relative path to simulate webkitRelativePath
        const relativePath = path ? `${path}/${file.name}` : file.name;
        Object.defineProperty(file, 'webkitRelativePath', {
          value: relativePath,
          writable: false
        });
        resolve([file]);
      });
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    return new Promise((resolve) => {
      const dirReader = dirEntry.createReader();
      const allFiles: File[] = [];
      
      const readEntries = async () => {
        dirReader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(allFiles);
            return;
          }
          
          for (const childEntry of entries) {
            const childPath = path ? `${path}/${entry.name}` : entry.name;
            const childFiles = await traverseFileTree(childEntry, childPath);
            allFiles.push(...childFiles);
          }
          
          // Continue reading (some browsers limit entries per call)
          await readEntries();
        });
      };
      
      readEntries();
    });
  }
  
  return files;
}

export function UserUploadArea({
  onFilesSelected,
  validationRules = DEFAULT_VALIDATION_RULES,
  disabled = false,
  className,
  children,
  showFileCount = true,
  showProgress = false,
  multiple = true,
}: UserUploadAreaProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<UploadAreaState>({
    isDragOver: false,
    isDragActive: false,
    dragCounter: 0,
    isProcessing: false,
    errors: [],
  });

  const [showUrlImport, setShowUrlImport] = useState(false);
  const { importFromUrls, isImporting } = useStore();

  const rules = { ...DEFAULT_VALIDATION_RULES, ...validationRules };

  const validateFile = useCallback(
    (file: File): UploadError | null => {
      // Check file type
      if (
        rules.acceptedFileTypes &&
        !rules.acceptedFileTypes.includes(file.type) &&
        !isSupportedImageType(file.type)
      ) {
        return {
          fileName: file.name,
          message: `File type "${file.type}" is not supported. Please use JPEG, PNG, WebP, AVIF, or GIF files.`,
          type: 'validation',
          file,
        };
      }

      // Check file size
      if (rules.maxFileSize && file.size > rules.maxFileSize) {
        return {
          fileName: file.name,
          message: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(rules.maxFileSize)}).`,
          type: 'validation',
          file,
        };
      }

      return null;
    },
    [rules]
  );

  const processFiles = useCallback(
    async (fileList: FileList | File[]): Promise<UploadResult> => {
      const files = Array.from(fileList);
      
      // Check if this is a folder upload (files have webkitRelativePath)
      const isFolderUpload = files.some(file => {
        const relativePath = (file as any).webkitRelativePath;
        return relativePath && relativePath.includes('/');
      });
      
      if (isFolderUpload && rules.allowFolders) {
        // Use FolderProcessor for folder uploads
        try {
          const folderProcessor = new FolderProcessor();
          const result = await folderProcessor.processFiles(files, {
            maxFiles: rules.maxFiles,
            maxFileSize: rules.maxFileSize,
            allowedExtensions: rules.acceptedFileTypes?.map(type => {
              const extensions: Record<string, string> = {
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg', 
                'image/png': '.png',
                'image/webp': '.webp',
                'image/avif': '.avif',
                'image/gif': '.gif',
              };
              return extensions[type] || '';
            }).filter(Boolean),
          });

          const errors: UploadError[] = result.warnings.map(warning => ({
            fileName: 'Folder processing',
            message: warning,
            type: 'validation' as const,
          }));

          return {
            validFiles: result.allImageFiles.map(f => f.file),
            errors,
            totalSize: result.allImageFiles.reduce((sum, f) => sum + f.size, 0),
            fileCount: result.allImageFiles.length,
            folderResult: result, // Pass folder structure data
          };
        } catch (error) {
          return {
            validFiles: [],
            errors: [{
              fileName: 'Folder processing',
              message: error instanceof Error ? error.message : 'Failed to process folder',
              type: 'processing',
            }],
            totalSize: 0,
            fileCount: 0,
          };
        }
      }

      // Handle individual file uploads (existing logic)
      const validFiles: File[] = [];
      const errors: UploadError[] = [];

      // Check total file count
      if (rules.maxFiles && files.length > rules.maxFiles) {
        errors.push({
          fileName: 'Multiple files',
          message: `Too many files selected. Maximum allowed: ${rules.maxFiles}`,
          type: 'validation',
        });
        return {
          validFiles: [],
          errors,
          totalSize: 0,
          fileCount: 0,
        };
      }

      // Validate each file
      for (const file of files) {
        const error = validateFile(file);
        if (error) {
          errors.push(error);
        } else {
          validFiles.push(file);
        }
      }

      const totalSize = validFiles.reduce((sum, file) => sum + file.size, 0);

      return {
        validFiles,
        errors,
        totalSize,
        fileCount: validFiles.length,
      };
    },
    [validateFile, rules]
  );

  const handleFileSelection = useCallback(
    async (files: FileList | File[]) => {
      if (disabled) return;

      setState((prev) => ({ ...prev, isProcessing: true, errors: [] }));

      try {
        const result = await processFiles(files);
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          errors: result.errors,
          lastUploadResult: result,
        }));
        onFilesSelected(result);
      } catch (error) {
        const uploadError: UploadError = {
          fileName: 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          type: 'processing',
        };
        setState((prev) => ({
          ...prev,
          isProcessing: false,
          errors: [uploadError],
        }));
        onFilesSelected({
          validFiles: [],
          errors: [uploadError],
          totalSize: 0,
          fileCount: 0,
        });
      }
    },
    [disabled, processFiles, onFilesSelected]
  );

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setState((prev) => ({
        ...prev,
        dragCounter: prev.dragCounter + 1,
        isDragActive: true,
        isDragOver: true,
      }));
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setState((prev) => {
        const newCounter = prev.dragCounter - 1;
        return {
          ...prev,
          dragCounter: newCounter,
          isDragActive: newCounter > 0,
          isDragOver: newCounter > 0,
        };
      });
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      // Ensure we show the drag state
      setState((prev) => ({
        ...prev,
        isDragOver: true,
        isDragActive: true,
      }));
    },
    [disabled]
  );

  const handleUrlImport = useCallback(
    async (urls: string[]) => {
      try {
        const request: UrlImportRequest = {
          urls,
          options: {
            maxConcurrent: 3,
            timeout: 30000, // 30 seconds
            validateImageType: true,
            maxFileSize: rules.maxFileSize,
          },
        };

        const result = await importFromUrls(request);
        
        // Show results to user
        if (result.failed.length > 0) {
          setState(prev => ({
            ...prev,
            errors: result.failed.map(failure => ({
              fileName: failure.url,
              message: failure.error,
              type: 'processing' as const,
            })),
          }));
        }

        // Close modal after successful import
        if (result.successful.length > 0) {
          setShowUrlImport(false);
          
          // Show success message
          setState(prev => ({
            ...prev,
            lastUploadResult: {
              validFiles: result.successful.map(s => s.file),
              errors: prev.errors,
              totalSize: result.successful.reduce((sum, s) => sum + s.size, 0),
              fileCount: result.successful.length,
            },
          }));
        }
      } catch (error) {
        setState(prev => ({
          ...prev,
          errors: [{
            fileName: 'URL Import',
            message: error instanceof Error ? error.message : 'Failed to import from URLs',
            type: 'processing',
          }],
        }));
      }
    },
    [importFromUrls, rules.maxFileSize]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (disabled) return;

      setState((prev) => ({
        ...prev,
        isDragOver: false,
        isDragActive: false,
        dragCounter: 0,
      }));

      // Check for text data (URLs) first
      const textData = e.dataTransfer.getData('text/plain');
      if (textData) {
        // Check if it's an image URL or contains image URLs
        const { validateImageUrl } = await import('@/lib/url-import');
        const urls = textData
          .split(/[\n\r\s,]+/)
          .map(url => url.trim())
          .filter(url => url.length > 0 && (url.startsWith('http://') || url.startsWith('https://')))
          .filter(url => validateImageUrl(url));

        if (urls.length > 0) {
          // Import from URLs
          handleUrlImport(urls);
          return;
        }
      }

      // Handle folder drops using DataTransferItemList API
      if (e.dataTransfer.items) {
        const items = Array.from(e.dataTransfer.items);
        const hasDirectories = items.some(item => 
          item.kind === 'file' && item.webkitGetAsEntry?.()?.isDirectory
        );

        if (hasDirectories && rules.allowFolders) {
          setState((prev) => ({ ...prev, isProcessing: true, errors: [] }));
          
          try {
            const allFiles: File[] = [];
            
            for (const item of items) {
              if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                  const files = await traverseFileTree(entry);
                  allFiles.push(...files);
                }
              }
            }

            if (allFiles.length > 0) {
              await handleFileSelection(allFiles);
            } else {
              setState((prev) => ({ 
                ...prev, 
                isProcessing: false,
                errors: [{
                  fileName: 'Folder',
                  message: 'No image files found in the dropped folder',
                  type: 'validation'
                }]
              }));
            }
          } catch (error) {
            setState((prev) => ({ 
              ...prev, 
              isProcessing: false,
              errors: [{
                fileName: 'Folder',
                message: error instanceof Error ? error.message : 'Failed to process folder',
                type: 'processing'
              }]
            }));
          }
          return;
        }
      }

      // Handle regular file drops
      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        handleFileSelection(files);
      }
    },
    [disabled, handleFileSelection, handleUrlImport, rules.allowFolders]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (files && files.length > 0) {
        handleFileSelection(files);
      }
      // Reset input value to allow selecting the same files again
      e.target.value = '';
    },
    [handleFileSelection]
  );

  const handleClick = useCallback(() => {
    if (disabled || state.isProcessing) return;
    fileInputRef.current?.click();
  }, [disabled, state.isProcessing]);

  const handleFolderClick = useCallback(() => {
    if (disabled || state.isProcessing || !rules.allowFolders) return;
    folderInputRef.current?.click();
  }, [disabled, state.isProcessing, rules.allowFolders]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }, [handleClick]);

  return (
    <div
      className={cn(
        'relative rounded-lg border-2 border-dashed transition-all duration-200',
        'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2',
        {
          'border-primary-300 bg-primary-50': state.isDragOver && !disabled,
          'border-gray-300 bg-gray-50': !state.isDragOver && !disabled,
          'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed': disabled,
          'cursor-pointer hover:border-primary-400 hover:bg-primary-25': !disabled && !state.isProcessing,
        },
        className
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="button"
      aria-label="Upload area. Click to browse files or drag and drop files here"
      aria-disabled={disabled}
    >
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={rules.acceptedFileTypes?.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        aria-hidden="true"
      />
      {rules.allowFolders && (
        <input
          ref={folderInputRef}
          type="file"
          multiple
          {...({ webkitdirectory: '' } as any)}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
          aria-hidden="true"
        />
      )}

      {/* Content */}
      <div className="p-8 text-center">
        {children || (
          <>
            <div className="mx-auto mb-4 h-12 w-12 text-gray-400">
              {state.isProcessing ? (
                <div className="animate-spin rounded-full border-2 border-primary-200 border-t-primary-600 h-12 w-12" />
              ) : (
                <svg
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900">
                {state.isProcessing
                  ? 'Processing files...'
                  : isImporting
                  ? 'Importing from URLs...'
                  : state.isDragOver
                  ? 'Drop files, folders, or image URLs here'
                  : 'Drop images here or click to browse'}
              </p>
              
              <p className="text-sm text-gray-600">
                Supports JPEG, PNG, WebP, AVIF, and GIF files • Drag image URLs from web
                {rules.maxFileSize && (
                  <> • Max {formatFileSize(rules.maxFileSize)} per file</>
                )}
                {rules.maxFiles && <> • Up to {rules.maxFiles} files</>}
              </p>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-center">
                {rules.allowFolders && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderClick();
                    }}
                    disabled={disabled || state.isProcessing}
                    className="text-sm text-primary-600 hover:text-primary-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Upload a folder
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowUrlImport(true);
                  }}
                  disabled={disabled || state.isProcessing || isImporting}
                  className="text-sm text-primary-600 hover:text-primary-700 underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Import from URLs
                </button>
              </div>
            </div>
          </>
        )}

        {/* Always show URL import button when files exist but showFileCount is false */}
        {!showFileCount && state.lastUploadResult && state.lastUploadResult.fileCount > 0 && (
          <div className="mt-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                disabled={disabled || state.isProcessing}
                className="text-sm text-primary-600 hover:text-primary-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add more files
              </button>
              
              {rules.allowFolders && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFolderClick();
                  }}
                  disabled={disabled || state.isProcessing}
                  className="text-sm text-primary-600 hover:text-primary-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add folder
                </button>
              )}
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUrlImport(true);
                }}
                disabled={disabled || state.isProcessing || isImporting}
                className="text-sm text-primary-600 hover:text-primary-700 underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Import from URLs
              </button>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        {showProgress && state.isProcessing && (
          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">Processing files...</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary-600 h-2 rounded-full animate-pulse w-1/3" />
            </div>
          </div>
        )}

        {/* File count display */}
        {showFileCount && state.lastUploadResult && (
          <div className="mt-4 space-y-3">
            {state.lastUploadResult.fileCount > 0 && (
              <div className="text-sm text-gray-600">
                <span>
                  {state.lastUploadResult.fileCount} file{state.lastUploadResult.fileCount !== 1 ? 's' : ''} selected
                  ({formatFileSize(state.lastUploadResult.totalSize)})
                </span>
              </div>
            )}
            
            {/* Add more files buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center justify-center">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
                disabled={disabled || state.isProcessing}
                className="text-sm text-primary-600 hover:text-primary-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add more files
              </button>
              
              {rules.allowFolders && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFolderClick();
                  }}
                  disabled={disabled || state.isProcessing}
                  className="text-sm text-primary-600 hover:text-primary-700 underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add folder
                </button>
              )}
              
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUrlImport(true);
                }}
                disabled={disabled || state.isProcessing || isImporting}
                className="text-sm text-primary-600 hover:text-primary-700 underline disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Import from URLs
              </button>
            </div>
          </div>
        )}

        {/* Error display */}
        {state.errors.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <h4 className="text-sm font-medium text-red-800 mb-1">
              Upload Issues ({state.errors.length})
            </h4>
            <ul className="text-sm text-red-700 space-y-1">
              {state.errors.slice(0, 3).map((error, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>
                    <strong>{error.fileName}:</strong> {error.message}
                  </span>
                </li>
              ))}
              {state.errors.length > 3 && (
                <li className="text-sm text-red-600">
                  ... and {state.errors.length - 3} more issue{state.errors.length - 3 !== 1 ? 's' : ''}
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* URL Import Modal */}
      <UrlImportModal
        isOpen={showUrlImport}
        onClose={() => setShowUrlImport(false)}
        onImport={handleUrlImport}
        isImporting={isImporting}
      />
    </div>
  );
}