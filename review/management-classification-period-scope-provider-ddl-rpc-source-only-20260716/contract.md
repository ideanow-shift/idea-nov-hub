# Classification Period Scope Provider Substrate V1

Status: SOURCE CANDIDATE ONLY. CURRENT PROVIDER NOT READY.

## Non-disruptive substrate

`substrate-up.sql` creates only a dedicated non-login owner, a fixed NOT_READY
status reader, and a SELECT-only period resolver stub. It adds no column,
trigger, policy, grant, or business mutation path. Existing classification
reads and writes remain unchanged.

The resolver accepts only a backend-resolved rule identifier. Browser target
month, range, actor, target, corporation, scope, provider, and readiness fields
are not accepted. The stub always returns `PERIOD_SCOPE_PROVIDER_NOT_READY` and
false booleans. PUBLIC, anon, and authenticated receive no EXECUTE privilege.

## Future cutover boundary

Canonical DB month conversion, inclusive closed-range comparison, actor/target
scope binding, corporation matching, and duplicate target rejection are not
implemented here. `cutover-authoritative-resolver.sql` is intentionally
execution-ineligible until the complete six-provider runtime graph has reviewed
identities.

A future DB-owned resolver must use canonical first-of-month dates, reject an
invalid target month or inverted range, and match both range endpoints
inclusively. Null or open-ended endpoints remain `PERIOD_RANGE_NOT_READY` until
a separate policy is approved. Raw month, range, target, actor, and corporation
values remain absent from terminal results and logs.

## Ownership and rollback

The owner is exact NOLOGIN and nonprivileged with zero membership. Existing
unsafe role, function overload, owner, or ACL identity aborts before owner
changes. CREATE OR REPLACE is prohibited. `down.sql` removes only the two
unconnected functions and owner, and is ineligible after runtime wiring.

## Current classification

- accepted source contract: verified
- local source fixture: PASS eligible
- runtime approved digest: null
- schema applied: false
- authoritative resolver installed: false
- runtime wired: false
- current ready: false
- production catalog/apply: `PRODUCTION_EVIDENCE_REQUIRED`
