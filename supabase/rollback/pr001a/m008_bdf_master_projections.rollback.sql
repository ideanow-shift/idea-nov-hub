-- PR001-A / M008 rollback
-- STAGING ONLY. Execute only after Consumer access is revoked.

drop view if exists projection.employee_assignment_v1;
drop view if exists projection.department_master_v1;
drop view if exists projection.store_master_v1;
drop view if exists projection.corporation_master_v1;
drop view if exists projection.master_manifest_v1;
