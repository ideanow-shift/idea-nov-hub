# Snapshot Schema

## Envelope

The logical format is `store-sales-staging-snapshot-v1`. It is immutable per version and contains only approved aggregate projections.

| Field | Type | Rule |
| --- | --- | --- |
| `format` | literal | `store-sales-staging-snapshot-v1` |
| `snapshot_version` | string | monotonically assigned, immutable version label |
| `approved_at` | ISO timestamp | approval time, not extraction source detail |
| `expires_at` | ISO timestamp | hard expiry; passed expiry is unavailable |
| `stores` | array | exactly 20 current stores, Direct 13 / FC 7 |
| `accounting` | array | aggregate rows keyed by canonical store code and period |
| `customer_metrics` | array | aggregate-only, optional panel availability |
| `product_metrics` | array | aggregate-only, optional panel availability |
| `ec_metrics` | array | aggregate-only, optional panel availability |
| `am_scope_status` | array | store code, `assigned` or `unassigned`, no employee identity |
| `legacy_store_references` | map | server-only legacy-reference to canonical-store mapping |
| `integrity` | object | manifest hash, artifact hash, schema version, signer category |

## Store row

`canonical_store_id`, `store_code`, `display_name`, `store_class`, `active`, and nullable `operator_code` are permitted. `canonical_store_id` is a Snapshot-local opaque identifier; raw Production UUIDs are not emitted in documentation, API responses, or client state.

## Accounting row

`canonical_store_id`, `period`, `confirmed_through_period`, `total_revenue`, `operating_profit`, `operating_margin`, `tax_basis`, and `confirmed` are permitted. All profit fields are `null` unless confirmed and tax-exclusive. FC profit is always `unavailable` in V1, and headquarters allocation is absent.

## Customer, unit-price, product, and EC rows

All are keyed by canonical store identifier and `YYYY-MM`. Only approved aggregate numeric metrics and an explicit availability state are permitted. A metric not supplied by the approved Snapshot is `unavailable`, not zero.

## AM row

AM data is limited to `store_code`, `assignment_state`, and an optional opaque `scope_reference`. It carries no employee identity. Without a separately approved server-side resolver matching the session actor to the scope reference, the API must deny AM access.

