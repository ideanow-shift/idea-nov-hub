-- NOV HUB master-admin updates employee_roles via Edge Function service_role.
-- Required for assigning the default common role (staff) and app-specific roles.
grant select, insert, update on table public.employee_roles to service_role;
grant select on table public.roles to service_role;
