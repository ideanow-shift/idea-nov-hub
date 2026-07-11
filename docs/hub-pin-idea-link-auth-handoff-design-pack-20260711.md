# HUB PIN -> IDEA LINK auth handoff design pack

## Purpose

Allow an employee who signed in to NOV HUB with email and PIN to open the IDEA LINK web app without entering the PIN again. The PIN is never transferred to IDEA LINK or stored in browser storage.

## Scope

- Source application: NOV HUB
- Target application: IDEA LINK / Thanks Coin
- Backend: `nov-hub-api`
- Audience: `idea_link`
- Valid roles: `idea_link.staff`, `idea_link.manager`, `idea_link.admin`

This pack is design-only. It does not authorize DDL, Secret changes, Edge deployment, or production authentication changes.

## Proposed flow

1. The employee signs in to NOV HUB using email and PIN.
2. When the employee opens IDEA LINK, HUB calls `nov-hub-api` using the existing authenticated PIN request.
3. `nov-hub-api` revalidates the employee, login status, and IDEA LINK role.
4. The backend creates a random one-time handoff code and stores only its hash.
5. HUB opens `idea-link-app/` with the one-time code in the URL fragment.
6. IDEA LINK immediately exchanges the code with `nov-hub-api`.
7. The backend atomically marks the code as consumed and issues a short-lived IDEA LINK app session.
8. IDEA LINK removes the URL fragment and keeps the app session in `sessionStorage` only.
9. Every protected IDEA LINK API validates the app session signature, audience, expiry, employee state, and current IDEA LINK role.
10. Expiry, logout, employee disablement, or role removal returns the employee to NOV HUB.

## One-time handoff code

```yaml
format: 256-bit cryptographically random opaque value
browser_location: URL fragment only
database_value: SHA-256 hash only
ttl: 60 seconds
single_use: true
audience: idea_link
consume_operation: atomic
replay_result: rejected
```

The raw code must not be written to logs, audit detail, database rows, analytics, or error messages.

## App session

Signed session payload candidate:

```yaml
version: 1
session_id: random UUID
employee_id: public.employees.id
audience: idea_link
auth_source: hub_pin
issued_at: unix timestamp
expires_at: unix timestamp
role_version_checked_at: unix timestamp
```

The payload must not contain email, PIN, PIN hash, employee name, LINE WORKS ID, Firebase token, service role key, or other secrets.

```yaml
session_ttl: 15 minutes
browser_storage: sessionStorage
localStorage: prohibited
url_query_storage: prohibited
refresh: return to HUB and issue a new handoff
```

## Backend verification

At code issue and exchange:

- employee exists and is active
- login is enabled and not locked
- employment status permits access
- the employee has one of the IDEA LINK roles
- requested audience is exactly `idea_link`

At every protected IDEA LINK API action:

- verify signature and expiry
- verify audience is `idea_link`
- load the employee by stable `public.employees.id`
- verify active/login state
- re-read `roles / employee_roles`
- apply manager/admin checks for privileged actions

The app session must not be accepted by other NOV applications.

## Proposed API actions

```text
createIdeaLinkHandoff
  auth: existing HUB PIN or Firebase authentication
  mutation: insert one hashed handoff record
  response: raw one-time code, expiresAt, targetPath

exchangeIdeaLinkHandoff
  auth: one-time handoff code
  mutation: atomically consume one handoff record and create/revoke session state as approved
  response: signed IDEA LINK session, expiresAt

revokeIdeaLinkSession
  auth: IDEA LINK app session
  mutation: revoke session when server-side revocation is enabled
```

## Secret candidate

```text
HUB_APP_SESSION_SIGNING_SECRET
```

- Supabase Edge Secrets only
- never stored in GAS, GitHub Pages, source control, chat, logs, or database rows
- minimum 32 random bytes
- rotation procedure must support an active and previous signing key during a short transition, if required

## Database candidate

Recommended table candidate: `public.hub_app_auth_handoffs`

Minimum fields:

```text
id uuid primary key
code_hash text unique not null
employee_id uuid not null references public.employees(id)
audience text not null
auth_source text not null
expires_at timestamptz not null
consumed_at timestamptz null
created_at timestamptz not null
request_id text null
```

Optional session revocation table candidate: `public.hub_app_sessions`. It is not required for the first short-TTL implementation unless logout/revocation must take effect immediately across tabs or devices.

## RLS and grants candidate

- RLS enabled at table creation
- no direct `anon` or `authenticated` table privileges
- no browser direct table access
- handoff issue/exchange through `nov-hub-api` service role only
- no browser direct RPC execute

Exact DDL, RLS, grants, and indexes require a separate Core DB review gate.

## Logout and expiry

- IDEA LINK logout removes the session from `sessionStorage` and calls server revocation when enabled.
- HUB logout clears HUB Context and any IDEA LINK session stored on the same origin.
- Expired, invalid, replayed, or revoked sessions show a short message and link back to NOV HUB.
- No silent fallback to legacy GAS or email+PIN inside IDEA LINK.

## Audit boundaries

Allowed audit values:

- action name
- employee ID
- audience
- result category
- request ID
- occurred_at
- handoff/session ID when non-secret

Prohibited audit values:

- raw handoff code or code hash
- signed app session
- PIN or PIN hash
- email
- Firebase token
- service role key
- signing Secret
- request Authorization header

## Stop conditions

Stop immediately if any implementation:

- transfers or stores the PIN outside the existing HUB authentication request
- places a handoff code in query parameters instead of the URL fragment
- accepts a code more than once
- skips current employee/role verification
- accepts the session for an audience other than `idea_link`
- exposes Secret or token values in logs or browser-visible source
- requires GAS Script Properties

## Rollout gates

1. Core DB review of table need, DDL boundary, RLS, grants, and retention.
2. Secret management review and creation approval.
3. Source-only backend implementation and Deno/static checks.
4. Edge deploy limited execution.
5. Non-production issue/exchange smoke with no IDEA LINK mutation.
6. One PIN user controlled production smoke.
7. General employee rollout with monitoring and rollback link to HUB.

## Review questions

1. Approve `public.hub_app_auth_handoffs` as a shared HUB authentication object or choose another schema/table name.
2. Approve 60-second handoff TTL and 15-minute IDEA LINK session TTL.
3. Decide whether initial rollout requires `public.hub_app_sessions` for immediate revocation.
4. Approve `HUB_APP_SESSION_SIGNING_SECRET` as an Edge-only Secret.
5. Confirm whether URL fragment transport is accepted for the one-time code.

## Still stopped

- DDL / RLS / GRANT / RPC execution
- Secret creation or rotation
- Edge code application or deployment
- production PIN handoff
- browser storage of PIN
- legacy GAS fallback
