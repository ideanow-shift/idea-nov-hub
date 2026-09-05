-- Disposable PostgreSQL 17 only. Synthetic fixture records never leave this database.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, deleted_at timestamptz, is_anonymous boolean default false,
 email_confirmed_at timestamptz default now(), banned_until timestamptz);
create table public.corporations(id uuid primary key, corporation_name text, is_active boolean default true);
create table public.stores(id uuid primary key, store_id text, store_no text, store_name text,
 corporation_id uuid references public.corporations, store_type text, is_active boolean default true);
create table public.store_business_profiles(store_id uuid primary key references public.stores,
 opened_on date, closed_on date, operating_status text);
create table public.corporation_business_profiles(corporation_id uuid primary key references public.corporations,
 fiscal_year_end_month integer);
create table public.employees(id uuid primary key, employee_id text, store_id uuid references public.stores,
 is_active boolean default true, employment_status text default '現職', joined_on date, retired_on date);
create table public.employee_login_credentials(employee_id uuid primary key references public.employees,
 login_enabled boolean default true, locked_until timestamptz);
create table public.roles(id uuid primary key, role_key text, is_active boolean default true);
create table public.employee_roles(id uuid primary key, employee_id uuid references public.employees,
 role_id uuid references public.roles, scope_type text, scope_id uuid, is_active boolean default true);
create table public.employee_store_assignments(id uuid primary key, employee_id uuid references public.employees,
 store_id uuid references public.stores, assignment_type text, is_active boolean default true,
 effective_from date, effective_to date);
grant usage on schema public,auth to service_role;
grant select on all tables in schema public,auth to service_role;
create function public.fixture_id(n integer) returns uuid language sql immutable as
 $$ select ('10000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid $$;
insert into public.corporations select fixture_id(500+n),'Fixture corporation '||n,true from generate_series(1,6) n;
insert into public.corporation_business_profiles select id,8 from public.corporations;
insert into public.stores select fixture_id(n),'S'||n,n::text,'Fixture store '||n,fixture_id(501+(n%6)),
 case when n<=13 then 'DIRECT' else 'FC' end,true from generate_series(1,20) n;
insert into public.stores values (fixture_id(21),'HQ','21','Head office',fixture_id(501),'HQ',true),
 (fixture_id(22),'CLOSED','22','Closed',fixture_id(501),'DIRECT',false);
insert into public.employees select fixture_id(100+n),'E'||n,fixture_id(n),true,'現職',null,null from generate_series(1,4) n;
insert into auth.users(id) select fixture_id(200+n) from generate_series(1,4) n;
insert into public.employee_login_credentials(employee_id) select id from public.employees;
insert into public.roles values (fixture_id(301),'executive',true),(fixture_id(302),'area_manager',true),
 (fixture_id(303),'store_manager',true),(fixture_id(304),'super_admin',true);
insert into public.employee_roles select fixture_id(400+n),fixture_id(100+n),fixture_id(300+n),'all',null,true from generate_series(1,3) n;
insert into public.employee_roles values(fixture_id(404),fixture_id(101),fixture_id(304),'all',null,true);
insert into public.employee_store_assignments values(fixture_id(602),fixture_id(102),fixture_id(2),'secondary',true,current_date-10,null);
