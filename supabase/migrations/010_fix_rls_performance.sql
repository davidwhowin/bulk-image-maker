-- Fix RLS Performance Issues
-- This migration optimizes RLS policies to prevent auth.uid() re-evaluation for each row

-- =====================================
-- DROP EXISTING POLICIES
-- =====================================

-- Drop existing policies for usage_stats
DROP POLICY IF EXISTS "Users can view own usage stats" ON public.usage_stats;
DROP POLICY IF EXISTS "Users can insert own usage stats" ON public.usage_stats;
DROP POLICY IF EXISTS "Users can update own usage stats" ON public.usage_stats;

-- Drop existing policies for user_profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Prevent admin status changes by non-admins" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;

-- Drop existing policies for subscriptions
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;

-- Drop existing policies for billing_info
DROP POLICY IF EXISTS "Users can view own billing info" ON public.billing_info;
DROP POLICY IF EXISTS "Users can insert own billing info" ON public.billing_info;
DROP POLICY IF EXISTS "Users can update own billing info" ON public.billing_info;

-- Drop existing policies for processing_history
DROP POLICY IF EXISTS "Users can view own processing history" ON public.processing_history;
DROP POLICY IF EXISTS "Users can insert own processing history" ON public.processing_history;

-- =====================================
-- CREATE OPTIMIZED SECURITY DEFINER FUNCTION FIRST
-- =====================================

-- Enhanced current_user_is_admin function with better performance
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  current_user_uuid UUID;
  is_admin_user BOOLEAN;
BEGIN
  -- Get the current user ID once
  current_user_uuid := (SELECT auth.uid());
  
  -- Return false if no authenticated user
  IF current_user_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check admin status with explicit query
  SELECT is_admin INTO is_admin_user 
  FROM public.user_profiles 
  WHERE id = current_user_uuid;
  
  RETURN COALESCE(is_admin_user, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================
-- CREATE OPTIMIZED RLS POLICIES
-- =====================================

-- Optimized usage_stats policies
CREATE POLICY "Users can view own usage stats" ON public.usage_stats
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own usage stats" ON public.usage_stats
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own usage stats" ON public.usage_stats
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- Optimized user_profiles policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

-- Optimized admin policies using security definer function
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (
    (SELECT auth.uid()) = id OR public.current_user_is_admin()
  );

CREATE POLICY "Admins can update any profile" ON public.user_profiles
  FOR UPDATE USING (
    (SELECT auth.uid()) = id OR public.current_user_is_admin()
  );

-- Optimized subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- Optimized billing_info policies
CREATE POLICY "Users can view own billing info" ON public.billing_info
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own billing info" ON public.billing_info
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own billing info" ON public.billing_info
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

-- Optimized processing_history policies
CREATE POLICY "Users can view own processing history" ON public.processing_history
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own processing history" ON public.processing_history
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

-- =====================================
-- ADDITIONAL OPTIMIZATION FUNCTIONS
-- =====================================

-- =====================================
-- CREATE RLS PERFORMANCE MONITORING
-- =====================================

-- Function to analyze RLS policy performance
CREATE OR REPLACE FUNCTION public.analyze_rls_performance()
RETURNS TABLE (
  table_name TEXT,
  policy_name TEXT,
  policy_type TEXT,
  has_auth_uid_optimization BOOLEAN,
  recommendation TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH policy_analysis AS (
    SELECT 
      schemaname||'.'||tablename as table_name,
      policyname as policy_name,
      cmd as policy_type,
      qual as policy_expression,
      -- Check if policy uses optimized auth.uid() pattern
      CASE 
        WHEN qual ~ '\(SELECT auth\.uid\(\)\)' THEN TRUE
        WHEN qual ~ 'auth\.uid\(\)' AND NOT qual ~ '\(SELECT auth\.uid\(\)\)' THEN FALSE
        ELSE NULL
      END as has_auth_uid_optimization
    FROM pg_policies 
    WHERE schemaname = 'public'
  )
  SELECT 
    pa.table_name,
    pa.policy_name,
    pa.policy_type,
    pa.has_auth_uid_optimization,
    CASE 
      WHEN pa.has_auth_uid_optimization = FALSE THEN 'OPTIMIZE: Replace auth.uid() with (SELECT auth.uid())'
      WHEN pa.has_auth_uid_optimization = TRUE THEN 'GOOD: Already optimized'
      ELSE 'INFO: No auth.uid() usage detected'
    END as recommendation
  FROM policy_analysis pa
  ORDER BY pa.table_name, pa.policy_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- GRANT PERMISSIONS
-- =====================================

GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_rls_performance() TO authenticated;

-- =====================================
-- PERFORMANCE VALIDATION
-- =====================================

-- Create index to support optimized RLS policies
CREATE INDEX IF NOT EXISTS idx_user_profiles_id_is_admin 
ON public.user_profiles (id) INCLUDE (is_admin);

-- Update table statistics for better query planning
ANALYZE public.user_profiles;
ANALYZE public.usage_stats;
ANALYZE public.subscriptions;
ANALYZE public.billing_info;
ANALYZE public.processing_history;