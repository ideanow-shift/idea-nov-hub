# Security Boundary

- Service credentials never enter the browser, repository fixtures, logs, or documentation.
- Store Operations has no direct Production database path. Any future source path is server-side and separately approved.
- Only fixed command inputs are accepted. Roles, scopes, approval claims, SQL, and table names in request bodies fail closed.
- Workbook parser failures, catalog mismatch, missing assignment, unknown crosswalk, missing publication, and unconfirmed profit fail closed.
- Rollback is an append-only state transition with two distinct server-resolved actors. It restores only the validated immediate numeric predecessor in the same period.

This audit creates no secret, credential, connection, deployment, or data operation.
