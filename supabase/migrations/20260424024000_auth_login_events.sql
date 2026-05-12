-- Migration: 20260424024000_auth_login_events.sql
-- Description: Persist login events for audit and visibility in admin user governance
-- Author: Codex
-- Date: 2026-04-24

CREATE TABLE IF NOT EXISTS public.auth_login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  provider TEXT NULL,
  full_name TEXT NULL,
  avatar_url TEXT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auth_login_events_email_lower_chk
    CHECK (email = lower(trim(email)))
);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_logged_at
  ON public.auth_login_events (logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_user_id
  ON public.auth_login_events (user_id);

CREATE INDEX IF NOT EXISTS idx_auth_login_events_email
  ON public.auth_login_events (email);

ALTER TABLE public.auth_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_login_events_select_policy
ON public.auth_login_events;
CREATE POLICY auth_login_events_select_policy
ON public.auth_login_events
FOR SELECT
USING (
  app_is_admin()
  OR user_id = auth.uid()
  OR email = lower(coalesce(auth.jwt() ->> 'email', ''))
);

DROP POLICY IF EXISTS auth_login_events_insert_policy
ON public.auth_login_events;
CREATE POLICY auth_login_events_insert_policy
ON public.auth_login_events
FOR INSERT
WITH CHECK (
  app_is_admin()
  OR user_id = auth.uid()
  OR email = lower(coalesce(auth.jwt() ->> 'email', ''))
);
