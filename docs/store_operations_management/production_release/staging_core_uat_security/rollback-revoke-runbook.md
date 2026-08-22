# Authentication Correction Rollback and Revoke Runbook

## Current state

Store Operations-specific Magic Link onboarding and browser session bootstrap are retired. This corrective performs no database, Auth, or Business Data write.

If a previously issued Store Operations Magic Link arrives, do not use it. It is not a valid NOV HUB launch path and cannot establish Store Operations authorization.

## Future approved HUB handoff

A future Store Operations handoff must provide server-side revocation by source HUB session, target audience, one-time code, and issued application session. Revocation must fail closed immediately and preserve an audit record without exposing token, email, employee ID, or raw Store UUID.

## Verification

Verify independent login route zero, Auth onboarding action zero, browser service-role zero, private RPC execution denied, Store Operations Business write zero, DBF Canonical write zero, and Production change zero. Database/Auth cleanup of previously created Staging UAT records requires a separate Owner-approved action.
