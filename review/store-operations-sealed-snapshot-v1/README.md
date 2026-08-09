# Store Operations Sealed Snapshot v1 Runner

This fixture-only package is the public control plane for a future, separately
approved, read-only Source Snapshot run. It has no database URL, credential,
network client, file-export path, or live execution entrypoint. It carries
only the reviewed, fixed, non-secret SQL text required by its 16 Query IDs.

The runner accepts only the six fixed `SOCE-QP01` through `SOCE-QP06` packs.
Each query's exact UTF-8, BOM-free, LF-terminated SQL artifact is under
`queries/`. The runner rehashes the actual bytes at startup and immediately
before that query is sent to the broker. Stage 0 must hash-match an approved
Schema/Column Contract before Stage 1 can be invoked.

Run the local fixtures only:

```powershell
node review/store-operations-sealed-snapshot-v1/sealed-snapshot-package.test.mjs
```

The test uses only synthetic records and an in-memory broker. It does not open
source or target connections and does not create a Snapshot artifact.
