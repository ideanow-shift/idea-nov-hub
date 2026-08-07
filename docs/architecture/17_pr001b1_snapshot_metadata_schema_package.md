# Core Business Data Foundation — PR001-B1 Snapshot Metadata Schema Package

## 1. Scope and decision

PR001-B1 closes the physical metadata gaps identified by PR001-B. It authors one Staging-only migration, rollback, validation, and static contract test. It does not connect to or apply against any database and contains no Snapshot or employee data.

**Migration boundary:** `M011 — Snapshot Metadata Foundation`. M001–M010 remain byte-for-byte unchanged. Migration Program numbers are not reused.

## 2. Physical model

```mermaid
erDiagram
  MASTER_SOURCE_SNAPSHOTS ||--|{ SNAPSHOT_MASTER_MANIFESTS : contains_exactly_five
  MASTER_SOURCE_SNAPSHOTS ||--|{ SNAPSHOT_APPROVALS : requires_four_types
  MASTER_SOURCE_SNAPSHOTS ||--|{ SNAPSHOT_VALIDATION_RESULTS : validates_each_master
  MASTER_SOURCE_SNAPSHOTS ||--o{ SOURCE_ENTITY_CROSSWALKS : governs
  MASTER_SOURCE_SNAPSHOTS ||--o{ CANONICAL_VERSION_REGISTRY : versions

  MASTER_SOURCE_SNAPSHOTS {
    uuid source_snapshot_id PK
    text snapshot_version UK
    text source_system
    text source_version UK
    timestamptz source_as_of
    text content_digest
    bigint total_record_count
    text mapping_contract_version
    text masking_policy_version
    text approval_reference
    text created_by
    text status
    timestamptz recorded_at
  }
  SNAPSHOT_MASTER_MANIFESTS {
    uuid source_snapshot_id PK_FK
    text master_type PK
    bigint record_count
    text content_hash
    text schema_version
    text source_extract_version
    text masking_status
    text mapping_status
    text validation_status
    timestamptz created_at
  }
  SNAPSHOT_APPROVALS {
    uuid snapshot_approval_id PK
    uuid source_snapshot_id FK
    text approval_type UK
    text approval_reference
    text approved_by
    timestamptz approved_at
    text approval_status
  }
  SNAPSHOT_VALIDATION_RESULTS {
    uuid snapshot_validation_result_id PK
    uuid source_snapshot_id FK
    text master_type UK
    text validation_code UK
    text validation_status
    text expected_value
    text actual_value
    timestamptz checked_at
  }
```

The existing header table is extended rather than duplicated. Contract names map as follows: `snapshot_id` → `source_snapshot_id`, `snapshot_created_at` → `source_as_of`, `content_hash` → `content_digest`, and `created_at` → `recorded_at`. These mappings preserve PR001 APIs and FK lineage without aliases or Consumer views.

## 3. Structures

### 3.1 Snapshot Header

`governance.master_source_snapshots` gains:

| Column | Type | NULL | Rule |
|---|---|---:|---|
| `total_record_count` | bigint | No | `>= 0`; must equal five manifest counts |
| `approval_reference` | text | No | non-secret structured reference, 3–256 chars |
| `created_by` | text | No | `canonical:`, `service:`, or `audit:` actor reference only |

Existing unique constraints continue to prevent duplicate source/snapshot/content versions. Source version is mandatory and nonblank. The header contains no Production employee ID.

### 3.2 Master Manifest

`governance.snapshot_master_manifests` has exactly one row per Snapshot and Master type. Composite PK `(source_snapshot_id, master_type)` rejects duplicates. Allowed types are only corporations, stores, departments, employees, and employee_store_assignments. Hash is a lowercase SHA-256; count is nonnegative. Mapping, masking, and validation each use `pending|passed|failed`.

Activation requires exactly five passed manifests and header/item count equality. A zero-count Master is representable but must be explicit; an omitted Master is not treated as zero.

### 3.3 Approval

`governance.snapshot_approvals` is append-only. It stores one final decision per required type: Data Owner, Security/Privacy, Platform DB, and Store Operations. The reference, actor reference, timestamp, and approved/rejected decision are physical fields. A rejected decision cannot be overwritten; correction requires a new Snapshot.

### 3.4 Validation Result

`governance.snapshot_validation_results` stores five checks for each of five Masters: hash, record count, schema, masking policy, and mapping contract. Activation therefore requires 25 passed results and no failed result. Expected/actual values are mandatory typed safe values only: `sha256:<64hex>`, `count:<digits>`, or `version:<controlled-token>`. Arbitrary free text is rejected. Raw rows, PII, credentials, hosts, and secrets are prohibited.

## 4. Immutability and activation

M011 retains PR001 system-version strategy B. Snapshot header content is immutable; only the existing controlled state transition can update `status`. Manifest, Approval, and Validation rows reject all UPDATE/DELETE through the existing immutable-mutation guard. Child inserts are accepted only while the parent is candidate or validated.

The existing Snapshot trigger is replaced without editing M007. Its original protections remain, and validated→activated additionally calls the fail-closed activation gate. Activation stops unless:

- all five manifests exist and all three statuses passed;
- manifest count sum equals `total_record_count`;
- all 25 validation contracts passed and no failed result exists;
- all four approval types are approved and none is rejected.

## 5. RLS and Grants

- RLS is enabled and forced on all three new tables.
- No policies are created in this authoring sprint: owner/direct access is denied under forced RLS.
- All table privileges are explicitly revoked from PUBLIC, anon, authenticated, and service_role.
- Helper function execution is explicitly revoked from those roles.
- No raw metadata View or Consumer API is created.
- Future controlled-writer grants/policies require a separate reviewed runtime-role package.

## 6. Migration and rollback

| Artifact | Responsibility |
|---|---|
| M011 | empty-header preflight; header columns; three tables; indexes/constraints; immutable guards; activation gate; RLS/REVOKE |
| M011 rollback | remove only M011 triggers/functions/tables/columns and restore the original PR001 Snapshot guard |
| Validation | required objects/columns, forced RLS, forbidden grants, PII deny-list, approval gate |

Rollback is authorized only before any Snapshot publication. It uses no CASCADE and does not drop or mutate existing PR001 tables, Crosswalks, Canonical history, projections, or audit ledger.

M011 deliberately stops if the existing Snapshot header already contains a row. Retrofitting approval/count lineage onto a pre-existing Snapshot would require invention or inference and is not permitted.

## 7. Static acceptance and release gate

Before Fresh DB rehearsal, all must pass:

1. M001–M010 diff count is zero.
2. Required header fields and all three tables exist in authored SQL.
3. Duplicate source versions remain rejected by existing header constraints.
4. Duplicate manifests and validation results are rejected.
5. Hash and policy versions are non-NULL; negative counts are rejected.
6. Unknown Master types are rejected and exactly five are required for activation.
7. Incomplete/rejected approval blocks activation.
8. Header and child immutability is enforced.
9. PUBLIC/anon/authenticated/service_role direct access is zero.
10. PII/secret columns are absent.
11. Rollback contains no CASCADE and restores M007 behavior.
12. Static Contract Test and `git diff --check` pass.

## 8. Review decision

| Gate | Decision |
|---|---|
| Design | **PASS — READY FOR REVIEW** |
| Migration authoring | **PASS subject to static test** |
| Fresh DB rehearsal | **CONDITIONAL PASS — permitted after review approval** |
| idea-nov-staging apply | **BLOCKED — requires Fresh DB forward/negative/rollback/reapply evidence and explicit approval** |
| Snapshot extraction/load | **BLOCKED / PROHIBITED** |
| Production connection | **PROHIBITED** |
