# Validation Rules

| Rule | Required result |
| --- | --- |
| Store Master | exactly 20 unique store codes, Direct 13 and FC 7 |
| Legacy crosswalk | Q08 returned and every row has opaque legacy/canonical references and version |
| Required fields | exact allowlisted primitive fields only |
| Accounting | tax-exclusive; unconfirmed profit/revenue/margin all `null` |
| FC profit | `unavailable` and no operating profit value |
| AM | `assigned` or `unassigned` only; unresolved mapping is deny-by-default |
| Integrity | artifact and manifest SHA-256 both match canonical bytes |
| Freshness | expiry after generation and current at Sandbox acceptance |
| Query budget | at most eight fixed queries; no retry |
| Cleanup | rollback then session close for every started session |

Failure of any rule emits no Snapshot artifact and retains no partial output.
