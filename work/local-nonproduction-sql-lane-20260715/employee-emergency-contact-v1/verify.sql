set role service_role;

insert into public.employee_emergency_contacts (
  employee_id,
  employee_phone_number,
  updated_by_employee_id
)
values (
  '00000000-0000-4000-8000-000000000001',
  '09012345678',
  '00000000-0000-4000-8000-000000000002'
);

update public.employee_emergency_contacts
set employee_phone_number = null,
    updated_at = now()
where employee_id = '00000000-0000-4000-8000-000000000001';

reset role;

select
  c.relrowsecurity,
  not c.relforcerowsecurity,
  (select count(*) from information_schema.columns
    where table_schema = 'public'
      and table_name = 'employee_emergency_contacts') = 5,
  (select count(*) from pg_catalog.pg_constraint
    where conrelid = 'public.employee_emergency_contacts'::regclass
      and contype = 'p') = 1,
  (select count(*) from pg_catalog.pg_constraint
    where conrelid = 'public.employee_emergency_contacts'::regclass
      and contype = 'f') = 2,
  (select count(*) from pg_catalog.pg_constraint
    where conrelid = 'public.employee_emergency_contacts'::regclass
      and conname = 'employee_emergency_contacts_phone_format_check') = 1,
  not has_table_privilege('anon', 'public.employee_emergency_contacts', 'SELECT,INSERT,UPDATE,DELETE'),
  not has_table_privilege('authenticated', 'public.employee_emergency_contacts', 'SELECT,INSERT,UPDATE,DELETE'),
  has_table_privilege('service_role', 'public.employee_emergency_contacts', 'SELECT,INSERT,UPDATE'),
  (select count(*) from public.employee_emergency_contact_audit_logs) = 2,
  (select count(*) from public.employee_emergency_contact_audit_logs
    where configured_before = false and configured_after = true) = 1,
  (select count(*) from public.employee_emergency_contact_audit_logs
    where configured_before = true and configured_after = false) = 1,
  not has_table_privilege('anon', 'public.employee_emergency_contact_audit_logs', 'SELECT,INSERT,UPDATE,DELETE'),
  not has_table_privilege('authenticated', 'public.employee_emergency_contact_audit_logs', 'SELECT,INSERT,UPDATE,DELETE'),
  has_table_privilege('service_role', 'public.employee_emergency_contact_audit_logs', 'SELECT,INSERT'),
  not has_table_privilege('service_role', 'public.employee_emergency_contact_audit_logs', 'UPDATE,DELETE'),
  (select count(*) from public.employee_emergency_contacts) = 1,
  (select count(*) from public.employee_emergency_contacts where employee_phone_number is null) = 1
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'employee_emergency_contacts';
