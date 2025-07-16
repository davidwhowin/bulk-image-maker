# Supabase Migration Instructions

Since the Supabase CLI requires Docker (which isn't running), you'll need to manually apply the migration through the Supabase Dashboard.

## Steps to Apply Migration:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `hwlgbnhgoorlawloqpgh`

2. **Access SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration

4. **Verify Tables Created**
   - Go to "Table Editor" in the left sidebar
   - You should see the following tables:
     - `user_profiles`
     - `usage_stats`
     - `subscriptions`
     - `billing_info`
     - `processing_history`

## Alternative: Use supabase CLI (if you start Docker)

If you want to use the CLI instead:

```bash
# Start Docker daemon first
sudo systemctl start docker

# Initialize Supabase (only once)
supabase init

# Link to remote project
supabase link --project-ref hwlgbnhgoorlawloqpgh

# Apply migrations
supabase db push
```

## Database Schema Overview

The migration creates:
- **user_profiles**: Stores user tier information
- **usage_stats**: Monthly usage tracking per user
- **subscriptions**: Subscription management
- **billing_info**: Payment and billing details
- **processing_history**: Analytics for image processing

All tables have Row Level Security (RLS) enabled with appropriate policies.