import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormatConversionWorkflow } from './FormatConversionWorkflow';
import type { FormatConversionResult, BatchConversionProgress } from '@/types/format-conversion';

// Mock the format converter
const mockConverter = {
  convertBatch: vi.fn(),
  convertFormat: vi.fn(),
  estimateProcessingTime: vi.fn(),
  getOptimalBatchSize: vi.fn(),
};

const mockFormatSupport = {
  isFormatSupported: vi.fn(),
  getSupportedFormats: vi.fn(),
  getFallbackFormat: vi.fn(),
};

vi.mock('@/lib/format-converter', () => ({
  FormatConverter: vi.fn(() => mockConverter),
  BrowserFormatSupport: vi.fn(() => mockFormatSupport),
}));

describe('FormatConversionWorkflow', () => {
  const mockFiles = [
    new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
    new File(['photo2'], 'photo2.png', { type: 'image/png' }),
    new File(['photo3'], 'photo3.webp', { type: 'image/webp' }),
  ];

  const mockOnComplete = vi.fn();
  const mockOnProgress = vi.fn();
  const mockOnError = vi.fn();

  const defaultProps = {
    files: mockFiles,
    onComplete: mockOnComplete,
    onProgress: mockOnProgress,
    onError: mockOnError,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock responses
    mockFormatSupport.isFormatSupported.mockReturnValue(true);
    mockFormatSupport.getSupportedFormats.mockReturnValue({
      jpeg: true,
      png: true,
      webp: true,
      avif: false,
    });
    mockFormatSupport.getFallbackFormat.mockImplementation((format: string) => format);
    
    mockConverter.estimateProcessingTime.mockReturnValue(1000);
    mockConverter.getOptimalBatchSize.mockReturnValue(10);
  });

  describe('initial state', () => {
    it('should render format selection interface', () => {
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      expect(screen.getByText(/format conversion/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/output format/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /start conversion/i })).toBeInTheDocument();
    });

    it('should show file list with current formats', () => {
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      expect(screen.getByText('photo1.jpg')).toBeInTheDocument();
      expect(screen.getByText('photo2.png')).toBeInTheDocument();
      expect(screen.getByText('photo3.webp')).toBeInTheDocument();
      
      expect(screen.getByText(/jpeg/i)).toBeInTheDocument();
      expect(screen.getByText(/png/i)).toBeInTheDocument();
      expect(screen.getByText(/webp/i)).toBeInTheDocument();
    });

    it('should display estimated processing time and file sizes', () => {
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      expect(screen.getByText(/estimated time/i)).toBeInTheDocument();
      expect(screen.getByText(/estimated size/i)).toBeInTheDocument();
    });

    it('should show browser compatibility warnings when needed', () => {
      mockFormatSupport.isFormatSupported.mockImplementation((format: string) => format !== 'avif');
      
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      fireEvent.change(dropdown, { target: { value: 'avif' } });
      
      expect(screen.getByText(/limited browser support/i)).toBeInTheDocument();
    });
  });

  describe('format selection', () => {
    it('should update output format for all files when uniform mode is enabled', async () => {
      const user = userEvent.setup();
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const uniformToggle = screen.getByLabelText(/same format for all/i);
      await user.click(uniformToggle);
      
      const dropdown = screen.getByRole('combobox');
      await user.selectOptions(dropdown, 'webp');
      
      // All files should show WebP as target format
      expect(screen.getAllByText(/→ webp/i)).toHaveLength(mockFiles.length);
    });

    it('should allow individual format selection when uniform mode is disabled', async () => {
      const user = userEvent.setup();
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const uniformToggle = screen.getByLabelText(/same format for all/i);
      await user.click(uniformToggle); // Enable uniform
      await user.click(uniformToggle); // Disable uniform
      
      // Should show individual dropdowns
      const dropdowns = screen.getAllByRole('combobox');
      expect(dropdowns.length).toBeGreaterThan(1);
    });

    it('should update quality settings when format changes', async () => {
      const user = userEvent.setup();
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      await user.selectOptions(dropdown, 'jpeg');
      
      // Should show quality slider
      expect(screen.getByRole('slider')).toBeInTheDocument();
      expect(screen.getByDisplayValue('85')).toBeInTheDocument(); // JPEG optimal quality
    });

    it('should hide quality slider for lossless formats', async () => {
      const user = userEvent.setup();
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      await user.selectOptions(dropdown, 'png');
      
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });
  });

  describe('conversion process', () => {
    it('should start conversion when button is clicked', async () => {
      const user = userEvent.setup();
      const mockResults: FormatConversionResult[] = mockFiles.map((file, index) => ({
        success: true,
        originalFormat: file.type.replace('image/', ''),
        outputFormat: 'webp' as const,
        outputBlob: new Blob(['converted'], { type: 'image/webp' }),
        originalSize: 1024 * (index + 1),
        outputSize: 512 * (index + 1),
        compressionRatio: 0.5,
        processingTime: 100,
      }));

      mockConverter.convertBatch.mockImplementation((files, options, onProgress) => {
        // Simulate progress updates
        setTimeout(() => onProgress?.({ 
          totalFiles: files.length, 
          completedFiles: 0, 
          currentFile: files[0].name,
          overallProgress: 0,
          currentFileProgress: 0,
        }), 0);
        
        setTimeout(() => onProgress?.({ 
          totalFiles: files.length, 
          completedFiles: files.length, 
          currentFile: '',
          overallProgress: 100,
          currentFileProgress: 100,
        }), 50);
        
        return Promise.resolve(mockResults);
      });

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      expect(mockConverter.convertBatch).toHaveBeenCalledWith(
        mockFiles,
        expect.objectContaining({
          outputFormat: expect.any(String),
          quality: expect.any(Number),
        }),
        expect.any(Function)
      );
    });

    it('should show progress during conversion', async () => {
      const user = userEvent.setup();
      let progressCallback: ((progress: BatchConversionProgress) => void) | undefined;

      mockConverter.convertBatch.mockImplementation((files, options, onProgress) => {
        progressCallback = onProgress;
        return new Promise(resolve => {
          setTimeout(() => {
            progressCallback?.({
              totalFiles: files.length,
              completedFiles: 1,
              currentFile: files[0].name,
              overallProgress: 33,
              currentFileProgress: 100,
            });
            resolve([]);
          }, 100);
        });
      });

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      expect(screen.getByText(/converting/i)).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('should call onProgress callback during conversion', async () => {
      const user = userEvent.setup();
      
      mockConverter.convertBatch.mockImplementation((files, options, onProgress) => {
        onProgress?.({
          totalFiles: files.length,
          completedFiles: 1,
          currentFile: files[0].name,
          overallProgress: 50,
          currentFileProgress: 100,
        });
        return Promise.resolve([]);
      });

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(mockOnProgress).toHaveBeenCalledWith(
          expect.objectContaining({
            overallProgress: 50,
            currentFile: 'photo1.jpg',
          })
        );
      });
    });

    it('should allow cancellation during conversion', async () => {
      const user = userEvent.setup();
      
      mockConverter.convertBatch.mockImplementation(() => {
        return new Promise(() => {}); // Never resolves, simulating long operation
      });

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toBeInTheDocument();
      
      await user.click(cancelButton);
      
      expect(screen.getByRole('button', { name: /start conversion/i })).toBeInTheDocument();
    });
  });

  describe('results display', () => {
    it('should show conversion results after completion', async () => {
      const user = userEvent.setup();
      const mockResults: FormatConversionResult[] = [
        {
          success: true,
          originalFormat: 'jpeg',
          outputFormat: 'webp',
          outputBlob: new Blob(['converted'], { type: 'image/webp' }),
          originalSize: 1024,
          outputSize: 512,
          compressionRatio: 0.5,
          processingTime: 100,
        },
      ];

      mockConverter.convertBatch.mockResolvedValue(mockResults);

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/conversion complete/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText(/50% size reduction/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });

    it('should show error messages for failed conversions', async () => {
      const user = userEvent.setup();
      const mockResults: FormatConversionResult[] = [
        {
          success: false,
          originalFormat: 'jpeg',
          outputFormat: 'webp',
          originalSize: 1024,
          processingTime: 50,
          error: 'Conversion failed: Unsupported format',
        },
      ];

      mockConverter.convertBatch.mockResolvedValue(mockResults);

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(screen.getByText(/conversion failed/i)).toBeInTheDocument();
      });
      
      expect(screen.getByText(/unsupported format/i)).toBeInTheDocument();
    });

    it('should call onComplete with results', async () => {
      const user = userEvent.setup();
      const mockResults: FormatConversionResult[] = [
        {
          success: true,
          originalFormat: 'jpeg',
          outputFormat: 'webp',
          outputBlob: new Blob(['converted'], { type: 'image/webp' }),
          originalSize: 1024,
          outputSize: 512,
          compressionRatio: 0.5,
          processingTime: 100,
        },
      ];

      mockConverter.convertBatch.mockResolvedValue(mockResults);

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(mockResults);
      });
    });
  });

  describe('error handling', () => {
    it('should handle conversion errors gracefully', async () => {
      const user = userEvent.setup();
      const error = new Error('Network error');
      
      mockConverter.convertBatch.mockRejectedValue(error);

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(error.message);
      });
      
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });

    it('should show warning for large batch sizes', () => {
      const largeFileList = Array.from({ length: 100 }, (_, i) => 
        new File([''], `photo${i}.jpg`, { type: 'image/jpeg' })
      );

      render(<FormatConversionWorkflow {...defaultProps} files={largeFileList} />);
      
      expect(screen.getByText(/large batch detected/i)).toBeInTheDocument();
      expect(screen.getByText(/consider processing in smaller chunks/i)).toBeInTheDocument();
    });

    it('should disable conversion for unsupported formats', () => {
      mockFormatSupport.isFormatSupported.mockReturnValue(false);
      
      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      expect(startButton).toBeDisabled();
      
      expect(screen.getByText(/format not supported/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should announce progress changes to screen readers', async () => {
      const user = userEvent.setup();
      
      mockConverter.convertBatch.mockImplementation((files, options, onProgress) => {
        onProgress?.({
          totalFiles: files.length,
          completedFiles: 1,
          currentFile: files[0].name,
          overallProgress: 50,
          currentFileProgress: 100,
        });
        return Promise.resolve([]);
      });

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
        expect(progressBar).toHaveAttribute('aria-valuetext', expect.stringContaining('50%'));
      });
    });

    it('should have proper focus management during conversion', async () => {
      const user = userEvent.setup();
      
      mockConverter.convertBatch.mockImplementation(() => {
        return new Promise(() => {}); // Never resolves
      });

      render(<FormatConversionWorkflow {...defaultProps} />);
      
      const startButton = screen.getByRole('button', { name: /start conversion/i });
      await user.click(startButton);
      
      // Focus should move to cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      expect(cancelButton).toHaveFocus();
    });
  });
});