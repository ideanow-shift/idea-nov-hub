# Authentication Correction Rollback and Revoke Runbook

## Current state

Store Operations-specific Magic Link onboarding and browser session bootstrap are retired. This corrective performs no database, Auth, or Business Data write.

If a previously issued Store Operations Magic Link arrives, do not use it. It is not a valid NOV HUB launch path and cannot establish Store Operations authorization.

## Store Operations handoff revoke

1. Disable the Staging HUB feature flag so no new Store Operations codes are issued.
2. Remove or rotate `STORE_OPERATIONS_HANDOFF_EXCHANGE_SECRET` on both the Edge Function and Cloud Run service; a mismatch makes exchange fail closed.
3. Roll Cloud Run and the Staging Edge Function back to the previously read-back revisions.
4. Expire outstanding codes by setting `expires_at` to the current timestamp through a separately reviewed service-role maintenance action, preserving audit rows. Do not delete audit history.
5. Existing application sessions expire within 15 minutes or earlier with their source HUB session. If immediate invalidation is required, rotate the application-session signing secret only under the separate NOV HUB session incident procedure.

The database objects may remain dormant. Dropping the private schema or public RPCs is a Staging migration and requires a separately reviewed rollback migration; never improvise DDL in Production.

## External Firebase subject bridge revoke

1. Disable `novHubStagingAuth01SubjectBridgeV1` and the Launcher enrollment route.
2. Revoke service-role EXECUTE on the three external-subject RPCs if immediate fail-close is required.
3. Add an append-only `revoke` decision for an active external subject binding. Never UPDATE or DELETE its grant/audit history.
4. Rotate `NOV_HUB_STAGING_EXTERNAL_SUBJECT_HMAC_SECRET` only through the Staging secret incident procedure. Rotation invalidates resolution until a separately approved key-version enrollment is completed.
5. Roll the Launcher and Edge Function back to their captured pre-bridge revisions. Existing Staging sessions expire in at most 15 minutes.

The external ledger stores only an HMAC fingerprint and canonical employee relation. Raw Firebase UID, token, email, AUTH-01 subject, Role, Scope and Store ID are never persisted there.

## Verification

Verify independent login route zero, Auth onboarding action zero, browser service-role zero, private RPC execution denied, Store Operations Business write zero, DBF Canonical write zero, and Production change zero. Database/Auth cleanup of previously created Staging UAT records requires a separate Owner-approved action.
