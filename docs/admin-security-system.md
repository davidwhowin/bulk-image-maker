# Admin Security System

This document outlines the comprehensive admin security system implemented in the bulk image optimizer application. The system provides role-based access control (RBAC) with secure admin-only areas and functions.

## Overview

The admin security system provides:
- **Database-level security** with Row Level Security (RLS) policies
- **Route-level protection** with authenticated admin-only access
- **Component-level security** with role verification
- **Admin management functions** for user promotion/demotion

## Architecture

### Database Security Layer

#### Admin Role Field
```sql
-- Added to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
```

#### Row Level Security (RLS) Policies
The system implements comprehensive RLS policies:

1. **User Profile Access**:
   - Users can view/update their own profiles
   - Admins can view/update any profile
   - Admin status changes restricted to existing admins

2. **Admin-only Operations**:
   - Tier configuration changes
   - User usage statistics management
   - System-wide settings

#### Security Functions
```sql
-- Check if current user is admin
public.is_admin() -> BOOLEAN

-- Promote user to admin (admin-only)
public.promote_to_admin(target_user_id UUID) -> JSONB

-- Revoke admin status (admin-only, with safeguards)
public.revoke_admin(target_user_id UUID) -> JSONB
```

### Application Security Layer

#### Protected Route Component
```typescript
<ProtectedRoute requireAdmin={true}>
  <AdminPage />
</ProtectedRoute>
```

**Features**:
- Authentication verification
- Admin role checking via database RPC
- Graceful fallback UI for non-admins
- Loading states during verification

#### Auth Store Integration
The auth store tracks admin status:
```typescript
interface AuthState {
  isAdmin: boolean
  // ... other fields
}

// Actions
checkIsAdmin(): Promise<boolean>
```

## Admin Features

### 1. Tier Configuration Management
**Route**: `/admin` → Tier Configuration tab

**Capabilities**:
- Visual tier limit adjustments (sliders/inputs)
- Real-time configuration updates
- Import/export configurations
- Tier comparison charts

**Security**: Admin-only via route protection + database RLS

### 2. User Usage Controls
**Route**: `/admin` → Usage Controls tab

**Capabilities**:
- Set user usage statistics manually
- Reset monthly usage for individual users
- Bulk reset operations
- View usage history

**Security**: Database functions with admin-only access controls

## Access Control Flow

### 1. Route Access
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

### 2. Admin Function Access
```
Admin calls usage control function
↓
Frontend calls supabase.rpc('set_usage_stats', params)
↓
Database function checks auth.uid() admin status
↓
Function executes if admin, returns error if not
```

## Security Safeguards

### Database Level
1. **RLS Enforcement**: All admin operations protected by RLS policies
2. **Function Security**: Admin functions use `SECURITY DEFINER` with internal auth checks
3. **Last Admin Protection**: Cannot revoke the last admin's status
4. **Self-Protection**: Admins cannot revoke their own admin status

### Application Level
1. **Double Protection**: Route-level + component-level admin checks
2. **Graceful Degradation**: Clear error messages for insufficient permissions
3. **State Management**: Admin status tracked in auth store for UI consistency
4. **Error Boundaries**: Auth errors caught and handled gracefully

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

## Security Best Practices

### 1. Defense in Depth
- Multiple security layers (database + application)
- Redundant checks at different levels
- Graceful failure modes

### 2. Principle of Least Privilege
- Users have minimal necessary permissions
- Admin status explicitly required for sensitive operations
- Clear separation between user and admin functions

### 3. Audit Trail
- Database functions return detailed operation results
- Admin actions logged through standard database logging
- Error handling provides security event information

### 4. Safe Defaults
- New users default to non-admin status
- Admin promotion requires explicit action
- Restrictive RLS policies by default

## Testing Admin Features

### 1. Access Control Testing
```bash
# Test non-admin access to /admin
# Should show "Access Denied" page

# Test admin access to /admin  
# Should show full admin dashboard
```

### 2. Function Testing
```sql
-- Test admin function access
SELECT public.is_admin(); -- Should return true for admins

-- Test admin promotion (as admin)
SELECT public.promote_to_admin('target-user-id');

-- Test non-admin function access
-- Should return permission error
```

### 3. UI Testing
- Admin dashboard loads without errors
- Tier configuration sliders work
- Usage controls function properly
- Non-admin users see appropriate error messages

## Security Considerations

### 1. Database Security
- RLS policies must be thoroughly tested
- Admin functions require `SECURITY DEFINER` for privilege elevation
- Regular security audits of policies and functions

### 2. Frontend Security
- Admin status verification on every sensitive operation
- No client-side admin privilege simulation
- Secure state management of admin status

### 3. Network Security
- All admin operations use authenticated API calls
- Database functions validate authentication server-side
- No admin credentials stored client-side

## Maintenance

### 1. Regular Security Audits
- Review RLS policies quarterly
- Test admin function permissions
- Verify access control flows

### 2. Admin User Management
- Regular review of admin user list
- Prompt removal of admin access for departed users
- Documentation of admin privilege changes

### 3. System Updates
- Keep Supabase and dependencies updated
- Monitor security advisories
- Test security features after updates

This admin security system provides enterprise-grade access control while maintaining usability and clear security boundaries.