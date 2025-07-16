# Supabase Database Migration

This document outlines the complete migration from in-memory storage to Supabase database for the bulk image optimizer application.

## ✅ Completed Migration Steps

### 1. Database Schema Design ✅
- Created comprehensive schema in `supabase/migrations/001_initial_schema.sql`
- Designed tables for user profiles, usage stats, subscriptions, billing info, and processing history
- Implemented Row Level Security (RLS) with appropriate policies
- Added database functions for common operations

### 2. Updated Services ✅

#### Auth Store (`src/lib/auth-store.ts`)
- ✅ Updated to fetch user tier from `user_profiles` table
- ✅ Modified login/register to sync with database
- ✅ Added database integration for user tier updates
- ✅ Enhanced auth state management with Supabase data

#### Tier Service (`src/lib/tier-service.ts`)
- ✅ Replaced in-memory Map storage with Supabase queries
- ✅ Updated `updateUsage()` to use `update_usage_stats` RPC function
- ✅ Modified `getUserUsage()` to use `get_current_usage` RPC function
- ✅ Added comprehensive error handling with `TierErrorHandler`

#### Subscription Service (`src/lib/subscription-service.ts`)
- ✅ Migrated subscription management to `subscriptions` table
- ✅ Updated billing info management to use `billing_info` table
- ✅ Enhanced upgrade/downgrade functionality with database persistence
- ✅ Maintained backward compatibility with testing mode

### 3. Error Handling ✅
- ✅ Added `DATABASE_ERROR` to tier error codes
- ✅ Enhanced error handling for database operations
- ✅ Implemented retry logic for database failures
- ✅ Added comprehensive error messaging

## 🔄 Manual Steps Required

### 1. Apply Database Migration
Since Docker is not running, you need to manually apply the migration:

1. **Open Supabase Dashboard**: https://supabase.com/dashboard
2. **Select Project**: `hwlgbnhgoorlawloqpgh`
3. **Go to SQL Editor** → New Query
4. **Copy and paste** contents of `supabase/migrations/001_initial_schema.sql`
5. **Execute** the migration
6. **Verify** tables are created in Table Editor

### 2. Test the Integration
After applying the migration, you can test the integration:

```bash
# Optional: Run the test script (requires tsx)
npx tsx scripts/test-supabase-integration.ts

# Start the development server
npm run dev

# Test user registration and login
# Verify tier limits and usage tracking
```

## 📊 Database Schema Overview

### Tables Created
- **`user_profiles`**: User tier information (extends auth.users)
- **`usage_stats`**: Monthly usage tracking per user
- **`subscriptions`**: Subscription management
- **`billing_info`**: Payment and billing details  
- **`processing_history`**: Analytics for image processing (optional)

### RPC Functions
- **`get_current_usage(user_uuid)`**: Retrieves current month's usage stats
- **`update_usage_stats(user_uuid, additional_images, additional_storage)`**: Updates usage statistics
- **`handle_new_user()`**: Automatically creates user profile and free subscription on signup

### Security Features
- **Row Level Security (RLS)** enabled on all tables
- **Policies** ensure users can only access their own data
- **Automatic user profile creation** on signup
- **Data validation** at database level

## 🔧 Configuration

### Environment Variables
The application uses these environment variables (already configured):
```env
VITE_SUPABASE_URL=https://hwlgbnhgoorlawloqpgh.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Supabase Client
The client is configured in `src/lib/supabase.ts` with:
- Auto refresh tokens
- Persistent sessions
- URL detection for auth flows

## 🧪 Testing Migration

### Automated Tests
Run the integration test script:
```bash
npx tsx scripts/test-supabase-integration.ts
```

### Manual Testing Checklist
- [ ] User registration creates profile and subscription
- [ ] User login fetches correct tier information
- [ ] Usage tracking updates in database
- [ ] Tier limits are enforced correctly
- [ ] Subscription upgrades work
- [ ] Data persists across sessions

## 🚀 Next Steps

1. **Apply the migration** using the Supabase dashboard
2. **Test user flows** thoroughly
3. **Monitor database performance** as users start using it
4. **Set up database backups** for production
5. **Consider adding indexes** for frequently queried data

## 🔍 Troubleshooting

### Common Issues
- **Connection errors**: Check environment variables and network
- **Migration errors**: Ensure tables don't already exist
- **RPC errors**: Verify functions were created correctly
- **Auth errors**: Check RLS policies are correctly configured

### Debug Commands
```bash
# Check Supabase connection
npm run dev
# Open browser console and check for errors

# Test specific functions
# Use Supabase SQL editor to test RPC functions manually
```

## 📝 Migration Impact

### What Changed
- ✅ **Data persistence**: Usage and subscription data now persists across sessions
- ✅ **User management**: Proper user profiles with tier information  
- ✅ **Scalability**: Database can handle multiple users and high load
- ✅ **Security**: Row-level security protects user data
- ✅ **Analytics**: Processing history for insights and optimization

### What Stayed the Same
- ✅ **API contracts**: All function signatures remain unchanged
- ✅ **User experience**: No changes to UI or user workflows
- ✅ **Testing mode**: Development and testing capabilities preserved
- ✅ **Error handling**: Enhanced but backward-compatible error messages

The migration is now complete and ready for testing! 🎉