# AUTH-01 Staging Authentication Security Specification

Status: Security Review PASS for implementation. Target: `idea-nov-staging` only. No Auth user is created by this document.

## Adopted Auth method

Use **Admin-created Staging Supabase Auth users followed by user-initiated Email OTP/Magic Link**. Admin creation is server-only and uses the sealed private delivery address; it sets no shared or fixed password. Subsequent sign-in uses `signInWithOtp` with `shouldCreateUser: false`.

The callback uses Supabase's native PKCE/token-hash verification on the server. The server stores the resulting Supabase session in the approved encrypted server session store and gives the browser only an opaque `Secure`, `HttpOnly`, `SameSite=Lax` cookie. The service-role key, OTP token, access token, refresh token, canonical UUIDs, and source identifiers never enter browser application state, URLs after callback cleanup, logs, or responses.

Email is only a delivery attribute. Authorization binding is created during sealed onboarding from the exact approved source record digest, canonical Employee UUID, and newly returned Staging `auth.users.id`. Email equality can never create, repair, or select a binding.

## Server-only chain

```text
native Staging Auth subject
  -> private AUTH-01 one-to-one temporal binding
  -> active canonical Employee identity/version
  -> append-only HUB Role attestation
  -> M019 current effective assignment/access contract
  -> server-resolved Store Scope
  -> storeMonthlyActualProjectionV1
```

The request may contain UI filters, but `employeeId`, Role, scope, `storeId`, and Store UUID are ignored as authority. Role and scope are always recomputed server-side for each request and accounting period.

## Role and scope

- 脇田: attested Executive; corporation scope resolves to exactly the 20 official non-HQ stores.
- 戸田: attested Area Manager; resolves only active, effective M019-backed assigned stores.
- 桝本: attested Store Manager; resolves only the active 上石神井店 assignment.

## Fail-close and revocation

Reject unknown/revoked Auth subject, expired or replayed browser session, project/audience mismatch, inactive binding, inactive identity/employee, inactive or expired assignment, missing/mismatched Role attestation, M019 denial, and source/canonical/Auth subject mismatch. A requested scope wider than the resolved scope returns `SCOPE_DENIED`, never Empty.

Revocation order is: invalidate server session and Supabase Auth sessions, disable the Staging Auth user, append AUTH-01 binding revoke, append Role attestation revoke, append M019 revoke. Sensitive reads recheck the server session identifier and current binding/assignment rather than trusting stale JWT metadata.

## Database/API boundary

AUTH-01 bindings and Role attestations live in a private, non-exposed schema with FORCE RLS and no direct `anon`/`authenticated` grants. The Edge/BFF calls an explicit server-only resolver. No browser direct database execution is permitted. Any narrowly required `SECURITY DEFINER` resolver must be outside `public`, pin `search_path`, validate the caller and Staging project/audience, revoke `PUBLIC`, and grant only the server runtime role.

Store Operations remains read-only. Business Fact, DBF Canonical Fact, Permission Model, and Production are unchanged.
