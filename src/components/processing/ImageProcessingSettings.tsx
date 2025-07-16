import { useStore } from '@/store'
import type { CompressionSettings } from '@/types'

interface ImageProcessingSettingsProps {
  className?: string
}

const QUALITY_PRESETS = [
  { name: 'Maximum Quality', value: 95, description: 'Best quality, minimal compression' },
  { name: 'Balanced', value: 80, description: 'Good quality with decent compression' },
  { name: 'Web Optimized', value: 65, description: 'Optimized for web with good quality' },
  { name: 'Maximum Compression', value: 40, description: 'Smallest files, lower quality' }
]

const FORMAT_OPTIONS = [
  { 
    value: 'auto' as const, 
    label: 'Auto (Smart Selection)', 
    description: 'Automatically chooses the best format for each image',
    recommendation: 'Best for mixed content types'
  },
  { 
    value: 'jpeg' as const, 
    label: 'JPEG', 
    description: 'Excellent for photos with rich colors',
    recommendation: 'Best for photographs'
  },
  { 
    value: 'png' as const, 
    label: 'PNG', 
    description: 'Perfect for graphics, logos, and images with transparency',
    recommendation: 'Best for graphics and screenshots'
  },
  { 
    value: 'webp' as const, 
    label: 'WebP', 
    description: 'Modern format with excellent compression',
    recommendation: 'Best overall efficiency'
  },
  { 
    value: 'avif' as const, 
    label: 'AVIF', 
    description: 'Next-generation format with superior compression',
    recommendation: 'Future-ready (limited browser support)'
  }
]

export function ImageProcessingSettings({ className = '' }: ImageProcessingSettingsProps) {
  const { compressionSettings, updateCompressionSettings, files } = useStore()

  const handleQualityChange = (quality: number) => {
    updateCompressionSettings({ quality })
  }

  const handleFormatChange = (format: CompressionSettings['format']) => {
    updateCompressionSettings({ format })
  }

  const getQualityDescription = (quality: number): string => {
    if (quality >= 90) return 'Maximum quality, minimal compression'
    if (quality >= 75) return 'High quality, balanced compression'
    if (quality >= 50) return 'Good quality, significant compression'
    return 'Lower quality, maximum compression'
  }

  const getEstimatedReduction = (quality: number): string => {
    // Rough estimates based on quality setting
    if (quality >= 90) return '10-30%'
    if (quality >= 75) return '30-50%'
    if (quality >= 50) return '50-70%'
    return '70-85%'
  }

  const selectedFormat = FORMAT_OPTIONS.find(opt => opt.value === compressionSettings.format)

  const getTotalOriginalSize = (): string => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    if (totalBytes < 1024) return `${totalBytes} B`
    if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`
    return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getEstimatedOutputSize = (): string => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    const reductionFactor = compressionSettings.quality >= 90 ? 0.8 : 
                           compressionSettings.quality >= 75 ? 0.6 : 
                           compressionSettings.quality >= 50 ? 0.4 : 0.25
    const estimatedBytes = totalBytes * reductionFactor
    
    if (estimatedBytes < 1024) return `${estimatedBytes.toFixed(0)} B`
    if (estimatedBytes < 1024 * 1024) return `${(estimatedBytes / 1024).toFixed(1)} KB`
    return `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Image Processing Settings</h3>
        <span className="text-sm text-gray-500">
          {files.length} file{files.length !== 1 ? 's' : ''} ready
        </span>
      </div>
      
      <div className="space-y-6">
        {/* File Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-900">Files</div>
              <div className="text-gray-600">{files.length} images</div>
            </div>
            <div>
              <div className="font-medium text-gray-900">Original Size</div>
              <div className="text-gray-600">{getTotalOriginalSize()}</div>
            </div>
            <div>
              <div className="font-medium text-gray-900">Estimated Output</div>
              <div className="text-gray-600">{getEstimatedOutputSize()}</div>
            </div>
          </div>
        </div>

        {/* Format Selection */}
        <div>
          <label htmlFor="processing-format" className="block text-sm font-medium text-gray-700 mb-3">
            Output Format
          </label>
          <div className="grid grid-cols-1 gap-3">
            {FORMAT_OPTIONS.map((option) => (
              <div
                key={option.value}
                className={`relative rounded-lg border p-4 cursor-pointer transition-all ${
                  compressionSettings.format === option.value
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => handleFormatChange(option.value)}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="format"
                    value={option.value}
                    checked={compressionSettings.format === option.value}
                    onChange={() => handleFormatChange(option.value)}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-900 cursor-pointer">
                        {option.label}
                      </label>
                      <span className="text-xs text-blue-600 font-medium">
                        {option.recommendation}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {option.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality Slider */}
        <div>
          <label htmlFor="processing-quality" className="block text-sm font-medium text-gray-700 mb-2">
            Quality: {compressionSettings.quality}%
          </label>
          <input
            id="processing-quality"
            type="range"
            min="10"
            max="100"
            step="5"
            value={compressionSettings.quality}
            onChange={(e) => handleQualityChange(parseInt(e.target.value))}
            className="block w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            aria-valuetext={`${compressionSettings.quality}% quality`}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Smaller files</span>
            <span>Better quality</span>
          </div>
          
          {/* Quality Description */}
          <div className="mt-3 p-3 bg-gray-50 rounded-md">
            <div className="text-sm text-gray-700">
              <div className="font-medium">{getQualityDescription(compressionSettings.quality)}</div>
              <div className="text-gray-600 mt-1">
                Expected size reduction: ~{getEstimatedReduction(compressionSettings.quality)}
              </div>
            </div>
          </div>
        </div>

        {/* Quality Presets */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h4>
          
          <div className="grid grid-cols-2 gap-2">
            {QUALITY_PRESETS.map((preset) => {
              const isActive = Math.abs(compressionSettings.quality - preset.value) <= 5
              
              return (
                <button
                  key={preset.name}
                  onClick={() => handleQualityChange(preset.value)}
                  className={`px-3 py-2 text-sm rounded-md border transition-colors ${
                    isActive
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* Advanced Options */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Advanced Options</h4>
          
          <div className="space-y-3">
            {/* Strip Metadata */}
            <div className="flex items-center">
              <input
                id="strip-metadata"
                type="checkbox"
                checked={compressionSettings.stripMetadata}
                onChange={(e) => updateCompressionSettings({ stripMetadata: e.target.checked })}
                className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <label htmlFor="strip-metadata" className="ml-2 text-sm text-gray-700">
                Remove metadata (recommended)
              </label>
            </div>
            <p className="text-xs text-gray-500 ml-6">
              Removes EXIF data, GPS location, and other metadata to reduce file size
            </p>

            {/* Progressive JPEG */}
            {(compressionSettings.format === 'jpeg' || compressionSettings.format === 'auto') && (
              <>
                <div className="flex items-center">
                  <input
                    id="progressive-jpeg"
                    type="checkbox"
                    checked={compressionSettings.progressive || false}
                    onChange={(e) => updateCompressionSettings({ progressive: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="progressive-jpeg" className="ml-2 text-sm text-gray-700">
                    Progressive JPEG (faster loading)
                  </label>
                </div>
                <p className="text-xs text-gray-500 ml-6">
                  Images load progressively, improving perceived performance
                </p>
              </>
            )}

            {/* Preserve Alpha Channel */}
            {(compressionSettings.format === 'png' || compressionSettings.format === 'webp' || compressionSettings.format === 'auto') && (
              <>
                <div className="flex items-center">
                  <input
                    id="preserve-alpha"
                    type="checkbox"
                    checked={compressionSettings.preserveAlpha !== false}
                    onChange={(e) => updateCompressionSettings({ preserveAlpha: e.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <label htmlFor="preserve-alpha" className="ml-2 text-sm text-gray-700">
                    Preserve transparency
                  </label>
                </div>
                <p className="text-xs text-gray-500 ml-6">
                  Maintains alpha channel for transparent backgrounds
                </p>
              </>
            )}
          </div>
        </div>

        {/* Format-specific Info */}
        {selectedFormat && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="h-5 w-5 text-blue-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h5 className="text-sm font-medium text-blue-900 mb-1">
                  About {selectedFormat.label}
                </h5>
                <p className="text-sm text-blue-800">
                  {selectedFormat.description}
                </p>
                <p className="text-xs text-blue-700 mt-1 font-medium">
                  {selectedFormat.recommendation}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}