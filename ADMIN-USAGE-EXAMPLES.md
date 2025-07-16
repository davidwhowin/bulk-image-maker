# Admin Usage Functions - Usage Examples

## Quick Start Guide

### 1. Apply the Database Migration

First, you need to apply the new migration to add the admin functions:

```bash
# If using Supabase locally with Docker
supabase db reset

# If using Supabase cloud
# Go to your Supabase dashboard > SQL Editor
# Copy and run the contents of: supabase/migrations/002_admin_usage_functions.sql
```

### 2. Basic Usage Examples

#### Set a User's Current Month Usage

```sql
-- Set user to 50 images and 1MB storage for current month
SELECT set_usage_stats(
  'user-uuid-here'::UUID, 
  50, 
  1048576
);
```

Result:
```json
{
  "success": true,
  "user_id": "user-uuid-here",
  "month": "2025-01",
  "previous_images": 0,
  "new_images": 50,
  "previous_storage": 0,
  "new_storage": 1048576,
  "updated_at": "2025-01-16T20:52:00Z"
}
```

#### Reset a User to Zero

```sql
-- Reset user's current month usage to zero
SELECT reset_usage_stats('user-uuid-here'::UUID);
```

#### Set Usage for a Specific Month

```sql
-- Set usage for December 2024
SELECT set_usage_stats(
  'user-uuid-here'::UUID, 
  25, 
  524288, 
  '2024-12'
);
```

#### Get User's Usage History

```sql
-- Get last 6 months of usage data
SELECT * FROM get_usage_history('user-uuid-here'::UUID, 6);
```

### 3. Frontend Integration

#### Using the Hook

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

#### Using the Component

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

### 4. Common Use Cases

#### Test User Setup
```typescript
// Set up a user for testing with specific limits
await setUserUsage('test-user-id', 75, 5242880) // 75 images, 5MB
```

#### Monthly Reset for Free Users
```sql
-- Reset all free tier users at start of month
UPDATE usage_stats 
SET images_processed = 0, storage_used = 0, last_updated = NOW()
WHERE user_id IN (
  SELECT id FROM user_profiles WHERE user_tier = 'free'
) AND current_month = TO_CHAR(NOW(), 'YYYY-MM');
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

### 5. Monitoring and Auditing

All admin operations are logged in the `processing_history` table for auditing:

```sql
-- View recent admin operations
SELECT 
  user_id,
  file_count as images_delta,
  total_input_size as old_storage,
  total_output_size as new_storage,
  formats_used,
  created_at
FROM processing_history 
WHERE formats_used && ARRAY['ADMIN_ADJUSTMENT', 'BULK_RESET']
ORDER BY created_at DESC
LIMIT 20;
```

### 6. Error Handling

The functions provide detailed error messages:

```typescript
const result = await setUserUsage('invalid-user-id', 50, 1024)

if (!result.success) {
  console.error('Error:', result.error)
  // Example errors:
  // "User with UUID invalid-user-id does not exist"
  // "Images count cannot be negative"
  // "Invalid month format. Use YYYY-MM (e.g., 2025-01)"
}
```

### 7. Quick Reference

| Function | Purpose | Example |
|----------|---------|---------|
| `set_usage_stats()` | Set absolute values | `SELECT set_usage_stats('uuid', 50, 1024)` |
| `reset_usage_stats()` | Reset to zero | `SELECT reset_usage_stats('uuid')` |
| `get_usage_history()` | Get historical data | `SELECT * FROM get_usage_history('uuid', 6)` |
| `bulk_reset_usage_stats()` | Reset all users | `SELECT bulk_reset_usage_stats('2025-01')` |

### 8. Security Notes

- Functions use `SECURITY DEFINER` for elevated privileges
- Application should verify admin permissions before allowing access
- All operations are logged for audit trails
- Input validation prevents SQL injection and invalid data