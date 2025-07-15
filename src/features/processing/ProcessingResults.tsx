import { useState, useCallback, useEffect } from 'react';
import { useStore } from '@/store';
import { formatFileSize } from '@/lib/utils';
import { createStructuredZip } from '@/lib/folder-structure-preservation';
import type { ImageFileWithPath } from '@/types/folder';

// Helper component for displaying images with proper URL management
function ImageDisplay({ file, alt, className }: { file: File; alt: string; className?: string }) {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={className}
      onError={() => {
        console.warn('Failed to load image:', alt);
      }}
    />
  );
}

export function ProcessingResults() {
  const { files, processingStats, folderSettings } = useStore();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'results' | 'comparison'>('results');
  

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

      {/* View Toggle */}
      <div className="flex items-center justify-center mb-6">
        <div className="bg-white rounded-lg p-1 border border-gray-200">
          <button
            onClick={() => setView('results')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'results'
                ? 'bg-primary-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            📊 Results Summary
          </button>
          <button
            onClick={() => setView('comparison')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              view === 'comparison'
                ? 'bg-primary-600 text-white'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            🔍 Before/After Comparison
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Results View */}
      {view === 'results' && (
        <>
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
        </>
      )}

      {/* Comparison View */}
      {view === 'comparison' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Before/After Comparison
            </h3>
            <p className="text-sm text-gray-600">
              Compare original and compressed images side-by-side with compression metrics.
            </p>
          </div>
          
          <div className="p-6 max-h-[600px] overflow-y-auto">
            {completedFiles.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-500">No processed files to compare</div>
              </div>
            ) : (
              <div className="space-y-6">
                {completedFiles.map(file => (
                  <div key={file.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <h4 className="font-medium text-gray-900">{file.name}</h4>
                    </div>
                    
                    <div className="p-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Original Image */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Original</h5>
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                            {file.preview ? (
                              <img
                                src={file.preview}
                                alt={`Original ${file.name}`}
                                className="w-full h-48 object-contain"
                              />
                            ) : (
                              <ImageDisplay
                                file={file.file}
                                alt={`Original ${file.name}`}
                                className="w-full h-48 object-contain"
                              />
                            )}
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <div>Size: {formatFileSize(file.size)}</div>
                            <div>Format: {file.type.replace('image/', '').toUpperCase()}</div>
                          </div>
                        </div>

                        {/* Compressed Image */}
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Compressed</h5>
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                            {file.compressed ? (
                              <img
                                src={file.compressed.preview || URL.createObjectURL(file.compressed.blob)}
                                alt={`Compressed ${file.name}`}
                                className="w-full h-48 object-contain"
                                onError={(e) => {
                                  console.warn('Failed to load compressed image:', file.name);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-full h-48 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <div>Processing...</div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="mt-2 text-sm text-gray-600">
                            <div>Size: {formatFileSize(file.compressed?.size || file.size)}</div>
                            <div>Format: {file.compressed?.format?.toUpperCase() || file.type.replace('image/', '').toUpperCase()}</div>
                            {file.compressed?.quality && (
                              <div>Quality: {Math.round(file.compressed.quality * 100)}%</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Compression Stats */}
                      {file.compressed && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <div className="font-medium text-green-800">
                                {(((file.size - file.compressed.size) / file.size) * 100).toFixed(1)}%
                              </div>
                              <div className="text-green-600">Size Reduction</div>
                            </div>
                            <div className="text-center p-3 bg-blue-50 rounded-lg">
                              <div className="font-medium text-blue-800">
                                {formatFileSize(file.size - file.compressed.size)}
                              </div>
                              <div className="text-blue-600">Space Saved</div>
                            </div>
                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                              <div className="font-medium text-purple-800">
                                {(file.compressed.size / file.size).toFixed(2)}x
                              </div>
                              <div className="text-purple-600">Compression Ratio</div>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <div className="font-medium text-gray-800">
                                {(() => {
                                  const originalFormat = file.type.replace('image/', '').toUpperCase();
                                  const compressedFormat = file.compressed.format.toUpperCase();
                                  const formatChanged = originalFormat !== compressedFormat;
                                  
                                  return formatChanged 
                                    ? `${originalFormat} → ${compressedFormat}`
                                    : `${originalFormat} (unchanged)`;
                                })()}
                              </div>
                              <div className="text-gray-600">
                                {file.type.replace('image/', '').toUpperCase() === file.compressed.format.toUpperCase() 
                                  ? 'Format Preserved' 
                                  : 'Format Changed'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}