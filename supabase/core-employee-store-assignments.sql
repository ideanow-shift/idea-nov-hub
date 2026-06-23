create table if not exists public.employee_store_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  assignment_order smallint not null check (assignment_order between 1 and 9),
  assignment_type text not null default 'primary' check (
    assignment_type in ('primary', 'secondary', 'third', 'support', 'temporary')
  ),
  effective_from date not null default current_date,
  effective_to date,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  check (effective_to is null or effective_to >= effective_from)
);

comment on table public.employee_store_assignments is '社員の複数店舗所属。主店舗・サブ店舗・応援店舗などを期間付きで管理する。';
comment on column public.employee_store_assignments.assignment_order is '所属順。1=主店舗, 2=サブ店舗, 3=第3店舗。';
comment on column public.employee_store_assignments.assignment_type is '所属区分。primary, secondary, third, support, temporary。';

create unique index if not exists uniq_active_employee_store_assignment_order
  on public.employee_store_assignments (employee_id, assignment_order)
  where is_active = true and effective_to is null;

create unique index if not exists uniq_active_employee_store_assignment_store
  on public.employee_store_assignments (employee_id, store_id)
  where is_active = true and effective_to is null;

create index if not exists idx_employee_store_assignments_employee_id
  on public.employee_store_assignments (employee_id);

create index if not exists idx_employee_store_assignments_store_id
  on public.employee_store_assignments (store_id);

create index if not exists idx_employee_store_assignments_effective
  on public.employee_store_assignments (effective_from, effective_to);

insert into public.employee_store_assignments (
  employee_id,
  store_id,
  assignment_order,
  assignment_type,
  effective_from,
  source
)
select
  e.id,
  e.store_id,
  1,
  'primary',
  current_date,
  'employees.store_id backfill'
from public.employees e
where e.store_id is not null
  and not exists (
    select 1
    from public.employee_store_assignments esa
    where esa.employee_id = e.id
      and esa.assignment_order = 1
      and esa.is_active = true
      and esa.effective_to is null
  );

grant select, insert, update on public.employee_store_assignments to service_role;
