-- 033_add_event_budget_columns.sql
-- Adds optional event budget columns used by dashboards (HOD/Dean/CFO/Finance)
-- and the approval context queries. Parallel to migration 031 for fests.
--
-- Problem: server code (eventRoutes_secured.js) inserts/updates
-- budget_amount / estimated_budget_amount / total_estimated_expense on the
-- events table, with fallback logic that silently drops the fields when the
-- columns are missing. Because no prior migration added these columns to the
-- events table, production events were persisted without their budget value,
-- causing HOD/Dean approval queues to show ₹0.

alter table if exists public.events
  add column if not exists budget_amount numeric,
  add column if not exists estimated_budget_amount numeric,
  add column if not exists total_estimated_expense numeric;
