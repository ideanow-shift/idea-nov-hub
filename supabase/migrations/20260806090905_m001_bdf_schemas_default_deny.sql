-- PR001-A / M001
-- Staging-only Canonical Core Master namespaces and default-deny boundary.
-- Authoring artifact only: do not apply without the PR001-A Staging release gate.

create schema if not exists core;
create schema if not exists governance;
create schema if not exists projection;

revoke all on schema core from public, anon, authenticated, service_role;
revoke all on schema governance from public, anon, authenticated, service_role;
revoke all on schema projection from public, anon, authenticated, service_role;

alter default privileges in schema core revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema governance revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema projection revoke all on tables from public, anon, authenticated, service_role;

alter default privileges in schema core revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema governance revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema projection revoke execute on functions from public, anon, authenticated, service_role;

create extension if not exists btree_gist with schema extensions;
