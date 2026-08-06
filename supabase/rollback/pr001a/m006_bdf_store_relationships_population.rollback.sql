-- PR001-A / M006 rollback
-- STAGING ONLY. Allowed only while all population versions are unpublished.

drop trigger if exists guard_store_population_publication on governance.store_population_versions;
drop trigger if exists guard_store_population_item_mutation on governance.store_population_items;
drop function if exists governance.guard_store_population_publication();
drop function if exists governance.guard_store_population_item_mutation();
drop table if exists governance.store_population_items;
drop table if exists governance.store_population_versions;
drop table if exists core.corporation_store_relationships;
drop table if exists core.corporation_store_relationship_identities;
