-- Migration 016: Budget items on approval records
-- Stores the organiser's expense estimate submitted with the approval request.

begin;

alter table public.approvals
  add column if not exists budget_items jsonb not null default '[]';

select 'budget_items on approvals' as check_name,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'approvals'
      and column_name = 'budget_items'
  ) as ok;

commit;
