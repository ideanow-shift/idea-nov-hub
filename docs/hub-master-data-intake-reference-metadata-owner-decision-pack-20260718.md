# HUB Master Data Intake reference metadata / owner decision pack 2026-07-18

## Gate

`HUB_MASTER_DATA_INTAKE_REFERENCE_METADATA_AND_OWNER_DECISION_REVIEW`

This is a source-only review artifact. It does not query production, change templates, enable saves, or alter runtime source.

## Evidence identity

| Classification | Source | Relevant lines | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| Review DDL, not proof of production schema | `docs/core-employee-ledger-v1-review.md` | 131-149 | 15074 | `6A1303348C20A0EF7AAF6BBE5723344192E942634CE1AA8B019A2E23BFDA7AD8` |
| Additive SQL candidate, not proof of production constraints | `supabase/job-types-stage1.sql` | 5-13 | 1648 | `18DE32080DC6C151EE37C90F63A0C1AA8A42F13C82A4B71AC407BE7783338219` |
| Runtime consumer contract | `supabase/nov-hub-bootstrap-rpc.sql` | 86-129 | 4780 | `5E9718BA64AD2235694C194F13E043893EC178545615919B6F7D30B1FA8EA1B0` |
| Runtime admin bootstrap / reference reads | `supabase/functions/nov-hub-api/index.ts` | 2251-2256, 2743-2766, 4744-4752 | 219640 | `26297CF8BA3DCA9966143C6BACDCD1AF6FA73F1D62AE31AD7999EF82D6BFCB00` |
| Current UI uses UUID selections and display names | `portal/master-admin/master-admin.js` | 1406-1411, 1929-1959 | 265265 | `DEC94618FE97C56669C41121C075AA684BE942C040449D314FD2C62776864F42` |

The local production-evidence artifact used by the previous write-shape gate does not include `departments`, `positions`, or `job_types`. It therefore cannot prove their current production constraints. No new production SELECT was performed in this gate.

## Source findings

### Department

- Candidate CSV identifier: `department_code` (`部署コード`).
- The review DDL proposes `NOT NULL UNIQUE` and `is_active boolean`.
- Runtime bootstrap already reads `department_code`.
- Production column/constraint identity remains unconfirmed in this gate.

Status: `OWNER_AND_PRODUCTION_METADATA_CONFIRMATION_REQUIRED`.

### Position

- No `position_code` column is present in reviewed source.
- Existing identifier candidate is `position_no`; review DDL proposes it as `NOT NULL UNIQUE`.
- `position_name` is also proposed unique, but a display name must not become CSV authority.
- Runtime bootstrap reads `position_no`, `position_name`, and `is_active`.

Status: `OWNER_DECISION_REQUIRED`.

Recommended Phase 1 choice: rename the proposed CSV header from `役職コード` to `役職No` and resolve exactly against `position_no`. Adding `position_code` would require a separate Core DB schema and migration gate.

### Job type

- Candidate CSV identifier: `job_type_key` (`職種コード`).
- The additive SQL proposes `UNIQUE`, but does not propose `NOT NULL`.
- Runtime bootstrap already reads `job_type_key` and `is_active`.
- Production nullability and uniqueness remain unconfirmed in this gate.

Status: `OWNER_AND_PRODUCTION_METADATA_CONFIRMATION_REQUIRED`.

## Recommended shared Phase 1 contract

```yaml
resolution: exact_active_canonical_identifier
unknown: reject_complete_batch
missing: reject_complete_batch
inactive: reject_complete_batch
ambiguous: reject_complete_batch
display_name_fallback: false
alias_fallback: false
canonical_identifier_mutable_after_create: false
display_name_mutable: true
```

Renaming a display name does not change the canonical identifier. Alias-based lookup is not supported in Phase 1. If aliases are needed later, they require a separately owned alias table/contract; free-text fallback is not acceptable.

## Owner decisions required

Core DB / product owner should return these exact decisions:

```yaml
department_identifier:
  decision: department_code | hold
  immutable_after_create: true | false
  unique_not_null_production_evidence: confirmed | unconfirmed

position_identifier:
  decision: position_no | create_position_code | hold
  csv_header: 役職No | 役職コード | hold
  immutable_after_create: true | false

job_type_identifier:
  decision: job_type_key | hold
  immutable_after_create: true | false
  unique_not_null_production_evidence: confirmed | unconfirmed

inactive_reference_policy:
  decision: reject_complete_batch | hold

rename_alias_policy:
  display_name_mutable: true | false
  alias_lookup_phase_1: disabled | hold
  display_name_fallback: disabled | hold
```

Recommended response: `department_code`, `position_no` with header `役職No`, `job_type_key`, complete-batch rejection for inactive references, and no alias/display-name fallback.

## Static verification

```yaml
result: DATA_INTAKE_REFERENCE_METADATA_SOURCE_AUDIT_PASS
check_count: 7
runtime_change_count: 0
production_access_count: 0
mutation_count: 0
```

## Stops maintained

- template change
- frontend validation replacement
- S2a validator finalization
- S2b atomic target write implementation
- save enablement
- production CSV import
- production SELECT DB
- DML / RPC / RLS / GRANT
- deploy / push / publish
