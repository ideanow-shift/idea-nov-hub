-- PR001-A / M003 rollback
-- STAGING ONLY. Allowed only before master publication.

drop table if exists core.stores;
drop table if exists core.store_identities;
drop table if exists core.corporations;
drop table if exists core.corporation_identities;
