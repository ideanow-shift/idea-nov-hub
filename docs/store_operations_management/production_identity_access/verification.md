# Verification and rollback

All fixture records are invented exclusively inside a disposable PostgreSQL 17 test database.
They are not operational users, bindings, assignments or Production/Staging population artifacts.

## Automated gates

- `tests/production-identity-access-postgres.test.mjs`: fresh migration apply; source-row fingerprints
  unchanged; RLS/FORCE and browser denial; live roles and exact all/assigned/own scope; closed/duplicate
  stores; inactive employee/Auth/login; revoked/expired/future grants; duplicate binding and real
  concurrent sessions; immutable revocation; alias namespace uniqueness; emergency containment.
- `tests/production-identity-access.test.mjs`: verified session contract, digest-only RPC request,
  browser identity/role/scope/store/target claims denied, signed UAT markers denied, malformed RPC
  responses denied, no exception credential leakage, rollout remains disabled by default.
- `tests/production-identity-access-edge.test.ts`: Production resolver → unchanged formal DBF
  consumer → public projection for all three roles; scope escalation denied before fact reads,
  no legacy identity lookup, no raw UUID response, missing metrics preparing with empty metric arrays.
- Existing DBF monthly/comparison, HUB handoff, Firebase/OIDC, Store Operations runtime/security,
  Production release package and Core security contracts remain regression gates.
- `deno check supabase/functions/nov-hub-api/index.ts`, `git diff --check`.

The new CI workflow runs a PostgreSQL 17.6 service and the same test harness. The harness only
allows loopback, a fixed disposable database name and test credentials; it accepts no remote URL.
On Windows, set BDF_PG_BIN to a complete PostgreSQL17 bin directory under an ASCII runtime path.
It creates its own temporary cluster, binds loopback and shuts it down/removes only that directory.
Never point the tests at any application database.

## Future post-apply readback (not authorized in this PR)

Before approved application, check exact catalog baseline/source fields, service_role source SELECT,
no conflicting identity_access schema/RPC, migration checksum and backup/recovery readiness. Apply
the new migration only under separate explicit approval, not a bulk migration push.

Afterwards check four private tables have RLS and FORCE, zero anon/authenticated schema/table/RPC
access, zero service UPDATE/DELETE/TRUNCATE, invoker routines with empty search_path, decision
constraints/indexes/triggers, and empty ledgers. Source public/core/auth row fingerprints unchanged.
Before identity configuration an otherwise valid Owner session must **deny** (empty AUTH01).
After the separately approved three grants, verify exact active 1/1/1; canonical Owner UUID stable,
existing roles unchanged, scope all/20/13/7, no raw UUID in public result. Missing formal facts remain
preparing; access configuration does not certify business data availability.

No Production Hosted Smoke or deployed result is claimed by disposable tests.

## Emergency rollback strategy

`supabase/rollback/production_identity_access_auth01_m019_v1.rollback.sql` is **manual only**.
With separate approval, disable the consumer rollout, then revoke server execute on the resolver
and server INSERT on the ledgers. This intentionally fails closed and retains all source/audit rows.
Never auto-execute rollback, drop this schema, remove migration history or restore a legacy auth
fallback. If identity configuration itself must be revoked, use the three append-only revokes
before removing service INSERT authority (or a separately approved administrative recovery path).

Re-enable only after root-cause review, exact ACL regrant approval and repeated disposable/live
readback. No destructive down-migration is needed; inactive additive objects can remain safely.
