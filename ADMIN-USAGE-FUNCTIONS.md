# Admin Usage Functions

This document describes the admin functions for managing user monthly image processing usage statistics.

## Database Migration

Run the migration to add admin functions:

```bash
# If using Supabase locally
supabase db reset

# If using Supabase cloud
# Upload and run the migration file: supabase/migrations/002_admin_usage_functions.sql
```

## Available Functions

### 1. `set_usage_stats(user_uuid, images_count, storage_bytes, target_month?)`

Sets absolute usage values for a user in a specific month.

**Parameters:**
- `user_uuid` (UUID): The user's UUID
- `images_count` (INTEGER): Number of images processed 
- `storage_bytes` (BIGINT): Storage used in bytes
- `target_month` (VARCHAR, optional): Target month in YYYY-MM format (defaults to current month)

**Returns:** JSONB with success status and operation details

**Example SQL:**
```sql
-- Set current month usage
SELECT set_usage_stats('user-uuid-here', 50, 1048576);

-- Set specific month usage  
SELECT set_usage_stats('user-uuid-here', 25, 512000, '2025-01');
```

### 2. `reset_usage_stats(user_uuid, target_month?)`

Convenience function to reset usage to zero.

**Example SQL:**
```sql
-- Reset current month
SELECT reset_usage_stats('user-uuid-here');

-- Reset specific month
SELECT reset_usage_stats('user-uuid-here', '2025-01');
```

### 3. `get_usage_history(user_uuid, months_back?)`

Retrieves historical usage data for a user.

**Example SQL:**
```sql
-- Get last 3 months (default)
SELECT * FROM get_usage_history('user-uuid-here');

-- Get last 6 months
SELECT * FROM get_usage_history('user-uuid-here', 6);
```

### 4. `bulk_reset_usage_stats(target_month?)`

⚠️ **DESTRUCTIVE**: Resets ALL users' usage for a month.

**Example SQL:**
```sql
-- Reset all users for current month
SELECT bulk_reset_usage_stats();

-- Reset all users for specific month
SELECT bulk_reset_usage_stats('2025-01');
```

## Frontend Integration

### Using the Admin Hook

```typescript
import { useAdminUsageControls } from '@/hooks/useAdminUsageControls'

function AdminPanel() {
  const { setUserUsage, resetUserUsage, isLoading, error } = useAdminUsageControls()

  const handleSetUsage = async () => {
    const result = await setUserUsage('user-uuid', 100, 2097152) // 100 images, 2MB
    
    if (result.success) {
      console.log('Usage updated successfully')
    } else {
      console.error('Failed to update usage:', result.error)
    }
  }

  return (
    <div>
      <button onClick={handleSetUsage} disabled={isLoading}>
        Set Usage
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  )
}
```

### Using the Admin Component

```typescript
import { AdminUsageControls } from '@/components/admin'

function AdminPage() {
  return (
    <div>
      <h1>Admin Panel</h1>
      <AdminUsageControls userId="optional-default-user-id" />
    </div>
  )
}
```

## Security Considerations

1. **Access Control**: The database functions use `SECURITY DEFINER` but application logic should verify admin permissions
2. **Audit Trail**: All operations are logged in the `processing_history` table
3. **Input Validation**: Functions validate all inputs and return detailed error messages
4. **Transaction Safety**: Operations are wrapped in transactions with proper error handling

## Testing Examples

### 1. Set User Usage to Specific Values
```sql
-- Set user to 75 images and 5MB for current month
SELECT set_usage_stats('12345678-1234-1234-1234-123456789012', 75, 5242880);
```

### 2. Reset User to Zero
```sql
-- Reset user's current month usage
SELECT reset_usage_stats('12345678-1234-1234-1234-123456789012');
```

### 3. Check User History
```sql
-- Get user's last 6 months of usage
SELECT * FROM get_usage_history('12345678-1234-1234-1234-123456789012', 6);
```

### 4. Bulk Reset (Testing Only)
```sql
-- Reset all users for January 2025
SELECT bulk_reset_usage_stats('2025-01');
```

## Error Handling

All functions return detailed error information:

```json
{
  "success": false,
  "error": "User with UUID 12345678-1234-1234-1234-123456789012 does not exist",
  "error_code": "P0001"
}
```

Common errors:
- Invalid UUID format
- User does not exist  
- Negative values for images/storage
- Invalid month format
- Database constraints

## Monitoring

Check the `processing_history` table for admin operations:

```sql
-- View recent admin operations
SELECT * FROM processing_history 
WHERE formats_used && ARRAY['ADMIN_ADJUSTMENT', 'BULK_RESET']
ORDER BY created_at DESC
LIMIT 10;
```