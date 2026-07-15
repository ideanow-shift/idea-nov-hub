# Classification Actor Audit Provider Substrate V1

Status: SOURCE CANDIDATE ONLY. CURRENT PROVIDER NOT READY.

## Non-disruptive substrate

`substrate-up.sql` creates only a dedicated non-login owner, a fixed NOT_READY
status reader, and a SELECT-only actor/audit resolver stub. It adds no column,
trigger, policy, grant, audit insert, command function, or business mutation
path. Existing classification and authentication behavior remains unchanged.

The resolver accepts only a backend-resolved rule identifier. Browser employee,
actor, role, permission, corporation, scope, audit, target, session, token,
provider, and readiness fields are not accepted. It always returns
`ACTOR_AUDIT_PROVIDER_NOT_READY` and false booleans. PUBLIC, anon, and
authenticated receive no EXECUTE privilege.

## Future cutover boundary

Session employee re-resolution, enabled/unlocked login checks, active current
role and permission checks, corporation scope matching, and same-transaction
audit exact-one enforcement are not implemented here. The cutover artifact is
intentionally execution-ineligible until all six runtime provider identities
are reviewed.

A future successful command must bind the audit actor to the backend-resolved
employee, insert exactly one command audit record inside the mutation
transaction, and roll the transaction back on zero/multiple records, actor
mismatch, or audit failure. Caller booleans and frontend roles are never
authority. Raw employee, role, corporation, audit, session, and target
identities remain absent from terminal results and logs.

## Ownership and rollback

The owner is exact NOLOGIN and nonprivileged with zero membership. Existing
unsafe role, function overload, owner, or ACL identity aborts before owner
changes. CREATE OR REPLACE is prohibited. `down.sql` removes only the two
unconnected functions and owner and is ineligible after runtime wiring.

## Current classification

- accepted source contract: verified
- local source fixture: PASS eligible
- runtime approved digest: null
- schema applied: false
- employee/role resolver installed: false
- audit command installed: false
- runtime wired: false
- current ready: false
- production catalog/apply: `PRODUCTION_EVIDENCE_REQUIRED`
