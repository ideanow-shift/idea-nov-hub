# Store Operations Consumer Enablement: Owner Decision Summary

**Status:** Decision confirmed. This summary records architecture/preflight readiness only. It does not authorize a database, Auth, master, M019, or application write.

## 1. Owner Decisions Recorded

| Decision | Selection | Effect |
|---|---|---|
| D1: Cross-corporation scope | `MODIFY AND ADOPT` | Use a purpose-separated, effective-dated, app-scoped consumer-anchor for future Representative and Vice President Store Operations eligibility. |
| D2: AUTH-01 | Identity Bridge new design | Reuse existing HUB Session server-side verification and integrate it with a new Staging-only native Auth identity bridge. |

## 2. Store Operations V1 Policy Fixed by This Decision

| Actor group | Future scope rule | Scenario |
|---|---|---|
| Representative | Six explicit corporation anchors, resolved to official 20-store projection only | `actual`, `budget` |
| Vice President | Six explicit corporation anchors, resolved to official 20-store projection only | `actual`, `budget` |
| Sales Department Head | Remains `UNRESOLVED` until source proves Employee, Position, Role, and Sales Department relation | No grant |
| Area Manager | Only source-attested effective permitted assignments; unproved stores denied | `actual`, `budget` |
| Store Manager | Only source-attested permitted self/approved concurrent assignments | `actual`, `budget` |
| General employee | Outside Store Operations V1 | None |

No policy allows `forecast`, browser role keys, Preview fixtures, direct URLs, legacy `scope_type = all`, a job title, or a role name to expand scope.

## 3. Work Package Status

| Package | Artifact | Result |
|---|---|---|
| A. Consumer-anchor contract | `46_store_operations_consumer_anchor_contract.md` | **CONSUMER-ANCHOR DESIGN READY** |
| B. AUTH-01 Identity Bridge | `47_store_operations_auth01_identity_bridge_contract.md` | **AUTH-01 DESIGN READY**; existing exchange not attested, implementation remains separately gated |
| C. Sealed source snapshot preflight | `48_store_operations_sealed_source_snapshot_preflight.md` | **SNAPSHOT PREFLIGHT PREPARATION READY**; execution requires fixed source identity, role, query packet, and Owner approval |
| D. M019 corrective | `49_store_operations_m019_additive_corrective_design.md` | **M019 CORRECTIVE DESIGN READY**; additive authoring/apply is not authorized |

## 4. Required Ordered Gates

1. Approve and execute a sealed source snapshot preflight.
2. Approve and execute Staging Canonical Master population.
3. Approve and execute AUTH-01 Staging Auth onboarding and Identity Bridge implementation.
4. Approve authoring, Fresh DB rehearsal, and Staging apply of the additive M019-Corrective package.
5. Approve individual Store Operations Consumer Access bindings.
6. Approve Store Operations staged Consumer connection and acceptance testing.

Each future write is independently approved. Earlier approval cannot be used as consent for a later write.

## 5. Current Unresolved Items

- Sales Department Head remains unresolved and cannot become a Consumer target without source proof.
- Area Manager Store Scope remains limited to source-attested assignments; no title-based expansion is allowed.
- The formal HUB subject to Canonical Employee to Staging Auth subject crosswalk is not populated or attested.
- The concrete supported server-side Staging Auth issuance operation must be selected in a later AUTH-01 implementation design; custom JWT creation is prohibited.
- Corporation-store relationship evidence and any required Snapshot Metadata extension must be resolved by the sealed source preflight, not inferred.

## 6. Explicitly Not Performed

- no database write or migration authoring/apply;
- no Master Population, Auth user onboarding, consumer-anchor record, or access-contract binding;
- no Store Operations API/UI change or Accounting fact load;
- no Production connection or change.
