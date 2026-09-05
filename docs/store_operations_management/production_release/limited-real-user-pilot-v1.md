# Limited Real User Pilot V1

## Boundary

`LIMITED_REAL_USER_PILOT` is a server-only Production rollout state for the Owner and exactly two approved real-user canonical employees. It does not replace AUTH-01, Role, M019, Consumer Access, or the canonical Store projection. The Production resolver remains the only Role and Scope authority. Browser payloads cannot choose a pilot, employee, Role, Scope, Store ID, or Store UUID.

The required configuration is the existing `STORE_OPERATIONS_OWNER_PILOT_EMPLOYEE_ID` plus `STORE_OPERATIONS_REAL_USER_PILOT_EMPLOYEE_ID_1` and `STORE_OPERATIONS_REAL_USER_PILOT_EMPLOYEE_ID_2`. All three values must be valid, pairwise-distinct canonical employee UUIDs. Missing, malformed, duplicate, or Owner-reused configuration fails closed. Non-pilots receive the same generic HTTP 403 as other rollout denials. UAT and technical-assumption markers remain denied. `GENERAL` is not used for Real User UAT.

## Production runtime provenance

The Production display version is `v132 / ACTIVE`, while its entrypoint provenance remains `_130`. The downloaded deployed Function source matches the approved main Store Operations runtime; the only main-only file is an unreferenced candidate artifact that was not bundled. The typed HTTP 403 corrective from PR #195 is present. The result is `APPROVED_SOURCE_MATCH / METADATA_VERSION_DRIFT`; no Production rollback is required.

## Auth anchor plan

Production read-only evidence finds one active canonical employee and one enabled, unlocked NOV HUB login credential for each approved real user. Candidate identity values are unique, active `auth.users` candidates are absent, duplicate candidates are zero, and collision with the Owner anchor is zero.

With separate Owner approval, create exactly one internal Supabase Auth anchor for each canonical identity through the server-only Admin API. Use the already verified unique canonical login identity as evidence, set the email confirmed state, create no interactive session, send no invitation, and expose no password, token, email, or UUID in logs or artifacts. The Admin API does not send a confirmation email for `createUser`; this anchor does not replace or modify normal NOV HUB login and requires no Google Workspace license or new user action. Immediately read back exactly one active, nonanonymous, nondeleted, nonbanned anchor for each candidate before any AUTH-01 decision. Any ambiguity, collision, notification, or newly required user authentication step is a stop condition.

## Bounded future writes

The identity-access apply is exactly six append-only metadata grants: one AUTH-01, one M019, and one `store_operations_v1` Consumer Access grant per real user. The Area Manager M019 grant is `assigned` to the single current active `employee_store_assignments` row and must preserve its `source_assignment_id`. The Store Manager M019 grant is `own` and must match the canonical own Store, BASSA上石神井店. Employee, Role, and Store master writes are zero. Auth anchor creates are separately counted as exactly two.

## Approved future execution order

1. Keep rollout at `OWNER_PILOT`.
2. Create and read back exactly two Auth anchors.
3. Apply and read back exactly six identity metadata grants.
4. Resolve the Area Manager as `AREA_MANAGER / ASSIGNED_1` and the Store Manager as `STORE_MANAGER / OWN_上石神井店`.
5. Merge this code under separate approval and deploy only `nov-hub-api` under another approval.
6. Keep rollout at `OWNER_PILOT`; configure the two distinct pilot IDs and read them back without exposing values.
7. Under separate approval, change rollout to `LIMITED_REAL_USER_PILOT`.
8. Run Owner smoke, both real-user UATs, and non-pilot denial, then stop.

This contract does not authorize Production Auth creation, identity metadata writes, configuration changes, deployment, migration, business writes, `GENERAL`, or a Portfolio phase transition.
