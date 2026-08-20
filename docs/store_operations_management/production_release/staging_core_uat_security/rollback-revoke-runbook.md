# Rollback and Revoke Runbook

## Before UAT begins

If population or onboarding fails, roll back the open transaction. If the transaction already committed, consume the matching sealed rollback manifest: revoke server sessions, disable newly created Staging Auth users, append AUTH-01/Role/M019 revoke decisions, and append inactive/retired Core versions only for rows owned by the run. Do not delete or overwrite immutable history.

## During or after UAT

For a compromised, departed, mismatched, or no-longer-approved user:

1. Revoke the opaque BFF session and all Supabase Auth sessions.
2. Disable the Staging Auth user.
3. Append an AUTH-01 binding revoke with the incident/approval reference.
4. Append the HUB Role attestation revoke.
5. Append M019 revoke decisions for every active access key.
6. Re-read the resolver and prove the subject is denied.

Assignment changes do not rewrite past rows. Append a new effective assignment version and corresponding access decision. Expired assignments fail closed even if an old JWT remains valid.

## Verification

The receipt must show: target Staging project, artifact/run hash, affected counts, session invalidation, Auth disabled status, active binding zero, active Role attestation zero, current M019 access zero, browser direct grants zero, Business/Canonical Fact writes zero, and Production changes zero. Raw identifiers and PII are prohibited.
