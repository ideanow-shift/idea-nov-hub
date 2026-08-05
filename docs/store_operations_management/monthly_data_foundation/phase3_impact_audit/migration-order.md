# Migration and Implementation Order

1. **Catalog attestation**: read-only confirmation of Accounting and Core Master objects, constraints, RLS, grants, and schema owners. No migration.
2. **Core Master alignment**: confirm effective employee assignments and identify whether a restricted legacy crosswalk relation is missing.
3. **Accounting lifecycle alignment**: apply only approved M1/M2/M3 structural changes with expand-only compatibility and preflight checks.
4. **RLS and grants**: apply reviewed least-privilege policies, then run server-only authorization fixtures.
5. **Access ports**: implement and test the Import Center command endpoint against a non-production database.
6. **Projection**: implement published-only read endpoint and role/store-scope fixtures.
7. **Rollback rehearsal**: validate append-only approval, supersession, restoration, and read rollback before any production decision.

Each phase has a separate approval. Failure halts before the next phase; no automatic retry, data rewrite, or rollback is permitted.
