# Store Operations Sealed Snapshot v1 Runner

This fixture-only package is the public control plane for a future, separately
approved, read-only Source Snapshot run. It has no database URL, credential,
SQL text, network client, file-export path, or live execution entrypoint.

The runner accepts only the six fixed `SOCE-QP01` through `SOCE-QP06` packs.
The approved SQL and physical-schema mapping remain inside the already approved
private broker. Stage 0 must hash-match a private approved Schema/Column
Contract before Stage 1 can be invoked.

Run the local fixtures only:

```powershell
node review/store-operations-sealed-snapshot-v1/sealed-snapshot-package.test.mjs
```

The test uses only synthetic records and an in-memory broker. It does not open
source or target connections and does not create a Snapshot artifact.
