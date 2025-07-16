# Admin System Guide

This document provides comprehensive guidance for the admin system in the bulk image optimizer application.

## Overview

The admin system provides complete administrative control over the application with:
- **Database-level security** with Row Level Security (RLS) policies
- **Route-level protection** with authenticated admin-only access
- **Component-level security** with role verification
- **Visual tier configuration** with real-time updates
- **User usage management** with comprehensive controls

## Admin Security System

### Architecture

#### Database Security Layer
- **Admin Role Field**: `is_admin BOOLEAN DEFAULT FALSE` in user_profiles table
- **Row Level Security (RLS)**: Comprehensive policies protecting admin operations
- **Security Functions**: `is_admin()`, `promote_to_admin()`, `revoke_admin()`

#### Application Security Layer
- **Protected Routes**: `<ProtectedRoute requireAdmin={true}>`
- **Auth Store Integration**: Admin status tracking and verification
- **Component Security**: Role verification at component level

### Access Control Flow

```
User requests /admin
↓
ProtectedRoute checks authentication
↓
ProtectedRoute calls supabase.rpc('is_admin')
↓
Database verifies admin status via RLS
↓
Component renders if admin, shows "Access Denied" if not
```

### Security Safeguards

#### Database Level
- **RLS Enforcement**: All admin operations protected by RLS policies
- **Function Security**: Admin functions use `SECURITY DEFINER` with internal auth checks
- **Last Admin Protection**: Cannot revoke the last admin's status
- **Self-Protection**: Admins cannot revoke their own admin status

#### Application Level
- **Double Protection**: Route-level + component-level admin checks
- **Graceful Degradation**: Clear error messages for insufficient permissions
- **State Management**: Admin status tracked in auth store for UI consistency
- **Error Boundaries**: Auth errors caught and handled gracefully

## Tier Configuration Interface

### Overview
The admin tier configuration interface provides a visual, interactive way to manage subscription plan limits and features without editing code files.

### Features

#### Visual Tier Editor
- **Interactive Sliders** for max images per month (0-100K range)
- **File Size Controls** with dropdown selectors (1MB-500MB)
- **Batch Size Adjustments** with number inputs
- **Format Selection** with categorized checkboxes
- **Feature Toggles** for team features and support levels

#### Visual Comparison Charts
- **Bar Charts** comparing limits across all tiers
- **Real-time Updates** as you adjust settings
- **Color-coded Tiers** (Free=gray, Pro=blue, Team=green, Enterprise=purple)
- **Format Support Matrix** showing capabilities

#### Configuration Management
- **Auto-save** - Changes saved instantly to localStorage
- **Import/Export** - Backup and restore configurations as JSON
- **Reset Options** - Revert to defaults or clear stored settings
- **Environment Overrides** - Support for env variable configuration

### Quick Start

#### 1. Access the Admin Interface
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

#### 2. Adjust Free Plan Limits
To change the free plan from 100 to 500 images:
1. Go to the **Free Plan** tab
2. Use the **Max Images per Month** slider
3. Drag to 500 or type `500` in the input box
4. Changes save automatically ✅

#### 3. Export/Import Settings
- **Export**: Click "📤 Export" → Downloads tier-config-YYYY-MM-DD.json
- **Import**: Click "📁 Import" → Upload JSON file or paste configuration

### Configuration Structure

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

## User Usage Controls

### Overview
The admin usage controls provide comprehensive management of user monthly image processing usage statistics.

### Available Functions

#### 1. `set_usage_stats(user_uuid, images_count, storage_bytes, target_month?)`
Sets absolute usage values for a user in a specific month.

**Parameters:**
- `user_uuid` (UUID): The user's UUID
- `images_count` (INTEGER): Number of images processed 
- `storage_bytes` (BIGINT): Storage used in bytes
- `target_month` (VARCHAR, optional): Target month in YYYY-MM format (defaults to current month)

**Example SQL:**
```sql
-- Set current month usage
SELECT set_usage_stats('user-uuid-here', 50, 1048576);

-- Set specific month usage  
SELECT set_usage_stats('user-uuid-here', 25, 512000, '2025-01');
```

#### 2. `reset_usage_stats(user_uuid, target_month?)`
Convenience function to reset usage to zero.

**Example SQL:**
```sql
-- Reset current month
SELECT reset_usage_stats('user-uuid-here');

-- Reset specific month
SELECT reset_usage_stats('user-uuid-here', '2025-01');
```

#### 3. `get_usage_history(user_uuid, months_back?)`
Retrieves historical usage data for a user.

**Example SQL:**
```sql
-- Get last 3 months (default)
SELECT * FROM get_usage_history('user-uuid-here');

-- Get last 6 months
SELECT * FROM get_usage_history('user-uuid-here', 6);
```

#### 4. `bulk_reset_usage_stats(target_month?)`
⚠️ **DESTRUCTIVE**: Resets ALL users' usage for a month.

**Example SQL:**
```sql
-- Reset all users for current month
SELECT bulk_reset_usage_stats();

-- Reset all users for specific month
SELECT bulk_reset_usage_stats('2025-01');
```

### Frontend Integration

#### Using the Admin Hook
```typescript
import { useAdminUsageControls } from '@/hooks/useAdminUsageControls'

function AdminDashboard() {
  const { 
    setUserUsage, 
    resetUserUsage, 
    getUserUsageHistory,
    formatFileSize,
    isLoading, 
    error 
  } = useAdminUsageControls()

  const handleSetUsage = async () => {
    const result = await setUserUsage(
      'user-uuid-here', 
      100,           // 100 images
      2097152        // 2MB in bytes
    )
    
    if (result.success) {
      console.log('✅ Usage updated:', result)
    } else {
      console.error('❌ Failed:', result.error)
    }
  }

  const handleResetUser = async () => {
    const result = await resetUserUsage('user-uuid-here')
    console.log('Reset result:', result)
  }

  const handleGetHistory = async () => {
    const history = await getUserUsageHistory('user-uuid-here', 3)
    console.log('Usage history:', history)
  }

  return (
    <div>
      <h2>Admin Controls</h2>
      
      <button onClick={handleSetUsage} disabled={isLoading}>
        Set Usage to 100 images / 2MB
      </button>
      
      <button onClick={handleResetUser} disabled={isLoading}>
        Reset User to Zero
      </button>
      
      <button onClick={handleGetHistory} disabled={isLoading}>
        Get Usage History
      </button>
      
      {error && <div style={{color: 'red'}}>Error: {error}</div>}
      {isLoading && <div>Loading...</div>}
    </div>
  )
}
```

#### Using the Admin Component
```typescript
import { AdminUsageControls } from '@/components/admin'

function AdminPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      
      {/* Complete admin interface */}
      <AdminUsageControls />
    </div>
  )
}
```

### Common Use Cases

#### Test User Setup
```typescript
// Set up a user for testing with specific limits
await setUserUsage('test-user-id', 75, 5242880) // 75 images, 5MB
```

#### Customer Support - Usage Adjustment
```typescript
// Customer accidentally hit limit, give them more images
const currentHistory = await getUserUsageHistory('customer-user-id', 1)
const currentUsage = currentHistory[0]

await setUserUsage(
  'customer-user-id',
  currentUsage.images_processed + 50, // Add 50 more images
  currentUsage.storage_used
)
```

## Admin Management

### Creating the First Admin
After user registration, manually promote to admin:
```sql
UPDATE public.user_profiles 
SET is_admin = TRUE 
WHERE id = (
  SELECT id FROM auth.users 
  WHERE email = 'admin@example.com'
);
```

### Managing Admin Users
Once admin system is active, use the provided functions:

```typescript
// Promote user to admin
const result = await supabase.rpc('promote_to_admin', {
  target_user_id: 'user-uuid-here'
})

// Revoke admin status  
const result = await supabase.rpc('revoke_admin', {
  target_user_id: 'user-uuid-here'
})
```

## Implementation Files

### Database
- `supabase/migrations/003_add_admin_roles_fixed.sql` - Admin role migration
- RLS policies for secure data access

### Frontend Components
- `src/components/auth/ProtectedRoute.tsx` - Route protection with admin checks
- `src/pages/AdminPage.tsx` - Main admin dashboard
- `src/components/admin/TierConfigAdmin.tsx` - Tier configuration interface
- `src/components/admin/AdminUsageControls.tsx` - Usage management interface

### State Management
- `src/lib/auth-store.ts` - Auth store with admin status tracking
- `src/types/auth.ts` - Type definitions with admin fields

### Hooks
- `src/hooks/useAdminUsageControls.ts` - Admin usage control functions

## Security Considerations

### Database Security
- RLS policies must be thoroughly tested
- Admin functions require `SECURITY DEFINER` for privilege elevation
- Regular security audits of policies and functions

### Frontend Security
- Admin status verification on every sensitive operation
- No client-side admin privilege simulation
- Secure state management of admin status

### Network Security
- All admin operations use authenticated API calls
- Database functions validate authentication server-side
- No admin credentials stored client-side

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

## Security Testing

### Access Control Testing
```bash
# Test non-admin access to /admin
# Should show "Access Denied" page

# Test admin access to /admin  
# Should show full admin dashboard
```

### Function Testing
```sql
-- Test admin function access
SELECT public.is_admin(); -- Should return true for admins

-- Test admin promotion (as admin)
SELECT public.promote_to_admin('target-user-id');

-- Test non-admin function access
-- Should return permission error
```

This admin system provides enterprise-grade access control while maintaining usability and clear security boundaries.