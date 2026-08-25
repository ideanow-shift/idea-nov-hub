\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema core;
grant usage on schema core to anon,authenticated,service_role;

create function auth.uid() returns uuid language sql stable as $$select '11111111-1111-4111-8111-111111111111'::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
create table auth.users(id uuid primary key,email text);

create table core.corporations(id uuid primary key default gen_random_uuid(),code text unique,name text,is_fc boolean default false,active boolean default true);
create table core.departments(id uuid primary key default gen_random_uuid(),code text unique,name text,active boolean default true);
create table core.stores(id uuid primary key default gen_random_uuid(),corporation_id uuid,code text unique,name text,active boolean default true);
create table core.positions(id uuid primary key default gen_random_uuid(),code text unique,name text,role_rank int,active boolean default true);
create table core.roles(id uuid primary key default gen_random_uuid(),code text unique,name text);
create table core.employees(id uuid primary key default gen_random_uuid(),employee_code text,email text unique,name text,firebase_uid text,corporation_id uuid,store_id uuid,department_id uuid,position_id uuid,employment_status text,updated_at timestamptz default now());
create table core.employee_roles(id uuid primary key default gen_random_uuid(),employee_id uuid,role_id uuid,scope_type text,scope_id uuid,unique(employee_id,role_id,scope_type,scope_id));
create table core.account_titles(id uuid primary key default gen_random_uuid());
create table core.vendors(id uuid primary key default gen_random_uuid());

grant select on all tables in schema core to authenticated;
grant select on core.employees,core.stores to service_role;

create function core.current_employee_id() returns uuid language sql stable security definer set search_path=core,auth,public as $$select id from core.employees where firebase_uid=auth.uid()::text limit 1$$;
create function core.role_code_aliases(role_code text) returns text[] language sql immutable as $$select array[role_code]$$;
create function core.has_role(role_code text) returns boolean language sql stable as $$select exists(select 1 from core.employee_roles er join core.roles r on r.id=er.role_id where er.employee_id=core.current_employee_id() and r.code=role_code)$$;
create function core.has_global_role(role_code text) returns boolean language sql stable as $$select exists(select 1 from core.employee_roles er join core.roles r on r.id=er.role_id where er.employee_id=core.current_employee_id() and r.code=role_code and er.scope_type='global')$$;
create function core.has_scoped_role(role_code text,target_scope_type text,target_scope_id uuid) returns boolean language sql stable as $$select exists(select 1 from core.employee_roles er join core.roles r on r.id=er.role_id where er.employee_id=core.current_employee_id() and r.code=role_code and (er.scope_type='global' or (er.scope_type=target_scope_type and er.scope_id=target_scope_id)))$$;
create function core.can_manage_permissions() returns boolean language sql stable as $$select core.has_global_role('executive')$$;
create function core.current_employee_has_any_role(role_codes text[]) returns boolean language sql security definer set search_path=core,public as $$select exists(select 1 from core.employee_roles er join core.roles r on r.id=er.role_id where er.employee_id=core.current_employee_id() and r.code=any(role_codes))$$;
create function core.current_employee_profile() returns table(employee_id uuid) language sql stable set search_path=core,public as $$select id from core.employees where id=core.current_employee_id()$$;
create function core.employee_admin_options() returns jsonb language sql stable security definer set search_path=core,public as $$select case when core.can_manage_permissions() then jsonb_build_object('employees',(select count(*) from core.employees)) else '{}'::jsonb end$$;
create function core.permission_admin_options() returns jsonb language sql stable security definer set search_path=core,public as $$select case when core.can_manage_permissions() then jsonb_build_object('roles',(select count(*) from core.roles)) else '{}'::jsonb end$$;
create function core.dev_seed_employee(p_email text,p_name text default 'test',p_role_code text default 'staff',p_store_code text default 'store') returns uuid language plpgsql security definer set search_path=core,public as $$declare result uuid; begin insert into core.employees(email,name,employment_status) values(p_email,p_name,'active') returning id into result; return result; end$$;
create function core.link_employee_to_auth_user(p_email text) returns uuid language plpgsql security definer set search_path=core,auth,public as $$declare result uuid; begin update core.employees set firebase_uid=auth.uid()::text where email=p_email returning id into result; return result; end$$;

grant execute on all functions in schema core to public,anon,authenticated,service_role;

insert into core.employees(id,employee_code,email,name,firebase_uid,employment_status) values('11111111-1111-4111-8111-111111111111','owner','owner@example.invalid','Owner','11111111-1111-4111-8111-111111111111','active');
insert into core.roles(code,name) values('executive','Executive');
insert into core.employee_roles(employee_id,role_id,scope_type) select '11111111-1111-4111-8111-111111111111',id,'global' from core.roles where code='executive';
