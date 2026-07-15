# Classification Corporation Scope Provider Substrate V1

Status: SOURCE CANDIDATE ONLY. CURRENT PROVIDER NOT READY.

## Non-disruptive substrate

`substrate-up.sql` creates only a dedicated non-login owner, a fixed NOT_READY
status reader, and a SELECT-only resolver stub. It adds no table column, trigger,
policy, grant, or business mutation path. Existing classification reads and
writes remain unchanged.

The resolver accepts only a backend-resolved rule identifier. Browser actor,
employee, role, permission, corporation, scope, provider, and readiness
assertions are not accepted. The stub always returns
`CORPORATION_SCOPE_PROVIDER_NOT_READY` and false booleans. PUBLIC, anon, and
authenticated receive no EXECUTE privilege.

## Future cutover boundary

Actor/session re-resolution, current role and permission verification, scoped
corporation matching, explicit global grants, common-rule policy, and target row
binding are not implemented here. `cutover-authoritative-resolver.sql` is
intentionally execution-ineligible until reviewed runtime provider identities
exist for the complete six-provider graph.

Common and missing corporation scope never imply global access. A future
resolver must preserve the accepted dummy contract: scoped targets require one
canonical opaque corporation identity; all-scope requires a DB-resolved explicit
global grant; unresolved, duplicate, malformed, common, or missing scope fails
closed. Raw actor, role, corporation, and target identities remain absent from
terminal results and logs.

## Ownership and collisions

The dedicated owner is exact NOLOGIN and nonprivileged with zero inbound or
outbound membership. Existing unsafe role, function overload, owner, or ACL
identity aborts before owner changes. CREATE OR REPLACE is prohibited.

## Rollback

`down.sql` removes only the two unconnected functions and their dedicated owner.
It must not run after runtime wiring or grants exist. No business row is changed.

## Current classification

- accepted source contract: verified
- local source fixture: PASS eligible
- runtime approved digest: null
- schema applied: false
- authoritative resolver installed: false
- runtime wired: false
- current ready: false
- production catalog/apply: `PRODUCTION_EVIDENCE_REQUIRED`
