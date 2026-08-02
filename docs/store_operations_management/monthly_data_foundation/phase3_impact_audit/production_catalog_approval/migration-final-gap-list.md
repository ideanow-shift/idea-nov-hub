# Migration Final Gap List

## Result

**Exact migration count: unresolved.** Target catalog facts were not collected, so no table, column, key, index, RLS, grant, trigger, or function gap can be declared final.

## Conditional Migration Domains

| Domain | Implement only if attestation proves a gap | Owner |
| --- | --- | --- |
| Accounting lifecycle alignment | missing or incompatible batch, file, version, fact, validation, publication, approval, audit, or published projection capability | Accounting Core |
| Core Master assignment/crosswalk | missing or incompatible employee assignment relation or legacy crosswalk | Core Master |
| Access security/projection | missing least-privilege server access and published-only projection boundary | Security / Platform |

## RLS and Grant Result

Exact policy and grant changes are unresolved. The attestation must first return current RLS enabled state, policy counts, relevant role grants, ownership, and function execution exposure. Any uncertainty is deny-by-default and blocks migration drafting.

## Minimal First Implementation

After catalog and verifier approval, the first implementation unit is a non-production `workbookDryRun` adapter that persists only safe batch/file/validation metadata. It may not import facts, publish a version, expose a browser database credential, or connect to Production directly.
