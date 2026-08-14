select
  to_regclass('public.employees') is not null,
  to_regclass('public.employee_emergency_contacts') is null,
  to_regclass('public.employee_emergency_contact_audit_logs') is null,
  to_regprocedure('public.audit_employee_emergency_contact_change()') is null,
  (select count(*) from public.employees) = 2;
