# Store Sales API Contract

## Status

**Design contract only. No production endpoint, host, credential, deployment, or live connection information is available or included.**

## Connection rules

1. Store Operations UI calls a versioned Store Sales API over the existing authenticated HUB session.
2. The API resolves actor role and Store Scope on the server; it does not trust browser-provided role, employee, corporation, or store list.
3. The API uses a Core Master Access Port for the approved canonical store set and an Accounting access contract for confirmed values.
4. UI-to-DB direct connection, service role use, production mock fallback, and unapproved data-source substitution are prohibited.
5. If session, scope, canonical mapping, source confirmation, or read-only policy is unavailable, the API returns a fixed safe state and the UI shows `準備中`/`未確定`; it never returns zero as a substitute.

## Target endpoints

| Method | Path | Purpose | Scope check |
| --- | --- | --- | --- |
| GET | `/v1/store-sales/dashboard?period=YYYY-MM` | scoped store summary | scope set resolved server-side |
| GET | `/v1/store-sales/stores/{storeId}?period=YYYY-MM` | one store detail | `storeId` must be within server scope |
| GET | `/health` | non-sensitive service health | no internal dependency details |

## Request contract

```yaml
authorization: existing_HUB_session_only
period: YYYY-MM
storeId: canonical_store_identifier_for_detail_only
allowed_options: page, pageSize, sort, filter
forbidden_input: employee_uuid, role, store_scope, corporation_scope, raw_sql, DB_connection
```

## Response contract

```yaml
contractVersion: store-sales-projection-v1
generatedAt: sanitized_timestamp
dataState: ready|pending|unavailable
scope: aggregate_scope_category_only
stores: aggregate_and_projection_fields_only
provenance: approved_source_version_category_only
```

Raw database IDs, financial source rows, credentials, or unconfirmed results are not returned. Error categories use fixed `401`, `403`, `404`, `422`, `429`, `503`, or timeout semantics; raw driver errors are never passed to the UI.

## Preconditions for a real connection

- canonical public Store Master and Tokorozawa crosswalk decision accepted;
- read-only Core DB/API identity and server-side role/store scope approved;
- Accounting owner confirms profit source, formula, and `confirmed_through_period`;
- endpoint, rate limit, audit sink, timeout budget, staging E2E, and rollback plan accepted;
- Sales owner completes operational review.

Until these are met, this document is the only formal connection information: it defines how the API must connect, not a usable production address or credential.
