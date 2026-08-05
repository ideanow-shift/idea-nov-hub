# Security Review

## PASS locally

- No database client, network call, production profile, secret, service-role credential, or deployment command is present.
- SQL registry is fixed and rejects writes, export, arbitrary statements, `SELECT *`, lock, advisory lock, and unsafe multi-statements.
- Identity mismatch and non-audit roles stop before opening the fake connection.
- The fake transaction always ends with rollback and close.
- Sanitizer and result-schema validator reject unapproved fields and raw-error propagation.

## Conditions before production use

- Independent private identity profile approval.
- DBA review of the real role, grants, default privileges, RLS behavior, expiry, and revocation.
- Per-query SQL, expected schema, result field, and classification approval against the actual target.
- Private broker, package signing, host TLS verification, and result retention review.
- One separately approved catalog-only smoke. No business-record query in the first smoke.
