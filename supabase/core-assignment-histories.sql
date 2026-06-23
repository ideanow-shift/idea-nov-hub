alter table public.employees
  add column if not exists kana_last_name text,
  add column if not exists kana_first_name text,
  add column if not exists joined_on date,
  add column if not exists retired_on date,
  add column if not exists is_legacy boolean not null default false;

alter table public.stores
  add column if not exists area text,
  add column if not exists store_type text;

alter table public.employee_roles
  add column if not exists scope_type text not null default 'all',
  add column if not exists scope_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employee_roles_scope_type_check'
  ) then
    alter table public.employee_roles
      add constraint employee_roles_scope_type_check
      check (scope_type in ('all','corporation','business_unit','department','store','self'));
  end if;
end $$;

create table if not exists public.employee_assignment_histories (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  corporation_id uuid references public.corporations(id),
  business_unit_id uuid references public.business_units(id),
  department_id uuid references public.departments(id),
  store_id uuid references public.stores(id),
  position_id uuid references public.positions(id),
  employment_status text,
  effective_from date not null,
  effective_to date,
  change_type text not null check (
    change_type in (
      'join',
      'transfer',
      'promotion',
      'demotion',
      'leave',
      'return',
      'retire',
      'fc_transfer',
      'correction'
    )
  ),
  change_reason text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  check (effective_to is null or effective_to >= effective_from)
);

create index if not exists idx_assignment_histories_employee_id
  on public.employee_assignment_histories (employee_id);

create index if not exists idx_assignment_histories_effective_from
  on public.employee_assignment_histories (effective_from);

create index if not exists idx_assignment_histories_store_id
  on public.employee_assignment_histories (store_id);

create index if not exists idx_assignment_histories_department_id
  on public.employee_assignment_histories (department_id);

create index if not exists idx_assignment_histories_change_type
  on public.employee_assignment_histories (change_type);

insert into public.employee_assignment_histories (
  employee_id,
  corporation_id,
  business_unit_id,
  department_id,
  store_id,
  position_id,
  employment_status,
  effective_from,
  change_type,
  change_reason,
  source
)
select
  e.id,
  e.corporation_id,
  s.business_unit_id,
  e.department_id,
  e.store_id,
  e.position_id,
  e.employment_status,
  coalesce(e.joined_on, current_date),
  case
    when e.employment_status like '%退職%' then 'retire'
    when e.employment_status ~ '(休職|産休|育休)' then 'leave'
    else 'correction'
  end,
  'Core社員台帳v1 初期履歴',
  'initial_import'
from public.employees e
left join public.stores s on s.id = e.store_id
where not exists (
  select 1
  from public.employee_assignment_histories h
  where h.employee_id = e.id
    and h.source = 'initial_import'
);

grant select, insert on public.employee_assignment_histories to service_role;
grant select, update on public.employees to service_role;
grant select on public.stores to service_role;
