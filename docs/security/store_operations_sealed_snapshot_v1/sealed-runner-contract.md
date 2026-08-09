# Sealed Runner Contract

## Fixed Execution Order

1. Validate request, Pack IDs/order, no-retry flag, and authorization reference.
2. Validate distinct private Source/Target profile shape without opening either.
3. Validate the approved Schema/Column Contract and private Pack manifest hash.
4. Open one Source and one Target private-broker connection.
5. Begin read-only transactions and mechanically attest both roles.
6. Execute Stage 0: `SOCE-QP01`, then `SOCE-QP02`.
7. Compare Stage 0 evidence hash with the approved Schema/Column Contract.
8. Execute Stage 1 in order: `SOCE-QP03`, `SOCE-QP04`, `SOCE-QP05`,
   `SOCE-QP06`.
9. Enforce 6 / 20 / 13 / 7, no duplicate/orphan/unresolved official Store,
   Tokorozawa relation state, manager coverage, crosswalk restrictions, and
   Target pre-state.
10. Sanitize public evidence, build private `SOCE-MANIFEST-v1`, and pass the
    private payload only to the sealed artifact sink.
11. Roll back both read-only transactions, close both connections, and clean
    ephemeral buffers on both success and failure.

## Non-negotiable Controls

- fixed query identifiers only; no SQL argument, RPC name, table, column, or
  filter accepted from the caller;
- two stages only; Stage 1 cannot run after a Stage 0 mismatch;
- one run, retry zero, fixed query maximum, timeout per query;
- no DML, DDL, grants, function write, export, or consumer/application write;
- no artifact on any Stage 0/1/validation failure;
- failure output uses an enumerated code and optional fixed query ID only;
- no automatic Population, Auth onboarding, consumer-anchor, M019 binding, or
  Store Operations connection after a successful Snapshot run.

The package has no network client. A future approved operation supplies the
existing private broker implementation that conforms to this interface; it must
not change the runner's gate order or expose a connection value.
