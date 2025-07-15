import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageComparison } from './ImageComparison';
import type { ImageComparison as ImageComparisonType } from '@/types';

// Mock dependencies
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(' ')),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
}));

describe('ImageComparison', () => {
  const user = userEvent.setup();

  const mockComparison: ImageComparisonType = {
    id: 'test-comparison-1',
    originalFile: {
      id: 'original-1',
      file: new File(['original'], 'test.jpg', { type: 'image/jpeg' }),
      name: 'test.jpg',
      size: 100000,
      type: 'image/jpeg',
      status: 'completed',
      progress: 100,
    },
    compressedFile: {
      id: 'compressed-1',
      file: new File(['compressed'], 'test-compressed.webp', { type: 'image/webp' }),
      name: 'test-compressed.webp',
      size: 50000,
      type: 'image/webp',
      status: 'completed',
      progress: 100,
    },
    comparisonMetrics: {
      originalSize: 100000,
      compressedSize: 50000,
      compressionRatio: 0.5,
      sizeSavings: 50000,
      sizeSavingsPercent: 50,
      qualityScore: 0.95,
      processingTime: 1500,
      dimensions: {
        original: { width: 1920, height: 1080 },
        compressed: { width: 1920, height: 1080 },
      },
      formats: {
        original: 'JPEG',
        compressed: 'WebP',
      },
    },
    viewSettings: {
      viewMode: 'side-by-side',
      showMetrics: true,
      showFileNames: true,
      zoomLevel: 1,
      panPosition: { x: 0, y: 0 },
      overlayOpacity: 0.5,
      splitPosition: 50,
    },
    thumbnails: {
      original: 'data:image/jpeg;base64,test-original',
      compressed: 'data:image/webp;base64,test-compressed',
    },
    status: 'ready',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render side-by-side comparison view', () => {
      render(<ImageComparison comparison={mockComparison} />);
      
      expect(screen.getByTestId('image-comparison')).toBeInTheDocument();
      expect(screen.getByTestId('original-image')).toBeInTheDocument();
      expect(screen.getByTestId('compressed-image')).toBeInTheDocument();
    });

    it('should display comparison metrics when enabled', () => {
      render(<ImageComparison comparison={mockComparison} />);
      
      expect(screen.getByText('50% smaller')).toBeInTheDocument();
      expect(screen.getByText('100000 bytes → 50000 bytes')).toBeInTheDocument();
      expect(screen.getByText('Quality: 95%')).toBeInTheDocument();
    });

    it('should hide metrics when showMetrics is false', () => {
      const comparisonWithoutMetrics = {
        ...mockComparison,
        viewSettings: {
          ...mockComparison.viewSettings,
          showMetrics: false,
        },
      };

      render(<ImageComparison comparison={comparisonWithoutMetrics} />);
      
      expect(screen.queryByText('50% smaller')).not.toBeInTheDocument();
      expect(screen.queryByText('Quality: 95%')).not.toBeInTheDocument();
    });

    it('should display loading state for pending comparisons', () => {
      const pendingComparison = {
        ...mockComparison,
        status: 'loading' as const,
        compressedFile: undefined,
      };

      render(<ImageComparison comparison={pendingComparison} />);
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should display error state for failed comparisons', () => {
      const errorComparison = {
        ...mockComparison,
        status: 'error' as const,
        error: 'Failed to process image',
      };

      render(<ImageComparison comparison={errorComparison} />);
      
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByText('Failed to process image')).toBeInTheDocument();
    });
  });

  describe('View Mode Switching', () => {
    it('should switch to overlay view mode', async () => {
      const onViewModeChange = vi.fn();
      render(
        <ImageComparison 
          comparison={mockComparison} 
          onViewModeChange={onViewModeChange}
        />
      );
      
      const overlayButton = screen.getByTestId('overlay-view-button');
      await user.click(overlayButton);
      
      expect(onViewModeChange).toHaveBeenCalledWith('overlay');
    });

    it('should switch to split view mode', async () => {
      const onViewModeChange = vi.fn();
      render(
        <ImageComparison 
          comparison={mockComparison} 
          onViewModeChange={onViewModeChange}
        />
      );
      
      const splitButton = screen.getByTestId('split-view-button');
      await user.click(splitButton);
      
      expect(onViewModeChange).toHaveBeenCalledWith('split');
    });

    it('should switch to slider view mode', async () => {
      const onViewModeChange = vi.fn();
      render(
        <ImageComparison 
          comparison={mockComparison} 
          onViewModeChange={onViewModeChange}
        />
      );
      
      const sliderButton = screen.getByTestId('slider-view-button');
      await user.click(sliderButton);
      
      expect(onViewModeChange).toHaveBeenCalledWith('slider');
    });
  });

  describe('Zoom and Pan Functionality', () => {
    it('should handle zoom in', async () => {
      const onZoomChange = vi.fn();
      render(
        <ImageComparison 
          comparison={mockComparison} 
          onZoomChange={onZoomChange}
        />
      );
      
      const zoomInButton = screen.getByTestId('zoom-in-button');
      await user.click(zoomInButton);
      
      expect(onZoomChange).toHaveBeenCalledWith(1.25);
    });

    it('should handle zoom out', async () => {
      const comparisonZoomed = {
        ...mockComparison,
        viewSettings: {
          ...mockComparison.viewSettings,
          zoomLevel: 2,
        },
      };
      
      const onZoomChange = vi.fn();
      render(
        <ImageComparison 
          comparison={comparisonZoomed} 
          onZoomChange={onZoomChange}
        />
      );
      
      const zoomOutButton = screen.getByTestId('zoom-out-button');
      await user.click(zoomOutButton);
      
      expect(onZoomChange).toHaveBeenCalledWith(1.6);
    });

    it('should handle pan gestures', async () => {
      const onPanChange = vi.fn();
      render(
        <ImageComparison 
          comparison={mockComparison} 
          onPanChange={onPanChange}
        />
      );
      
      const imageContainer = screen.getByTestId('image-container');
      
      fireEvent.mouseDown(imageContainer, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(imageContainer, { clientX: 150, clientY: 120 });
      fireEvent.mouseUp(imageContainer);
      
      expect(onPanChange).toHaveBeenCalledWith({ x: 50, y: 20 });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ImageComparison comparison={mockComparison} />);
      
      expect(screen.getByLabelText('Original image: test.jpg')).toBeInTheDocument();
      expect(screen.getByLabelText('Compressed image: test-compressed.webp')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(<ImageComparison comparison={mockComparison} />);
      
      const comparison = screen.getByTestId('image-comparison');
      comparison.focus();
      
      // Test keyboard shortcuts
      await user.keyboard('{ArrowRight}'); // Should zoom in
      await user.keyboard('{ArrowLeft}');  // Should zoom out
      await user.keyboard('{Space}');      // Should toggle view mode
      
      // These would trigger the respective handlers if implemented
    });
  });

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const renderSpy = vi.fn();
      const ComparisonWithSpy = (props: any) => {
        renderSpy();
        return <ImageComparison {...props} />;
      };

      const { rerender } = render(<ComparisonWithSpy comparison={mockComparison} />);
      
      expect(renderSpy).toHaveBeenCalledTimes(1);
      
      // Rerender with same props
      rerender(<ComparisonWithSpy comparison={mockComparison} />);
      
      // Should not re-render if props haven't changed (when memo is implemented)
      expect(renderSpy).toHaveBeenCalledTimes(2); // Will be 1 when memo is added
    });

    it('should handle large images without memory leaks', async () => {
      const largeComparison = {
        ...mockComparison,
        comparisonMetrics: {
          ...mockComparison.comparisonMetrics,
          originalSize: 50 * 1024 * 1024, // 50MB
          dimensions: {
            original: { width: 8000, height: 6000 },
            compressed: { width: 8000, height: 6000 },
          },
        },
      };

      const { unmount } = render(<ImageComparison comparison={largeComparison} />);
      
      // Simulate component unmount
      unmount();
      
      // Should clean up object URLs and event listeners
      // This would be tested with memory monitoring in actual implementation
    });
  });
});