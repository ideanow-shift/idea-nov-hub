# Edge Function Impact

## Candidate 1: Import Center Command Endpoint

The server endpoint hosts exactly `upload`, `dry-run`, `validate`, `import`, `review`, `publish`, and `rollback`. It invokes the merged fixture parser and command-boundary logic, resolves the canonical HUB session server-side, validates fixed input, and owns the write transaction. It has no arbitrary SQL or browser credential path.

## Candidate 2: Monthly Projection Read Endpoint

The server endpoint resolves actor role and effective store scope, then reads only a confirmed, latest published version. It returns `null`/unavailable for unconfirmed profit and FC profit, never synthetic zero. It does not expose raw Workbook, audit, source UUID inventory, or draft data.

## Gates

Neither endpoint is implemented or deployable until canonical HUB verifier ownership, database catalog, RLS/grant design, sanctioned Workbook storage, and staging deployment approvals are complete.
