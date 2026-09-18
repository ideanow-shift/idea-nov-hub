# Production Snapshot: Human Operator Action Guide

## Rule before step 1

Do not use an existing Production credential, `service_role`, browser session, API key, or connection string. Do not paste any secret into chat, GitHub, a repository file, or an evidence record. If the Production identity cannot be proven, stop; query count remains zero.

## 1. Confirm the Production project identity

**Screen:** Supabase Dashboard, project selector, then **Settings > General > Project Settings > Reference ID**. The location is documented by Supabase; use the real Dashboard as the source of truth. [Supabase project-reference documentation](https://supabase.com/docs/guides/graphql)

**Private input fields:** project display name, organization, environment label `Production`, Reference ID, and an approved fingerprint of the Reference ID. Record only the fingerprint and approval ID outside the private profile.

**Completion:** DB owner independently matches all private fields to the D01 record. **Stop:** any missing or mismatched field; do not open a database session.

## 2. Create the Private Identity Profile

**Screen:** organization-approved password manager or approved encrypted secure-record system, not GitHub.

**Fields:** D01 approval record ID, masked project identity/fingerprint, environment label, approved read-only route category, DB owner, expiry policy, revocation owner. Do not store a full connection string in the approval document.

**Completion:** the OS owner can compare a fingerprint only; the DB owner alone can access private connection material when a later one-time run is approved.

## 3. Confirm the exact Q01/Q02/Q08 source objects before creating a role

**Screen:** DB owner’s approved private database administration path.

**Required evidence:** the exact source object for Store Master, confirmed Accounting, and Tokorozawa crosswalk; schema name; object kind; RLS behavior; permitted projection columns; and whether a SELECT-only role can reach each object without a function/RPC.

**Completion:** a private object-evidence record maps each Query ID to one approved projection. **Stop:** if an object, schema, RLS rule, or projection is uncertain. No role is created and no query runs.

## 4. Create the temporary read-only audit role only after step 3

**Screen:** DB owner’s approved private database administration path. Supabase documents that database roles are configured with PostgreSQL roles and object grants. [Supabase roles documentation](https://supabase.com/docs/guides/database/postgres/roles)

**Role properties to enter:** login enabled; `NOINHERIT`; connection limit `1`; explicit expiry timestamp within the approved window; a generated unique credential held only in the approved password manager; audit label referencing the opaque approval record.

**Exact permissions:** `USAGE` only on the three verified schemas and `SELECT` only on the three verified Q01/Q02/Q08 projection objects. The actual schema and object names are intentionally not written here and must come from step 3 evidence. There are no default or future-object grants.

**Completion:** DB owner verifies the role has exactly those three SELECT grants. **Stop:** any extra grant, unknown object, or inability to apply a bounded expiry.

## 5. Prohibited role permissions

The audit role must not have `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, `EXECUTE`, `CREATE`, `ALTER`, `DROP`, ownership, membership inheritance, replication, `BYPASSRLS`, superuser, database creation, schema creation, default privileges, or access to any arbitrary function/RPC. It must not be `postgres`, `service_role`, `anon`, `authenticated`, or any existing application role.

## 6. Transfer the credential safely

**Channel:** a time-limited, access-controlled password-manager share to the named OS command owner only. Do not use chat, email, GitHub Secrets, repository files, clipboard history, or browser-side configuration.

**Completion:** recipient acknowledges access without repeating the value; DB owner records share expiry and revocation owner. **Stop:** any accidental disclosure; revoke/rotate immediately and abandon the execution approval.

## 7. Set the execution time

**Screen:** approved internal calendar/change record.

**Fields:** one date, one start/end window between `04:00-05:00 JST`, named OS command owner, DB owner on-call, representative approval ID, runner source manifest hash, and retry `0`.

**Completion:** all three approvals and private identity profile remain valid at the planned time. **Stop:** expired credential, missing approver, conflicting operations, or changed runner hash.

## 8. Perform the immediate GO / NO-GO check

**GO requires:** D01 identity all-match; D02 exact grants; Q01/Q02/Q08 source evidence; runner source hash match; no Q03-Q07 activation; connection limit 1; 5-second statement / 1-second lock timeouts; no Sandbox intake approval bundled into this run.

**NO-GO:** any item absent, ambiguous, expired, or changed. The operator closes the window without connecting.

## 9. Revoke credentials after the run

**Screen:** the same approved private database administration path.

**Action:** disable/revoke the temporary role credential immediately after the runner reports rollback and session close, regardless of success or failure. Remove the password-manager share and retain only sanitized evidence.

**Completion:** DB owner records the revocation result category and time. Do not retain the credential in evidence.

## 10. Review before Sandbox intake

Extraction does not authorize transfer. A separate reviewer checks artifact/manifest hashes, expiry, query count 3, 20/13/7 baseline, approved confirmed-through period, unavailable Q03-Q07, no personal-data exposure, and rollback/close proof. Only a separate Sandbox-intake approval can permit upload or activation.

## Current result

**Production connection start: NO.** Representative approval is recorded, but OS technical confirmation and DB authority/source-object confirmation remain pending. Until both are recorded, no role creation, credential creation, connection, or SELECT is authorized.
