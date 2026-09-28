# Store Sales API Staging Connection Report

## Result

**BLOCKED — no verified Staging identity or read-only server access ports are configured.**

This sprint did not make a Production connection, deploy an endpoint, execute a database query, or change a database object.

## Connection evidence

| Required connection | Status | Evidence | Safe conclusion |
| --- | --- | --- | --- |
| Staging project identity | not configured | repository configuration has a project reference but no `staging` label; no `STAGING_*` connection environment is present | target cannot be proved non-Production |
| `public.stores` read-only port | not bound | new API defines a server-only `StoreMasterAccessPort`; no Staging adapter/configuration exists | no real Store Master row was read |
| Accounting Projection read-only port | not bound | new API defines `AccountingReadOnlyAccessPort`; no Staging adapter/configuration exists | no real profit or revenue was read |
| HUB server Session verifier | not bound | client session contract exists, but a Staging server verifier binding is not configured | no real actor was authenticated |
| Store Operations runtime | synthetic-only | existing Staging configuration explicitly requires synthetic data | it cannot be used for real-data E2E |

## Implemented source endpoint

The source candidate exposes these server routes after a Staging-only deploy:

- `GET /v1/store-sales/dashboard?period=YYYY-MM`
- `GET /v1/store-sales/stores/{storeId}?period=YYYY-MM`

The source package is [store-sales-staging-api](../../../supabase/functions/store-sales-staging-api/). It is not a deployed URL.

## No synthetic fallback rule

The real-data handler returns `null` with `preparing` when an Accounting projection is missing. It has no fixture fallback. The separate pre-existing Staging synthetic runtime remains intentionally disconnected from this candidate.

## Required Staging-only activation inputs

1. Platform/Security owner supplies a verified non-Production project identity fingerprint and deploy target.
2. HUB owner supplies the existing server-side session verifier binding for the Staging audience.
3. Core DB owner supplies a read-only `public.stores` access port, constrained to the approved current-store projection.
4. Accounting owner supplies a read-only confirmed tax-exclusive projection access port.
5. Deploy owner approves one Staging-only deployment and one bounded E2E run.

No connection value, credential, project reference, or secret is recorded in this report.
