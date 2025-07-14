import { useState, useCallback } from 'react';
import { useStore } from '@/store';
import { formatFileSize } from '@/lib/utils';
import { createStructuredZip } from '@/lib/folder-structure-preservation';
import type { ImageFileWithPath } from '@/types/folder';

export function ProcessingResults() {
  const { files, processingStats, folderSettings } = useStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter completed files
  const completedFiles = files.filter(file => file.status === 'completed');
  const hasCompletedFiles = completedFiles.length > 0;

  const downloadProcessedFiles = useCallback(async () => {
    if (!hasCompletedFiles || isDownloading) return;

    setIsDownloading(true);
    setError(null);
    
    try {
      // Convert files to ImageFileWithPath format for folder preservation
      const filesWithPaths: ImageFileWithPath[] = completedFiles.map(file => ({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        file: file.compressed?.blob ? new File([file.compressed.blob], file.name, { type: file.compressed.blob.type }) : file.file,
        status: file.status,
        folderPath: file.folderPath || '',
        relativePath: file.relativePath || file.name,
      }));
      
      // Create ZIP with folder structure preservation
      const zipBlob = await createStructuredZip(filesWithPaths, {
        preserveStructure: folderSettings.preserveStructure,
        maxDepth: folderSettings.maxDepth,
        handleDuplicates: folderSettings.flattenDuplicateHandling,
        includeMetrics: true,
      });
      
      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      
      const structurePrefix = folderSettings.preserveStructure ? 'structured' : 'flat';
      link.download = `${structurePrefix}-optimized-images-${new Date().toISOString().split('T')[0]}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Log metrics if available
      if (zipBlob.metrics) {
        const metrics = zipBlob.metrics;
        console.log(`Downloaded ${completedFiles.length} processed files:`, {
          zipSize: formatFileSize(metrics.size),
          folderCount: metrics.folderCount,
          processingTime: `${metrics.processingTime?.toFixed(0)}ms`,
          skippedFiles: metrics.skippedFiles || 0,
        });
        
        // Show warning if files were skipped
        if (metrics.skippedFiles && metrics.skippedFiles > 0) {
          console.warn(`${metrics.skippedFiles} files were skipped due to errors`);
        }
      }
      
    } catch (error) {
      console.error('Download failed:', error);
      // Show user-friendly error message
      setError(error instanceof Error ? error.message : 'Failed to create download file');
    } finally {
      setIsDownloading(false);
    }
  }, [hasCompletedFiles, completedFiles, isDownloading, folderSettings]);

  const downloadIndividualFile = useCallback((file: typeof completedFiles[0]) => {
    if (!file.file) return;
    
    // Create download link for individual file
    const url = URL.createObjectURL(file.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  if (!hasCompletedFiles && (!processingStats || processingStats.processedFiles === 0)) {
    return null;
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0">
          <svg className="h-8 w-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-lg font-medium text-green-800">
            Processing Complete!
          </h3>
          <div className="mt-2 text-sm text-green-700">
            <p>
              Successfully processed {processingStats?.processedFiles || 0} of {processingStats?.totalFiles || 0} files
              {processingStats && processingStats.failedFiles > 0 && (
                <span className="text-red-600 ml-2">
                  ({processingStats.failedFiles} failed)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Processing Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 text-sm">
        <div className="bg-white rounded-lg p-3">
          <div className="text-gray-500">Original Size</div>
          <div className="font-medium text-gray-900">
            {formatFileSize(processingStats?.totalOriginalSize || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="text-gray-500">Compressed Size</div>
          <div className="font-medium text-gray-900">
            {formatFileSize(processingStats?.totalCompressedSize || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="text-gray-500">Space Saved</div>
          <div className="font-medium text-green-600">
            {formatFileSize((processingStats?.totalOriginalSize || 0) - (processingStats?.totalCompressedSize || 0))}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3">
          <div className="text-gray-500">Compression</div>
          <div className="font-medium text-green-600">
            {(processingStats?.compressionRatio || 0).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Download Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={downloadProcessedFiles}
          disabled={!hasCompletedFiles || isDownloading}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDownloading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Creating ZIP...
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              Download All ({completedFiles.length} files)
            </>
          )}
        </button>

        {completedFiles.length > 1 && (
          <div className="text-sm text-gray-600 flex items-center">
            Or download individual files from the preview grid above
          </div>
        )}
      </div>

      {/* Individual Download Links (for smaller batches) */}
      {completedFiles.length <= 5 && (
        <div className="mt-4 pt-4 border-t border-green-200">
          <div className="text-sm text-gray-600 mb-2">Individual Downloads:</div>
          <div className="flex flex-wrap gap-2">
            {completedFiles.map(file => (
              <button
                key={file.id}
                onClick={() => downloadIndividualFile(file)}
                className="text-xs bg-white border border-gray-300 rounded px-2 py-1 hover:bg-gray-50 truncate max-w-32"
                title={`Download ${file.name}`}
              >
                {file.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}