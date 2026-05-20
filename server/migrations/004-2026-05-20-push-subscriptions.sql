-- Migration: 004-2026-05-20-push-subscriptions.sql
-- Created at: 2026-05-20T12:00:00Z

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT null DEFAULT gen_random_uuid(),
  user_email text NOT null,
  subscription jsonb NOT null,
  created_at timestamptz NOT null DEFAULT now(),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_email_fkey FOREIGN KEY (user_email) REFERENCES public.users(email) ON DELETE CASCADE
);

-- Index for fast lookup by user email
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_email ON public.push_subscriptions(user_email);

-- Enable RLS and create policy
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_access ON public.push_subscriptions;
CREATE POLICY allow_all_access ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);
