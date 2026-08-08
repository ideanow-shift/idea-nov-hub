# PR002 M016 Accounting Validation / Approval / Audit Design Package

## Scope and release order

M016 implements only ACF-05 after `M015 → M063`. It adds the Control Layer that promotes an immutable Accounting Version from `validating` to `validated`, and from `validated` to `approved`. Publication remains unreachable until M017; Consumer projection, APIs, Cash Flow, data load, UI, Production and downstream connections remain excluded.

The migration adds exactly three tables: `accounting.validation_results`, `accounting.approvals`, and `accounting.audit_events`. A validation cycle is represented by an immutable `validation_cycle_id` shared by result rows; a mutable workflow/header table is intentionally avoided. Approval is a single minimal checker gate (`accounting_confirmed`) for the M016 lifecycle. Other frozen approval types may be recorded, but their publication requirements remain M017 responsibility.

## Validation contract

Every required result is derived by `accounting.record_accounting_validation`; callers cannot submit an arbitrary PASS. The evaluator returns a violation count and records `pass` only when actual equals expected zero, `fail` for a nonzero violation count, and `pending` when prerequisite Facts do not yet exist. NULL and missing evidence never become PASS.

Common checks are Journal completeness, Debit/Credit integrity, Account validity, Organization Scope validity, period validity, Measure Type integrity, allocation completeness, explicit unallocated state, duplicate prevention, source lineage and Fact completeness. Actual additionally requires M012 source completeness and tax/rounding evidence. Budget and Forecast require the planning contract. Previous Year is not a Scenario.

Evidence is restricted to typed status/count/hash/version tokens plus controlled evidence references. Raw source values, descriptions, names, files, credentials and PII have no storage column. Every row pins Accounting Version content hash, validator version, actor/role reference, checked time and correlation ID.

## Lifecycle

M016 replaces only the M014 Accounting Version mutation guard. `draft → validating` remains. A complete cycle of blocking PASS results permits `validating → validated`; any blocking FAIL permits `validating → rejected`; PENDING or missing results keep the Version validating. One approved `accounting_confirmed` decision permits `validated → approved`. `approved → published` continues to fail with the M017 stop condition.

Content and lineage columns remain immutable. Validation or approval corrections append evidence and, where ledger content changes, use Adjustment, Reversal or a new Accounting Version; existing Facts are never updated or deleted.

## Approval and separation of duties

Approvals are append-only decisions with frozen approval type, decision sequence, status, reference, canonical approver, role reference, time, reason, content hash and validation cycle. An approved decision of the same type is unique; a rejected decision is retained and may be followed by a new decision.

The M016 maker/checker minimum is deliberately small: an approver must be an active Canonical Employee and must differ from both the Version creator and the validator. M016 does not invent a Role catalog or assert external role membership. Concrete permission-to-role bindings remain a Staging/Production security gate. Command functions are SECURITY INVOKER and executable by none of PUBLIC, anon, authenticated or service_role in this authoring migration.

## Audit

Every result recording, validation finalization, approval decision and approved lifecycle transition appends an `audit_events` row with actor, role, action, previous/next state, time, reason, evidence reference, content hash, cycle and correlation ID. Validation results, approvals and audit events reject UPDATE and DELETE.

## Security and performance

All three tables enable and force RLS, have no policy and revoke all direct access from PUBLIC/anon/authenticated/service_role. Functions use SECURITY INVOKER with empty search path and direct EXECUTE revocation. There are no Views, Consumer objects, SECURITY DEFINER routines, Production IDs or PII columns. Foreign keys and lifecycle query paths have leading indexes.

Version row `FOR UPDATE` is the only workflow mutex. It serializes commands for the same Accounting Version while different Versions remain independent. No new table lock, advisory lock or M015/M063 concurrency path is introduced, so a new two-session test is not required.

## Rollback

The M016-only rollback drops three evidence triggers and M016 functions/tables in dependency order, restores the exact M014 pre-M016 mutation guard, uses no CASCADE and leaves M001–M015 plus M061–M063 intact.
