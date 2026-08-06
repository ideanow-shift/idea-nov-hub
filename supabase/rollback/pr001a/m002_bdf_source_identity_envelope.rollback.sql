-- PR001-A / M002 rollback
-- STAGING ONLY. Allowed only after all dependent canonical objects are removed.

drop table if exists governance.source_entity_crosswalks;
drop table if exists governance.canonical_version_registry;
drop table if exists governance.canonical_entity_registry;
drop table if exists governance.master_source_snapshots;
