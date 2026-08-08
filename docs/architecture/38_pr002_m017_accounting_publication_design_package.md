# PR002 / M017 Accounting Publication — Design Package

## Scope and authority

M017 implements ACF-06 after the effective baseline `M015 -> M063 -> M016`. It turns an immutable, fully validated and approved Accounting Version into the formal published Version. It adds Publication identity/history and the frozen comparison-rule contract. M018 Consumer projections, APIs, dashboards, Cash Flow publication, data load, Production and downstream connections remain excluded.

M017 adds exactly three tables:

- `accounting.publication_releases`: immutable release identity, request idempotency, actor, approval and prior/reversal lineage.
- `accounting.publication_members`: the exact Accounting Version, corporation, monthly period, Scenario, validation cycle and content hash pinned by the release.
- `accounting.comparison_rules`: immutable/versioned prior-period selection contract used later by M018.

One release contains exactly one Accounting Version member in M017. This deliberately keeps the operator action atomic and minimal while retaining the frozen release/member boundary. A later business-authorized release profile may group members without changing the meaning of existing rows.

## Publication contract

`accounting.publish_accounting_version(...)` is the only controlled command. It is SECURITY INVOKER, has an empty search path and has no EXECUTE grant for PUBLIC, anon, authenticated or service_role. The command:

1. verifies an active Canonical Employee publisher;
2. serializes only the exact corporation/month/Scenario stream with a transaction advisory lock;
3. locks the candidate Accounting Version and requires `status='approved'`;
4. requires the caller-supplied content hash to match and rejects a non-rejected higher Version sequence as stale;
5. pins the complete blocking M016 PASS cycle for the same content hash;
6. requires the scenario/version/scope-specific approval set;
7. creates one immutable release/member pair;
8. supersedes the prior published Version without deleting its release;
9. transitions the new Version to `published`; and
10. appends Publication audit events.

Facts are not copied. Scenario, corporation and period are pinned from the Accounting Version. Measure Type is validated through the M016 `measure_type_integrity` result and remains a Fact property; it is intentionally not duplicated into the publication stream key. The current stream is therefore Canonical Corporation × monthly period × Scenario.

## Approval and actor boundary

M016 `approvals` remains the sole approval record. M017 neither updates nor copies it. `accounting_confirmed` and `publication_approved` are required for every publication. Actual also requires `import_validated`; store/department-attributable content requires `operations_confirmed`; adjustment/reversal versions require their matching approval type. Every approval must belong to the pinned validation cycle and content hash.

The Publisher must be an active Canonical Employee. M017 does not invent a Role catalog. Publisher and Approver are not forced to be different people: the independent M016 Maker/Checker decision already supplies the second-person control, and a mandatory third person would add operational ceremony without a frozen requirement. Direct browser publication remains impossible.

## Current publication, supersede and idempotency

Publication history is append-only. Current means the sole member in a stream whose Accounting Version status is `published`; prior Versions are moved only from `published` to `superseded`. The new member points to the exact prior member, and the release points to the prior release. No historical release/member is updated or deleted.

A stream-scoped transaction advisory lock prevents concurrent initial/current publications. A deferred constraint trigger rechecks at commit that each release has exactly one member, its Version pins match, and the stream has exactly one current published Version.

`request_key` is stable and unique. Repeating the same request for the same Version/hash returns the existing publication ID. Reusing it for another payload fails. `publication_members.accounting_version_id` is unique, so the same Version cannot be published twice.

## Reversal and correction

Published ledger content never changes. A correction creates an Adjustment, Reversal or new Accounting Version, passes M016 Validation/Approval, then creates a new M017 release. Reversal/adjustment releases retain the prior release and member chain; originals are never deleted or rewritten.

## Publication audit

M017 extends the existing append-only `accounting.audit_events` vocabulary and adds a nullable typed Publication FK. `publication_recorded`, `version_published` and `version_superseded` record actor, role, state transition, reason, evidence reference, Version hash, correlation and Publication identity. M016 audit rows remain unchanged.

## Comparison rules and Consumer boundary

Comparison rules represent only the frozen selection inputs: versioned rule identity, negative month shift, Actual comparison Scenario, approved selection policy, Canonical continuity handling, Account mapping version and effective period. Previous Year is never a Scenario and no Fact is duplicated.

M017 creates no View, Projection, Consumer grant, Store Operations/Finance API or Dashboard. M018 alone turns published releases into `security_invoker` read models.

## Security and rollback

All three M017 tables enable and force RLS, define no policy and revoke direct access from PUBLIC/anon/authenticated/service_role. Functions are SECURITY INVOKER with empty search paths and revoked EXECUTE. There is no SECURITY DEFINER, Consumer View, PII column, Production identifier or CASCADE.

The M017-only rollback removes only M017 triggers/functions/tables, removes the M017 audit extension, restores the exact M016 Accounting Version guard and audit constraints, and leaves M001–M016 plus M061–M063 intact.
