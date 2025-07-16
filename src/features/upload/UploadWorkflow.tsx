import { useCallback, useState } from 'react';
import { UserUploadArea } from '@/components';
import { FolderStructureSettings, FolderTreeView } from '@/components/folder';
import { CompressionSettings } from '@/components/compression';
import { useStore } from '@/store';
import { useImageProcessor } from '@/hooks/useImageProcessor';
import { FilePreviewGrid } from './FilePreviewGrid';
import { ProcessingResults } from '@/features/processing';
import type { UploadResult } from '@/types';

export function UploadWorkflow() {
  const { files, addFiles, removeFile, clearFiles } = useStore();
  const [error, setError] = useState<string | null>(null);
  const { processFiles, abortProcessing, canProcess, canAbort, isProcessing } = useImageProcessor();

  const handleFilesSelected = useCallback((result: UploadResult) => {
    try {
      setError(null);
      if (result.validFiles.length > 0) {
        addFiles(result.validFiles, result.folderResult);
      }
    } catch (err) {
      setError('Error processing files');
    }
  }, [addFiles]);

  const handleProcessFiles = useCallback(async () => {
    try {
      setError(null);
      await processFiles();
    } catch (err) {
      console.error('Processing failed:', err);
      setError(err instanceof Error ? err.message : 'Processing failed');
    }
  }, [processFiles]);

  const handleAbortProcessing = useCallback(() => {
    abortProcessing();
    setError(null);
  }, [abortProcessing]);

  const hasFiles = files.length > 0;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div>
        <UserUploadArea
          onFilesSelected={handleFilesSelected}
          validationRules={{
            maxFileSize: 50 * 1024 * 1024, // 50MB
            maxFiles: 500,
            allowFolders: true,
          }}
          showFileCount={!hasFiles}
          showProgress={true}
        >
          {hasFiles ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-4 h-12 w-12 text-gray-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">
                Drop more images here
              </p>
              <p className="text-sm text-gray-600">
                Or click to browse additional files
              </p>
            </div>
          ) : undefined}
        </UserUploadArea>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Compression Settings - Show when files are uploaded */}
      {hasFiles && <CompressionSettings />}

      {/* Folder Structure Settings */}
      <FolderStructureSettings />

      {/* Folder Tree View */}
      <FolderTreeView />

      {/* File Preview Grid */}
      {hasFiles && (
        <FilePreviewGrid
          files={files}
          onRemoveFile={removeFile}
          onClearAll={clearFiles}
        />
      )}

      {/* Process Button */}
      {hasFiles && (
        <div className="flex justify-center gap-4">
          <button
            onClick={handleProcessFiles}
            disabled={!canProcess}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Process Files'}
          </button>
          
          {canAbort && (
            <button
              onClick={handleAbortProcessing}
              className="btn-secondary"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Processing Results */}
      <ProcessingResults />

      {/* Status Announcements for Screen Readers */}
      <div role="status" aria-live="polite" className="sr-only">
        {hasFiles 
          ? `${files.length} file${files.length !== 1 ? 's' : ''} uploaded`
          : 'No files uploaded'
        }
      </div>
    </div>
  );
}