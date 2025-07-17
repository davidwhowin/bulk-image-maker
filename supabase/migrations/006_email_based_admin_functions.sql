-- Email-based admin functions for improved UX
-- This migration adds email-based user lookup and top usage statistics functions

-- Function to get user by email (admin-only)
CREATE OR REPLACE FUNCTION public.get_user_by_email(user_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  user_tier VARCHAR(20),
  current_images INTEGER,
  current_storage BIGINT,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  current_month VARCHAR(7);
BEGIN
  -- Input validation
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email cannot be null or empty';
  END IF;

  -- Validate email format (basic check)
  IF user_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email format';
  END IF;

  current_month := TO_CHAR(NOW(), 'YYYY-MM');

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at,
    COALESCE(up.user_tier, 'FREE') as user_tier,
    COALESCE(us.images_processed, 0) as current_images,
    COALESCE(us.storage_used, 0) as current_storage,
    us.last_updated as last_activity
  FROM auth.users u
  LEFT JOIN public.user_profiles up ON u.id = up.id
  LEFT JOIN public.usage_stats us ON u.id = us.user_id AND us.current_month = current_month
  WHERE u.email ILIKE user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search users by email pattern (admin-only)
CREATE OR REPLACE FUNCTION public.search_users_by_email(
  email_pattern TEXT,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  user_tier VARCHAR(20),
  current_images INTEGER,
  current_storage BIGINT,
  last_activity TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  current_month VARCHAR(7);
  search_pattern TEXT;
BEGIN
  -- Input validation
  IF email_pattern IS NULL OR email_pattern = '' THEN
    RAISE EXCEPTION 'Email pattern cannot be null or empty';
  END IF;

  IF limit_count <= 0 OR limit_count > 100 THEN
    RAISE EXCEPTION 'Limit must be between 1 and 100';
  END IF;

  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  search_pattern := '%' || email_pattern || '%';

  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.created_at,
    COALESCE(up.user_tier, 'FREE') as user_tier,
    COALESCE(us.images_processed, 0) as current_images,
    COALESCE(us.storage_used, 0) as current_storage,
    us.last_updated as last_activity
  FROM auth.users u
  LEFT JOIN public.user_profiles up ON u.id = up.id
  LEFT JOIN public.usage_stats us ON u.id = us.user_id AND us.current_month = current_month
  WHERE u.email ILIKE search_pattern
  ORDER BY u.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top users by usage (admin-only)
CREATE OR REPLACE FUNCTION public.get_top_users_by_usage(
  target_month VARCHAR(7) DEFAULT NULL,
  limit_count INTEGER DEFAULT 10,
  order_by VARCHAR(10) DEFAULT 'images'
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  user_tier VARCHAR(20),
  images_processed INTEGER,
  storage_used BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  month_str VARCHAR(7);
BEGIN
  -- Input validation
  IF limit_count <= 0 OR limit_count > 100 THEN
    RAISE EXCEPTION 'Limit must be between 1 and 100';
  END IF;

  IF order_by NOT IN ('images', 'storage') THEN
    RAISE EXCEPTION 'Order by must be either "images" or "storage"';
  END IF;

  -- Determine target month
  IF target_month IS NULL THEN
    month_str := TO_CHAR(NOW(), 'YYYY-MM');
  ELSE
    -- Validate month format
    IF target_month !~ '^\d{4}-\d{2}$' THEN
      RAISE EXCEPTION 'Invalid month format. Use YYYY-MM (e.g., 2025-01)';
    END IF;
    month_str := target_month;
  END IF;

  RETURN QUERY
  SELECT 
    us.user_id,
    u.email,
    COALESCE(up.user_tier, 'FREE') as user_tier,
    us.images_processed,
    us.storage_used,
    us.last_updated,
    u.created_at
  FROM public.usage_stats us
  JOIN auth.users u ON us.user_id = u.id
  LEFT JOIN public.user_profiles up ON u.id = up.id
  WHERE us.current_month = month_str
  ORDER BY 
    CASE 
      WHEN order_by = 'images' THEN us.images_processed 
      WHEN order_by = 'storage' THEN us.storage_used 
    END DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get usage statistics by month (admin-only)
CREATE OR REPLACE FUNCTION public.get_usage_stats_by_month(
  target_month VARCHAR(7) DEFAULT NULL
)
RETURNS TABLE (
  total_users INTEGER,
  active_users INTEGER,
  total_images INTEGER,
  total_storage BIGINT,
  avg_images_per_user DECIMAL,
  avg_storage_per_user BIGINT,
  free_users INTEGER,
  pro_users INTEGER,
  premium_users INTEGER
) AS $$
DECLARE
  month_str VARCHAR(7);
BEGIN
  -- Determine target month
  IF target_month IS NULL THEN
    month_str := TO_CHAR(NOW(), 'YYYY-MM');
  ELSE
    -- Validate month format
    IF target_month !~ '^\d{4}-\d{2}$' THEN
      RAISE EXCEPTION 'Invalid month format. Use YYYY-MM (e.g., 2025-01)';
    END IF;
    month_str := target_month;
  END IF;

  RETURN QUERY
  SELECT 
    COUNT(DISTINCT u.id)::INTEGER as total_users,
    COUNT(DISTINCT CASE WHEN us.images_processed > 0 THEN u.id END)::INTEGER as active_users,
    COALESCE(SUM(us.images_processed), 0)::INTEGER as total_images,
    COALESCE(SUM(us.storage_used), 0)::BIGINT as total_storage,
    CASE 
      WHEN COUNT(DISTINCT u.id) > 0 THEN COALESCE(SUM(us.images_processed), 0)::DECIMAL / COUNT(DISTINCT u.id)
      ELSE 0 
    END as avg_images_per_user,
    CASE 
      WHEN COUNT(DISTINCT u.id) > 0 THEN COALESCE(SUM(us.storage_used), 0) / COUNT(DISTINCT u.id)
      ELSE 0 
    END as avg_storage_per_user,
    COUNT(DISTINCT CASE WHEN COALESCE(up.user_tier, 'FREE') = 'FREE' THEN u.id END)::INTEGER as free_users,
    COUNT(DISTINCT CASE WHEN COALESCE(up.user_tier, 'FREE') = 'PRO' THEN u.id END)::INTEGER as pro_users,
    COUNT(DISTINCT CASE WHEN COALESCE(up.user_tier, 'FREE') = 'PREMIUM' THEN u.id END)::INTEGER as premium_users
  FROM auth.users u
  LEFT JOIN public.user_profiles up ON u.id = up.id
  LEFT JOIN public.usage_stats us ON u.id = us.user_id AND us.current_month = month_str;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated email-based version of set_usage_stats
CREATE OR REPLACE FUNCTION public.set_usage_stats_by_email(
  user_email TEXT,
  images_count INTEGER,
  storage_bytes BIGINT,
  target_month VARCHAR(7) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  user_uuid UUID;
  user_data RECORD;
BEGIN
  -- Input validation
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email cannot be null or empty';
  END IF;

  -- Get user by email
  SELECT id INTO user_uuid 
  FROM auth.users 
  WHERE email = user_email;

  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User with email % does not exist', user_email;
  END IF;

  -- Call the existing UUID-based function
  RETURN public.set_usage_stats(user_uuid, images_count, storage_bytes, target_month);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated email-based version of reset_usage_stats
CREATE OR REPLACE FUNCTION public.reset_usage_stats_by_email(
  user_email TEXT,
  target_month VARCHAR(7) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Input validation
  IF user_email IS NULL OR user_email = '' THEN
    RAISE EXCEPTION 'Email cannot be null or empty';
  END IF;

  -- Get user by email
  SELECT id INTO user_uuid 
  FROM auth.users 
  WHERE email = user_email;

  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User with email % does not exist', user_email;
  END IF;

  -- Call the existing UUID-based function
  RETURN public.reset_usage_stats(user_uuid, target_month);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users_by_email(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_users_by_usage(VARCHAR, INTEGER, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_stats_by_month(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_usage_stats_by_email(TEXT, INTEGER, BIGINT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_usage_stats_by_email(TEXT, VARCHAR) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_user_by_email IS 'Admin function to get user details by email address';
COMMENT ON FUNCTION public.search_users_by_email IS 'Admin function to search users by email pattern with usage data';
COMMENT ON FUNCTION public.get_top_users_by_usage IS 'Admin function to get top users by image processing or storage usage';
COMMENT ON FUNCTION public.get_usage_stats_by_month IS 'Admin function to get aggregated usage statistics for a month';
COMMENT ON FUNCTION public.set_usage_stats_by_email IS 'Admin function to set usage statistics using email address';
COMMENT ON FUNCTION public.reset_usage_stats_by_email IS 'Admin function to reset usage statistics using email address';