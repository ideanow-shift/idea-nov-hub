# Store Sales API Staging Implementation Sprint

## Scope

This package implements the server-side, read-only handler and its testable access-port boundary. It does not deploy an endpoint, configure a staging secret, connect to a database, or change the UI.

## Implemented source boundary

- `GET /v1/store-sales/dashboard?period=YYYY-MM`
- `GET /v1/store-sales/stores/{storeId}?period=YYYY-MM`
- server-only HUB Session verifier interface
- server-only `public.stores` access port, requiring the exact active 20-store baseline
- server-only Accounting Projection access port
- legacy Tokorozawa reference resolution through the Store Master port only
- representative: 20, sales director: Direct 13, unassigned AM: 403, store manager: own store only, employee: 403
- profit equals tax-exclusive store operating profit; margin equals `operating_profit / total_revenue`; unconfirmed is `null`; FC profit is unavailable in V1

## Explicit non-features

No browser DB access, service-role browser exposure, synthetic values, RLS change, database mutation, migration, production connection, production deployment, or UI change is present.

## Staging activation prerequisites

1. deploy owner creates the Staging-only function and supplies server-side ports from the approved environment;
2. HUB owner binds the verifier to the existing server session validation path;
3. Core DB owner binds the `public.stores` read-only port and validates the exact current 20 baseline;
4. Accounting owner binds the confirmed, tax-exclusive projection port;
5. security owner runs the E2E cases with non-production identities.

Until these steps are approved and deployed, the Staging HTTPS endpoint is a source candidate, not a live URL.
