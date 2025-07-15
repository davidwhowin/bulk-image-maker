import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormatSelector } from './FormatSelector';
import type { SupportedFormat, FormatSupport } from '@/types/format-conversion';

// Mock the format support detection
const mockFormatSupport: FormatSupport = {
  jpeg: true,
  png: true,
  webp: true,
  avif: false, // Simulate older browser
};

vi.mock('@/lib/format-converter', () => ({
  BrowserFormatSupport: vi.fn(() => ({
    getSupportedFormats: () => mockFormatSupport,
    isFormatSupported: (format: SupportedFormat) => mockFormatSupport[format],
    getFallbackFormat: (format: SupportedFormat) => format === 'avif' ? 'webp' : format,
  })),
}));

describe('FormatSelector', () => {
  const mockOnFormatChange = vi.fn();
  const mockOnQualityChange = vi.fn();

  const defaultProps = {
    selectedFormat: 'webp' as SupportedFormat,
    quality: 80,
    onFormatChange: mockOnFormatChange,
    onQualityChange: mockOnQualityChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render format selection dropdown', () => {
      render(<FormatSelector {...defaultProps} />);
      
      expect(screen.getByLabelText(/output format/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show supported formats only', () => {
      render(<FormatSelector {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      fireEvent.click(dropdown);

      expect(screen.getByText('JPEG')).toBeInTheDocument();
      expect(screen.getByText('PNG')).toBeInTheDocument();
      expect(screen.getByText('WebP')).toBeInTheDocument();
      
      // AVIF should be disabled or not shown since it's not supported
      const avifOption = screen.queryByText('AVIF');
      if (avifOption) {
        expect(avifOption).toHaveAttribute('aria-disabled', 'true');
      }
    });

    it('should display quality slider for lossy formats', () => {
      render(<FormatSelector {...defaultProps} selectedFormat="jpeg" />);
      
      expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('should hide quality slider for lossless formats', () => {
      render(<FormatSelector {...defaultProps} selectedFormat="png" />);
      
      expect(screen.queryByLabelText(/quality/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    });

    it('should show format recommendations', () => {
      render(<FormatSelector {...defaultProps} showRecommendations={true} />);
      
      expect(screen.getByText(/recommended/i)).toBeInTheDocument();
    });

    it('should display browser compatibility warnings', () => {
      render(<FormatSelector {...defaultProps} selectedFormat="avif" />);
      
      expect(screen.getByText(/limited browser support/i)).toBeInTheDocument();
      expect(screen.getByText(/will fallback to webp/i)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onFormatChange when format is selected', async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      await user.click(dropdown);
      await user.click(screen.getByText('JPEG'));

      expect(mockOnFormatChange).toHaveBeenCalledWith('jpeg');
    });

    it('should call onQualityChange when slider is moved', async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} selectedFormat="jpeg" />);
      
      const slider = screen.getByRole('slider');
      await user.click(slider);
      // Simulate setting slider to 90
      fireEvent.change(slider, { target: { value: '90' } });

      expect(mockOnQualityChange).toHaveBeenCalledWith(90);
    });

    it('should update quality when format changes to use optimal settings', async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} selectedFormat="jpeg" />);
      
      const dropdown = screen.getByRole('combobox');
      await user.click(dropdown);
      await user.click(screen.getByText('WebP'));

      // Should call with WebP optimal quality (80)
      expect(mockOnQualityChange).toHaveBeenCalledWith(80);
    });

    it('should show quality preview with estimated file size', async () => {
      render(<FormatSelector {...defaultProps} selectedFormat="jpeg" showPreview={true} originalSize={1024 * 1024} />);
      
      expect(screen.getByText(/estimated size/i)).toBeInTheDocument();
      expect(screen.getByText(/compression ratio/i)).toBeInTheDocument();
    });
  });

  describe('format-specific behavior', () => {
    it('should show JPEG-specific quality range (1-100)', () => {
      render(<FormatSelector {...defaultProps} selectedFormat="jpeg" />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '1');
      expect(slider).toHaveAttribute('max', '100');
    });

    it('should show WebP-specific quality range (1-100)', () => {
      render(<FormatSelector {...defaultProps} selectedFormat="webp" />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '1');
      expect(slider).toHaveAttribute('max', '100');
    });

    it('should show AVIF-specific quality range (1-100)', () => {
      render(<FormatSelector {...defaultProps} selectedFormat="avif" />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('min', '1');
      expect(slider).toHaveAttribute('max', '100');
    });

    it('should display format characteristics', () => {
      render(<FormatSelector {...defaultProps} selectedFormat="webp" showDetails={true} />);
      
      expect(screen.getByText(/supports transparency/i)).toBeInTheDocument();
      expect(screen.getByText(/lossy and lossless/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<FormatSelector {...defaultProps} />);
      
      expect(screen.getByLabelText(/output format/i)).toBeInTheDocument();
      
      // When quality slider is shown
      render(<FormatSelector {...defaultProps} selectedFormat="jpeg" />);
      expect(screen.getByLabelText(/quality/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      await user.tab(); // Focus on dropdown
      expect(dropdown).toHaveFocus();
      
      await user.keyboard('{Enter}'); // Open dropdown
      await user.keyboard('{ArrowDown}'); // Navigate to next option
      await user.keyboard('{Enter}'); // Select option
      
      expect(mockOnFormatChange).toHaveBeenCalled();
    });

    it('should announce quality changes to screen readers', async () => {
      const user = userEvent.setup();
      render(<FormatSelector {...defaultProps} selectedFormat="jpeg" />);
      
      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-valuetext');
    });
  });

  describe('error handling', () => {
    it('should show warning for unsupported format fallback', () => {
      render(<FormatSelector {...defaultProps} selectedFormat="avif" />);
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/will fallback to webp/i)).toBeInTheDocument();
    });

    it('should disable unavailable formats gracefully', () => {
      // Mock all formats as unsupported except JPEG
      vi.mocked(mockFormatSupport).webp = false;
      vi.mocked(mockFormatSupport).avif = false;
      
      render(<FormatSelector {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      fireEvent.click(dropdown);
      
      const webpOption = screen.getByText('WebP');
      expect(webpOption).toHaveAttribute('aria-disabled', 'true');
    });
  });
});

describe('BatchFormatSelector', () => {
  const mockOnFormatsChange = vi.fn();
  const files = [
    new File([''], 'photo1.jpg', { type: 'image/jpeg' }),
    new File([''], 'graphic.png', { type: 'image/png' }),
  ];

  const defaultProps = {
    files,
    onFormatsChange: mockOnFormatsChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow setting same format for all files', async () => {
    const user = userEvent.setup();
    render(<BatchFormatSelector {...defaultProps} />);
    
    const uniformToggle = screen.getByLabelText(/same format for all/i);
    await user.click(uniformToggle);
    
    const dropdown = screen.getByRole('combobox');
    await user.click(dropdown);
    await user.click(screen.getByText('WebP'));
    
    expect(mockOnFormatsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ outputFormat: 'webp' }),
        expect.objectContaining({ outputFormat: 'webp' }),
      ])
    );
  });

  it('should allow individual format selection per file', async () => {
    const user = userEvent.setup();
    render(<BatchFormatSelector {...defaultProps} />);
    
    // Should show individual dropdowns for each file
    const dropdowns = screen.getAllByRole('combobox');
    expect(dropdowns).toHaveLength(2);
    
    // Set different formats
    await user.click(dropdowns[0]);
    await user.click(screen.getByText('WebP'));
    
    await user.click(dropdowns[1]);
    await user.click(screen.getByText('AVIF'));
    
    expect(mockOnFormatsChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ outputFormat: 'webp' }),
        expect.objectContaining({ outputFormat: 'avif' }),
      ])
    );
  });

  it('should show format recommendations based on file type', () => {
    render(<BatchFormatSelector {...defaultProps} showRecommendations={true} />);
    
    // Should recommend WebP for photos (JPEG)
    expect(screen.getByText(/recommended: webp/i)).toBeInTheDocument();
    
    // Should recommend keeping PNG for graphics
    expect(screen.getByText(/recommended: png/i)).toBeInTheDocument();
  });
});