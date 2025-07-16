-- Admin functions for managing user usage statistics
-- This migration adds administrative capabilities to set/modify usage stats

-- Function to set absolute usage stats (admin-only)
CREATE OR REPLACE FUNCTION public.set_usage_stats(
  user_uuid UUID,
  images_count INTEGER,
  storage_bytes BIGINT,
  target_month VARCHAR(7) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  month_str VARCHAR(7);
  user_exists BOOLEAN;
  old_images INTEGER DEFAULT 0;
  old_storage BIGINT DEFAULT 0;
  result_data JSONB;
BEGIN
  -- Input validation
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User UUID cannot be null';
  END IF;

  IF images_count < 0 THEN
    RAISE EXCEPTION 'Images count cannot be negative';
  END IF;

  IF storage_bytes < 0 THEN
    RAISE EXCEPTION 'Storage bytes cannot be negative';
  END IF;

  -- Determine target month
  IF target_month IS NULL THEN
    month_str := TO_CHAR(NOW(), 'YYYY-MM');
  ELSE
    -- Validate month format (YYYY-MM)
    IF target_month !~ '^\d{4}-\d{2}$' THEN
      RAISE EXCEPTION 'Invalid month format. Use YYYY-MM (e.g., 2025-01)';
    END IF;
    month_str := target_month;
  END IF;

  -- Check if user exists
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE id = user_uuid
  ) INTO user_exists;

  IF NOT user_exists THEN
    RAISE EXCEPTION 'User with UUID % does not exist', user_uuid;
  END IF;

  -- Get existing values for logging
  SELECT 
    COALESCE(images_processed, 0),
    COALESCE(storage_used, 0)
  INTO old_images, old_storage
  FROM public.usage_stats 
  WHERE user_id = user_uuid AND current_month = month_str;

  -- Upsert the usage stats with absolute values
  INSERT INTO public.usage_stats (user_id, current_month, images_processed, storage_used)
  VALUES (user_uuid, month_str, images_count, storage_bytes)
  ON CONFLICT (user_id, current_month)
  DO UPDATE SET
    images_processed = EXCLUDED.images_processed,
    storage_used = EXCLUDED.storage_used,
    last_updated = NOW();

  -- Log the admin action in processing_history for audit trail
  INSERT INTO public.processing_history (
    user_id,
    batch_id,
    file_count,
    total_input_size,
    total_output_size,
    compression_ratio,
    formats_used,
    processing_time_ms
  ) VALUES (
    user_uuid,
    uuid_generate_v4(),
    images_count - old_images, -- Delta for tracking
    old_storage,
    storage_bytes,
    CASE WHEN old_storage > 0 THEN (storage_bytes::DECIMAL / old_storage) ELSE 1.0 END,
    ARRAY['ADMIN_ADJUSTMENT'], -- Mark as admin action
    0 -- No processing time for admin actions
  );

  -- Prepare result data
  result_data := jsonb_build_object(
    'success', true,
    'user_id', user_uuid,
    'month', month_str,
    'previous_images', old_images,
    'new_images', images_count,
    'previous_storage', old_storage,
    'new_storage', storage_bytes,
    'updated_at', NOW()
  );

  RETURN result_data;

EXCEPTION
  WHEN OTHERS THEN
    -- Return error information
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset usage stats to zero (convenience function)
CREATE OR REPLACE FUNCTION public.reset_usage_stats(
  user_uuid UUID,
  target_month VARCHAR(7) DEFAULT NULL
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.set_usage_stats(user_uuid, 0, 0, target_month);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get usage stats for admin purposes (with historical data)
CREATE OR REPLACE FUNCTION public.get_usage_history(
  user_uuid UUID,
  months_back INTEGER DEFAULT 3
)
RETURNS TABLE (
  month VARCHAR(7),
  images_processed INTEGER,
  storage_used BIGINT,
  last_updated TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  start_month VARCHAR(7);
BEGIN
  -- Calculate start month
  start_month := TO_CHAR(NOW() - INTERVAL '1 month' * months_back, 'YYYY-MM');
  
  RETURN QUERY
  SELECT 
    us.current_month,
    us.images_processed,
    us.storage_used,
    us.last_updated,
    us.created_at
  FROM public.usage_stats us
  WHERE us.user_id = user_uuid 
    AND us.current_month >= start_month
  ORDER BY us.current_month DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk reset multiple users (for testing environments)
CREATE OR REPLACE FUNCTION public.bulk_reset_usage_stats(
  target_month VARCHAR(7) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  month_str VARCHAR(7);
  affected_rows INTEGER;
  result_data JSONB;
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

  -- Reset all users for the specified month
  UPDATE public.usage_stats 
  SET 
    images_processed = 0,
    storage_used = 0,
    last_updated = NOW()
  WHERE current_month = month_str;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;

  -- Log bulk operation
  INSERT INTO public.processing_history (
    user_id,
    batch_id,
    file_count,
    total_input_size,
    total_output_size,
    compression_ratio,
    formats_used,
    processing_time_ms
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::UUID, -- System UUID for bulk operations
    uuid_generate_v4(),
    affected_rows,
    0,
    0,
    0,
    ARRAY['BULK_RESET'],
    0
  );

  result_data := jsonb_build_object(
    'success', true,
    'month', month_str,
    'affected_users', affected_rows,
    'reset_at', NOW()
  );

  RETURN result_data;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for admin functions (they use SECURITY DEFINER so they run with elevated privileges)
-- Note: These functions should only be called by authenticated admin users in the application layer

-- Grant execute permissions to authenticated users (application will handle admin checks)
GRANT EXECUTE ON FUNCTION public.set_usage_stats(UUID, INTEGER, BIGINT, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_usage_stats(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_usage_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_reset_usage_stats(VARCHAR) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.set_usage_stats IS 'Admin function to set absolute usage statistics for a user in a specific month';
COMMENT ON FUNCTION public.reset_usage_stats IS 'Admin convenience function to reset usage statistics to zero';
COMMENT ON FUNCTION public.get_usage_history IS 'Admin function to retrieve historical usage data for a user';
COMMENT ON FUNCTION public.bulk_reset_usage_stats IS 'Admin function to reset usage statistics for all users in a month (testing use)';