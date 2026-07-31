# ADR: Version, publication and rollback

Status: accepted for the isolated prototype.

Each scope and fiscal period has immutable, numbered versions. A human label is
derived for display but is not used as identity. The enforced workflow is:

`imported → validated → accounting_approved → management_approved → published`.

Accounting and management rejection are terminal history states. Decisions,
actors, reasons and timestamps are append-only.

Publishing is an explicit transaction after both approvals. If another active
publication exists, the new version must explicitly identify it through
`supersedes_version_id`; the old publication/version becomes superseded while
its facts remain unchanged.

Rollback creates a new `rollback_restore` version. It reuses the superseded
version's raw lineage and copies its fact values into new fact identities, then
passes both approvals and explicit publication. Neither old nor bad facts are
updated or deleted. This preserves what consumers saw at every point in time.

Production separation of duties should normally use three actors:

- accounting reviewer: accounting approval;
- management approver: management approval;
- accounting administrator: explicit publish/rollback orchestration.

Emergency combination of roles, if enabled by policy, must be tenant-configured
and audited; it is not client-selectable.
