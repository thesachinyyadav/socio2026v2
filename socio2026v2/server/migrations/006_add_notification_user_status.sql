-- Migration: Add notification_user_status table for tracking per-user notification read status
-- Date: 2026-04-02
-- Purpose: Track which users have read/dismissed broadcast notifications
-- This table is CRITICAL for notifications to persist across page refreshes/logouts

create table if not exists public.notification_user_status (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null,
  user_email text not null,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Ensure one read status record per user per notification
  constraint fk_notification_user_status_notification_id
    foreign key (notification_id)
    references public.notifications(id)
    on delete cascade,

  -- Unique constraint: one entry per user per notification
  constraint uq_notification_user_status_user_notification
    unique (notification_id, user_email)
);

-- Indexes for fast lookups
create index if not exists idx_notification_user_status_user_email 
on public.notification_user_status(user_email);

create index if not exists idx_notification_user_status_notification_id 
on public.notification_user_status(notification_id);

create index if not exists idx_notification_user_status_is_read 
on public.notification_user_status(is_read) 
where is_read = false;

-- Enable RLS
alter table public.notification_user_status enable row level security;

-- Allow all access (tighten later if needed)
drop policy if exists "Allow all access to notification_user_status" on public.notification_user_status;
create policy "Allow all access to notification_user_status" 
on public.notification_user_status for all using (true) with check (true);

-- Auto update updated_at timestamp
create or replace function public.set_notification_user_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_notification_user_status_updated_at on public.notification_user_status;
create trigger trg_notification_user_status_updated_at
before update on public.notification_user_status
for each row execute function public.set_notification_user_status_updated_at();

-- Migration note for tracking
comment on table public.notification_user_status is 
'Tracks per-user read/dismiss status for broadcast notifications. Critical for notif persistence.';
