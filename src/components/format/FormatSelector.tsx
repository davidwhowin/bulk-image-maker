import { useState, useEffect, useCallback } from 'react';
import { BrowserFormatSupport } from '@/lib/format-converter';
import type { SupportedFormat, FormatSupport } from '@/types/format-conversion';

interface FormatSelectorProps {
  selectedFormat: SupportedFormat;
  quality: number;
  onFormatChange: (format: SupportedFormat) => void;
  onQualityChange: (quality: number) => void;
  disabled?: boolean;
  showRecommendations?: boolean;
  showPreview?: boolean;
  showDetails?: boolean;
  originalSize?: number;
  lossless?: boolean;
  onLosslessChange?: (lossless: boolean) => void;
  compressionLevel?: number;
  onCompressionLevelChange?: (level: number) => void;
}

interface BatchFormatSelectorProps {
  files: File[];
  onFormatsChange: (formats: Array<{ file: File; outputFormat: SupportedFormat; quality: number }>) => void;
  showRecommendations?: boolean;
}

export function FormatSelector({
  selectedFormat,
  quality,
  onFormatChange,
  onQualityChange,
  disabled = false,
  showRecommendations = false,
  showPreview = false,
  showDetails = false,
  originalSize,
  lossless = false,
  onLosslessChange,
  compressionLevel = 9,
  onCompressionLevelChange,
}: FormatSelectorProps) {
  const [formatSupport, setFormatSupport] = useState<FormatSupport>({
    jpeg: true,
    png: true,
    webp: true,
    avif: false,
    svg: true,
    jxl: false,
  });
  
  const [browserSupport] = useState(() => new BrowserFormatSupport());

  useEffect(() => {
    // Detect format support
    const detectSupport = async () => {
      const [webp, avif, jxl] = await Promise.all([
        browserSupport.detectWebPSupport(),
        browserSupport.detectAVIFSupport(),
        browserSupport.detectJXLSupport(),
      ]);

      setFormatSupport({
        jpeg: true,
        png: true,
        webp,
        avif,
        svg: true, // SVG is always supported in browsers
        jxl, // JPEG XL support depends on browser/WebAssembly
      });
    };

    void detectSupport();
  }, [browserSupport]);

  const handleFormatChange = useCallback((newFormat: SupportedFormat) => {
    onFormatChange(newFormat);
    
    // Auto-adjust quality for optimal settings
    const optimalQuality = getOptimalQuality(newFormat);
    onQualityChange(optimalQuality);
  }, [onFormatChange, onQualityChange]);

  const getOptimalQuality = (format: SupportedFormat): number => {
    const qualityMap: Record<SupportedFormat, number> = {
      jpeg: 85,
      webp: 80,
      avif: 75,
      png: 100,
      svg: 85, // SVG optimization level (0-100)
      jxl: 70, // JPEG XL can achieve better quality at lower settings
    };
    return qualityMap[format];
  };

  const isLossyFormat = (format: SupportedFormat): boolean => {
    return ['jpeg', 'webp', 'avif', 'jxl'].includes(format);
  };

  const formatHasLimitedSupport = (format: SupportedFormat): boolean => {
    return !formatSupport[format];
  };

  const getFallbackFormat = (format: SupportedFormat): SupportedFormat => {
    return browserSupport.getFallbackFormat(format);
  };

  const getFormatCharacteristics = (format: SupportedFormat) => {
    const characteristics = {
      jpeg: { lossy: true, lossless: false, transparency: false, animation: false },
      png: { lossy: false, lossless: true, transparency: true, animation: false },
      webp: { lossy: true, lossless: true, transparency: true, animation: true },
      avif: { lossy: true, lossless: true, transparency: true, animation: false },
      svg: { lossy: false, lossless: true, transparency: true, animation: true },
      jxl: { lossy: true, lossless: true, transparency: true, animation: false },
    };
    return characteristics[format];
  };

  const estimateOutputSize = (format: SupportedFormat, quality: number): string => {
    if (!originalSize) return 'Unknown';
    
    // Rough compression estimates
    const compressionRatios = {
      jpeg: 0.1 + (quality / 100) * 0.4, // 10-50% of original
      png: 0.7, // PNG compression is consistent
      webp: 0.08 + (quality / 100) * 0.32, // 8-40% of original  
      avif: 0.06 + (quality / 100) * 0.24, // 6-30% of original
      svg: 0.3 + (quality / 100) * 0.5, // 30-80% of original (depends on optimization level)
      jxl: 0.04 + (quality / 100) * 0.20, // 4-24% of original (better than AVIF)
    };
    
    const estimatedSize = originalSize * compressionRatios[format];
    return formatFileSize(estimatedSize);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Format Selection */}
      <div>
        <label htmlFor="format-select" className="block text-sm font-medium text-gray-700 mb-2">
          Output Format
        </label>
        <select
          id="format-select"
          value={selectedFormat}
          onChange={(e) => handleFormatChange(e.target.value as SupportedFormat)}
          disabled={disabled}
          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
        >
          <option value="jpeg" disabled={!formatSupport.jpeg}>
            JPEG {!formatSupport.jpeg && '(Not Supported)'}
          </option>
          <option value="png" disabled={!formatSupport.png}>
            PNG {!formatSupport.png && '(Not Supported)'}
          </option>
          <option value="webp" disabled={!formatSupport.webp}>
            WebP {!formatSupport.webp && '(Limited Support)'}
          </option>
          <option value="avif" disabled={!formatSupport.avif}>
            AVIF {!formatSupport.avif && '(Limited Support)'}
          </option>
          <option value="svg" disabled={!formatSupport.svg}>
            SVG {!formatSupport.svg && '(Not Supported)'}
          </option>
          <option value="jxl" disabled={!formatSupport.jxl}>
            JPEG XL {!formatSupport.jxl && '(Experimental)'}
          </option>
        </select>
      </div>

      {/* Lossless Mode Toggle */}
      {onLosslessChange && (
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center">
            <input
              id="lossless-toggle"
              type="checkbox"
              checked={lossless}
              onChange={(e) => onLosslessChange(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <label htmlFor="lossless-toggle" className="ml-2 text-sm font-medium text-gray-700">
              Enable Lossless Compression
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Maximum quality preservation with larger file sizes
          </p>
        </div>
      )}

      {/* Quality Slider (for lossy formats, SVG, and when not lossless) */}
      {(isLossyFormat(selectedFormat) || selectedFormat === 'svg') && !lossless && (
        <div>
          <label htmlFor="quality-slider" className="block text-sm font-medium text-gray-700 mb-2">
            {selectedFormat === 'svg' ? 'Optimization Level' : 'Quality'}: {quality}%
          </label>
          <input
            id="quality-slider"
            type="range"
            min="1"
            max="100"
            value={quality}
            onChange={(e) => onQualityChange(parseInt(e.target.value))}
            disabled={disabled}
            className="block w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            aria-valuetext={`${quality}% quality`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{selectedFormat === 'svg' ? 'More optimization' : 'Smaller file'}</span>
            <span>{selectedFormat === 'svg' ? 'Less optimization' : 'Better quality'}</span>
          </div>
        </div>
      )}

      {/* PNG Compression Level (for PNG lossless mode) */}
      {selectedFormat === 'png' && lossless && onCompressionLevelChange && (
        <div>
          <label htmlFor="compression-level" className="block text-sm font-medium text-gray-700 mb-2">
            Compression Level: {compressionLevel}
          </label>
          <input
            id="compression-level"
            type="range"
            min="0"
            max="9"
            value={compressionLevel}
            onChange={(e) => onCompressionLevelChange(parseInt(e.target.value))}
            disabled={disabled}
            className="block w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            aria-valuetext={`Compression level ${compressionLevel}`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Fast (0)</span>
            <span>Maximum compression (9)</span>
          </div>
        </div>
      )}

      {/* Browser Compatibility Warning */}
      {formatHasLimitedSupport(selectedFormat) && (
        <div role="alert" className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Limited Browser Support</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This format has limited browser support and will fallback to {getFallbackFormat(selectedFormat).toUpperCase()} in unsupported browsers.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Format Details */}
      {showDetails && (
        <div className="bg-gray-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Format Characteristics</h4>
          <div className="text-sm text-gray-600 space-y-1">
            {(() => {
              const chars = getFormatCharacteristics(selectedFormat);
              return (
                <>
                  {chars.transparency && <div>✓ Supports transparency</div>}
                  {chars.lossy && chars.lossless && <div>✓ Lossy and lossless compression</div>}
                  {chars.lossy && !chars.lossless && <div>• Lossy compression only</div>}
                  {!chars.lossy && chars.lossless && <div>• Lossless compression only</div>}
                  {chars.animation && <div>✓ Animation support</div>}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Size Preview */}
      {showPreview && originalSize && (
        <div className="bg-blue-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Estimated Results</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <div>Original size: {formatFileSize(originalSize)}</div>
            <div>Estimated size: {estimateOutputSize(selectedFormat, quality)}</div>
            <div>Compression ratio: ~{Math.round((1 - parseFloat(estimateOutputSize(selectedFormat, quality).replace(/[^\d.]/g, '')) / (originalSize / 1024)) * 100)}%</div>
          </div>
        </div>
      )}

      {/* Lossless Mode Information */}
      {lossless && (
        <div className="bg-blue-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Lossless Compression Active</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <div>✓ Perfect quality preservation</div>
            <div>✓ No visual degradation</div>
            {selectedFormat === 'png' && <div>✓ Optimized PNG compression</div>}
            {selectedFormat === 'webp' && <div>✓ WebP lossless mode (~26% smaller than PNG)</div>}
            {selectedFormat === 'avif' && <div>✓ AVIF lossless mode (~50% smaller than PNG)</div>}
            {selectedFormat === 'jxl' && <div>✓ JPEG XL lossless mode (~60% smaller than PNG)</div>}
            {selectedFormat === 'jpeg' && <div>⚠️ JPEG is not truly lossless (using quality 100)</div>}
            {selectedFormat === 'svg' && <div>✓ Vector format maintains perfect quality at any size</div>}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {showRecommendations && !lossless && (
        <div className="bg-green-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-green-800 mb-2">Recommended</h4>
          <p className="text-sm text-green-700">
            For photos: JPEG or WebP • For graphics: PNG or WebP • For vectors: SVG • For maximum compression: JPEG XL • For wide compatibility: AVIF
          </p>
        </div>
      )}

      {/* Lossless Recommendations */}
      {showRecommendations && lossless && (
        <div className="bg-green-50 p-3 rounded-md">
          <h4 className="text-sm font-medium text-green-800 mb-2">Lossless Recommendations</h4>
          <p className="text-sm text-green-700">
            For maximum compression: JPEG XL lossless • For wide compatibility: AVIF lossless • For legacy support: PNG • For balanced: WebP lossless • For vectors: SVG
          </p>
        </div>
      )}
    </div>
  );
}

export function BatchFormatSelector({
  files,
  onFormatsChange,
  showRecommendations = false,
}: BatchFormatSelectorProps) {
  const [uniformFormat, setUniformFormat] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState<SupportedFormat>('webp');
  const [quality, setQuality] = useState(80);

  const handleUniformToggle = useCallback(() => {
    setUniformFormat(!uniformFormat);
  }, [uniformFormat]);

  const handleFormatChange = useCallback((format: SupportedFormat) => {
    setSelectedFormat(format);
    
    if (uniformFormat) {
      // Apply to all files
      const formats = files.map(file => ({
        file,
        outputFormat: format,
        quality,
      }));
      onFormatsChange(formats);
    }
  }, [files, quality, uniformFormat, onFormatsChange]);

  const handleQualityChange = useCallback((newQuality: number) => {
    setQuality(newQuality);
    
    if (uniformFormat) {
      // Apply to all files
      const formats = files.map(file => ({
        file,
        outputFormat: selectedFormat,
        quality: newQuality,
      }));
      onFormatsChange(formats);
    }
  }, [files, selectedFormat, uniformFormat, onFormatsChange]);

  const getRecommendedFormat = (file: File): SupportedFormat => {
    const type = file.type;
    if (type.includes('svg')) {
      return 'svg'; // Keep SVG for vector graphics
    }
    if (type.includes('jpeg') || type.includes('jpg')) {
      return 'webp'; // Photos benefit from WebP
    }
    if (type.includes('png')) {
      return 'png'; // Keep PNG for graphics with transparency
    }
    return 'webp'; // Default to WebP
  };

  return (
    <div className="space-y-4">
      {/* Uniform Format Toggle */}
      <div className="flex items-center">
        <input
          id="uniform-format"
          type="checkbox"
          checked={uniformFormat}
          onChange={handleUniformToggle}
          className="h-4 w-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
        />
        <label htmlFor="uniform-format" className="ml-2 text-sm text-gray-700">
          Use same format for all files
        </label>
      </div>

      {/* Format Selection */}
      {uniformFormat ? (
        <FormatSelector
          selectedFormat={selectedFormat}
          quality={quality}
          onFormatChange={handleFormatChange}
          onQualityChange={handleQualityChange}
          showRecommendations={showRecommendations}
        />
      ) : (
        <div className="space-y-3">
          {files.map((file, index) => (
            <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-md">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900">{file.name}</div>
                <div className="text-xs text-gray-500">{file.type.replace('image/', '').toUpperCase()}</div>
                {showRecommendations && (
                  <div className="text-xs text-green-600 mt-1">
                    Recommended: {getRecommendedFormat(file).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="w-32">
                <select
                  value={selectedFormat}
                  onChange={(e) => {
                    const format = e.target.value as SupportedFormat;
                    const formats = files.map((f, i) => ({
                      file: f,
                      outputFormat: i === index ? format : selectedFormat,
                      quality,
                    }));
                    onFormatsChange(formats);
                  }}
                  className="block w-full text-sm rounded border-gray-300"
                >
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                  <option value="webp">WebP</option>
                  <option value="avif">AVIF</option>
                  <option value="svg">SVG</option>
                  <option value="jxl">JPEG XL</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}