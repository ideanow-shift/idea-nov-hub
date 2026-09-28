# Store Operations Next Phase Requirements

## Entry condition

The next phase may begin only after explicit human approval for both independent blockers below. Neither approval can be inferred from the Phase 1 work or from this documentation.

## R01: Production Snapshot approval

The owner must approve a separate, read-only Snapshot acquisition gate that fixes:

1. the verified Production source identity and authorized read-only actor;
2. the exact minimum Store Master and Accounting fields to extract;
3. sanitization rules that exclude personal data, credentials, raw SQL output, unnecessary history, and arbitrary-query results;
4. Snapshot integrity, approval identity, expiry, retention, revocation, and transfer mechanism;
5. one bounded execution window, query-count limit, retry policy, and safe evidence schema.

The Snapshot must validate against the existing 20 / Direct 13 / FC 7 manifest. A missing or invalid Snapshot must remain unavailable; it may never be replaced with synthetic data or zero values.

## R02: Canonical HUB Session foundation approval

The owner must approve a non-Production binding for the existing canonical HUB Session method, including:

1. the authorized Sandbox issuer path or other approved verification source;
2. server-side employee, Role, and Store Scope resolution sources;
3. expiry, audience, mock-identity rejection, and AM-unassigned deny-by-default behavior;
4. secret creation, custody, expiry, rotation, revocation, and no-browser-exposure controls;
5. a test proving that missing or invalid verifier dependencies return 401 or 403 before any Snapshot result is read.

Copying an existing environment signing credential, creating an unapproved token format, or calling Production at request time is prohibited.

## R03: Deployment approval after R01 and R02

Only after R01 and R02 are complete may a separate deployment decision consider:

- `store-sales-staging` GitHub Environment with one actual named human required reviewer;
- custom branch policy limited to the reviewed candidate branch;
- a Sandbox-only Function deployment with no database write, migration, RLS relaxation, or UI change;
- fail-closed checks: Snapshot missing/invalid = unavailable, verifier unavailable = 401/403, Store Master mismatch = 503;
- one human-approved Staging E2E window and a disabled-endpoint rollback plan.

## Required decision record

The future approval must state the manifest or contract identity, approving owner, permitted execution count, expiry, and rollback owner. It must not include credentials, raw UUIDs, connection details, or Production data values.

## Current status

**WAITING_FOR_SNAPSHOT_APPROVAL**. No execution is authorized by this document.
