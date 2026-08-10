-- SOURCE-ONLY REVIEW CANDIDATE. DO NOT APPLY TO PRODUCTION.
-- Precondition: Core DB owner confirms names, target cardinality, RLS and grants.

begin;

alter table public.positions
  add column position_class text;

alter table public.positions
  add constraint positions_position_class_check check (
    position_class is null
    or position_class in ('corporate_position', 'legacy_assignment', 'legacy_staff_classification')
  );

create table public.organization_assignment_types (
  id uuid primary key default gen_random_uuid(),
  assignment_code text not null unique,
  assignment_name text not null unique,
  allowed_target_type text not null check (
    allowed_target_type in ('corporation', 'business_unit', 'department', 'store')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employee_organization_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  assignment_type_id uuid not null references public.organization_assignment_types(id) on delete restrict,
  corporation_id uuid references public.corporations(id) on delete restrict,
  business_unit_id uuid references public.business_units(id) on delete restrict,
  department_id uuid references public.departments(id) on delete restrict,
  store_id uuid references public.stores(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  is_active boolean not null default true,
  is_primary boolean not null default false,
  priority smallint not null default 100 check (priority between 1 and 999),
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from),
  check (num_nonnulls(corporation_id, business_unit_id, department_id, store_id) = 1)
);

create index employee_organization_assignments_employee_asof_idx
  on public.employee_organization_assignments (employee_id, effective_from desc, effective_to);

create index employee_organization_assignments_department_asof_idx
  on public.employee_organization_assignments (department_id, effective_from desc, effective_to)
  where department_id is not null;

create index employee_organization_assignments_store_asof_idx
  on public.employee_organization_assignments (store_id, effective_from desc, effective_to)
  where store_id is not null;

alter table public.organization_assignment_types enable row level security;
alter table public.employee_organization_assignments enable row level security;

revoke all on public.organization_assignment_types from public, anon, authenticated;
revoke all on public.employee_organization_assignments from public, anon, authenticated;

-- position_class intentionally remains NULL until a reviewed classification DML gate.
-- No seed, grant, policy, backfill, compatibility view or legacy mutation in this candidate.
-- They require independent owner-approved gates after Production metadata precheck.

rollback;
