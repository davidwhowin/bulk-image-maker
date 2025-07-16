-- Enable Row Level Security (RLS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (user_tier IN ('free', 'pro', 'team', 'enterprise')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Usage statistics table
CREATE TABLE public.usage_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_month VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
  images_processed INTEGER NOT NULL DEFAULT 0 CHECK (images_processed >= 0),
  storage_used BIGINT NOT NULL DEFAULT 0 CHECK (storage_used >= 0), -- in bytes
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Ensure one record per user per month
  UNIQUE(user_id, current_month)
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('free', 'pro', 'team', 'enterprise')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'incomplete')),
  stripe_subscription_id VARCHAR(255) UNIQUE, -- Stripe subscription ID for paid plans
  stripe_customer_id VARCHAR(255), -- Stripe customer ID
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Ensure one active subscription per user
  UNIQUE(user_id)
);

-- Billing information table
CREATE TABLE public.billing_info (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255),
  payment_method_id VARCHAR(255),
  billing_email VARCHAR(255),
  company_name VARCHAR(255),
  billing_address JSONB, -- Store address as JSON
  tax_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id)
);

-- Processing history table (optional - for analytics)
CREATE TABLE public.processing_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id UUID DEFAULT uuid_generate_v4(),
  file_count INTEGER NOT NULL CHECK (file_count > 0),
  total_input_size BIGINT NOT NULL CHECK (total_input_size > 0),
  total_output_size BIGINT NOT NULL CHECK (total_output_size >= 0),
  compression_ratio DECIMAL(5,4), -- e.g., 0.7500 for 75% of original size
  formats_used TEXT[], -- Array of format types used
  processing_time_ms INTEGER, -- Processing time in milliseconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_tier ON public.user_profiles(user_tier);
CREATE INDEX idx_usage_stats_user_month ON public.usage_stats(user_id, current_month);
CREATE INDEX idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON public.subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_billing_info_user ON public.billing_info(user_id);
CREATE INDEX idx_processing_history_user ON public.processing_history(user_id);
CREATE INDEX idx_processing_history_date ON public.processing_history(created_at);

-- Functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_info_updated_at
  BEFORE UPDATE ON public.billing_info
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_history ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Usage stats policies
CREATE POLICY "Users can view own usage stats" ON public.usage_stats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage stats" ON public.usage_stats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage stats" ON public.usage_stats
  FOR UPDATE USING (auth.uid() = user_id);

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

-- Billing info policies
CREATE POLICY "Users can view own billing info" ON public.billing_info
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own billing info" ON public.billing_info
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own billing info" ON public.billing_info
  FOR UPDATE USING (auth.uid() = user_id);

-- Processing history policies
CREATE POLICY "Users can view own processing history" ON public.processing_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processing history" ON public.processing_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to create user profile automatically when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, user_tier)
  VALUES (NEW.id, 'free');
  
  INSERT INTO public.subscriptions (user_id, tier, current_period_start, current_period_end)
  VALUES (
    NEW.id, 
    'free', 
    NOW(), 
    NOW() + INTERVAL '1000 years' -- Free tier never expires
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get current month usage
CREATE OR REPLACE FUNCTION public.get_current_usage(user_uuid UUID)
RETURNS TABLE (
  images_processed INTEGER,
  storage_used BIGINT,
  current_month VARCHAR(7),
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  current_month_str VARCHAR(7);
BEGIN
  current_month_str := TO_CHAR(NOW(), 'YYYY-MM');
  
  RETURN QUERY
  SELECT 
    COALESCE(us.images_processed, 0) as images_processed,
    COALESCE(us.storage_used, 0) as storage_used,
    current_month_str as current_month,
    COALESCE(us.last_updated, NOW()) as last_updated
  FROM public.usage_stats us
  WHERE us.user_id = user_uuid AND us.current_month = current_month_str
  
  UNION ALL
  
  SELECT 
    0 as images_processed,
    0 as storage_used,
    current_month_str as current_month,
    NOW() as last_updated
  WHERE NOT EXISTS (
    SELECT 1 FROM public.usage_stats us 
    WHERE us.user_id = user_uuid AND us.current_month = current_month_str
  )
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update usage stats
CREATE OR REPLACE FUNCTION public.update_usage_stats(
  user_uuid UUID,
  additional_images INTEGER,
  additional_storage BIGINT
)
RETURNS VOID AS $$
DECLARE
  current_month_str VARCHAR(7);
BEGIN
  current_month_str := TO_CHAR(NOW(), 'YYYY-MM');
  
  INSERT INTO public.usage_stats (user_id, current_month, images_processed, storage_used)
  VALUES (user_uuid, current_month_str, additional_images, additional_storage)
  ON CONFLICT (user_id, current_month)
  DO UPDATE SET
    images_processed = usage_stats.images_processed + additional_images,
    storage_used = usage_stats.storage_used + additional_storage,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;