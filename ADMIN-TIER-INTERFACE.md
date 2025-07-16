# Admin Tier Configuration Interface

## Overview

The admin tier configuration interface provides a visual, interactive way to manage subscription plan limits and features. No more editing code files - adjust limits with sliders, toggle features with checkboxes, and see changes reflected immediately.

## Features

### 🎯 **Visual Tier Editor**
- **Interactive Sliders** for max images per month (0-100K range)
- **File Size Controls** with dropdown selectors (1MB-500MB)
- **Batch Size Adjustments** with number inputs
- **Format Selection** with categorized checkboxes
- **Feature Toggles** for team features and support levels

### 📊 **Visual Comparison Charts**
- **Bar Charts** comparing limits across all tiers
- **Real-time Updates** as you adjust settings
- **Color-coded Tiers** (Free=gray, Pro=blue, Team=green, Enterprise=purple)
- **Format Support Matrix** showing capabilities

### 💾 **Configuration Management**
- **Auto-save** - Changes saved instantly to localStorage
- **Import/Export** - Backup and restore configurations as JSON
- **Reset Options** - Revert to defaults or clear stored settings
- **Environment Overrides** - Support for env variable configuration

## Quick Start

### 1. Access the Admin Interface

Navigate to `/admin` in your application or use the component directly:

```typescript
import { TierConfigAdmin } from '@/components/admin'

function AdminPage() {
  return (
    <div className="p-6">
      <h1>Admin Panel</h1>
      <TierConfigAdmin />
    </div>
  )
}
```

### 2. Adjust Free Plan Limits

**To change the free plan from 100 to 500 images:**

1. Go to the **Free Plan** tab
2. Use the **Max Images per Month** slider
3. Drag to 500 or type `500` in the input box
4. Changes save automatically ✅

### 3. Compare Tiers Visually

The comparison chart on the right shows:
- Relative limits between tiers
- Format support differences  
- Current configuration summary

### 4. Export/Import Settings

**Export Current Config:**
```bash
Click "📤 Export" → Downloads tier-config-YYYY-MM-DD.json
```

**Import Config:**
```bash
Click "📁 Import" → Upload JSON file or paste configuration
```

## Configuration Structure

### Tier Limits Object
```typescript
interface TierLimits {
  maxImagesPerMonth: number        // 0 to 1,000,000
  maxFileSize: number             // 1KB to 1GB (in bytes)
  maxBatchSize: number            // 1 to 10,000
  processingPriority: 'low' | 'normal' | 'high' | 'highest'
  processingDelay: number         // in milliseconds
  supportedFormats: string[]      // MIME types
  teamFeatures: boolean           // collaboration features
  prioritySupport: 'none' | 'email' | 'chat' | 'phone'
}
```

### Example Configuration
```json
{
  "free": {
    "maxImagesPerMonth": 500,
    "maxFileSize": 10485760,
    "maxBatchSize": 5,
    "processingPriority": "low",
    "processingDelay": 120000,
    "supportedFormats": ["image/jpeg", "image/png", "image/webp"],
    "teamFeatures": false,
    "prioritySupport": "none"
  }
}
```

## Component Usage

### Basic Usage
```typescript
import { TierConfigAdmin } from '@/components/admin'

<TierConfigAdmin />
```

### Compact Mode
```typescript
<TierConfigAdmin 
  compactMode={true}
  showComparison={false}
/>
```

### Individual Components
```typescript
import { 
  ImageLimitSlider,
  TierComparisonChart,
  FormatSelector 
} from '@/components/admin'

// Custom slider
<ImageLimitSlider
  value={500}
  onChange={(value) => console.log(value)}
  color="blue"
/>

// Comparison chart only
<TierComparisonChart config={tierConfig} />

// Format selector only
<FormatSelector
  selectedFormats={['image/jpeg', 'image/png']}
  onChange={(formats) => console.log(formats)}
/>
```

## Advanced Features

### Environment Variable Override

Set environment variables to override defaults:

```env
VITE_TIER_FREE_MAX_IMAGES=500
VITE_TIER_PRO_MAX_IMAGES=5000
```

### Programmatic Access

```typescript
import { useTierConfig } from '@/hooks/useTierConfig'

function CustomAdmin() {
  const { 
    config, 
    updateTierConfig, 
    exportConfig,
    validateConfig 
  } = useTierConfig()

  const updateFreeLimit = async () => {
    await updateTierConfig('free', {
      ...config.free,
      maxImagesPerMonth: 1000
    })
  }
}
```

### Configuration Manager

```typescript
import { tierConfigManager } from '@/lib/tier-config-manager'

// Get current config
const config = tierConfigManager.getConfiguration()

// Subscribe to changes
const unsubscribe = tierConfigManager.subscribe((newConfig) => {
  console.log('Config updated:', newConfig)
})

// Update programmatically
tierConfigManager.updateConfiguration(newConfig)
```

## Validation & Safety

### Automatic Validation
- **Tier Hierarchy** - Higher tiers must have better limits
- **Range Checks** - Values must be within reasonable bounds
- **Format Validation** - Supported formats must be valid MIME types
- **Type Safety** - Full TypeScript validation

### Error Handling
- **User-friendly Messages** - Clear error descriptions
- **Rollback Support** - Invalid changes are rejected
- **Visual Indicators** - Errors highlighted in UI

### Safety Features
- **Auto-save** prevents data loss
- **Export/Import** for backups
- **Reset Options** for recovery
- **Validation Warnings** before destructive actions

## Integration with Existing System

The tier configuration automatically integrates with:

✅ **Tier Service** - `tierService.getTierLimits()`  
✅ **Auth Store** - User limit checking  
✅ **Subscription Service** - Plan descriptions  
✅ **Usage Tracking** - Limit enforcement  

Changes take effect **immediately** across the entire application.

## Troubleshooting

### Config Not Saving
- Check localStorage quota
- Verify browser permissions
- Check console for errors

### Changes Not Reflecting
- Refresh the page
- Check if environment variables override
- Verify component is using `useTierConfig`

### Import/Export Issues
- Validate JSON format
- Check required fields are present
- Ensure values are within valid ranges

## Examples

### Common Use Cases

**Promotional Free Tier Boost:**
```typescript
// Temporarily increase free limits for promotion
await updateTierConfig('free', {
  ...currentFreeConfig,
  maxImagesPerMonth: 1000,  // Up from 100
  maxFileSize: 10 * 1024 * 1024  // Up to 10MB
})
```

**New Format Rollout:**
```typescript
// Add AVIF support to Pro tier
const proFormats = [...config.pro.supportedFormats, 'image/avif']
await updateTierConfig('pro', {
  ...config.pro,
  supportedFormats: proFormats
})
```

**A/B Testing:**
```typescript
// Export current config for backup
const backup = exportConfig()

// Test new limits
await updateTierConfig('free', testConfig)

// Restore if needed
await importConfig(backup)
```

This admin interface gives you complete control over tier limits with enterprise-grade management features! 🚀