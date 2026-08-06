-- PR001-A / M001 rollback
-- STAGING ONLY. These non-recursive drops intentionally fail if any object remains.
-- The shared btree_gist extension is not removed.

drop schema if exists projection;
drop schema if exists governance;
drop schema if exists core;
