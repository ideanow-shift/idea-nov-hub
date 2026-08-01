# Rollback Plan

## Principle

Rollback restores the last known release artifact or disables the newly approved integration path. It never repairs data by editing production records during an incident.

## Release 1.0 rollback

| Symptom | Immediate action | Evidence | Data effect |
| --- | --- | --- | --- |
| UI/navigation regression | restore prior static release artifact | prior/failed release identifiers | none |
| broken local parser/view | hide or remove affected UI entry in next approved static patch | test failure category | none |
| misleading readiness state | revert to explicit pending state | screenshot/static test | none |

## Release 1.1 rollback

| Symptom | Immediate action | Mandatory follow-up |
| --- | --- | --- |
| Core DB identity/role/query mismatch | stop runner; rollback transaction; revoke/expire audit credential | preserve sanitized receipt; reopen approval only after diagnosis |
| Store Sales API scope/source issue | disable that API integration; restore pending display | API contract and session-scope review |
| Accounting source/period ambiguity | remove confirmed-value display; retain pending state | finance owner decision |
| Talent endpoint/staging issue | stop only Talent path; preserve existing data | Talent owner fixed-stage diagnosis |
| HUB provider issue | omit provider field/card; keep navigation available | provider owner review |

## Rollback rules

- No automatic retry.
- No force push or emergency direct main edit.
- No production DML, schema change, seed, UUID change, or role expansion as a rollback substitute.
- Every rollback records release/version, failure category, time, owner, and whether any production operation occurred. Raw values and credentials are never recorded.

## Return-to-service

The affected domain returns only through a new approval, a fixed artifact/contract, scoped tests, and a separately authorized deployment window.
