import { useState, useCallback, memo } from 'react';
import { cn } from '@/lib/utils';
import type { ImageComparison as ImageComparisonType } from '@/types';

interface ImageComparisonProps {
  comparison: ImageComparisonType;
  onViewModeChange?: (viewMode: 'side-by-side' | 'overlay' | 'split' | 'slider') => void;
  onZoomChange?: (zoomLevel: number) => void;
  onPanChange?: (position: { x: number; y: number }) => void;
  className?: string;
}

export const ImageComparison = memo(function ImageComparison({
  comparison,
  onViewModeChange,
  onZoomChange,
  onPanChange,
  className,
}: ImageComparisonProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleViewModeChange = useCallback((mode: 'side-by-side' | 'overlay' | 'split' | 'slider') => {
    onViewModeChange?.(mode);
  }, [onViewModeChange]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(comparison.viewSettings.zoomLevel * 1.25, 5);
    onZoomChange?.(newZoom);
  }, [comparison.viewSettings.zoomLevel, onZoomChange]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(comparison.viewSettings.zoomLevel / 1.25, 0.25);
    onZoomChange?.(newZoom);
  }, [comparison.viewSettings.zoomLevel, onZoomChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    onPanChange?.({ x: deltaX, y: deltaY });
  }, [isDragging, dragStart, onPanChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Loading state
  if (comparison.status === 'loading') {
    return (
      <div data-testid="image-comparison" className={cn('relative p-4 border rounded-lg', className)}>
        <div className="flex items-center justify-center h-64">
          <div data-testid="loading-spinner" className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <span className="ml-2 text-gray-600">Processing...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (comparison.status === 'error') {
    return (
      <div data-testid="image-comparison" className={cn('relative p-4 border rounded-lg bg-red-50', className)}>
        <div data-testid="error-message" className="text-red-700">
          {comparison.error || 'An error occurred'}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="image-comparison" className={cn('relative border rounded-lg overflow-hidden', className)}>
      {/* View Mode Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 bg-white/90 backdrop-blur-sm rounded-md p-1">
        <button
          data-testid="side-by-side-view-button"
          onClick={() => handleViewModeChange('side-by-side')}
          className={cn(
            'p-2 rounded text-xs',
            comparison.viewSettings.viewMode === 'side-by-side' 
              ? 'bg-primary-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          Side
        </button>
        <button
          data-testid="overlay-view-button"
          onClick={() => handleViewModeChange('overlay')}
          className={cn(
            'p-2 rounded text-xs',
            comparison.viewSettings.viewMode === 'overlay' 
              ? 'bg-primary-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          Overlay
        </button>
        <button
          data-testid="split-view-button"
          onClick={() => handleViewModeChange('split')}
          className={cn(
            'p-2 rounded text-xs',
            comparison.viewSettings.viewMode === 'split' 
              ? 'bg-primary-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          Split
        </button>
        <button
          data-testid="slider-view-button"
          onClick={() => handleViewModeChange('slider')}
          className={cn(
            'p-2 rounded text-xs',
            comparison.viewSettings.viewMode === 'slider' 
              ? 'bg-primary-600 text-white' 
              : 'text-gray-600 hover:bg-gray-100'
          )}
        >
          Slider
        </button>
      </div>

      {/* Zoom Controls */}
      <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 bg-white/90 backdrop-blur-sm rounded-md p-1">
        <button
          data-testid="zoom-in-button"
          onClick={handleZoomIn}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          +
        </button>
        <button
          data-testid="zoom-out-button"
          onClick={handleZoomOut}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded"
        >
          -
        </button>
      </div>

      {/* Image Container */}
      <div
        data-testid="image-container"
        className="relative overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {comparison.viewSettings.viewMode === 'side-by-side' && (
          <div className="flex">
            {/* Original Image */}
            <div className="flex-1 p-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Original</div>
              <img
                data-testid="original-image"
                src={comparison.thumbnails.original}
                alt={`Original image: ${comparison.originalFile.name}`}
                aria-label={`Original image: ${comparison.originalFile.name}`}
                className="w-full h-auto rounded"
                style={{
                  transform: `scale(${comparison.viewSettings.zoomLevel}) translate(${comparison.viewSettings.panPosition.x}px, ${comparison.viewSettings.panPosition.y}px)`,
                }}
              />
            </div>

            {/* Compressed Image */}
            {comparison.compressedFile && (
              <div className="flex-1 p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Compressed</div>
                <img
                  data-testid="compressed-image"
                  src={comparison.thumbnails.compressed}
                  alt={`Compressed image: ${comparison.compressedFile.name}`}
                  aria-label={`Compressed image: ${comparison.compressedFile.name}`}
                  className="w-full h-auto rounded"
                  style={{
                    transform: `scale(${comparison.viewSettings.zoomLevel}) translate(${comparison.viewSettings.panPosition.x}px, ${comparison.viewSettings.panPosition.y}px)`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Other view modes would be implemented here */}
        {comparison.viewSettings.viewMode === 'overlay' && (
          <div className="relative p-4">
            <div className="relative">
              <img
                data-testid="original-image"
                src={comparison.thumbnails.original}
                alt={`Original image: ${comparison.originalFile.name}`}
                aria-label={`Original image: ${comparison.originalFile.name}`}
                className="w-full h-auto rounded"
              />
              {comparison.compressedFile && (
                <img
                  data-testid="compressed-image"
                  src={comparison.thumbnails.compressed}
                  alt={`Compressed image: ${comparison.compressedFile.name}`}
                  aria-label={`Compressed image: ${comparison.compressedFile.name}`}
                  className="absolute inset-0 w-full h-auto rounded"
                  style={{ opacity: comparison.viewSettings.overlayOpacity }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Metrics */}
      {comparison.viewSettings.showMetrics && comparison.compressedFile && (
        <div className="p-4 bg-gray-50 border-t">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-green-600">
                {comparison.comparisonMetrics.sizeSavingsPercent.toFixed(0)}% smaller
              </div>
              <div className="text-gray-600">
                {comparison.comparisonMetrics.originalSize} bytes → {comparison.comparisonMetrics.compressedSize} bytes
              </div>
            </div>
            {comparison.comparisonMetrics.qualityScore && (
              <div>
                <div className="font-medium">Quality: {(comparison.comparisonMetrics.qualityScore * 100).toFixed(0)}%</div>
                <div className="text-gray-600">
                  {comparison.comparisonMetrics.formats.original} → {comparison.comparisonMetrics.formats.compressed}
                </div>
              </div>
            )}
            <div>
              <div className="font-medium">Processing time</div>
              <div className="text-gray-600">{comparison.comparisonMetrics.processingTime}ms</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});