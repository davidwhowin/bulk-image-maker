import { useStore } from '@/store'
import type { CompressionSettings } from '@/types'

interface CompressionSettingsProps {
  className?: string
}

const QUALITY_PRESETS = [
  { name: 'Maximum Quality', value: 95, description: 'Best quality, minimal compression' },
  { name: 'Balanced', value: 80, description: 'Good quality with decent compression' },
  { name: 'Web Optimized', value: 65, description: 'Optimized for web with good quality' },
  { name: 'Maximum Compression', value: 40, description: 'Smallest files, lower quality' }
]

export function CompressionSettings({ className = '' }: CompressionSettingsProps) {
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

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Compression Settings</h3>
        <span className="text-sm text-gray-500">
          {files.length} file{files.length !== 1 ? 's' : ''} ready
        </span>
      </div>
      
      <div className="space-y-6">
        {/* Format Selection */}
        <div>
          <label htmlFor="compression-format" className="block text-sm font-medium text-gray-700 mb-2">
            Output Format
          </label>
          <select
            id="compression-format"
            value={compressionSettings.format}
            onChange={(e) => handleFormatChange(e.target.value as CompressionSettings['format'])}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="auto">Auto (Smart format selection)</option>
            <option value="jpeg">JPEG (Best for photos)</option>
            <option value="png">PNG (Best for graphics)</option>
            <option value="webp">WebP (Modern, efficient)</option>
            <option value="avif">AVIF (Next-gen, experimental)</option>
          </select>
          
          <p className="text-xs text-gray-500 mt-1">
            {compressionSettings.format === 'auto' 
              ? 'Automatically chooses the best format for each image'
              : `All images will be converted to ${compressionSettings.format.toUpperCase()}`
            }
          </p>
        </div>

        {/* Quality Slider */}
        <div>
          <label htmlFor="compression-quality" className="block text-sm font-medium text-gray-700 mb-2">
            Quality: {compressionSettings.quality}%
          </label>
          <input
            id="compression-quality"
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
          </div>
        </div>

        {/* Quality Presets */}
        <div className="border-t border-gray-200 pt-4">
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
      </div>
    </div>
  )
}