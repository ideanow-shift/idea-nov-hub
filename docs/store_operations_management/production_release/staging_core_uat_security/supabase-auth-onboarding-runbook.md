# Supabase Auth Onboarding Runbook

This is a future Staging execution runbook; running it requires a separately approved implementation PR and one-time Owner execution authorization.

1. Confirm project identity is exactly `idea-nov-staging` / `zgkoofphhivesclehrom`; abort on any mismatch.
2. Verify the sealed population artifact, manifest, approval, expiry, checksums, exact counts 6/20/3, HQ exclusion, and zero unexpected target rows.
3. Run population dry-run and archive only the sanitized receipt.
4. Apply the population artifact in one transaction; verify six corporations, 20 official stores, three employees, active identities, Role attestations, effective assignments, and duplicate zero.
5. From the encrypted execution envelope, call Supabase Admin `createUser` server-side for each of the three Staging-only delivery addresses. Set no password and no authorization data in `user_metadata`.
6. Capture each returned Staging Auth subject and atomically create the exact one-to-one AUTH-01 binding to the already resolved canonical Employee. Never bind by email lookup.
7. Append the approved HUB Role attestation and M019 actual/budget grants. Forecast remains absent. Verify the assignment and scope before every grant.
8. Each UAT user requests Email OTP/Magic Link through the Staging entry. Use `shouldCreateUser: false`; unknown email must not create a user.
9. Verify the native callback server-side, store the session server-side, issue only the opaque cookie, and clear callback material.
10. Run negative security tests before positive Role smoke. Then verify Executive 20, Area Manager assigned-only, and Store Manager 上石神井店-only.
11. Produce a sanitized completion receipt containing counts, hashes, revision IDs, test results, and zero-write attestations—never email, token, raw UUID, or service credentials.

Any partial result, identity ambiguity, delivery failure, duplicate, digest mismatch, unexpected existing Auth user, or scope mismatch stops the run and invokes the rollback/revoke runbook.
