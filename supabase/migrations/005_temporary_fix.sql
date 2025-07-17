-- Temporary fix for RLS recursion issue
-- Drop the problematic admin policies that cause recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;

-- Keep only the basic user policies that work
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Update the is_admin function to use a simpler approach
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  admin_status BOOLEAN := FALSE;
BEGIN
  -- Direct query without using RLS-protected views
  SELECT is_admin INTO admin_status
  FROM public.user_profiles
  WHERE id = auth.uid();
  
  RETURN COALESCE(admin_status, FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update admin functions to use the simpler approach
CREATE OR REPLACE FUNCTION public.promote_to_admin(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_user_admin BOOLEAN := FALSE;
  target_exists BOOLEAN := FALSE;
BEGIN
  -- Check if current user is admin using direct query
  SELECT is_admin INTO current_user_admin 
  FROM public.user_profiles 
  WHERE id = auth.uid();
  
  IF NOT COALESCE(current_user_admin, FALSE) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Insufficient permissions: Only admins can promote users'
    );
  END IF;
  
  -- Check if target user exists
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = target_user_id) INTO target_exists;
  
  IF NOT target_exists THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User not found'
    );
  END IF;
  
  -- Promote user to admin
  UPDATE public.user_profiles 
  SET is_admin = TRUE, updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'User successfully promoted to admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.revoke_admin(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_user_admin BOOLEAN := FALSE;
  target_exists BOOLEAN := FALSE;
  admin_count INTEGER := 0;
BEGIN
  -- Check if current user is admin using direct query
  SELECT is_admin INTO current_user_admin 
  FROM public.user_profiles 
  WHERE id = auth.uid();
  
  IF NOT COALESCE(current_user_admin, FALSE) THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Insufficient permissions: Only admins can revoke admin status'
    );
  END IF;
  
  -- Prevent admins from revoking their own admin status
  IF target_user_id = auth.uid() THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Cannot revoke your own admin status'
    );
  END IF;
  
  -- Check if target user exists
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = target_user_id) INTO target_exists;
  
  IF NOT target_exists THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User not found'
    );
  END IF;
  
  -- Check that we're not revoking the last admin
  SELECT COUNT(*) INTO admin_count 
  FROM public.user_profiles 
  WHERE is_admin = TRUE AND id != target_user_id;
  
  IF admin_count = 0 THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Cannot revoke admin status: At least one admin must remain'
    );
  END IF;
  
  -- Revoke admin status
  UPDATE public.user_profiles 
  SET is_admin = FALSE, updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Admin status successfully revoked'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;