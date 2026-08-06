-- PR001-A / M009
-- Defense-in-depth RLS and explicit default deny.
-- Writer/reader grants are intentionally deferred to separately reviewed runtime roles.

alter table governance.master_source_snapshots enable row level security;
alter table governance.master_source_snapshots force row level security;
alter table governance.canonical_entity_registry enable row level security;
alter table governance.canonical_entity_registry force row level security;
alter table governance.canonical_version_registry enable row level security;
alter table governance.canonical_version_registry force row level security;
alter table governance.source_entity_crosswalks enable row level security;
alter table governance.source_entity_crosswalks force row level security;
alter table governance.store_population_versions enable row level security;
alter table governance.store_population_versions force row level security;
alter table governance.store_population_items enable row level security;
alter table governance.store_population_items force row level security;
alter table governance.master_versions enable row level security;
alter table governance.master_versions force row level security;
alter table governance.master_version_members enable row level security;
alter table governance.master_version_members force row level security;
alter table governance.master_publication_releases enable row level security;
alter table governance.master_publication_releases force row level security;
alter table governance.master_audit_events enable row level security;
alter table governance.master_audit_events force row level security;

alter table core.corporation_identities enable row level security;
alter table core.corporation_identities force row level security;
alter table core.corporations enable row level security;
alter table core.corporations force row level security;
alter table core.store_identities enable row level security;
alter table core.store_identities force row level security;
alter table core.stores enable row level security;
alter table core.stores force row level security;
alter table core.department_identities enable row level security;
alter table core.department_identities force row level security;
alter table core.departments enable row level security;
alter table core.departments force row level security;
alter table core.employee_identities enable row level security;
alter table core.employee_identities force row level security;
alter table core.employees enable row level security;
alter table core.employees force row level security;
alter table core.assignment_identities enable row level security;
alter table core.assignment_identities force row level security;
alter table core.employee_store_assignments enable row level security;
alter table core.employee_store_assignments force row level security;
alter table core.corporation_store_relationship_identities enable row level security;
alter table core.corporation_store_relationship_identities force row level security;
alter table core.corporation_store_relationships enable row level security;
alter table core.corporation_store_relationships force row level security;

revoke all on all tables in schema core from public, anon, authenticated, service_role;
revoke all on all tables in schema governance from public, anon, authenticated, service_role;
revoke all on all tables in schema projection from public, anon, authenticated, service_role;
revoke all on all sequences in schema core from public, anon, authenticated, service_role;
revoke all on all sequences in schema governance from public, anon, authenticated, service_role;
revoke all on all functions in schema core from public, anon, authenticated, service_role;
revoke all on all functions in schema governance from public, anon, authenticated, service_role;
revoke all on all functions in schema projection from public, anon, authenticated, service_role;

revoke all on schema core from public, anon, authenticated, service_role;
revoke all on schema governance from public, anon, authenticated, service_role;
revoke all on schema projection from public, anon, authenticated, service_role;
