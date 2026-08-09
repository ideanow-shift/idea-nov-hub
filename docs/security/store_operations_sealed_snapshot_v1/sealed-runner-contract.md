# Sealed Runner Contract

## Fixed Execution Order

1. Validate request, package/schema/private-query-registry hashes, Pack IDs/order, and no-retry flag.
2. Atomically claim the pre-registered Owner-approved `run_id` and its exact binding hash in the private execution ledger.
3. Verify Owner, Operator, Reviewer, Source/Target Role Owner, Broker Owner, and Profile Custodian attestations.
4. Verify Source/Target profile not-before, expiry, identity, fingerprint, broker reference, and PostgreSQL version policy through the private broker.
5. Open one Source and one Target private-broker connection, begin `READ ONLY`, and mechanically attest both roles.
6. Verify all 16 per-Query SQL SHA-256 values against the private broker before QP01.
7. Execute Stage 0: `SOCE-QP01`, validate identity/read-only/PostgreSQL version, then execute `SOCE-QP02`.
8. Compare the Stage 0 evidence hash with the approved Schema/Column Contract.
9. Execute Stage 1 in order: `SOCE-QP03`, `SOCE-QP04`, `SOCE-QP05`, `SOCE-QP06`.
10. Enforce 6 / 20 / 13 / 7, no duplicate/orphan/unresolved official Store, Tokorozawa relation state, manager coverage, crosswalk restrictions, and Target pre-state.
11. Sanitize public evidence, build private `SOCE-MANIFEST-v1`, and prepare a sealed bundle.
12. Verify the prepared bundle hash, close both DB connections, and verify temporary-resource cleanup.
13. Atomically commit the sealed bundle, close the broker, verify final cleanup, then mark the `run_id` `COMPLETE`.

## Non-negotiable Controls

- fixed query identifiers only; no SQL argument, RPC name, table, column, or
  filter accepted from the caller;
- two stages only; Stage 1 cannot run after a Stage 0 mismatch;
- one atomic claim of a pre-registered Owner-approved `run_id`, retry zero, no resume under a `FAILED` or `COMPLETE` run ID, fixed query maximum, timeout per query;
- no DML, DDL, grants, function write, export, or consumer/application write;
- no final artifact on any failure: a prepared bundle is aborted and a committed bundle is revoked before the run is marked `FAILED`;
- failure output uses an enumerated code and optional fixed query ID only;
- no automatic Population, Auth onboarding, consumer-anchor, M019 binding, or
  Store Operations connection after a successful Snapshot run.

The package has no network client. A future approved operation supplies the
existing private broker, private execution ledger, and sealed-artifact store;
all must conform to this interface and must not change the runner's gate order
or expose a connection value.
