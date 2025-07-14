import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FilePreviewItem } from './FilePreviewItem';
import type { ImageFile } from '@/types';

// Mock image utils
vi.mock('@/lib/image-utils', () => ({
  generateThumbnail: vi.fn(() => Promise.resolve('data:image/jpeg;base64,test-thumbnail')),
  getImageDimensions: vi.fn(() => Promise.resolve({ width: 800, height: 600 })),
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(' ')),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
}));

describe('FilePreviewItem', () => {
  const user = userEvent.setup();
  const mockOnRemoveFile = vi.fn();
  const mockOnKeyDown = vi.fn();

  const createMockImageFile = (
    id: string,
    name: string,
    size: number,
    status: ImageFile['status'] = 'pending'
  ): ImageFile => ({
    id,
    file: new File(['mock content'], name, { type: 'image/jpeg' }),
    name,
    size,
    type: 'image/jpeg',
    status,
    progress: status === 'processing' ? 50 : status === 'completed' ? 100 : 0,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  describe('Rendering', () => {
    it('should render file info correctly', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      expect(screen.getByText('test.jpg')).toBeInTheDocument();
      expect(screen.getByText('1024 bytes')).toBeInTheDocument();
      expect(screen.getByText('jpeg')).toBeInTheDocument();
    });

    it('should show placeholder when not visible', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      const thumbnail = screen.getByTestId('file-thumbnail-1');
      expect(thumbnail).toHaveAttribute('data-lazy', 'true');
      
      // Should show placeholder SVG icon instead of actual image
      expect(thumbnail.querySelector('svg')).toBeInTheDocument();
      expect(screen.queryByAltText(/preview of/i)).not.toBeInTheDocument();
    });
  });

  describe('Thumbnail Generation', () => {
    it('should generate thumbnail when visible', async () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={true}
        />
      );

      // Should show loading state initially
      expect(screen.getByTestId('file-thumbnail-1')).toBeInTheDocument();

      // Wait for thumbnail to load
      await waitFor(() => {
        expect(screen.getByAltText('Preview of test.jpg')).toBeInTheDocument();
      });
    });

    it('should show error state when thumbnail generation fails', async () => {
      // Mock generateThumbnail to reject
      const { generateThumbnail } = await import('@/lib/image-utils');
      vi.mocked(generateThumbnail).mockRejectedValueOnce(new Error('Generation failed'));

      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={true}
        />
      );

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Error loading')).toBeInTheDocument();
      });
    });

    it('should show loading spinner during thumbnail generation', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={true}
        />
      );

      // Should show loading spinner
      expect(screen.getByTestId('file-thumbnail-1')).toBeInTheDocument();
    });
  });

  describe('Status Indicators', () => {
    it('should show processing status with progress bar', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024, 'processing');

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByLabelText('Processing test.jpg')).toBeInTheDocument();
    });

    it('should show completed status', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024, 'completed');

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      expect(screen.getByTestId('file-status-completed')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    it('should show error status with error message', () => {
      const file = {
        ...createMockImageFile('1', 'test.jpg', 1024, 'error'),
        error: 'Processing failed',
      };

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      expect(screen.getByTestId('file-status-error')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
      expect(screen.getByText('Processing failed')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('should call onRemoveFile when remove button is clicked', async () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      const removeButton = screen.getByRole('button', { name: /remove test.jpg/i });
      await user.click(removeButton);

      expect(mockOnRemoveFile).toHaveBeenCalledWith('1');
    });

    it('should call onKeyDown when key is pressed', async () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          onKeyDown={mockOnKeyDown}
          isVisible={false}
        />
      );

      const item = screen.getByTestId('file-preview-item-1');
      fireEvent.keyDown(item, { key: 'Delete' });

      expect(mockOnKeyDown).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'Delete' }),
        '1'
      );
    });

    it('should be focusable', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      const item = screen.getByTestId('file-preview-item-1');
      item.focus();
      expect(item).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      expect(screen.getByRole('button', { name: /remove test.jpg/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/select test.jpg/i)).toBeInTheDocument();
    });

    it('should have proper tabIndex for keyboard navigation', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      const item = screen.getByTestId('file-preview-item-1');
      expect(item).toHaveAttribute('tabIndex', '0');
    });

    it('should show remove button on focus', async () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      const removeButton = screen.getByRole('button', { name: /remove test.jpg/i });
      removeButton.focus();

      expect(removeButton).toHaveClass('focus:opacity-100');
    });
  });

  describe('Selection Feature', () => {
    it('should render selection checkbox', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      expect(screen.getByLabelText(/select test.jpg/i)).toBeInTheDocument();
    });

    it('should show selection checkbox on hover', () => {
      const file = createMockImageFile('1', 'test.jpg', 1024);

      render(
        <FilePreviewItem
          file={file}
          onRemoveFile={mockOnRemoveFile}
          isVisible={false}
        />
      );

      const checkbox = screen.getByLabelText(/select test.jpg/i);
      expect(checkbox.parentElement).toHaveClass('group-hover:opacity-100');
    });
  });
});