-- Migration: Create users and chats tables for NamoGPT Supabase Database
-- Timestamp: 2026-10-12T18:00:00Z
-- Author: NamoGPT Database Architect

-- ============================================================================
-- 1. USERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  dob TEXT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_created_at ON public.users(created_at DESC);

-- Enable Row Level Security (RLS) Mandate
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Users Table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_select_policy'
  ) THEN
    CREATE POLICY users_select_policy ON public.users
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_insert_policy'
  ) THEN
    CREATE POLICY users_insert_policy ON public.users
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_update_policy'
  ) THEN
    CREATE POLICY users_update_policy ON public.users
      FOR UPDATE
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'users_delete_policy'
  ) THEN
    CREATE POLICY users_delete_policy ON public.users
      FOR DELETE
      USING (true);
  END IF;
END $$;

-- ============================================================================
-- 2. CHATS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.chats (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL DEFAULT 'auto',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_chats_user_id ON public.chats(user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON public.chats(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON public.chats(created_at DESC);

-- Enable Row Level Security (RLS) Mandate
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Chats Table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'chats_select_policy'
  ) THEN
    CREATE POLICY chats_select_policy ON public.chats
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'chats_insert_policy'
  ) THEN
    CREATE POLICY chats_insert_policy ON public.chats
      FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'chats_update_policy'
  ) THEN
    CREATE POLICY chats_update_policy ON public.chats
      FOR UPDATE
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chats' AND policyname = 'chats_delete_policy'
  ) THEN
    CREATE POLICY chats_delete_policy ON public.chats
      FOR DELETE
      USING (true);
  END IF;
END $$;
