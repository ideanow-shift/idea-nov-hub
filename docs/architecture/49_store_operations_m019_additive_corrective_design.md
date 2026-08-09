# Store Operations M019 Additive Corrective Design

**Status:** Architecture only. Existing M019 migration files remain unchanged. No corrective migration has been authored, applied, or rehearsed.

## 1. Decision and Compatibility Objective

The Owner approved a purpose-separated consumer-anchor model for Representative and Vice President Store Operations scope. Current M019 accepts only `core.employee_store_assignments` as its authorization anchor. Therefore an **additive corrective migration is required** before a consumer-anchor can be recognized at runtime.

The corrective package must retain M019 v1 unchanged and introduce a versioned compatibility path. It may not revise the historical M019 migration file, weaken RLS, grant raw table access, or create a role/Employee-specific exception.

## 2. Current M019 Gap

| Current M019 behavior | Why it is insufficient for the approved model |
|---|---|
| Every contract requires `assignment_version_id` referencing `core.employee_store_assignments` | A purpose-separated consumer-anchor is deliberately not a normal employee-store assignment. |
| Corporation scope is proved through the assigned store's effective accounting relationship | The future anchor needs an explicit validating store/corporation relationship without creating a false HR assignment. |
| Resolver joins only employee-store assignments | It cannot resolve a consumer-anchor or reject an incorrect purpose/application because that type does not exist. |
| Port is JWT-bound and append-only | These properties must be preserved, not bypassed. |

## 3. Recommended Additive Design

The actual migration identifier is intentionally unassigned until the Migration Register is reviewed. This document calls the future package **M019-Corrective**. It is an additive successor, not an edit to M019.

### 3.1 Logical Objects

| Logical object | Responsibility |
|---|---|
| `core.consumer_anchor_identities` | Stable Consumer-anchor identities, separate from assignment identities. |
| `core.consumer_anchor_versions` | Immutable effective-dated purpose/application/corporation/anchor-store records with Canonical Employee and source-snapshot provenance. |
| `core.consumer_anchor_decisions` | Append-only grant/revoke chain for the anchor itself. |
| `accounting.consumer_access_contracts_v2` | Append-only consumer access decisions that support exactly one anchor kind: normal assignment or consumer-anchor. |
| `accounting.current_consumer_access_contracts_v2` | Security-invoker resolver that validates whichever approved anchor kind is pinned by the contract. |
| `projection.read_accounting_consumer_v2` | JWT-bound, narrow read port preserving the M019 security model while using the v2 resolver. |

Existing `accounting.consumer_access_contracts`, its guard, resolver, and `projection.read_accounting_consumer_v1` remain intact. Existing consumers keep their v1 contract. Store Operations V1 may use v2 only after separate binding, integration, and acceptance approvals.

### 3.2 V2 Anchor Rules

| Anchor kind | Permitted V2 scope | Runtime proof |
|---|---|---|
| `employee_store_assignment` | Corporation, store, or department, preserving M019 semantics | Active Canonical Employee, active effective assignment, and effective organization relationship |
| `consumer_anchor` | Corporation scope only for Store Operations V1 | Active Canonical Employee, active grant, `consumer_application = store_operations`, approved purpose, active effective anchor version, and effective validating store/corporation accounting relation |

Consumer-anchor scope is never global. For Representative/Vice President all-store access, the Store Operations adapter makes separate authorized corporation requests and then returns only official Store Master projection rows. `actual` and `budget` are the only Bindable scenarios for Store Operations V1. `forecast` is rejected by the Store Operations v2 contract even though older generic M019 API shape recognizes it.

### 3.3 V2 Access Contract Shape

The V2 ledger retains M019's append-only decision sequence and all identity/scope/scenario evidence. It additionally pins one of these mutually exclusive anchor references:

```text
anchor_kind = employee_store_assignment
  -> assignment_version_id is present
  -> consumer_anchor_version_id is absent

anchor_kind = consumer_anchor
  -> consumer_anchor_version_id is present
  -> assignment_version_id is absent
```

The guard must reject missing, dual, mismatched, inactive, expired, revoked, cross-application, cross-purpose, or cross-corporation anchor values. No migration or runtime code can contain a role name or Employee UUID as an authorization exception.

## 4. Security, RLS, and Grant Invariants

| Area | Required invariant |
|---|---|
| Tables | RLS enabled and forced. No direct PUBLIC, anon, authenticated, or service-role DML/SELECT grants. |
| Resolver | `security_invoker`, fixed empty search path, no caller-controlled SQL, no raw anchor/assignment row exposure. |
| Read port | The only justified `security_definer` boundary, fixed search path, schema-qualified relations, valid Staging `authenticated` JWT subject, and narrow projection allowlist. |
| Identity | Read port resolves the JWT subject and rechecks the active Canonical Employee plus current access decision. AUTH-01 identity success alone is insufficient. |
| Scope | Resolver reevaluates anchor/assignment period, corporation relation, purpose/application, scenario, and publication at request time. |
| Audit | Grant/revoke chains are append-only. No UPDATE/DELETE correction path exists. |
| Failure | Missing or invalid proof returns access denied; no fallback to legacy `scope_type = all`, frontend role aliases, or browser filters. |

## 5. Migration Design Sequence

No step below is currently authorized to execute.

1. Catalog/contract re-attestation confirms M019 v1 objects, dependencies, grants, and existing access-row state.
2. Author a new additive M019-Corrective migration, rollback SQL, validation SQL, and static tests. Never edit the M019 migration file.
3. Rehearse forward, negative, rollback, and reapply behavior on a fresh non-Production database.
4. Obtain separate Owner approval for Staging apply.
5. Apply only to `idea-nov-staging`; validate v1 behavior remains unchanged and v2 has no consumer rows yet.
6. Only after Master Population and AUTH-01 onboarding, seek a separate binding approval for source-attested people and scopes.

## 6. Required Negative Tests

1. Consumer-anchor cannot be inserted as an HR assignment or be read by HR projections.
2. `consumer_anchor` with any application other than `store_operations` is denied by the Store Operations v2 path.
3. An anchor missing the approved purpose, corporation, validating store relation, source snapshot provenance, or Owner reference is denied.
4. One global anchor cannot permit six corporations.
5. Expired/revoked anchor, inactive employee, inactive anchor store, and changed corporation relation all deny access.
6. `forecast` is not bindable or readable through Store Operations V1.
7. A subject cannot bind to two Canonical Employees.
8. Direct v2 table reads/writes, anon calls, and unverified JWT calls are denied.
9. Existing M019 v1 consumer behavior and grants remain unchanged.
10. Revoke is append-only; UPDATE/DELETE are rejected.

## 7. Rollback Policy

| Stage | Permitted response |
|---|---|
| Before any V2 contract/anchor data | Approved schema rollback may remove only M019-Corrective objects, without CASCADE and without modifying M019 v1, M018, or earlier Core objects. |
| After an anchor or V2 contract exists | Do not physically delete history. Append the appropriate revoke decision and disable the v2 path under a separately approved incident procedure. |
| After application integration | Revert Store Operations to the prior no-consumer-data state; never redirect it to M019 v1 or a privileged bypass merely to retain availability. |

## 8. Readiness

| Item | Status |
|---|---|
| Additive corrective design | **DESIGN READY** |
| Additive corrective migration necessity | **REQUIRED** |
| Migration identifier, SQL, rollback, validation, tests | Not authored |
| Fresh DB rehearsal | Not authorized |
| Staging apply | Not authorized |
| M019 v1 change | Prohibited; v1 remains immutable |
