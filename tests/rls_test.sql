-- Source-only RLS validation plan. Do not execute against production.
begin;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'store_operation_history'
order by policyname;

-- Required staging harness cases:
-- 1. representative/executive: read and write allowed.
-- 2. department manager: denied until a canonical department-store scope exists.
-- 3. store manager: assigned store only.
-- 4. FC owner: corporation-scoped stores only.
-- 5. employee: own primary store only.
-- 6. anonymous and malformed identity: denied.
-- 7. service_role is tested separately and never treated as RLS proof.

rollback;
