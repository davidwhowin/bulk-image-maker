-- Check what tables and columns actually exist in your database
-- Run this first to verify the schema before applying indexes

-- 1. List all tables in the public schema
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Check specific table columns
-- User profiles table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Usage stats table  
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'usage_stats'
ORDER BY ordinal_position;

-- Subscriptions table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- Processing history table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'processing_history'
ORDER BY ordinal_position;

-- Billing info table (if exists)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'billing_info'
ORDER BY ordinal_position;

-- 3. Check existing indexes
SELECT indexname, tablename, indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
AND indexname NOT LIKE 'pg_%'
ORDER BY tablename, indexname;