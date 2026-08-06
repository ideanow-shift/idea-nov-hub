-- PR001-A / M004 rollback
-- STAGING ONLY. Allowed only before master publication.

drop table if exists core.employees;
drop table if exists core.employee_identities;
drop table if exists core.departments;
drop table if exists core.department_identities;
