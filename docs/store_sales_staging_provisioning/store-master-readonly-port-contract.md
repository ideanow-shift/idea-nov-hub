# Store Master Read-only Port Contract

## Status

**Interface contract exists; source binding is pending the Data Source decision.**

## Fixed source and response boundary

| Item | Contract |
| --- | --- |
| Logical source | `public.stores` is the approved Store Master SSoT |
| Data Source for Staging | approved Option A port or Option B sanitized Snapshot only |
| Read operation | fixed server-side projection only; no arbitrary SQL, filter, table name, or schema from the request |
| Returned shape | canonical store ID, stable store code, display name, Direct/FC class, active flag, approved operator code |
| Baseline check | exactly 20 active current stores: Direct 13 and FC 7 |
| Legacy reference | Tokorozawa legacy UUID may resolve only inside this server-side Port to the approved canonical ID |
| Scope projection | performed after verifier capability is resolved; no browser scope input |
| Failure | missing source, invalid 20/13/7 baseline, missing crosswalk proof, or stale Snapshot returns 503 |
| Write behavior | INSERT, UPDATE, DELETE, UPSERT, RPC write, migration, and schema change are prohibited |

## Port interface implementation boundary

The Store Sales source candidate already depends on `listCurrentStores()` and `resolveLegacyStoreReference()` interfaces. A future adapter may implement those exact methods only after the approved source is available. It may not expose a general database client to the handler.

## Staging Snapshot minimum content if B is approved

One current-store projection record per approved current store plus the approved Tokorozawa legacy-to-canonical reference. No employee, contact, raw source key, connection, or unapproved historical row is included.

