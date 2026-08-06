-- PR001-A / M007 rollback
-- STAGING ONLY. Allowed only before approved Snapshot activation/publication.

drop trigger if exists reject_master_audit_event_mutation on governance.master_audit_events;
drop trigger if exists reject_master_publication_release_mutation on governance.master_publication_releases;
drop trigger if exists guard_master_publication_release_insert on governance.master_publication_releases;
drop trigger if exists guard_master_version_member_mutation on governance.master_version_members;
drop trigger if exists guard_master_version_mutation on governance.master_versions;
drop trigger if exists reject_corporation_store_relationships_mutation on core.corporation_store_relationships;
drop trigger if exists reject_assignments_mutation on core.employee_store_assignments;
drop trigger if exists reject_employees_mutation on core.employees;
drop trigger if exists reject_departments_mutation on core.departments;
drop trigger if exists reject_stores_mutation on core.stores;
drop trigger if exists reject_corporations_mutation on core.corporations;
drop trigger if exists reject_source_crosswalk_mutation on governance.source_entity_crosswalks;
drop trigger if exists reject_canonical_version_registry_mutation on governance.canonical_version_registry;
drop trigger if exists reject_canonical_entity_registry_mutation on governance.canonical_entity_registry;
drop trigger if exists guard_master_source_snapshot_mutation on governance.master_source_snapshots;
drop table if exists governance.master_audit_events;
drop table if exists governance.master_publication_releases;
drop table if exists governance.master_version_members;
drop table if exists governance.master_versions;
drop function if exists governance.guard_master_publication_release_insert();
drop function if exists governance.guard_master_version_member_mutation();
drop function if exists governance.guard_master_version_mutation();
drop function if exists governance.guard_snapshot_mutation();
drop function if exists governance.reject_immutable_mutation();
