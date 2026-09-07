# Limited Real User Pilot V1

## Boundary

`LIMITED_REAL_USER_PILOT` is a server-only Production rollout state for the Owner and exactly two approved real-user canonical employees. It does not replace AUTH-01, Role, M019, Consumer Access, or the canonical Store projection. The Production resolver remains the only Role and Scope authority. Browser payloads cannot choose a pilot, employee, Role, Scope, Store ID, or Store UUID.

The required configuration is the existing `STORE_OPERATIONS_OWNER_PILOT_EMPLOYEE_ID` plus `STORE_OPERATIONS_REAL_USER_PILOT_EMPLOYEE_ID_1` and `STORE_OPERATIONS_REAL_USER_PILOT_EMPLOYEE_ID_2`. All three values must be valid, pairwise-distinct canonical employee UUIDs. Missing, malformed, duplicate, or Owner-reused configuration fails closed. Non-pilots receive the same generic HTTP 403 as other rollout denials. UAT and technical-assumption markers remain denied. `GENERAL` is not used for Real User UAT.

## Production runtime provenance

The Production display version is `v132 / ACTIVE`, while its entrypoint provenance remains `_130`. The downloaded deployed Function source matches the approved main Store Operations runtime; the only main-only file is an unreferenced candidate artifact that was not bundled. The typed HTTP 403 corrective from PR #195 is present. The result is `APPROVED_SOURCE_MATCH / METADATA_VERSION_DRIFT`; no Production rollback is required.

## Verified Production identity state

The two server-managed internal Supabase Auth anchors are `CREATED_VERIFIED`: 戸田 and 桝本 each have exactly one unique active anchor. These anchors support the Production AUTH-01 contract only and are not user-facing login accounts. Authentication authority remains the existing signed NOV HUB session and canonical employee identity; an anchor email must not be used as proof of identity or authorization authority. The operational contract is to send no email or invitation, configure no user password, and require no Supabase login, Google Workspace license, or user operation. Any Supabase-generated opaque internal credential remains an undisclosed implementation detail and is never a user password or authentication authority.

The six append-only identity metadata grants are `APPLIED_VERIFIED`: two AUTH-01 grants, two M019 grants, and two `store_operations_v1` Consumer Access grants. The total Production identity metadata write count is `EXACTLY_6`. Employee, Role, Store, and business-data writes remain zero.

Server-side resolver read-back is complete:

- Owner: `EXECUTIVE_ALL_20`.
- 戸田: `AREA_MANAGER_ASSIGNED_1`.
- 桝本: `STORE_MANAGER_OWN_上石神井店`.

No UUID, Auth ID, internal email, password, credential, token, or secret is recorded in this document.

## Current rollout and pending activation

The current Production rollout remains `OWNER_PILOT`. Owner Hosted access remains HTTP 200. 戸田 and 桝本 remain HTTP 403 as expected, and `GENERAL` is `NOT_ACTIVE`.

The following actions are not yet activated and each remains separately Owner-gated:

1. Merge this code and deploy only `nov-hub-api` from the approved source.
2. Configure the two distinct server-only real-user pilot employee IDs and read back only their presence and validity.
3. Change the rollout state to `LIMITED_REAL_USER_PILOT`.
4. Run Owner smoke, both real-user UATs, and non-pilot denial, then stop.

This contract does not authorize Production configuration changes, deployment, migration, business writes, `GENERAL`, or a Portfolio phase transition. The completed Auth anchor and identity metadata operations are recorded as verified prior state and are not repeated by this PR.
