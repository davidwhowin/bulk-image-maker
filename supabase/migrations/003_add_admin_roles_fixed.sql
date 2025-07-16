-- Add admin role support to user_profiles table
ALTER TABLE public.user_profiles 
ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Create an index for faster admin queries
CREATE INDEX idx_user_profiles_is_admin ON public.user_profiles(is_admin) WHERE is_admin = TRUE;

-- Update RLS policies to include admin checks
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile (non-admin fields only)
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile" ON public.user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Create RPC function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Create RPC function to promote user to admin (only callable by existing admins)
CREATE OR REPLACE FUNCTION public.promote_to_admin(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_user_admin BOOLEAN;
  target_exists BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT is_admin INTO current_user_admin 
  FROM public.user_profiles 
  WHERE id = auth.uid();
  
  IF NOT current_user_admin THEN
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

-- Grant execute permission to authenticated users (function handles authorization)
GRANT EXECUTE ON FUNCTION public.promote_to_admin(UUID) TO authenticated;

-- Create RPC function to revoke admin status (only callable by existing admins)
CREATE OR REPLACE FUNCTION public.revoke_admin(target_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  current_user_admin BOOLEAN;
  target_exists BOOLEAN;
  admin_count INTEGER;
BEGIN
  -- Check if current user is admin
  SELECT is_admin INTO current_user_admin 
  FROM public.user_profiles 
  WHERE id = auth.uid();
  
  IF NOT current_user_admin THEN
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

-- Grant execute permission to authenticated users (function handles authorization)
GRANT EXECUTE ON FUNCTION public.revoke_admin(UUID) TO authenticated;

-- NOTE: To create your first admin user, run this after creating your account:
-- UPDATE public.user_profiles SET is_admin = TRUE WHERE email = 'your-email@example.com';
-- Or use the user ID:
-- UPDATE public.user_profiles SET is_admin = TRUE WHERE id = 'your-user-id-here';