# Snapshot Security and Sanitization

## Excluded by design

- credentials, tokens, connection strings, host names, project identifiers, and raw errors;
- raw UUIDs, source record keys, internal database IDs, arbitrary SQL output, and audit-log detail;
- employee, customer, applicant, reservation, order, contact, and free-text data;
- row-level accounting data, journals, invoices, allocations, and unapproved historical detail.

## Sanitization controls

The extraction contract uses a fixed field allowlist and aggregate-only grouping. It must reject an unexpected column, row type, or free-text field before artifact creation. An approval record contains only opaque references, result category, hashes, version, counts, and timestamps.

## Access controls

The Snapshot artifact is readable only by the Sandbox server-side adapter. Browser clients receive the existing scoped API response only. The API does not provide Snapshot download, arbitrary filtering, raw manifest content, or direct storage paths.

## Integrity and retention

Artifact and manifest SHA-256 validation is required on receipt and before activation. Retain the active artifact and one prior approved artifact for rollback under restricted server-side access. Retention duration and storage implementation require a separate owner decision; no storage system is selected here.

