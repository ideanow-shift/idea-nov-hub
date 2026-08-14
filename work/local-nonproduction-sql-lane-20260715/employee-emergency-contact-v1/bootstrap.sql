create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create table public.employees (
  id uuid primary key,
  employee_id text not null unique,
  full_name text not null,
  is_active boolean not null default true
);

insert into public.employees (id, employee_id, full_name)
values
  ('00000000-0000-4000-8000-000000000001', 'SYNTHETIC-001', 'SYNTHETIC EMPLOYEE'),
  ('00000000-0000-4000-8000-000000000002', 'SYNTHETIC-002', 'SYNTHETIC ACTOR');
