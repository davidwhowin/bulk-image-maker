import { useState, useEffect } from 'react'

interface TierLimitSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  formatValue?: (value: number) => string
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  showInput?: boolean
  color?: 'blue' | 'green' | 'purple' | 'orange'
}

export function TierLimitSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  formatValue,
  onChange,
  disabled = false,
  className = '',
  showInput = true,
  color = 'blue'
}: TierLimitSliderProps) {
  const [inputValue, setInputValue] = useState(value.toString())

  useEffect(() => {
    setInputValue(value.toString())
  }, [value])

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10)
    onChange(newValue)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    setInputValue(rawValue)
    
    const numValue = parseInt(rawValue, 10)
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(numValue)
    }
  }

  const handleInputBlur = () => {
    const numValue = parseInt(inputValue, 10)
    if (isNaN(numValue) || numValue < min || numValue > max) {
      setInputValue(value.toString())
    }
  }

  const displayValue = formatValue ? formatValue(value) : `${value.toLocaleString()}${unit ? ` ${unit}` : ''}`
  const percentage = ((value - min) / (max - min)) * 100

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600', 
    purple: 'bg-purple-600',
    orange: 'bg-orange-600'
  }

  const focusColorClasses = {
    blue: 'focus:ring-blue-500',
    green: 'focus:ring-green-500',
    purple: 'focus:ring-purple-500', 
    orange: 'focus:ring-orange-500'
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label and Value Display */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">
            {displayValue}
          </span>
          {showInput && (
            <input
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleSliderChange}
          disabled={disabled}
          className={`
            w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
            disabled:opacity-50 disabled:cursor-not-allowed
            ${focusColorClasses[color]}
            slider-thumb
          `}
          style={{
            background: `linear-gradient(to right, ${colorClasses[color].replace('bg-', '')} 0%, ${colorClasses[color].replace('bg-', '')} ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
          }}
        />
        
        {/* Min/Max Labels */}
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatValue ? formatValue(min) : min.toLocaleString()}</span>
          <span>{formatValue ? formatValue(max) : max.toLocaleString()}</span>
        </div>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <div className="flex-1 bg-gray-200 rounded-full h-1">
          <div 
            className={`h-1 rounded-full ${colorClasses[color]} transition-all duration-200`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span>{percentage.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// Specialized sliders for common use cases
export function ImageLimitSlider({
  value,
  onChange,
  disabled,
  className,
  color = 'blue'
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const formatValue = (val: number): string => {
    if (val >= 1000) {
      return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}K`
    }
    return val.toString()
  }

  return (
    <TierLimitSlider
      label="Max Images per Month"
      value={value}
      min={0}
      max={100000}
      step={100}
      formatValue={formatValue}
      onChange={onChange}
      disabled={disabled}
      className={className}
      color={color}
    />
  )
}

export function FileSizeSlider({
  value,
  onChange,
  disabled,
  className,
  color = 'blue'
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
}) {
  const formatValue = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`
  }

  // Convert bytes to MB for easier handling
  const mbValue = Math.round(value / (1024 * 1024))
  const handleChange = (mb: number) => {
    onChange(mb * 1024 * 1024)
  }

  return (
    <TierLimitSlider
      label="Max File Size"
      value={mbValue}
      min={1}
      max={500}
      step={1}
      formatValue={(mb) => formatValue(mb * 1024 * 1024)}
      onChange={handleChange}
      disabled={disabled}
      className={className}
      color={color}
    />
  )
}

export function BatchSizeSlider({
  value,
  onChange,
  disabled,
  className,
  color = 'blue'
}: {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
}) {
  return (
    <TierLimitSlider
      label="Max Batch Size"
      value={value}
      min={1}
      max={1000}
      step={1}
      unit="files"
      onChange={onChange}
      disabled={disabled}
      className={className}
      color={color}
    />
  )
}