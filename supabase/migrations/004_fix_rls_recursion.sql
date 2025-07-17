-- Fix RLS policy recursion issue
-- The problem is that admin policies are checking user_profiles table from within policies that protect user_profiles

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.user_profiles;

-- Create a security definer function to check admin status without causing recursion
CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Use a direct query without RLS to avoid recursion
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = auth.uid() AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- Create new admin policies that use the security definer function
CREATE POLICY "Admins can view all profiles" ON public.user_profiles
  FOR SELECT USING (
    auth.uid() = id OR public.current_user_is_admin()
  );

CREATE POLICY "Admins can update any profile" ON public.user_profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.current_user_is_admin()
  );

-- Also update the is_admin() function to use the same pattern
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.current_user_is_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to safely get user profile data
CREATE OR REPLACE FUNCTION public.get_user_profile(target_user_id UUID DEFAULT auth.uid())
RETURNS TABLE(
  id UUID,
  user_tier VARCHAR(20),
  is_admin BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- Check if the requesting user can access this profile
  IF target_user_id = auth.uid() OR public.current_user_is_admin() THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.user_tier,
      p.is_admin,
      p.created_at,
      p.updated_at
    FROM public.user_profiles p
    WHERE p.id = target_user_id;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_profile(UUID) TO authenticated;

-- Create a function to safely update user profiles
CREATE OR REPLACE FUNCTION public.update_user_profile(
  target_user_id UUID,
  new_user_tier VARCHAR(20) DEFAULT NULL,
  new_is_admin BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  current_user_admin BOOLEAN;
  target_exists BOOLEAN;
BEGIN
  -- Get current user admin status
  SELECT public.current_user_is_admin() INTO current_user_admin;
  
  -- Check if target user exists
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = target_user_id) INTO target_exists;
  
  IF NOT target_exists THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'User not found'
    );
  END IF;
  
  -- Check permissions
  IF target_user_id != auth.uid() AND NOT current_user_admin THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Insufficient permissions'
    );
  END IF;
  
  -- Non-admin users cannot change admin status
  IF new_is_admin IS NOT NULL AND NOT current_user_admin THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Only admins can change admin status'
    );
  END IF;
  
  -- Update the profile
  UPDATE public.user_profiles 
  SET 
    user_tier = COALESCE(new_user_tier, user_tier),
    is_admin = COALESCE(new_is_admin, is_admin),
    updated_at = NOW()
  WHERE id = target_user_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'message', 'Profile updated successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, VARCHAR(20), BOOLEAN) TO authenticated;