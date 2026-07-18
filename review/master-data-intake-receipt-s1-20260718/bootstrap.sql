create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create table public.employees (
  id uuid primary key default gen_random_uuid()
);
