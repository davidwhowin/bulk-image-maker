import { useState } from 'react'

interface FormatOption {
  id: string
  label: string
  description: string
  mimeType: string
  icon?: string
  category?: 'basic' | 'modern' | 'advanced'
}

const AVAILABLE_FORMATS: FormatOption[] = [
  {
    id: 'jpeg',
    label: 'JPEG',
    description: 'Standard photo format, widely supported',
    mimeType: 'image/jpeg',
    icon: '📷',
    category: 'basic'
  },
  {
    id: 'png',
    label: 'PNG',
    description: 'Lossless format with transparency support',
    mimeType: 'image/png',
    icon: '🖼️',
    category: 'basic'
  },
  {
    id: 'webp',
    label: 'WebP',
    description: 'Modern format with excellent compression',
    mimeType: 'image/webp',
    icon: '🌐',
    category: 'modern'
  },
  {
    id: 'avif',
    label: 'AVIF',
    description: 'Next-gen format with superior compression',
    mimeType: 'image/avif',
    icon: '🚀',
    category: 'modern'
  },
  {
    id: 'jxl',
    label: 'JPEG XL',
    description: 'Future format with advanced features',
    mimeType: 'image/jxl',
    icon: '✨',
    category: 'advanced'
  },
  {
    id: 'svg',
    label: 'SVG',
    description: 'Vector graphics format',
    mimeType: 'image/svg+xml',
    icon: '🎨',
    category: 'advanced'
  },
  {
    id: 'gif',
    label: 'GIF',
    description: 'Animated image format',
    mimeType: 'image/gif',
    icon: '🎬',
    category: 'basic'
  }
]

interface FormatSelectorProps {
  selectedFormats: string[]
  onChange: (formats: string[]) => void
  disabled?: boolean
  className?: string
  showCategories?: boolean
  showDescriptions?: boolean
  layout?: 'grid' | 'list'
  tierColor?: 'blue' | 'green' | 'purple' | 'orange'
}

export function FormatSelector({
  selectedFormats,
  onChange,
  disabled = false,
  className = '',
  showCategories = true,
  showDescriptions = true,
  layout = 'grid',
  tierColor = 'blue'
}: FormatSelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['basic', 'modern'])

  const handleFormatToggle = (mimeType: string) => {
    if (disabled) return

    const newFormats = selectedFormats.includes(mimeType)
      ? selectedFormats.filter(f => f !== mimeType)
      : [...selectedFormats, mimeType]
    
    onChange(newFormats)
  }

  const handleCategoryToggle = (category: string) => {
    const categoryFormats = AVAILABLE_FORMATS
      .filter(f => f.category === category)
      .map(f => f.mimeType)
    
    const allSelected = categoryFormats.every(format => selectedFormats.includes(format))
    
    if (allSelected) {
      // Deselect all in category
      onChange(selectedFormats.filter(f => !categoryFormats.includes(f)))
    } else {
      // Select all in category
      const newFormats = [...new Set([...selectedFormats, ...categoryFormats])]
      onChange(newFormats)
    }
  }

  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    )
  }

  const colorClasses = {
    blue: 'border-blue-500 bg-blue-50 text-blue-700',
    green: 'border-green-500 bg-green-50 text-green-700',
    purple: 'border-purple-500 bg-purple-50 text-purple-700',
    orange: 'border-orange-500 bg-orange-50 text-orange-700'
  }

  const groupedFormats = AVAILABLE_FORMATS.reduce((acc, format) => {
    const category = format.category || 'other'
    if (!acc[category]) acc[category] = []
    acc[category].push(format)
    return acc
  }, {} as Record<string, FormatOption[]>)

  const categoryLabels = {
    basic: 'Basic Formats',
    modern: 'Modern Formats', 
    advanced: 'Advanced Formats',
    other: 'Other Formats'
  }

  if (!showCategories) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h4 className="text-sm font-medium text-gray-700">Supported Formats</h4>
        
        <div className={layout === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
          {AVAILABLE_FORMATS.map((format) => (
            <FormatItem
              key={format.id}
              format={format}
              isSelected={selectedFormats.includes(format.mimeType)}
              onToggle={() => handleFormatToggle(format.mimeType)}
              disabled={disabled}
              showDescription={showDescriptions}
              tierColor={tierColor}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">Supported Formats</h4>
        <span className="text-xs text-gray-500">
          {selectedFormats.length} of {AVAILABLE_FORMATS.length} selected
        </span>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedFormats).map(([category, formats]) => {
          const isExpanded = expandedCategories.includes(category)
          const categoryFormats = formats.map(f => f.mimeType)
          const selectedCount = categoryFormats.filter(f => selectedFormats.includes(f)).length
          const allSelected = selectedCount === categoryFormats.length
          const someSelected = selectedCount > 0 && selectedCount < categoryFormats.length

          return (
            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Category Header */}
              <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCategoryExpansion(category)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    disabled={disabled}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  
                  <h5 className="text-sm font-medium text-gray-900">
                    {categoryLabels[category as keyof typeof categoryLabels] || category}
                  </h5>
                  
                  <span className="text-xs text-gray-500">
                    ({selectedCount}/{categoryFormats.length})
                  </span>
                </div>

                <button
                  onClick={() => handleCategoryToggle(category)}
                  disabled={disabled}
                  className={`
                    px-2 py-1 text-xs font-medium rounded transition-colors
                    ${allSelected 
                      ? colorClasses[tierColor]
                      : someSelected
                        ? `border-${tierColor}-300 bg-${tierColor}-25 text-${tierColor}-600`
                        : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              {/* Category Content */}
              {isExpanded && (
                <div className="p-3">
                  <div className={layout === 'grid' ? 'grid grid-cols-1 gap-2' : 'space-y-2'}>
                    {formats.map((format) => (
                      <FormatItem
                        key={format.id}
                        format={format}
                        isSelected={selectedFormats.includes(format.mimeType)}
                        onToggle={() => handleFormatToggle(format.mimeType)}
                        disabled={disabled}
                        showDescription={showDescriptions}
                        tierColor={tierColor}
                        compact={layout === 'grid'}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface FormatItemProps {
  format: FormatOption
  isSelected: boolean
  onToggle: () => void
  disabled?: boolean
  showDescription?: boolean
  tierColor?: 'blue' | 'green' | 'purple' | 'orange'
  compact?: boolean
}

function FormatItem({
  format,
  isSelected,
  onToggle,
  disabled = false,
  showDescription = true,
  tierColor = 'blue',
  compact = false
}: FormatItemProps) {
  const colorClasses = {
    blue: 'border-blue-500 bg-blue-50 text-blue-700',
    green: 'border-green-500 bg-green-50 text-green-700',
    purple: 'border-purple-500 bg-purple-50 text-purple-700',
    orange: 'border-orange-500 bg-orange-50 text-orange-700'
  }

  return (
    <label
      className={`
        flex items-center p-3 border rounded-lg cursor-pointer transition-all
        ${isSelected 
          ? colorClasses[tierColor]
          : 'border-gray-300 bg-white hover:bg-gray-50'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${compact ? 'p-2' : 'p-3'}
      `}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        disabled={disabled}
        className="sr-only"
      />
      
      <div className="flex items-center gap-3 flex-1">
        <div className="flex items-center gap-2">
          {format.icon && (
            <span className="text-lg">{format.icon}</span>
          )}
          <div className="flex items-center gap-2">
            <div className={`
              w-4 h-4 border-2 rounded flex items-center justify-center
              ${isSelected 
                ? `border-${tierColor}-500 bg-${tierColor}-500`
                : 'border-gray-300 bg-white'
              }
            `}>
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            
            <div>
              <div className="font-medium text-sm">{format.label}</div>
              {showDescription && !compact && (
                <div className="text-xs text-gray-600">{format.description}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </label>
  )
}