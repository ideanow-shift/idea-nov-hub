begin;

do $precheck$
declare
  existing_columns text[];
begin
  if to_regclass('public.employees') is null or to_regclass('public.stores') is null then
    raise exception 'FOLLOWUP_DEPENDENCY_MISMATCH';
  end if;
  if to_regclass('public.idea_link_activity_followups') is not null then
    select array_agg(attname::text order by attname::text)
      into existing_columns
      from pg_attribute
     where attrelid = 'public.idea_link_activity_followups'::regclass
       and attnum > 0
       and not attisdropped;
    if existing_columns is distinct from array[
      'assigned_to_employee_id', 'created_at', 'created_by_employee_id', 'id',
      'next_review_on', 'signal_categories', 'status', 'store_id',
      'target_employee_id', 'updated_at', 'updated_by_employee_id'
    ]::text[] then
      raise exception 'FOLLOWUP_EXISTING_OBJECT_INCOMPATIBLE';
    end if;
  end if;
end
$precheck$;

create table if not exists public.idea_link_activity_followups (
  id uuid primary key default gen_random_uuid(),
  target_employee_id uuid not null references public.employees(id),
  store_id uuid not null references public.stores(id),
  signal_categories text[] not null,
  status text not null default 'PENDING',
  assigned_to_employee_id uuid not null references public.employees(id),
  next_review_on date,
  created_by_employee_id uuid not null references public.employees(id),
  updated_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint idea_link_activity_followups_target_unique unique (target_employee_id),
  constraint idea_link_activity_followups_status_check
    check (status in ('PENDING', 'CONTACTED', 'MONITORING', 'COMPLETED')),
  constraint idea_link_activity_followups_signal_categories_check
    check (
      cardinality(signal_categories) between 1 and 6
      and signal_categories <@ array[
        'PUBLIC_SEND_ACTIVITY_STOPPED',
        'PUBLIC_SEND_ACTIVITY_DROPPED',
        'NO_PUBLIC_SEND_ACTIVITY',
        'PUBLIC_RECEIVE_ACTIVITY_STOPPED',
        'PUBLIC_RECEIVE_ACTIVITY_DROPPED',
        'NO_PUBLIC_RECEIVE_ACTIVITY'
      ]::text[]
    )
);

alter table public.idea_link_activity_followups enable row level security;
revoke all on table public.idea_link_activity_followups from anon, authenticated;
grant select, insert, update on table public.idea_link_activity_followups to service_role;

do $postcheck$
declare
  column_count integer;
begin
  select count(*)
    into column_count
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'idea_link_activity_followups';
  if column_count <> 11 then
    raise exception 'FOLLOWUP_POSTCHECK_COLUMN_MISMATCH';
  end if;
  if not exists (
    select 1
      from pg_class
     where oid = 'public.idea_link_activity_followups'::regclass
       and relrowsecurity
  ) then
    raise exception 'FOLLOWUP_POSTCHECK_RLS_MISMATCH';
  end if;
  if has_table_privilege('anon', 'public.idea_link_activity_followups', 'SELECT')
     or has_table_privilege('authenticated', 'public.idea_link_activity_followups', 'SELECT')
     or has_table_privilege('anon', 'public.idea_link_activity_followups', 'INSERT')
     or has_table_privilege('authenticated', 'public.idea_link_activity_followups', 'INSERT')
     or has_table_privilege('anon', 'public.idea_link_activity_followups', 'UPDATE')
     or has_table_privilege('authenticated', 'public.idea_link_activity_followups', 'UPDATE')
     or has_table_privilege('service_role', 'public.idea_link_activity_followups', 'DELETE') then
    raise exception 'FOLLOWUP_POSTCHECK_GRANT_MISMATCH';
  end if;
  if not has_table_privilege('service_role', 'public.idea_link_activity_followups', 'SELECT')
     or not has_table_privilege('service_role', 'public.idea_link_activity_followups', 'INSERT')
     or not has_table_privilege('service_role', 'public.idea_link_activity_followups', 'UPDATE') then
    raise exception 'FOLLOWUP_POSTCHECK_SERVICE_ROLE_MISMATCH';
  end if;
end
$postcheck$;

commit;
