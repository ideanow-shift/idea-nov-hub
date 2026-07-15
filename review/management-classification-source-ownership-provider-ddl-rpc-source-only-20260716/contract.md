# Classification Source Ownership Provider Substrate V1

Status: SOURCE CANDIDATE ONLY. CURRENT PROVIDER NOT READY.

## Non-disruptive substrate

`substrate-up.sql` creates only a dedicated non-login owner, a fixed NOT_READY
status reader, and a SELECT-only ownership resolver stub. It adds no column,
trigger, policy, grant, key generator, or business mutation path. Existing
classification behavior remains unchanged.

The resolver accepts only a backend-resolved rule identifier. Browser actor,
role, owner, source, relation, row, ownership key, snapshot, provider, and
readiness fields are not accepted. It always returns
`SOURCE_OWNERSHIP_PROVIDER_NOT_READY` and false booleans. PUBLIC, anon, and
authenticated receive no EXECUTE privilege.

## Future cutover boundary

Approved owner relation resolution, canonical owner-kind framing, DB-owned
opaque owner identity hashing, target row binding, duplicate rejection, and
same-read snapshot binding are not implemented here.
`cutover-authoritative-resolver.sql` remains execution-ineligible until the
complete provider graph has reviewed runtime identities.

A future provider must generate the canonical ownership key itself, require one
known active owner and one bound target row, and compare that key with the
snapshot provider inside one atomic read. Browser labels and caller-generated
hashes never become authority. Raw owner, source, target, actor, key, and
snapshot identities remain absent from terminal results and logs.

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
- authoritative resolver installed: false
- snapshot binding installed: false
- runtime wired: false
- current ready: false
- production catalog/apply: `PRODUCTION_EVIDENCE_REQUIRED`
