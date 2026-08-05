# Sealed Runner Candidate

The local candidate at [review/production-read-only-audit-runner](../../../review/production-read-only-audit-runner) has no production driver, connection string input, environment lookup, network code, or deploy path. It accepts only the audit pack, environment name, fixed query IDs, profile fingerprint, and a connection abstraction supplied by a future private broker.

Evaluation order is fixed: request validation, identity validation, audit-role validation, open, read-only transaction, timeout setup, read-only guard, fixed queries, sanitization, result schema validation, rollback, close. `finally` invokes rollback after every opened session, including partial failure. The abstraction intentionally prevents arbitrary SQL and has no `commit` method.
