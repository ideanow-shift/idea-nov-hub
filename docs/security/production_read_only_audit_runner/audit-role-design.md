# Production Audit Role Design

## Status

Design only. The companion SQL is an unapplied template and must not be run without the separate production role gate.

## Intended identity

`idea_nov_prod_audit` is a dedicated login for one sealed read-only audit runner. It is not a Supabase `service_role`, does not inherit membership, cannot bypass RLS, has one connection maximum, and has no owner, DDL, DML, replication, temporary-object, or function-execution privilege.

| Control | Required state |
| --- | --- |
| Login | `LOGIN`, credential provisioned only by the private broker |
| Membership | `NOINHERIT`; no role grants to or from application roles |
| Privilege | `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS` |
| Data | explicit `SELECT` only on approved relations |
| Functions/RPC | no `EXECUTE` grants |
| Search path | `pg_catalog, information_schema` only |
| Limits | connection limit 1; statement 5s; lock 1s; idle transaction 10s |
| Expiry | human-approved UTC expiry, rotated before expiry |

PostgreSQL cannot independently distinguish `COPY TO` from a client that already has `SELECT`. The audit login is therefore never exposed to a SQL client: the sealed runner grammar rejects all `COPY`, and the credential broker releases it only to that runner. `COPY FROM` is denied by the absence of write privileges.

## Required human checks before applying

1. Verify the target is the approved production project privately.
2. Verify the exact approved relation list exists and RLS permits only the reviewed audit shape.
3. Set a real expiry only in the private privileged session; do not commit it.
4. Confirm no default privilege or membership path gives `EXECUTE`, write, or ownership.
5. Store a revocation receipt after the limited audit window closes.
