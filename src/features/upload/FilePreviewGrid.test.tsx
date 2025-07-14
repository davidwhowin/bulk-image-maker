import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilePreviewGrid } from './FilePreviewGrid';
import type { ImageFile } from '@/types';

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(' ')),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
}));

// Mock intersection observer for lazy loading
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});

globalThis.IntersectionObserver = mockIntersectionObserver;

describe('FilePreviewGrid', () => {
  const user = userEvent.setup();
  const mockOnRemoveFile = vi.fn();
  const mockOnClearAll = vi.fn();

  const createMockImageFile = (id: string, name: string, size: number): ImageFile => ({
    id,
    file: new File(['mock'], name, { type: 'image/jpeg' }),
    name,
    size,
    type: 'image/jpeg',
    status: 'pending',
    progress: 0,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render empty state when no files provided', () => {
      render(
        <FilePreviewGrid 
          files={[]} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByText(/no files uploaded/i)).toBeInTheDocument();
    });

    it('should render file grid when files are provided', () => {
      const files = [
        createMockImageFile('1', 'file1.jpg', 1024),
        createMockImageFile('2', 'file2.png', 2048),
      ];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByTestId('file-preview-grid')).toBeInTheDocument();
      expect(screen.getByText('file1.jpg')).toBeInTheDocument();
      expect(screen.getByText('file2.png')).toBeInTheDocument();
    });

    it('should display file metadata correctly', () => {
      const files = [createMockImageFile('1', 'test.jpg', 1024)];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByText('test.jpg')).toBeInTheDocument();
      expect(screen.getByText('1024 bytes')).toBeInTheDocument();
    });
  });

  describe('File Operations', () => {
    const files = [
      createMockImageFile('1', 'file1.jpg', 1024),
      createMockImageFile('2', 'file2.jpg', 2048),
    ];

    it('should call onRemoveFile when remove button is clicked', async () => {
      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      const removeButton = screen.getByRole('button', { name: /remove file1.jpg/i });
      await user.click(removeButton);
      
      expect(mockOnRemoveFile).toHaveBeenCalledWith('1');
    });

    it('should call onClearAll when clear all button is clicked', async () => {
      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      const clearAllButton = screen.getByRole('button', { name: /clear all files/i });
      await user.click(clearAllButton);
      
      // Confirm the clear operation
      const confirmButton = screen.getByRole('button', { name: /clear all$/i });
      await user.click(confirmButton);
      
      expect(mockOnClearAll).toHaveBeenCalled();
    });

    it('should show confirmation dialog for clear all operation', async () => {
      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      const clearAllButton = screen.getByRole('button', { name: /clear all files/i });
      await user.click(clearAllButton);
      
      expect(screen.getByText(/are you sure you want to clear all files/i)).toBeInTheDocument();
    });
  });

  describe('File Status Display', () => {
    it('should show processing status for files being processed', () => {
      const files = [
        { ...createMockImageFile('1', 'processing.jpg', 1024), status: 'processing' as const, progress: 50 },
      ];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should show completed status for processed files', () => {
      const files = [
        { ...createMockImageFile('1', 'completed.jpg', 1024), status: 'completed' as const, progress: 100 },
      ];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByTestId('file-status-completed')).toBeInTheDocument();
    });

    it('should show error status for failed files', () => {
      const files = [
        { 
          ...createMockImageFile('1', 'error.jpg', 1024), 
          status: 'error' as const, 
          error: 'Processing failed' 
        },
      ];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByTestId('file-status-error')).toBeInTheDocument();
      expect(screen.getByText(/processing failed/i)).toBeInTheDocument();
    });
  });

  describe('Performance Features', () => {
    it('should implement virtual scrolling for large file lists', () => {
      const manyFiles = Array.from({ length: 100 }, (_, i) => 
        createMockImageFile(`file-${i}`, `file${i}.jpg`, 1024)
      );

      render(
        <FilePreviewGrid 
          files={manyFiles} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      // Should only render visible items initially (not all 100)
      const visibleItems = screen.getAllByTestId(/file-preview-item-/);
      expect(visibleItems.length).toBeLessThan(100);
      expect(visibleItems.length).toBeGreaterThan(0);
    });

    it('should implement lazy loading for file thumbnails', () => {
      const files = [createMockImageFile('1', 'test.jpg', 1024)];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      // Should set up intersection observer for lazy loading
      expect(mockIntersectionObserver).toHaveBeenCalled();
    });

    it('should load thumbnails only when in viewport', () => {
      const files = [createMockImageFile('1', 'test.jpg', 1024)];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      const thumbnailElement = screen.getByTestId('file-thumbnail-1');
      
      // Initially should show placeholder
      expect(thumbnailElement).toHaveAttribute('data-lazy', 'true');
    });
  });

  describe('Grid Layout and Responsiveness', () => {
    it('should apply responsive grid classes', () => {
      const files = [createMockImageFile('1', 'test.jpg', 1024)];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      const grid = screen.getByTestId('file-preview-grid');
      expect(grid).toHaveClass('grid');
    });

    it('should handle different viewport sizes', () => {
      const files = Array.from({ length: 20 }, (_, i) => 
        createMockImageFile(`file-${i}`, `file${i}.jpg`, 1024)
      );

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      // Grid should adapt to viewport size
      const grid = screen.getByTestId('file-preview-grid');
      expect(grid).toHaveClass(/grid-cols-/);
    });
  });

  describe('Accessibility', () => {
    const files = [createMockImageFile('1', 'test.jpg', 1024)];

    it('should provide proper ARIA labels for file operations', () => {
      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      const removeButton = screen.getByRole('button', { name: /remove test.jpg/i });
      expect(removeButton).toHaveAttribute('aria-label');
    });

    it('should announce file count changes to screen readers', () => {
      const { rerender } = render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByRole('status')).toHaveTextContent(/1 file/i);
      
      rerender(
        <FilePreviewGrid 
          files={[]} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByRole('status')).toHaveTextContent(/no files/i);
    });

    it('should provide keyboard navigation for file grid', async () => {
      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      const fileItem = screen.getByTestId('file-preview-item-1');
      
      // Should be focusable
      fileItem.focus();
      expect(fileItem).toHaveFocus();
      
      // Should support keyboard navigation
      fireEvent.keyDown(fileItem, { key: 'Delete' });
      expect(mockOnRemoveFile).toHaveBeenCalledWith('1');
    });
  });

  describe('File Summary and Statistics', () => {
    it('should display total file count and size', () => {
      const files = [
        createMockImageFile('1', 'file1.jpg', 1024),
        createMockImageFile('2', 'file2.jpg', 2048),
      ];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByText(/2 files selected/i)).toBeInTheDocument();
      expect(screen.getByText(/3072 bytes total/i)).toBeInTheDocument();
    });

    it('should show processing progress summary', () => {
      const files = [
        createMockImageFile('1', 'file1.jpg', 1024),
        { ...createMockImageFile('2', 'file2.jpg', 2048), status: 'completed' as const },
        { ...createMockImageFile('3', 'file3.jpg', 1024), status: 'processing' as const },
      ];

      render(
        <FilePreviewGrid 
          files={files} 
          onRemoveFile={mockOnRemoveFile}
          onClearAll={mockOnClearAll}
        />
      );
      
      expect(screen.getByText(/1 pending/i)).toBeInTheDocument();
      expect(screen.getByText(/1 completed/i)).toBeInTheDocument();
      expect(screen.getByText(/1 processing/i)).toBeInTheDocument();
    });
  });
});