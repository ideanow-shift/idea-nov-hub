# Staging Core UAT Authentication Correction Plan

## Current corrective

1. Remove the Store Operations-specific Magic Link callback, browser Supabase session bootstrap, onboarding endpoint, and dependency.
2. Retain fail-closed `requireHubSession` behavior and the existing same-origin NOV HUB launch contract.
3. Keep the sealed Core population and server-side Role/scope evidence; do not treat independent Supabase Auth subjects as the canonical login.
4. Verify unauthenticated denial, browser-private-RPC denial, no raw token URL, and zero write boundaries.
5. Update PR #180 only. Do not merge it in this work unit.

## Blocked implementation unit

Hosted cross-origin launch needs an approved Store Operations application-session handoff. The existing DBF and IDEA LINK handoffs are target-, origin-, audience-, and permission-specific and cannot be reused unchanged. Creating or widening a handoff requires separate Owner approval because it changes the authentication contract and server exchange boundary.

Until then, 脇田 hosted browser UAT is blocked. 戸田 and 桝本 server Role/scope checks remain mandatory, while their real hosted UAT status is `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN`.

No migration, deployment, Auth change, Business write, or Production change is authorized by this plan.
