# 🔧 Plan Switching Fixes Applied

Fixed the issues you were experiencing when trying to switch plans. Here's what was causing the problems and how they were resolved:

## 🐛 Issues Fixed

### 1. **406 Error on user_profiles Query**
**Problem**: `HRGET .../user_profiles?select=user_tier&id=eq.5ed45de8...` returning 406 (Not Acceptable)

**Root Cause**: User profile didn't exist in database (migration trigger not working or user created before migration)

**Solution**: 
- ✅ Added proper error handling to detect missing profiles
- ✅ Automatic profile creation when `PGRST116` (record not found) error occurs
- ✅ Creates both user profile AND default subscription for new users

### 2. **409 Conflict on Subscription Upgrade**
**Problem**: `duplicate key value violates unique constraint "subscriptions_user_id_key"`

**Root Cause**: Trying to INSERT new subscription when one already exists

**Solution**:
- ✅ Check if subscription exists before upgrade
- ✅ Use UPDATE for existing subscriptions
- ✅ Use INSERT only for new subscriptions
- ✅ Proper handling of both scenarios

## 🔧 Code Changes Applied

### **Auth Store (`src/lib/auth-store.ts`)**
```typescript
// Added fallback profile creation
if (profileError?.code === 'PGRST116') {
  // Create user profile if it doesn't exist
  await supabase.from('user_profiles').insert({
    id: data.user.id,
    user_tier: 'free'
  })
  
  // Also create default subscription
  await supabase.from('subscriptions').insert({
    user_id: data.user.id,
    tier: 'free',
    status: 'active',
    // ... other fields
  })
}
```

### **Subscription Service (`src/lib/subscription-service.ts`)**
```typescript
// Check if subscription exists first
const { data: existingSubscription } = await supabase
  .from('subscriptions')
  .select('id')
  .eq('user_id', userId)
  .single()

if (existingSubscription) {
  // UPDATE existing subscription
  await supabase.from('subscriptions').update({...})
} else {
  // INSERT new subscription
  await supabase.from('subscriptions').insert({...})
}
```

## ✅ What Should Work Now

1. **New Users**: Automatically get profiles and subscriptions created
2. **Existing Users**: Missing profiles get created on login
3. **Plan Upgrades**: Properly update existing subscriptions instead of creating duplicates
4. **Error Handling**: Better error messages and logging

## 🧪 Testing Steps

1. **Try Plan Switching Again**:
   - Go to Plans page
   - Click upgrade to Pro/Team/Enterprise
   - Should work without 406 or 409 errors

2. **Check Console Logs**:
   - Look for: `"Creating user profile for new user"` (if needed)
   - Look for: `"Subscription service result: { success: true }"` (on success)

3. **Verify Database**:
   - Check Supabase dashboard → user_profiles table
   - Check subscriptions table for your user
   - Verify tier updated correctly

## 🔍 If Issues Persist

### **Still Getting 406 Errors?**
- Check RLS policies in Supabase dashboard
- Verify user is authenticated (check auth.users table)
- Check browser console for detailed error messages

### **Still Getting 409 Conflicts?**
- Check if there are multiple subscription rows for your user
- Delete duplicate subscriptions manually in Supabase dashboard
- Try again with clean subscription state

### **Debug Commands**
```javascript
// In browser console:
// Check current user
console.log(useAuthStore.getState().user)

// Check subscription
fetch('https://hwlgbnhgoorlawloqpgh.supabase.co/rest/v1/subscriptions?user_id=eq.YOUR_USER_ID', {
  headers: {
    'apikey': 'YOUR_ANON_KEY',
    'Authorization': 'Bearer YOUR_ANON_KEY'
  }
}).then(r => r.json()).then(console.log)
```

---

🎉 **Plan switching should now work correctly!** The fixes handle both new users and existing users with missing profiles/subscriptions.