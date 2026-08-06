-- PR001-A / M009 rollback
-- STAGING ONLY. Fail closed: do not disable RLS or restore broad grants.

revoke all on schema core from public, anon, authenticated, service_role;
revoke all on schema governance from public, anon, authenticated, service_role;
revoke all on schema projection from public, anon, authenticated, service_role;
revoke all on all tables in schema core from public, anon, authenticated, service_role;
revoke all on all tables in schema governance from public, anon, authenticated, service_role;
revoke all on all tables in schema projection from public, anon, authenticated, service_role;
