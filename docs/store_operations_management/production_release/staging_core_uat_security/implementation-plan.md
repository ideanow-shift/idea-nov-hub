# Staging Core UAT Authentication Correction Plan

## Approved implementation unit

1. Keep the Store Operations-specific Magic Link callback, browser Supabase Auth bootstrap, and onboarding endpoint absent.
2. Start at Cloud Run `/auth/start`, retain signed state and a PKCE verifier in a 120-second Secure HttpOnly cookie, and send only the S256 challenge to NOV HUB.
3. Add a Store Operations-only, 60-second one-time code issued from an active NOV HUB session and return it only to `/auth/callback`.
4. Exchange the code only through the Cloud Run BFF with a metadata-server Google OIDC identity token plus defense-in-depth secret, and store the application session in an HttpOnly cookie.
5. Re-resolve canonical Employee, active Identity, Role attestation, M019 Assignment, and Store Scope at issue and exchange.
6. Proxy only the allowlisted read-only projection action; ignore browser authority fields.
7. Verify OIDC signature/claims/service account, PKCE, replay denial, exact contract/origin/callback/audience binding, no raw token exposure, browser-private-RPC denial, and zero-write boundaries.
8. Update PR #180 only. Do not merge it in this work unit.

## Deployment gate

Apply the private migration to Staging only, bind one shared exchange secret separately to the Staging Edge Function and Cloud Run service, deploy both from the reviewed PR head, and enable the launcher only in the formal Staging HUB configuration. Never place the secret in Git, an image, browser configuration, URL, HTML, or logs.

脇田 hosted browser UAT may be executed only through normal NOV HUB login after these gates pass. 戸田 and 桝本 server Role/scope checks remain mandatory, while their real hosted UAT status is `DEFERRED_UNTIL_NORMAL_NOV_HUB_LOGIN`.

The Owner authorized the Staging-only migration and deployment for this contract. Auth mutation, Business write, DBF Canonical write, Production migration, and Production deployment remain prohibited.
