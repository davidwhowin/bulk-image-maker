# 📁 Scripts Directory

Essential utility scripts for the bulk image processing application.

## 🛠️ Available Scripts

### 🗄️ **Database Tools**

#### `check-database-schema.sql`
Database schema verification script for Supabase.
```bash
# Usage: Copy and run in Supabase SQL Editor
# Purpose: Verify table structure and existing indexes
```

### 📊 **Performance Monitoring**

#### `performance-verification.js`
Comprehensive performance optimization verification.
```bash
node scripts/performance-verification.js
# Purpose: Verify all optimizations are applied correctly
# Output: Performance impact analysis and status report
```

#### `test-performance-improvements.js`
Performance testing suite for all optimizations.
```bash
node scripts/test-performance-improvements.js
# Purpose: Test database, React, bundle, and processing optimizations
# Output: Simulated performance improvements and benchmarks
```

### 💳 **Development Tools**

#### `stripe-listen.sh`
Stripe webhook forwarding for local development.
```bash
./scripts/stripe-listen.sh
# Purpose: Forward Stripe webhooks to local development server
# Requires: Stripe CLI installed and configured
```

## 🎯 **Quick Commands**

```bash
# Verify all performance optimizations
npm run verify-performance

# Test performance improvements
npm run test-performance

# Check database schema (copy to Supabase SQL Editor)
cat scripts/check-database-schema.sql

# Start Stripe webhook forwarding
./scripts/stripe-listen.sh
```

## 📋 **Script Maintenance**

- ✅ **Optimized**: Removed 30+ temporary optimization files
- ✅ **Essential**: Kept only production-useful scripts
- ✅ **Documented**: Each script has clear purpose and usage

All performance optimization files have been cleaned up as the optimizations are now permanently applied to the codebase.