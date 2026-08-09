# Sanitizer Contract

## Public Evidence Allowlist

The public runner result and retained safe evidence may contain only:

- fixed query IDs;
- result category;
- row counts;
- deterministic entity/result-schema digests;
- approved status/failure code;
- aggregate duplicate, orphan, unresolved, and classification outcomes;
- manifest and canonical-payload hashes;
- rollback/close and cleanup status;
- approval reference and opaque sealed-artifact reference.

## Absolute Prohibitions

The runner rejects and never serializes employee name, email, telephone,
address, birth/salary data, raw employee/store/corporation UUID, raw Auth
subject, password, secret, token, credential, certificate, DSN, connection
detail, SQL text, raw source row, or raw database error.

Aggregate fields such as `email_only_match_count` are permitted because they
state a validation count and contain no email value. They do not authorize
email-based matching.

## Private Payload

The private broker may retain only the minimum approved logical Snapshot fields
needed for a later population decision. Those fields remain in its sealed
artifact boundary. The public runner receives no file path and does not write a
plaintext export. If a field outside the fixed logical output schema is
returned, the run stops before artifact storage.

Sanitization is tested with PII-like and secret-like field injection. Failures
return an enumerated code only, never a raw error message.
