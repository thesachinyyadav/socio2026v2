-- Migration: 030_module11_l4_accounts_policy_alignment
-- Purpose:
-- Ensure L4 Accounts queue visibility and update access for Accounts/Finance Officer/Master Admin.

grant select, update on table public.approval_requests to authenticated;

drop policy if exists approval_requests_select_l4_accounts_finance on public.approval_requests;
create policy approval_requests_select_l4_accounts_finance
  on public.approval_requests
  for select
  to authenticated
  using (
    upper(coalesce(approval_level, '')) = 'L4_ACCOUNTS'
    and lower(coalesce(status, '')) = 'pending'
    and public.current_user_has_any_role(array['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );

drop policy if exists approval_requests_update_l4_accounts_finance on public.approval_requests;
create policy approval_requests_update_l4_accounts_finance
  on public.approval_requests
  for update
  to authenticated
  using (
    upper(coalesce(approval_level, '')) = 'L4_ACCOUNTS'
    and lower(coalesce(status, '')) = 'pending'
    and public.current_user_has_any_role(array['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  )
  with check (
    upper(coalesce(approval_level, '')) = 'L4_ACCOUNTS'
    and public.current_user_has_any_role(array['MASTER_ADMIN', 'ACCOUNTS', 'FINANCE_OFFICER'])
  );
