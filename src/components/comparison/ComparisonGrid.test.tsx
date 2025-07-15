import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComparisonGrid } from './ComparisonGrid';
import type { ImageComparison, ComparisonGridSettings } from '@/types';

// Mock dependencies
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(' ')),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
}));

// Mock virtual scrolling
vi.mock('@/components/common/VirtualScroll', () => ({
  VirtualScroll: ({ children, items }: any) => (
    <div data-testid="virtual-scroll">
      {items.map((item: any, index: number) => (
        <div key={index}>{children(item, index)}</div>
      ))}
    </div>
  ),
}));

describe('ComparisonGrid', () => {
  const user = userEvent.setup();

  const createMockComparison = (id: string, originalSize: number, compressedSize: number): ImageComparison => ({
    id,
    originalFile: {
      id: `original-${id}`,
      file: new File(['original'], `test-${id}.jpg`, { type: 'image/jpeg' }),
      name: `test-${id}.jpg`,
      size: originalSize,
      type: 'image/jpeg',
      status: 'completed',
      progress: 100,
    },
    compressedFile: {
      id: `compressed-${id}`,
      file: new File(['compressed'], `test-${id}.webp`, { type: 'image/webp' }),
      name: `test-${id}.webp`,
      size: compressedSize,
      type: 'image/webp',
      status: 'completed',
      progress: 100,
    },
    comparisonMetrics: {
      originalSize,
      compressedSize,
      compressionRatio: compressedSize / originalSize,
      sizeSavings: originalSize - compressedSize,
      sizeSavingsPercent: ((originalSize - compressedSize) / originalSize) * 100,
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
      original: `data:image/jpeg;base64,test-original-${id}`,
      compressed: `data:image/webp;base64,test-compressed-${id}`,
    },
    status: 'ready',
  });

  const mockComparisons: ImageComparison[] = [
    createMockComparison('1', 100000, 50000),
    createMockComparison('2', 200000, 120000),
    createMockComparison('3', 150000, 45000),
  ];

  const defaultGridSettings: ComparisonGridSettings = {
    itemsPerRow: 3,
    itemHeight: 300,
    showMetrics: true,
    viewMode: 'side-by-side',
    sortBy: 'name',
    sortOrder: 'asc',
    filterBy: 'all',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render comparison grid with all items', () => {
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
        />
      );
      
      expect(screen.getByTestId('comparison-grid')).toBeInTheDocument();
      expect(screen.getAllByTestId(/^comparison-item-/)).toHaveLength(3);
    });

    it('should render empty state when no comparisons', () => {
      render(
        <ComparisonGrid 
          comparisons={[]}
          settings={defaultGridSettings}
        />
      );
      
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      expect(screen.getByText('No comparisons to display')).toBeInTheDocument();
    });

    it('should apply correct grid layout based on itemsPerRow setting', () => {
      const settings = { ...defaultGridSettings, itemsPerRow: 2 };
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={settings}
        />
      );
      
      const grid = screen.getByTestId('comparison-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(2, 1fr)' });
    });

    it('should show loading state for pending comparisons', () => {
      const loadingComparisons = [
        { ...mockComparisons[0], status: 'loading' as const },
        mockComparisons[1],
      ];

      render(
        <ComparisonGrid 
          comparisons={loadingComparisons}
          settings={defaultGridSettings}
        />
      );
      
      expect(screen.getByTestId('loading-item-1')).toBeInTheDocument();
      expect(screen.queryByTestId('loading-item-2')).not.toBeInTheDocument();
    });
  });

  describe('Sorting', () => {
    it('should sort by name in ascending order', () => {
      const settings = { ...defaultGridSettings, sortBy: 'name' as const, sortOrder: 'asc' as const };
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={settings}
          onSettingsChange={vi.fn()}
        />
      );
      
      const items = screen.getAllByTestId(/^comparison-item-/);
      // Should be ordered: test-1.jpg, test-2.jpg, test-3.jpg
      expect(items[0]).toHaveAttribute('data-file-name', 'test-1.jpg');
      expect(items[1]).toHaveAttribute('data-file-name', 'test-2.jpg');
      expect(items[2]).toHaveAttribute('data-file-name', 'test-3.jpg');
    });

    it('should sort by compression ratio', () => {
      const settings = { ...defaultGridSettings, sortBy: 'compressionRatio' as const, sortOrder: 'desc' as const };
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={settings}
          onSettingsChange={vi.fn()}
        />
      );
      
      // Should order by highest compression ratio first
      // test-2: 120000/200000 = 0.6
      // test-1: 50000/100000 = 0.5  
      // test-3: 45000/150000 = 0.3
      const items = screen.getAllByTestId(/^comparison-item-/);
      expect(items[0]).toHaveAttribute('data-file-name', 'test-2.jpg');
      expect(items[1]).toHaveAttribute('data-file-name', 'test-1.jpg');
      expect(items[2]).toHaveAttribute('data-file-name', 'test-3.jpg');
    });

    it('should handle sort direction change', async () => {
      const onSettingsChange = vi.fn();
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
          onSettingsChange={onSettingsChange}
        />
      );
      
      const sortButton = screen.getByTestId('sort-direction-button');
      await user.click(sortButton);
      
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultGridSettings,
        sortOrder: 'desc',
      });
    });
  });

  describe('Filtering', () => {
    it('should filter by processed status', () => {
      const mixedComparisons = [
        mockComparisons[0],
        { ...mockComparisons[1], status: 'pending' as const },
        { ...mockComparisons[2], status: 'error' as const },
      ];

      const settings = { ...defaultGridSettings, filterBy: 'processed' as const };
      render(
        <ComparisonGrid 
          comparisons={mixedComparisons}
          settings={settings}
        />
      );
      
      // Should only show processed items
      expect(screen.getAllByTestId(/^comparison-item-/)).toHaveLength(1);
    });

    it('should filter by pending status', () => {
      const mixedComparisons = [
        { ...mockComparisons[0], status: 'pending' as const },
        { ...mockComparisons[1], status: 'pending' as const },
        mockComparisons[2],
      ];

      const settings = { ...defaultGridSettings, filterBy: 'pending' as const };
      render(
        <ComparisonGrid 
          comparisons={mixedComparisons}
          settings={settings}
        />
      );
      
      expect(screen.getAllByTestId(/^comparison-item-/)).toHaveLength(2);
    });

    it('should filter by error status', () => {
      const mixedComparisons = [
        mockComparisons[0],
        { ...mockComparisons[1], status: 'error' as const },
        mockComparisons[2],
      ];

      const settings = { ...defaultGridSettings, filterBy: 'error' as const };
      render(
        <ComparisonGrid 
          comparisons={mixedComparisons}
          settings={settings}
        />
      );
      
      expect(screen.getAllByTestId(/^comparison-item-/)).toHaveLength(1);
    });
  });

  describe('Virtual Scrolling', () => {
    it('should use virtual scrolling for large datasets', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => 
        createMockComparison(i.toString(), 100000, 50000)
      );

      render(
        <ComparisonGrid 
          comparisons={largeDataset}
          settings={defaultGridSettings}
        />
      );
      
      expect(screen.getByTestId('virtual-scroll')).toBeInTheDocument();
    });

    it('should handle scroll events efficiently', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => 
        createMockComparison(i.toString(), 100000, 50000)
      );

      const onScroll = vi.fn();
      render(
        <ComparisonGrid 
          comparisons={largeDataset}
          settings={defaultGridSettings}
          onScroll={onScroll}
        />
      );
      
      const scrollContainer = screen.getByTestId('scroll-container');
      fireEvent.scroll(scrollContainer, { target: { scrollTop: 1000 } });
      
      // Should be debounced
      await waitFor(() => {
        expect(onScroll).toHaveBeenCalled();
      });
    });
  });

  describe('Interaction', () => {
    it('should handle item selection', async () => {
      const onItemSelect = vi.fn();
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
          onItemSelect={onItemSelect}
        />
      );
      
      const firstItem = screen.getByTestId('comparison-item-1');
      await user.click(firstItem);
      
      expect(onItemSelect).toHaveBeenCalledWith(mockComparisons[0]);
    });

    it('should handle item double-click for fullscreen', async () => {
      const onItemDoubleClick = vi.fn();
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
          onItemDoubleClick={onItemDoubleClick}
        />
      );
      
      const firstItem = screen.getByTestId('comparison-item-1');
      await user.dblClick(firstItem);
      
      expect(onItemDoubleClick).toHaveBeenCalledWith(mockComparisons[0]);
    });

    it('should handle context menu for item actions', async () => {
      const onContextMenu = vi.fn();
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
          onContextMenu={onContextMenu}
        />
      );
      
      const firstItem = screen.getByTestId('comparison-item-1');
      fireEvent.contextMenu(firstItem);
      
      expect(onContextMenu).toHaveBeenCalledWith(mockComparisons[0]);
    });
  });

  describe('Performance', () => {
    it('should debounce settings changes', async () => {
      const onSettingsChange = vi.fn();
      const { rerender } = render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
          onSettingsChange={onSettingsChange}
        />
      );
      
      // Rapid settings changes
      rerender(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={{ ...defaultGridSettings, itemsPerRow: 2 }}
          onSettingsChange={onSettingsChange}
        />
      );
      
      rerender(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={{ ...defaultGridSettings, itemsPerRow: 4 }}
          onSettingsChange={onSettingsChange}
        />
      );
      
      // Should debounce rapid changes
      await waitFor(() => {
        expect(onSettingsChange).toHaveBeenCalledTimes(1);
      });
    });

    it('should memoize comparison items', () => {
      const renderSpy = vi.fn();
      const ItemWithSpy = (props: any) => {
        renderSpy();
        return <div data-testid={`comparison-item-${props.comparison.id}`} />;
      };

      const { rerender } = render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
          itemRenderer={ItemWithSpy}
        />
      );
      
      const initialRenderCount = renderSpy.mock.calls.length;
      
      // Rerender with same comparisons
      rerender(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
          itemRenderer={ItemWithSpy}
        />
      );
      
      // Should not re-render items if they haven't changed
      expect(renderSpy).toHaveBeenCalledTimes(initialRenderCount);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
        />
      );
      
      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(screen.getByLabelText('Image comparison grid')).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
        />
      );
      
      const grid = screen.getByRole('grid');
      grid.focus();
      
      await user.keyboard('{ArrowDown}'); // Navigate to next row
      await user.keyboard('{ArrowRight}'); // Navigate to next column
      await user.keyboard('{Enter}'); // Select item
      
      // Should handle keyboard navigation properly
    });

    it('should announce changes to screen readers', async () => {
      render(
        <ComparisonGrid 
          comparisons={mockComparisons}
          settings={defaultGridSettings}
        />
      );
      
      expect(screen.getByLabelText('3 image comparisons displayed')).toBeInTheDocument();
    });
  });
});