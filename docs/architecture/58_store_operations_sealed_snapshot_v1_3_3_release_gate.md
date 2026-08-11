# Store Operations Sealed Snapshot v1.3.3 Release Gate

Release is permitted only when all of the following pass:

- v1.3.3 Package integrity and fixed SQL hashes;
- Authorization exact-key contract: required 31/31, missing 0, unknown 0,
  type mismatch 0;
- approved Schema Contract generation and canonical hash verification;
- QP02/QP04 Canonical Assignment schema parity;
- adversarial execution-path security;
- Windows LF byte integrity;
- v1.3.2 and earlier immutable-package regression;
- zero-connection formal runner state `EXECUTION_READY` with connection 0 and
  query 0.

Failure at any gate is a safe stop. This release does not authorize credentials,
Source/Target connection, Snapshot execution, database writes, role changes,
Staging Master Population, AUTH-01, Consumer Anchor, or M019 Binding.
