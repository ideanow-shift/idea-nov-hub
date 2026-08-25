# Production Core Access Containment V1 Rollback

Rollback is not authorized by this PR. If a separately approved Production application causes a verified regression:

1. Keep Store Operations rollout `DISABLED`.
2. Capture failing server/API evidence without tokens, UUIDs or personal data.
3. Obtain Owner rollback approval.
4. Apply `supabase/rollback/production_core_access_containment_v1.rollback.sql` as one transaction.
5. Read back all nine RLS/FORCE RLS states, table ACLs, function ACLs and search paths.
6. Re-run NOV HUB, Finance/OS server paths, Store Operations, AUTH-01 and Role/Scope smoke.
7. Record that rollback restores the exposed pre-corrective state and therefore reopens the security blocker.

No business rows are inserted, updated, deleted or copied by either the corrective or rollback SQL.
