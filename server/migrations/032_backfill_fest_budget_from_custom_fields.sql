-- 032_backfill_fest_budget_from_custom_fields.sql
-- Backfills fests budget columns from legacy custom_fields budget payload.

with extracted_budget as (
  select
    fest_id,
    nullif(
      regexp_replace(coalesce(entry->'value'->>'amount', ''), '[^0-9\.-]', '', 'g'),
      ''
    )::numeric as parsed_amount
  from public.fests
  cross join lateral jsonb_array_elements(coalesce(custom_fields, '[]'::jsonb)) as entry
  where entry->>'key' = '__budget_approval__'
), normalized_budget as (
  select fest_id, max(parsed_amount) as budget_amount
  from extracted_budget
  where parsed_amount is not null and parsed_amount > 0
  group by fest_id
)
update public.fests as f
set
  budget_amount = coalesce(f.budget_amount, nb.budget_amount),
  estimated_budget_amount = coalesce(f.estimated_budget_amount, nb.budget_amount),
  total_estimated_expense = coalesce(f.total_estimated_expense, nb.budget_amount)
from normalized_budget as nb
where f.fest_id = nb.fest_id;
