# Sealed Runner Contract

## Fixed Execution Order

1. Rehash every ordered execution artifact and compare it with `execution-package-lock-v1.json`.
2. Recalculate and compare the self-excluding Package SHA-256, then rehash all 16 fixed SQL artifacts.
3. Verify the complete Owner run authorization binding: run ID, package ID/version/hash, Query Pack hash, Schema Contract hash, source/target profile references and fingerprints, broker reference/fingerprint, Operator, Reviewer, time window, and output policy.
4. Atomically claim the pre-registered Owner-approved `run_id`; retry is always zero.
5. Verify separation of duties, resolve Source and Target profile metadata, verify exact profile reference/fingerprint/environment/project identity/expiry, then verify broker metadata.
6. Open one Source and one Target private-broker data connection, begin `READ ONLY`, and mechanically attest both roles.
7. Execute Stage 0: `SOCE-QP01`, validate identity/read-only/PostgreSQL version, then execute `SOCE-QP02`.
8. Compare the Stage 0 evidence hash with the approved Schema/Column Contract.
9. Execute Stage 1 in order: `SOCE-QP03`, `SOCE-QP04`, `SOCE-QP05`, `SOCE-QP06`; immediately before every execution re-read, rehash, and send that exact SQL artifact.
10. Enforce 6 / 20 / 13 / 7, no duplicate/orphan/unresolved official Store, Tokorozawa relation state, manager coverage, crosswalk restrictions, and Target pre-state.
11. Build and validate a local ephemeral bundle frame only; no broker-side persistent `prepare` artifact exists.
12. Roll back and close both DB sessions, stop the broker data session, delete raw/intermediate resources, and generate a hash-validated Cleanup Receipt.
13. Add the Cleanup Receipt to sanitized evidence and the private manifest, finalize the local bundle, atomically commit the final bundle, verify its digest, close broker control, verify final cleanup, then mark the `run_id` `COMPLETE`.

## Non-negotiable Controls

- fixed query identifiers only; no SQL argument, RPC name, table, column, or
  filter accepted from the caller;
- two stages only; Stage 1 cannot run after a Stage 0 mismatch;
- one atomic claim of a pre-registered Owner-approved `run_id`, retry zero, no resume under a `FAILED` or `COMPLETE` run ID, fixed query maximum, timeout per query;
- no DML, DDL, grants, function write, export, or consumer/application write;
- no final artifact on any failure: local ephemeral material is deleted or placed in an unreadable quarantine/cleanup queue, and a committed bundle is revoked before the run is marked `FAILED`;
- every Cleanup Receipt has the 13 enumerated fields with only `pass`, `failed`, or legitimate `not_created`; its SHA-256 is part of the manifest canonical payload and sanitized evidence;
- failure output uses an enumerated code and optional fixed query ID only;
- no automatic Population, Auth onboarding, consumer-anchor, M019 binding, or
  Store Operations connection after a successful Snapshot run.

The package has no network client. A future approved operation supplies the
existing private broker, private execution ledger, and sealed-artifact store;
all must conform to this interface and must not change the runner's gate order
or expose a connection value.
