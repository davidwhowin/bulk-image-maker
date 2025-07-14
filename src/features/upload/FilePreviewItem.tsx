import { useState, useEffect, useRef } from 'react';
import { useImageWorker } from '@/hooks/useImageWorker';
import { performanceMonitor, MemoryManager } from '@/lib/performance-utils';
import { formatFileSize } from '@/lib/utils';
import type { ImageFile } from '@/types';

interface FilePreviewItemProps {
  file: ImageFile;
  onRemoveFile: (id: string) => void;
  onKeyDown?: (e: React.KeyboardEvent, fileId: string) => void;
  isVisible?: boolean;
}

export function FilePreviewItem({ 
  file, 
  onRemoveFile, 
  onKeyDown,
  isVisible = true 
}: FilePreviewItemProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const hasGeneratedThumbnail = useRef(false);
  const memoryManager = MemoryManager.getInstance();
  const { generateThumbnail: generateThumbnailWorker } = useImageWorker();

  // Generate thumbnail when item becomes visible
  useEffect(() => {
    if (isVisible && !hasGeneratedThumbnail.current && file.file) {
      hasGeneratedThumbnail.current = true;
      setIsLoading(true);
      setError(null);

      // Record performance metrics
      performanceMonitor.recordMemoryUsage();

      const generateOperation = () => 
        generateThumbnailWorker(file.file, { width: 200, height: 200, quality: 0.7 });

      performanceMonitor.measureThumbnailGeneration(generateOperation)
        .then((dataUrl) => {
          setThumbnail(dataUrl);
          // Track for potential cleanup
          if (dataUrl.startsWith('blob:')) {
            memoryManager.trackObjectUrl(dataUrl);
          }
        })
        .catch((err) => {
          console.error('Failed to generate thumbnail:', err);
          setError('Failed to load preview');
        })
        .finally(() => {
          setIsLoading(false);
          performanceMonitor.recordMemoryUsage();
        });
    }
  }, [isVisible, file.file, generateThumbnailWorker, memoryManager]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (thumbnail && thumbnail.startsWith('blob:')) {
        memoryManager.revokeObjectUrl(thumbnail);
      }
    };
  }, [thumbnail, memoryManager]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onKeyDown) {
      onKeyDown(e, file.id);
    }
  };

  return (
    <div
      data-testid={`file-preview-item-${file.id}`}
      className="relative group bg-white rounded-lg border border-gray-200 p-3 hover:border-gray-300 transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* File Thumbnail */}
      <div
        ref={thumbnailRef}
        className="aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center overflow-hidden"
        data-testid={`file-thumbnail-${file.id}`}
        data-lazy={(!isVisible).toString()}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={`Preview of ${file.name}`}
            className="w-full h-full object-cover rounded-md"
            loading="lazy"
          />
        ) : error ? (
          <div className="text-center p-2">
            <svg className="w-6 h-6 text-red-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-xs text-red-600">Error loading</span>
          </div>
        ) : (
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      {/* File Info */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-900 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.size)}
        </p>
        {file.type && (
          <p className="text-xs text-gray-400 uppercase">
            {file.type.replace('image/', '')}
          </p>
        )}
      </div>

      {/* Status Indicator */}
      {file.status === 'processing' && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div
              className="bg-blue-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${file.progress || 0}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{file.progress || 0}%</p>
          <div 
            role="progressbar" 
            aria-valuenow={file.progress || 0} 
            aria-valuemin={0} 
            aria-valuemax={100}
            aria-label={`Processing ${file.name}`}
          />
        </div>
      )}

      {file.status === 'completed' && (
        <div className="mt-2" data-testid="file-status-completed">
          <div className="flex items-center text-green-600">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Done</span>
          </div>
        </div>
      )}

      {file.status === 'error' && (
        <div className="mt-2" data-testid="file-status-error">
          <div className="flex items-center text-red-600">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Error</span>
          </div>
          {file.error && (
            <p className="text-xs text-red-600 mt-1 truncate" title={file.error}>
              {file.error}
            </p>
          )}
        </div>
      )}

      {/* Remove Button */}
      <button
        onClick={() => onRemoveFile(file.id)}
        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
        aria-label={`Remove ${file.name}`}
        title={`Remove ${file.name}`}
      >
        ×
      </button>

      {/* Selection checkbox for future batch operations */}
      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <input
          type="checkbox"
          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          aria-label={`Select ${file.name}`}
          // TODO: Connect to selection state management
        />
      </div>
    </div>
  );
}