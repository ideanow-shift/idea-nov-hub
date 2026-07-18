# HUB Master Data Intake transactional RPC design pack 2026-07-18

## Ownership

- API owner: `nov-hub-api`
- database owner: Core DB / `public`
- execution: backend-only service role calling a fixed Security Definer RPC
- UI owner: Master Admin Data Intake
- authorization source: active employee plus current `super_admin` or approved master-editor role resolved in the backend

Frontend role hints, HUB Context fields, CSV content, and browser state are never authorization sources.

## Proposed database contract

One generic public RPC is preferred over browser table writes:

```text
public.commit_master_data_intake(
  p_target text,
  p_client_request_id uuid,
  p_file_digest text,
  p_preview_digest text,
  p_rows jsonb,
  p_expected_counts jsonb,
  p_actor_employee_id uuid
) returns jsonb
```

The final function name and schema require Core DB review. The function must be Security Definer with a fixed search path and no PUBLIC/anon/authenticated EXECUTE.

## Atomic flow

1. Lock or reserve `target + file_digest` and `client_request_id` in an idempotency receipt.
2. Validate target, digest shapes, maximum 1000 rows, action counts, natural-key uniqueness, field allowlist, and forbidden fields.
3. Resolve foreign labels to canonical IDs using active Core master rows.
4. Lock existing target rows by natural key.
5. Verify each requested create/update classification still matches current state.
6. Apply all target and business-profile changes in one transaction.
7. Append one safe change-log entry per changed record without raw CSV or private fields.
8. Mark receipt success and return counts plus a fixed result category.
9. Any error rolls back target changes, audit entries, and receipt completion together.

## Idempotency contract

```yaml
same_client_request_and_same_digests: return_same_sanitized_result
same_client_request_different_digest: reject
same_target_and_file_digest: reject_duplicate_file
in_progress_receipt: reject_busy
failed_transaction: no_partial_target_or_audit_change
retention_candidate_days: 90
```

Retention is a product/operations decision and is not fixed by this pack.

## Phase 1 field boundary

### Employees

- required: employee number, full name
- optional: email, corporation, department, store, position, job type, joined/retired dates, employment type/status, leave fields, active status
- prohibited: PIN, credential, Firebase UID, role, permission, LINE WORKS ID, profile image, HR private data

### Stores

- required: store ID, store name
- optional: store number, corporation, business unit, area, store type, active status and approved business-profile fields
- immutable after creation candidate: store ID and store number

### Corporations

- required: corporation number, corporation name
- optional: corporation code, active status and approved business-profile fields
- immutable after creation candidate: corporation number and corporation code

Blank optional cells mean no change in Phase 1. Explicit clearing requires a future typed operation and is not represented by an empty CSV cell.

## Required migration slices

1. `S1`: idempotency receipt table, constraints, RLS, rollback, catalog post-check.
2. `S2`: transactional RPC, fixed search path, execution revoke/grant, synthetic local fixtures.
3. `S3`: Edge action wiring with request and response sanitization.
4. `S4`: frontend save enablement and confirmation screen.
5. `S5`: one synthetic/nonproduction rehearsal.
6. `S6`: one production file limited execution with aggregate post-check.

Each slice requires a separate review. This design pack executes none of them.

## Fail-close conditions

- schema metadata drift
- unsupported or unknown field
- ambiguous foreign label
- preview/current-state classification mismatch
- duplicate natural key
- duplicate file or request-ID reuse
- row count over 1000
- any forbidden field
- missing active authorized actor
- audit or receipt failure

Direct grant widening, partial save, browser writes, raw-row error responses, and automatic retries are prohibited.
