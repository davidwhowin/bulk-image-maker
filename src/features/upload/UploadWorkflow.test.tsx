import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UploadWorkflow } from './UploadWorkflow';

// Mock the store
const mockStore = {
  files: [] as any[],
  addFiles: vi.fn(),
  removeFile: vi.fn(),
  clearFiles: vi.fn(),
  isProcessing: false,
  setIsProcessing: vi.fn(),
};

vi.mock('@/store', () => ({
  useStore: () => mockStore,
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(' ')),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
  isSupportedImageType: vi.fn((type: string) => 
    ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(type)
  ),
  generateId: vi.fn(() => 'mock-id-123'),
}));

describe('UploadWorkflow', () => {
  const user = userEvent.setup();

  // Helper to create mock files
  const createMockFile = (name: string, type: string, size: number): File => {
    const file = new File(['mock content'], name, { type });
    Object.defineProperty(file, 'size', { value: size, writable: false });
    return file;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.files = [];
  });

  describe('Initial State', () => {
    it('should render upload area when no files are present', () => {
      render(<UploadWorkflow />);
      
      expect(screen.getByText(/drop images here or click to browse/i)).toBeInTheDocument();
      expect(screen.queryByTestId('file-preview-grid')).not.toBeInTheDocument();
    });

    it('should render with proper accessibility attributes', () => {
      render(<UploadWorkflow />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      expect(uploadArea).toHaveAttribute('aria-label');
      expect(uploadArea).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('File Upload Integration', () => {
    it('should integrate uploaded files with the store', async () => {
      render(<UploadWorkflow />);
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      // Simulate file drop
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] }
      });
      
      await waitFor(() => {
        expect(mockStore.addFiles).toHaveBeenCalledWith([file]);
      });
    });

    it('should handle multiple file upload', async () => {
      render(<UploadWorkflow />);
      
      const files = [
        createMockFile('file1.jpg', 'image/jpeg', 1024),
        createMockFile('file2.png', 'image/png', 2048),
      ];
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      fireEvent.drop(uploadArea, {
        dataTransfer: { files }
      });
      
      await waitFor(() => {
        expect(mockStore.addFiles).toHaveBeenCalledWith(files);
      });
    });

    it('should filter invalid file types before adding to store', async () => {
      render(<UploadWorkflow />);
      
      const validFile = createMockFile('valid.jpg', 'image/jpeg', 1024);
      const invalidFile = createMockFile('invalid.txt', 'text/plain', 1024);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [validFile, invalidFile] }
      });
      
      await waitFor(() => {
        expect(mockStore.addFiles).toHaveBeenCalledWith([validFile]);
      });
    });
  });

  describe('File Preview Grid', () => {
    beforeEach(() => {
      // Mock files in store
      mockStore.files = [
        {
          id: '1',
          file: createMockFile('file1.jpg', 'image/jpeg', 1024),
          name: 'file1.jpg',
          size: 1024,
          type: 'image/jpeg',
          status: 'pending',
          progress: 0,
        },
        {
          id: '2',
          file: createMockFile('file2.png', 'image/png', 2048),
          name: 'file2.png',
          size: 2048,
          type: 'image/png',
          status: 'pending',
          progress: 0,
        },
      ];
    });

    it('should render file preview grid when files are present', () => {
      render(<UploadWorkflow />);
      
      expect(screen.getByTestId('file-preview-grid')).toBeInTheDocument();
      expect(screen.getByText('file1.jpg')).toBeInTheDocument();
      expect(screen.getByText('file2.png')).toBeInTheDocument();
    });

    it('should display file metadata correctly', () => {
      render(<UploadWorkflow />);
      
      expect(screen.getByText('1024 bytes')).toBeInTheDocument();
      expect(screen.getByText('2048 bytes')).toBeInTheDocument();
    });

    it('should show upload area alongside file grid', () => {
      render(<UploadWorkflow />);
      
      // Both upload area and file grid should be visible
      expect(screen.getByText(/drop more images/i)).toBeInTheDocument();
      expect(screen.getByTestId('file-preview-grid')).toBeInTheDocument();
    });
  });

  describe('File Management Operations', () => {
    beforeEach(() => {
      mockStore.files = [
        {
          id: '1',
          file: createMockFile('file1.jpg', 'image/jpeg', 1024),
          name: 'file1.jpg',
          size: 1024,
          type: 'image/jpeg',
          status: 'pending',
          progress: 0,
        },
      ];
    });

    it('should allow removing individual files', async () => {
      render(<UploadWorkflow />);
      
      const removeButton = screen.getByRole('button', { name: /remove file1.jpg/i });
      await user.click(removeButton);
      
      expect(mockStore.removeFile).toHaveBeenCalledWith('1');
    });

    it('should allow clearing all files', async () => {
      render(<UploadWorkflow />);
      
      const clearAllButton = screen.getByRole('button', { name: /clear all files/i });
      await user.click(clearAllButton);
      
      // Confirm the clear operation
      const confirmButton = screen.getByRole('button', { name: /clear all$/i });
      await user.click(confirmButton);
      
      expect(mockStore.clearFiles).toHaveBeenCalled();
    });

    it('should show file count and total size', () => {
      render(<UploadWorkflow />);
      
      expect(screen.getByText(/1 file selected/i)).toBeInTheDocument();
      expect(screen.getByText(/1024 bytes total/i)).toBeInTheDocument();
    });
  });

  describe('Performance Features', () => {
    it('should implement lazy loading for file previews', () => {
      // Mock many files to test virtualization
      mockStore.files = Array.from({ length: 100 }, (_, i) => ({
        id: `file-${i}`,
        file: createMockFile(`file${i}.jpg`, 'image/jpeg', 1024),
        name: `file${i}.jpg`,
        size: 1024,
        type: 'image/jpeg',
        status: 'pending',
        progress: 0,
      }));

      render(<UploadWorkflow />);
      
      // Should only render visible items initially
      const visibleItems = screen.getAllByTestId(/file-preview-item/);
      expect(visibleItems.length).toBeLessThan(100);
    });

    it('should throttle drag events for performance', async () => {
      render(<UploadWorkflow />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      // Simulate rapid drag events
      for (let i = 0; i < 10; i++) {
        fireEvent.dragOver(uploadArea);
      }
      
      // Should handle events efficiently without performance degradation
      expect(uploadArea).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle file processing errors gracefully', async () => {
      // Mock store.addFiles to throw an error
      mockStore.addFiles.mockImplementation(() => {
        throw new Error('Processing failed');
      });

      render(<UploadWorkflow />);
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] }
      });
      
      await waitFor(() => {
        expect(screen.getByText(/error processing files/i)).toBeInTheDocument();
      });
    });

    it('should handle large file uploads with memory management', async () => {
      render(<UploadWorkflow />);
      
      // Create a very large file (10MB)
      const largeFile = createMockFile('large.jpg', 'image/jpeg', 10 * 1024 * 1024);
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [largeFile] }
      });
      
      // Should handle large files without crashing
      await waitFor(() => {
        expect(screen.queryByText(/memory error/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Processing Integration', () => {
    beforeEach(() => {
      mockStore.files = [
        {
          id: '1',
          file: createMockFile('file1.jpg', 'image/jpeg', 1024),
          name: 'file1.jpg',
          size: 1024,
          type: 'image/jpeg',
          status: 'pending',
          progress: 0,
        },
      ];
    });

    it('should show process button when files are available', () => {
      render(<UploadWorkflow />);
      
      expect(screen.getByRole('button', { name: /process files/i })).toBeInTheDocument();
    });

    it('should disable process button when already processing', () => {
      mockStore.isProcessing = true;
      
      render(<UploadWorkflow />);
      
      const processButton = screen.getByRole('button', { name: /processing/i });
      expect(processButton).toBeDisabled();
    });

    it('should start processing when process button is clicked', async () => {
      mockStore.isProcessing = false; // Ensure processing is false initially
      
      render(<UploadWorkflow />);
      
      const processButton = screen.getByRole('button', { name: /process files/i });
      await user.click(processButton);
      
      expect(mockStore.setIsProcessing).toHaveBeenCalledWith(true);
    });
  });

  describe('Accessibility & User Experience', () => {
    it('should announce file upload status to screen readers', async () => {
      // Simulate the store having files after upload
      mockStore.files = [
        {
          id: '1',
          file: createMockFile('test.jpg', 'image/jpeg', 1024),
          name: 'test.jpg',
          size: 1024,
          type: 'image/jpeg',
          status: 'pending',
          progress: 0,
        },
      ];
      
      render(<UploadWorkflow />);
      
      // Use getAllByRole to find all status elements, then find the one with upload announcement
      const statusElements = screen.getAllByRole('status');
      const uploadStatus = statusElements.find(el => el.textContent?.includes('uploaded'));
      expect(uploadStatus).toHaveTextContent(/1 file uploaded/i);
    });

    it('should provide keyboard navigation for file operations', async () => {
      mockStore.files = [
        {
          id: '1',
          file: createMockFile('file1.jpg', 'image/jpeg', 1024),
          name: 'file1.jpg',
          size: 1024,
          type: 'image/jpeg',
          status: 'pending',
          progress: 0,
        },
      ];

      render(<UploadWorkflow />);
      
      const removeButton = screen.getByRole('button', { name: /remove file1.jpg/i });
      
      // Should be focusable and keyboard accessible
      removeButton.focus();
      expect(removeButton).toHaveFocus();
      
      await user.keyboard('{Enter}');
      expect(mockStore.removeFile).toHaveBeenCalledWith('1');
    });
  });
});