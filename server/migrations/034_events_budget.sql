-- 034_events_budget.sql
-- Add budget tracking columns to events table.
-- budget_allocated: the approved budget for the event
-- budget_breakdown: JSON array of line items [{item: string, cost: number}]

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS budget_allocated NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;
