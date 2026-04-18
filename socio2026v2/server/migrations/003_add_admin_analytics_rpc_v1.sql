-- Adds a master-admin guarded analytics RPC for client-side Data Explorer.
-- This is intentionally additive and does not modify existing app RLS policies.

create or replace function public.is_masteradmin_session()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_email text;
  v_is_masteradmin boolean := false;
begin
  v_uid := auth.uid();

  if v_uid is null then
    return false;
  end if;

  begin
    v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  exception when others then
    v_email := '';
  end;

  select coalesce(u.is_masteradmin, false)
    into v_is_masteradmin
  from public.users u
  where u.auth_uuid = v_uid
     or (v_email <> '' and lower(u.email) = v_email)
  order by case when u.auth_uuid = v_uid then 0 else 1 end
  limit 1;

  return coalesce(v_is_masteradmin, false);
end;
$$;

revoke all on function public.is_masteradmin_session() from public;
grant execute on function public.is_masteradmin_session() to authenticated;

create or replace function public.get_admin_analytics_dataset_v1(
  p_max_users integer default 20000,
  p_max_events integer default 25000,
  p_max_fests integer default 10000,
  p_max_registrations integer default 80000,
  p_max_attendance integer default 80000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_users_campus boolean := false;
  v_has_users_department boolean := false;
  v_has_events_event_type boolean := false;
  v_has_events_campus boolean := false;
  v_has_events_fest_id boolean := false;
  v_has_events_outsider_fee boolean := false;
  v_has_fests_campus boolean := false;

  v_fest_table text := null;

  v_limit_users integer := greatest(1, least(coalesce(p_max_users, 20000), 50000));
  v_limit_events integer := greatest(1, least(coalesce(p_max_events, 25000), 50000));
  v_limit_fests integer := greatest(1, least(coalesce(p_max_fests, 10000), 50000));
  v_limit_registrations integer := greatest(1, least(coalesce(p_max_registrations, 80000), 200000));
  v_limit_attendance integer := greatest(1, least(coalesce(p_max_attendance, 80000), 200000));

  v_users jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_fests jsonb := '[]'::jsonb;
  v_registrations jsonb := '[]'::jsonb;
  v_attendance jsonb := '[]'::jsonb;

  v_sql text;
begin
  if not public.is_masteradmin_session() then
    raise exception 'Forbidden: master admin privileges required';
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'campus'
  ) into v_has_users_campus;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'department'
  ) into v_has_users_department;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'event_type'
  ) into v_has_events_event_type;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'campus_hosted_at'
  ) into v_has_events_campus;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'fest_id'
  ) into v_has_events_fest_id;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'outsider_registration_fee'
  ) into v_has_events_outsider_fee;

  if to_regclass('public.fests') is not null then
    v_fest_table := 'public.fests';
  elsif to_regclass('public.fest') is not null then
    v_fest_table := 'public.fest';
  else
    v_fest_table := null;
  end if;

  if v_fest_table is not null then
    v_sql := format(
      'select exists (select 1 from information_schema.columns where table_schema = ''public'' and table_name = %L and column_name = ''campus_hosted_at'')',
      replace(v_fest_table, 'public.', '')
    );
    execute v_sql into v_has_fests_campus;
  end if;

  v_sql := format(
    'select coalesce(jsonb_agg(to_jsonb(u)), ''[]''::jsonb) from (
       select
         email,
         name,
         %s as campus,
         %s as department,
         course,
         organization_type,
         is_organiser,
         is_support,
         is_masteradmin,
         created_at
       from public.users
       order by id asc
       limit %s
     ) u',
    case when v_has_users_campus then 'campus' else 'null::text' end,
    case when v_has_users_department then 'department' else 'null::text' end,
    v_limit_users
  );
  execute v_sql into v_users;

  v_sql := format(
    'select coalesce(jsonb_agg(to_jsonb(e)), ''[]''::jsonb) from (
       select
         event_id,
         title,
         event_date,
         created_at,
         category,
         %s as event_type,
         organizing_dept,
         %s as campus_hosted_at,
         coalesce(registration_fee, 0) as registration_fee,
         %s as outsider_registration_fee,
         %s as fest_id,
         fest,
         created_by
       from public.events
       order by id asc
       limit %s
     ) e',
    case when v_has_events_event_type then 'event_type' else 'null::text' end,
    case when v_has_events_campus then 'campus_hosted_at' else 'null::text' end,
    case when v_has_events_outsider_fee then 'coalesce(outsider_registration_fee, 0)' else '0::numeric' end,
    case when v_has_events_fest_id then 'fest_id' else 'null::text' end,
    v_limit_events
  );
  execute v_sql into v_events;

  if v_fest_table is not null then
    v_sql := format(
      'select coalesce(jsonb_agg(to_jsonb(f)), ''[]''::jsonb) from (
         select
           fest_id,
           fest_title,
           organizing_dept,
           %s as campus_hosted_at,
           opening_date,
           closing_date
         from %s
         order by id asc
         limit %s
       ) f',
      case when v_has_fests_campus then 'campus_hosted_at' else 'null::text' end,
      v_fest_table,
      v_limit_fests
    );
    execute v_sql into v_fests;
  end if;

  if to_regclass('public.registrations') is not null then
    v_sql := format(
      'select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from (
         select
           registration_id,
           event_id,
           registration_type,
           participant_organization,
           user_email,
           individual_email,
           team_leader_email,
           teammates,
           created_at
         from public.registrations
         order by id asc
         limit %s
       ) r',
      v_limit_registrations
    );
    execute v_sql into v_registrations;
  end if;

  if to_regclass('public.attendance_status') is not null then
    v_sql := format(
      'select coalesce(jsonb_agg(to_jsonb(a)), ''[]''::jsonb) from (
         select
           registration_id,
           event_id,
           status,
           marked_at
         from public.attendance_status
         order by id asc
         limit %s
       ) a',
      v_limit_attendance
    );
    execute v_sql into v_attendance;
  end if;

  return jsonb_build_object(
    'generatedAt', now(),
    'users', v_users,
    'events', v_events,
    'fests', v_fests,
    'registrations', v_registrations,
    'attendance', v_attendance
  );
end;
$$;

revoke all on function public.get_admin_analytics_dataset_v1(integer, integer, integer, integer, integer) from public;
grant execute on function public.get_admin_analytics_dataset_v1(integer, integer, integer, integer, integer) to authenticated;
