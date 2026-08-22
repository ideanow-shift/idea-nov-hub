# Snapshot Validation

## Required validation order

1. Verify the manifest schema, version, expiry, and approval reference.
2. Recompute artifact and manifest SHA-256 values.
3. Reject any field outside the approved field allowlist.
4. Verify Store Master records are exactly 20 active current stores: Direct 13 and FC 7.
5. Verify store-code uniqueness, approved Store Master class, and approved legacy-reference crosswalk shape.
6. Verify accounting rows are tax-exclusive and confirmation semantics follow the approved contract.
7. Verify FC profit is unavailable and headquarters allocation is absent.
8. Verify AM rows carry no identity and that unassigned Scope remains deny-by-default.
9. Atomically activate the new version only after every validation passes.

## Failure behavior

| Failure | Result |
| --- | --- |
| missing artifact or manifest | unavailable / `503` |
| hash or schema mismatch | unavailable / `503` |
| expired Snapshot | unavailable / `503` |
| 20 / 13 / 7 mismatch | unavailable / `503` |
| invalid confirmation or forbidden field | unavailable / `503` |
| missing session dependency | `401` or `403` before Snapshot read |
| AM has no approved assignment | `403` or empty approved scope |

No validation failure permits fallback to Production, old arbitrary data, synthetic data, or zero-filled financial values.

