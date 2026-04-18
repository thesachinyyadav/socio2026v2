-- Fix notifications schema for broadcast support

-- Step 1: Add is_broadcast column if it doesn't exist
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN DEFAULT false;

-- Step 2: Create notification_user_status table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.notification_user_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_user_status_user_email 
  ON public.notification_user_status(user_email);

CREATE INDEX IF NOT EXISTS idx_notification_user_status_notification_id 
  ON public.notification_user_status(notification_id);

-- Step 4: Enable RLS
ALTER TABLE public.notification_user_status ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop and recreate policy (safer than IF NOT EXISTS which isn't supported)
DROP POLICY IF EXISTS "Allow all access to notification_user_status" 
  ON public.notification_user_status;

CREATE POLICY "Allow all access to notification_user_status" 
  ON public.notification_user_status FOR ALL USING (true) WITH CHECK (true);
