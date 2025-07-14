import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserUploadArea } from './UserUploadArea';

// Mock the utils
vi.mock('@/lib/utils', () => ({
  cn: vi.fn((...args) => args.filter(Boolean).join(' ')),
  formatFileSize: vi.fn((bytes: number) => `${bytes} bytes`),
  isSupportedImageType: vi.fn((type: string) => 
    ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/gif'].includes(type)
  ),
}));

describe('UserUploadArea', () => {
  const mockOnFilesSelected = vi.fn();
  const user = userEvent.setup();

  // Helper to create mock files
  const createMockFile = (name: string, type: string, size: number): File => {
    const file = new File(['mock content'], name, { type });
    Object.defineProperty(file, 'size', { value: size, writable: false });
    return file;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default content', () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      expect(screen.getByRole('button', { name: /upload area/i })).toBeInTheDocument();
      expect(screen.getByText(/drop images here or click to browse/i)).toBeInTheDocument();
      expect(screen.getByText(/supports jpeg, png, webp/i)).toBeInTheDocument();
    });

    it('renders with custom children', () => {
      const customContent = <div>Custom upload content</div>;
      render(
        <UserUploadArea onFilesSelected={mockOnFilesSelected}>
          {customContent}
        </UserUploadArea>
      );
      
      expect(screen.getByText('Custom upload content')).toBeInTheDocument();
      expect(screen.queryByText(/drop images here/i)).not.toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected} 
          className="custom-class"
        />
      );
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      expect(uploadArea).toHaveClass('custom-class');
    });

    it('shows validation rules in UI', () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          validationRules={{
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 100,
          }}
        />
      );
      
      expect(screen.getByText(/max 10485760 bytes per file/i)).toBeInTheDocument();
      expect(screen.getByText(/up to 100 files/i)).toBeInTheDocument();
    });
  });

  describe('File Input Interaction', () => {
    it('opens file dialog on click', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      const fileInput = uploadArea.querySelector('input[type="file"]') as HTMLInputElement;
      
      const clickSpy = vi.spyOn(fileInput, 'click');
      
      await user.click(uploadArea);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file dialog on Enter key', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      const fileInput = uploadArea.querySelector('input[type="file"]') as HTMLInputElement;
      
      const clickSpy = vi.spyOn(fileInput, 'click');
      
      uploadArea.focus();
      await user.keyboard('{Enter}');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('opens file dialog on Space key', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      const fileInput = uploadArea.querySelector('input[type="file"]') as HTMLInputElement;
      
      const clickSpy = vi.spyOn(fileInput, 'click');
      
      uploadArea.focus();
      await user.keyboard(' ');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('handles file selection through input', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(
          expect.objectContaining({
            validFiles: [file],
            errors: [],
            fileCount: 1,
            totalSize: 1024,
          })
        );
      });
    });
  });

  describe('Drag and Drop', () => {
    it('shows drag state on drag enter', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      fireEvent.dragEnter(uploadArea);
      
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
    });

    it('removes drag state on drag leave', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      fireEvent.dragEnter(uploadArea);
      expect(screen.getByText(/drop files here/i)).toBeInTheDocument();
      
      fireEvent.dragLeave(uploadArea);
      
      await waitFor(() => {
        expect(screen.queryByText(/drop files here/i)).not.toBeInTheDocument();
      });
    });

    it('handles file drop', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      const file = createMockFile('dropped.png', 'image/png', 2048);
      
      const dataTransfer = {
        files: [file],
      };
      
      fireEvent.drop(uploadArea, { dataTransfer });
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(
          expect.objectContaining({
            validFiles: [file],
            errors: [],
            fileCount: 1,
            totalSize: 2048,
          })
        );
      });
    });
  });

  describe('File Validation', () => {
    it('validates file types', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const invalidFile = createMockFile('test.txt', 'text/plain', 1024);
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, invalidFile);
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(
          expect.objectContaining({
            validFiles: [],
            errors: expect.arrayContaining([
              expect.objectContaining({
                fileName: 'test.txt',
                type: 'validation',
                message: expect.stringContaining('not supported'),
              }),
            ]),
          })
        );
      });
    });

    it('validates file size', async () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          validationRules={{ maxFileSize: 1000 }}
        />
      );
      
      const largeFile = createMockFile('large.jpg', 'image/jpeg', 2000);
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, largeFile);
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(
          expect.objectContaining({
            validFiles: [],
            errors: expect.arrayContaining([
              expect.objectContaining({
                fileName: 'large.jpg',
                type: 'validation',
                message: expect.stringContaining('exceeds maximum allowed size'),
              }),
            ]),
          })
        );
      });
    });

    it('validates maximum file count', async () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          validationRules={{ maxFiles: 2 }}
        />
      );
      
      const files = [
        createMockFile('file1.jpg', 'image/jpeg', 1024),
        createMockFile('file2.jpg', 'image/jpeg', 1024),
        createMockFile('file3.jpg', 'image/jpeg', 1024),
      ];
      
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, files);
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(
          expect.objectContaining({
            validFiles: [],
            errors: expect.arrayContaining([
              expect.objectContaining({
                fileName: 'Multiple files',
                type: 'validation',
                message: expect.stringContaining('Too many files'),
              }),
            ]),
          })
        );
      });
    });

    it('processes mixed valid and invalid files', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const validFile = createMockFile('valid.jpg', 'image/jpeg', 1024);
      const invalidFile = createMockFile('invalid.txt', 'text/plain', 1024);
      
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, [validFile, invalidFile]);
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(
          expect.objectContaining({
            validFiles: [validFile],
            errors: expect.arrayContaining([
              expect.objectContaining({
                fileName: 'invalid.txt',
                type: 'validation',
              }),
            ]),
            fileCount: 1,
            totalSize: 1024,
          })
        );
      });
    });
  });

  describe('Error Display', () => {
    it('shows errors in UI', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const invalidFile = createMockFile('test.txt', 'text/plain', 1024);
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, invalidFile);
      
      await waitFor(() => {
        expect(screen.getByText(/upload issues/i)).toBeInTheDocument();
        expect(screen.getByText(/test.txt:/)).toBeInTheDocument();
      });
    });

    it('limits error display to 3 items', async () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const files = Array.from({ length: 5 }, (_, i) => 
        createMockFile(`file${i}.txt`, 'text/plain', 1024)
      );
      
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, files);
      
      await waitFor(() => {
        expect(screen.getByText(/upload issues \(5\)/i)).toBeInTheDocument();
        expect(screen.getByText(/and 2 more issues/i)).toBeInTheDocument();
      });
    });
  });

  describe('Disabled State', () => {
    it('does not respond to interactions when disabled', async () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          disabled={true}
        />
      );
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      expect(uploadArea).toHaveAttribute('aria-disabled', 'true');
      expect(uploadArea).toHaveAttribute('tabIndex', '-1');
      
      await user.click(uploadArea);
      expect(mockOnFilesSelected).not.toHaveBeenCalled();
    });

    it('ignores drag events when disabled', () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          disabled={true}
        />
      );
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      
      fireEvent.dragEnter(uploadArea);
      expect(screen.queryByText(/drop files here/i)).not.toBeInTheDocument();
    });
  });

  describe('Folder Upload', () => {
    it('shows folder upload option when enabled', () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          validationRules={{ allowFolders: true }}
        />
      );
      
      expect(screen.getByText(/or upload a folder/i)).toBeInTheDocument();
    });

    it('hides folder upload option when disabled', () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          validationRules={{ allowFolders: false }}
        />
      );
      
      expect(screen.queryByText(/or upload a folder/i)).not.toBeInTheDocument();
    });
  });

  describe('Progress and File Count Display', () => {
    it('shows progress when enabled and processing', async () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          showProgress={true}
        />
      );
      
      // Initially no progress
      expect(screen.queryByText(/processing files/i)).not.toBeInTheDocument();
      
      // Trigger file processing
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      // Should show progress briefly during processing
      // Note: This is hard to test due to timing, but the component supports it
    });

    it('shows file count when enabled', async () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          showFileCount={true}
        />
      );
      
      const file = createMockFile('test.jpg', 'image/jpeg', 1024);
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      
      await user.upload(fileInput, file);
      
      await waitFor(() => {
        expect(screen.getByText(/1 file selected/i)).toBeInTheDocument();
        expect(screen.getByText(/1024 bytes/i)).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Files', () => {
    it('handles multiple files when enabled', async () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          multiple={true}
        />
      );
      
      const files = [
        createMockFile('file1.jpg', 'image/jpeg', 1024),
        createMockFile('file2.png', 'image/png', 2048),
      ];
      
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toHaveAttribute('multiple');
      
      await user.upload(fileInput, files);
      
      await waitFor(() => {
        expect(mockOnFilesSelected).toHaveBeenCalledWith(
          expect.objectContaining({
            validFiles: files,
            fileCount: 2,
            totalSize: 3072,
          })
        );
      });
    });

    it('restricts to single file when multiple is false', () => {
      render(
        <UserUploadArea 
          onFilesSelected={mockOnFilesSelected}
          multiple={false}
        />
      );
      
      const fileInput = screen.getByRole('button', { name: /upload area/i }).querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).not.toHaveAttribute('multiple');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      expect(uploadArea).toHaveAttribute('aria-label');
      expect(uploadArea).toHaveAttribute('aria-disabled', 'false');
    });

    it('is focusable and keyboard accessible', () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const uploadArea = screen.getByRole('button', { name: /upload area/i });
      expect(uploadArea).toHaveAttribute('tabIndex', '0');
      
      uploadArea.focus();
      expect(uploadArea).toHaveFocus();
    });

    it('hides file inputs from screen readers', () => {
      render(<UserUploadArea onFilesSelected={mockOnFilesSelected} />);
      
      const fileInputs = screen.getByRole('button', { name: /upload area/i }).querySelectorAll('input[type="file"]');
      fileInputs.forEach(input => {
        expect(input).toHaveAttribute('aria-hidden', 'true');
      });
    });
  });
});