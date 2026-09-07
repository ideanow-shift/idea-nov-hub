# Store Operations Staging Go / No-Go

# NO-GO

## Decision basis

The approved Sandbox is active and clean, but it has no tables, migrations, Functions, secrets, Store Master port, Accounting port, or Session verifier. The requested prohibition on Production connection, database update, and migration means none of the missing non-Production data sources can be supplied in this sprint.

Creating a Function endpoint without a real server-side verifier and two Staging-only read-only ports would be a false indication that Store Operations is connected. This sprint therefore stops before deployment.

## Required human approvals before GO

1. approve the non-Production source and read-only boundary for the 20-store `public.stores` projection;
2. approve the non-Production Accounting projection source and confirmed-period rules;
3. approve HUB Session verifier ownership and actor/scope source;
4. approve creation of three new Sandbox-only runtime secret bindings; values must be entered directly by authorized owners;
5. add a GitHub Environment reviewer and deployment branch policy;
6. approve one Staging deployment and E2E window.

## What Codex can perform after those approvals

Codex can validate the supplied non-Production endpoint identities, deploy the reviewed Store Sales API to the approved Sandbox, run one bounded E2E suite, and produce a sanitized result. Codex must still reject Production endpoints, synthetic fallback, unassigned AM access, and any non-read-only source.

## Counts

| Operation | Count |
| --- | ---: |
| Production connections | 0 |
| Sandbox database connections | 0 |
| Database writes / migrations | 0 |
| Function deploys | 0 |
| Secret registrations or reads | 0 |
| E2E requests | 0 |

