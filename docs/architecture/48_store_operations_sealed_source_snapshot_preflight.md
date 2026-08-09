# Store Operations Sealed Source Snapshot Preflight

**Status:** Preparation only. No Production connection, query, snapshot extraction, data load, Auth onboarding, or Staging write has been performed.

## 1. Objective

This Preflight prepares the only permitted route for obtaining source-backed Canonical Master candidates for Store Operations V1:

```text
idea-nov-core Canonical Master
  -> separately approved read-only sealed source snapshot
  -> manifest, mapping, masking, validation, and approval gates
  -> separately approved Canonical Master population in idea-nov-staging
```

It never creates Staging master data by inference or manually recreates Production data. It does not permit a direct Production connection from Store Operations, the browser, or the Consumer Access Port.

## 2. Source Scope

The existing Snapshot Metadata contract has five required Master manifests:

1. corporations;
2. stores;
3. departments;
4. employees;
5. employee-store assignments.

Store Operations needs the following additional **relationship evidence** during preflight. This is evidence scope, not permission to add a sixth master manifest without a separately approved Snapshot Metadata contract change.

| Requirement | Required evidence | Fail-closed rule |
|---|---|---|
| Official store projection | Store identity/status/type and explicit classification of the official 20, Direct 13, Franchise 7; headquarters/legacy/virtual/test rows remain separately classified | Do not populate or project an unclassified row. |
| Corporation/store authority | Effective corporation-store accounting relation for each permitted corporation anchor | Do not infer the relation from a label or current UI field. |
| AM/Store Manager scope | Effective employee-store assignment, supported assignment kind, status, and period | Unproved stores remain absent from scope. |
| Representative/Vice President anchors | Active Canonical Employee and each corporation's validating store relation | Do not create consumer-anchor candidates until both sides are source-backed. |
| AUTH-01 crosswalk input | Explicit persisted HUB employee identifier to Canonical Employee relationship, where it exists | No email/name matching fallback. |
| Sales Department Head | Employee, position, role, and department relation | Keep `UNRESOLVED` when any fact is absent. |

## 3. Sealed Preflight Inputs

The actual source operation may begin only after a separate Owner approval package fixes all values below. This document does not create the package or execute it.

| Input | Required condition |
|---|---|
| Source project identity profile | All private identity fingerprints match `idea-nov-core`; any mismatch stops before query 1. |
| Read-only actor | Dedicated least-privilege source-audit route; no service credential, DML, DDL, RPC, arbitrary SQL, retry, or export. |
| Sealed runner | Hash-pinned approved runner, fixed query IDs only, `BEGIN READ ONLY`, statement/lock/session limits, mandatory rollback and close. |
| Query packet | Pre-reviewed catalog-safe and minimal approved source queries only. It must not retrieve employee personal values, raw credentials, raw UUID lists, or financial facts. |
| Result schema | Aggregate and masked/derived identity evidence only, with an explicit per-field allowlist. |
| Execution window | One approved window, one run, retry zero; failure produces no candidate snapshot. |
| Evidence retention | Safe run metadata, query IDs/counts, hashes, result shape, rollback/close result, and approval reference only. |

## 4. Manifest, Mapping, and Masking Contract

The Snapshot Metadata Foundation remains the governing mechanism. Each candidate snapshot must retain its immutable source/version/mapping/masking lineage and must not overwrite a prior snapshot.

| Control | Required preflight proof |
|---|---|
| Source version | Present, nonblank, and tied to the source snapshot timestamp. Unknown source version blocks use. |
| Artifact/content hash | Verified before activation; mismatch blocks population. |
| Mapping contract | Explicit approved version. Sheet/UI labels, store names, role names, and email do not substitute for identifiers. |
| Masking policy | Explicit approved version. PII, secrets, host/connection details, raw token material, and unneeded history are excluded. |
| Counts | Manifest counts and header total match. Zero may be explicit but missing is not zero. |
| Freshness | `current`, `stale`, `expired`, or `invalid`, using a per-domain controlled threshold. `expired` and `invalid` block population. |
| Immutability | New source data creates a new snapshot version. Existing content, manifests, approvals, and validation evidence are not overwritten. |

## 5. Store Operations V1 Validation Gates

The future preflight must validate the following before it can request a population approval:

| Gate | Required result |
|---|---|
| Corporation baseline | Six explicitly identified Canonical corporations are present and active as-of snapshot date. |
| Store baseline | Official Store Master projection has exactly 20 approved stores, with Direct 13 and Franchise 7. |
| Non-official rows | Headquarters, legacy, virtual, inactive, test, duplicate, or unresolved rows are classified and excluded from the official 20 unless separately approved. |
| Store/corporation relation | Every official store and proposed anchor store has an explicit, effective corporation relation; none is guessed. |
| Employees | Only source-attested eligible candidates are considered. No full employee data export is required. |
| AM | Only `primary` or `secondary` effective assignments may propose Store Scope. `temporary` and `support` never expand it. |
| Store Manager | Only source-attested current assignment(s) may propose self-store scope. |
| Sales Department Head | `UNRESOLVED` until Employee, Position, Role, and Department facts all exist. |
| Consumer-anchor | Representative/Vice President candidates require source-attested Canonical identity plus six corporation validation paths. |
| Scenario | Store Operations V1 candidates are limited to `actual` and `budget`; `forecast` is rejected. |
| Identity bridge | No Auth onboarding candidate proceeds without an explicit source-backed HUB subject relation. |

## 6. Stop Conditions

Preflight must stop, issue no population candidate, and require new Owner review if any of the following occurs:

- project identity mismatch or possible Production/Staging confusion;
- sealed runner, query packet, mapping contract, masking policy, or result schema mismatch;
- read-only route cannot be proven;
- source version/hash/freshness missing, expired, invalid, or inconsistent;
- official store counts are not `20 / 13 / 7`;
- a corporation/store, candidate employee, assignment, or identity crosswalk is unresolved;
- a proposed anchor relies on a role, email, display name, UI state, or manually supplied UUID;
- PII, credentials, token material, raw connection data, or unapproved raw values would enter an artifact;
- any execution would require retry, write, snapshot load, or automatic merge.

## 7. Subsequent Approval Boundaries

The following are distinct write approvals and must not be bundled with preflight:

1. sealed source snapshot execution;
2. Staging Canonical Master population;
3. Staging Auth onboarding and AUTH-01 implementation;
4. M019 additive corrective migration authoring/rehearsal/apply;
5. Store Operations Consumer Access binding;
6. Store Operations staged connection.

## 8. Readiness

| Item | Status |
|---|---|
| Sealed snapshot architecture and stop conditions | **PREPARATION READY** |
| Approved source identity/role/query packet | Not supplied in this work package |
| Source connection/extraction | Not authorized and not executed |
| Staging population | Not authorized and not executed |
| Snapshot Preflight execution | Requires a separate Owner approval package |
