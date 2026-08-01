# Execution Manifest

The generated manifest contains immutable snapshot version, generation and expiry times, confirmed-through period, executed query IDs, row counts, unavailable sources, schema version, artifact SHA-256, manifest SHA-256, and approval status.

The runner uses SHA-256 over canonical JSON bytes. A manifest is not valid solely because hashes match: it must also carry a matching human approval record and pass the Sandbox validation contract. Manifest output contains no credential, endpoint, project identity, raw UUID, or accounting amount.

Initial safety parameters are: maximum 8 fixed queries, statement timeout 5 seconds, lock timeout 1 second, one session, one execution, retry 0, and rollback required. Any future change requires a new approval pack and runner manifest identity.
