-- Migration: Create user_usage table for NamoGPT Model Usage Meter
-- Timestamp: 2026-10-20T00:00:00Z
-- Author: NamoGPT Backend & Telemetry Specialist

-- ============================================================================
-- 1. USER USAGE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  model TEXT NOT NULL,
  prompt_tokens BIGINT NOT NULL DEFAULT 0,
  completion_tokens BIGINT NOT NULL DEFAULT 0,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  duration_sec NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON public.user_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_created_at ON public.user_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_usage_model ON public.user_usage(model);

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS) MANDATE
-- ============================================================================
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_usage table
DO $$
BEGIN
  -- SELECT Policy: Users can inspect their own records; Superadmins and guest fallback (strict isolation, no OR true)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_usage' AND policyname = 'user_usage_select_policy'
  ) THEN
    CREATE POLICY user_usage_select_policy ON public.user_usage
      FOR SELECT
      USING (
        auth.uid()::text = user_id 
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'superadmin'))
        OR (auth.uid() IS NULL AND (user_id IS NULL OR user_id = 'anonymous' OR user_id LIKE 'guest%'))
      );
  END IF;

  -- INSERT Policy: Authenticated users can insert their own telemetry records; anonymous records allowed
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_usage' AND policyname = 'user_usage_insert_policy'
  ) THEN
    CREATE POLICY user_usage_insert_policy ON public.user_usage
      FOR INSERT
      WITH CHECK (
        auth.uid()::text = user_id 
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'superadmin'))
        OR (auth.uid() IS NULL AND (user_id IS NULL OR user_id = 'anonymous' OR user_id LIKE 'guest%'))
      );
  END IF;

  -- DELETE Policy: Users can delete only their own records; Superadmins can purge
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_usage' AND policyname = 'user_usage_delete_policy'
  ) THEN
    CREATE POLICY user_usage_delete_policy ON public.user_usage
      FOR DELETE
      USING (
        auth.uid()::text = user_id 
        OR (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid()::text AND role = 'superadmin'))
      );
  END IF;
END $$;
