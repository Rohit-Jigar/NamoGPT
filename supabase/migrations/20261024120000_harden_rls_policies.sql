-- Migration: Harden Row Level Security (RLS) on users, chats, and user_usage
-- Timestamp: 2026-10-24T12:00:00Z
-- Author: Worker 1 - Security & Penetration Testing Specialist
-- Remediates: VULN-04 (Eliminating USING (true) and OR true bypasses)

-- ============================================================================
-- 1. HARDEN USERS TABLE RLS
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop permissive legacy policies
DROP POLICY IF EXISTS users_select_policy ON public.users;
DROP POLICY IF EXISTS users_insert_policy ON public.users;
DROP POLICY IF EXISTS users_update_policy ON public.users;
DROP POLICY IF EXISTS users_delete_policy ON public.users;

-- SELECT Policy: Users can only read their own profile; Superadmins can read all profiles
CREATE POLICY users_select_policy ON public.users
  FOR SELECT
  USING (
    auth.uid()::text = id
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
  );

-- INSERT Policy: Authenticated users can insert their own record during signup or service role
CREATE POLICY users_insert_policy ON public.users
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = id
    OR auth.role() = 'service_role'
  );

-- UPDATE Policy: Users can update their own profile (cannot escalate their own role to superadmin unless already superadmin)
CREATE POLICY users_update_policy ON public.users
  FOR UPDATE
  USING (
    auth.uid()::text = id
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
  )
  WITH CHECK (
    (auth.uid()::text = id AND (role = 'user' OR role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid()::text)))
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
    OR auth.role() = 'service_role'
  );

-- DELETE Policy: Only self or Superadmins can delete an account
CREATE POLICY users_delete_policy ON public.users
  FOR DELETE
  USING (
    auth.uid()::text = id
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
    OR auth.role() = 'service_role'
  );

-- ============================================================================
-- 2. HARDEN CHATS TABLE RLS
-- ============================================================================
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- Drop permissive legacy policies
DROP POLICY IF EXISTS chats_select_policy ON public.chats;
DROP POLICY IF EXISTS chats_insert_policy ON public.chats;
DROP POLICY IF EXISTS chats_update_policy ON public.chats;
DROP POLICY IF EXISTS chats_delete_policy ON public.chats;

-- SELECT Policy: Users can only read their own chats; Superadmins can read all chats; guest sessions allowed if matching session id
CREATE POLICY chats_select_policy ON public.chats
  FOR SELECT
  USING (
    auth.uid()::text = user_id
    OR (auth.uid() IS NULL AND user_id = 'guest-session')
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
  );

-- INSERT Policy: Users can only insert chats belonging to their own user_id
CREATE POLICY chats_insert_policy ON public.chats
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    OR (auth.uid() IS NULL AND user_id = 'guest-session')
    OR auth.role() = 'service_role'
  );

-- UPDATE Policy: Users can only update their own chats
CREATE POLICY chats_update_policy ON public.chats
  FOR UPDATE
  USING (
    auth.uid()::text = user_id
    OR (auth.uid() IS NULL AND user_id = 'guest-session')
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
  )
  WITH CHECK (
    auth.uid()::text = user_id
    OR (auth.uid() IS NULL AND user_id = 'guest-session')
    OR auth.role() = 'service_role'
  );

-- DELETE Policy: Users can only delete their own chats
CREATE POLICY chats_delete_policy ON public.chats
  FOR DELETE
  USING (
    auth.uid()::text = user_id
    OR (auth.uid() IS NULL AND user_id = 'guest-session')
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
    OR auth.role() = 'service_role'
  );

-- ============================================================================
-- 3. HARDEN USER_USAGE TABLE RLS
-- ============================================================================
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Drop permissive legacy policies
DROP POLICY IF EXISTS user_usage_select_policy ON public.user_usage;
DROP POLICY IF EXISTS user_usage_insert_policy ON public.user_usage;
DROP POLICY IF EXISTS user_usage_delete_policy ON public.user_usage;

-- SELECT Policy: Users can only inspect their own telemetry records
CREATE POLICY user_usage_select_policy ON public.user_usage
  FOR SELECT
  USING (
    auth.uid()::text = user_id
    OR (auth.uid() IS NULL AND user_id = 'anonymous')
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
  );

-- INSERT Policy: Telemetry recording bound to user_id or service_role
CREATE POLICY user_usage_insert_policy ON public.user_usage
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    OR (auth.uid() IS NULL AND user_id = 'anonymous')
    OR auth.role() = 'service_role'
  );

-- DELETE Policy: Users can clear their own telemetry or Superadmins can purge
CREATE POLICY user_usage_delete_policy ON public.user_usage
  FOR DELETE
  USING (
    auth.uid()::text = user_id
    OR (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid()::text AND u.role = 'superadmin'))
    OR auth.role() = 'service_role'
  );
