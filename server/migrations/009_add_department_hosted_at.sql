-- Migration: Add department_hosted_at field to fests table for department availability control
-- Purpose: Allow fests to specify which department hosts the fest and which departments can register

alter table public.fests add column if not exists department_hosted_at text;

-- Create index for department_hosted_at for faster queries
create index if not exists idx_fests_department_hosted_at on public.fests(department_hosted_at);

-- Confirmation query
SELECT 'fests.department_hosted_at' as column_checked, 
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='fests' AND column_name='department_hosted_at') as exists;
