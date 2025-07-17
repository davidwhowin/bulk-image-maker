-- Ensure admin functions are available
-- This migration ensures the required admin functions exist in the database

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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_top_users_by_usage(VARCHAR, INTEGER, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_stats_by_month(VARCHAR) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_top_users_by_usage IS 'Admin function to get top users by image processing or storage usage';
COMMENT ON FUNCTION public.get_usage_stats_by_month IS 'Admin function to get aggregated usage statistics for a month';