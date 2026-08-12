# DBF HUB Session Handoff v1 - source-only design

Status: source-only, not deployed. No remote database, Edge Function, Pages, or
Cloud Run environment was changed.

## Authority boundary

Google Direct IAP protects entry to the hosted Staging origin. It proves only
that the request passed the configured IAP boundary; its email or subject is not
used as DBF business authorization. The existing NOV HUB backend remains the
authority for the current HUB session, Employee state, and
`business_data_admin` capability. Staging Employee/Role/Permission population is
not a prerequisite for this handoff.

## Flow

1. NOV HUB creates a random browser `state` and invokes
   `dbfStagingHandoffIssueV1` with the current HUB session.
2. The backend validates the HUB session and re-evaluates
   `business_data_admin` through its existing authorization path.
3. The backend generates a 256-bit code and persists only SHA-256 hashes, bound
   to Employee, HUB session, exact target/origin/audience, state/nonce, and a
   maximum 60-second lifetime.
4. The launcher opens the exact Cloud Run origin with only `handoff_code` and
   `state` in the URL fragment.
5. The Staging frontend removes the fragment from browser history before calling
   `POST /session/handoff/exchange`.
6. The Cloud Run BFF verifies the IAP JWT signature, issuer, audience, and
   lifetime. It forwards the assertion only over the server-to-server exchange
   hop; it never accepts an `iapVerified` flag from browser JSON.
7. `dbfStagingHandoffExchangeV1` verifies that BFF request, atomically consumes
   the stored code, verifies HUB session continuity, and re-evaluates
   `business_data_admin`.
8. Success returns a Cloud Run-origin `dbf_staging_session_v1` session whose
   lifetime is at most 15 minutes and never exceeds the source HUB session.

## Durable store

The formal migration creates private `dbf_handoff` tables for hash-only codes
and append-only audit events. Browser roles have no schema/table/RPC access.
Security-invoker RPCs issue, atomically consume, and clean up expired records;
only `service_role` has the required private-schema grants. RLS and forced RLS
are enabled as defense in depth. The migration is additive, wrapped in
`BEGIN`/`COMMIT`, forward-only, and is not applied.

## Browser and session rules

- The URL fragment contains only `handoff_code` and `state`; no HUB/Firebase
  token, email, Employee data, role, permission, or credential is transported.
- The fragment is cleared before exchange.
- The Staging session uses only Cloud Run-origin `sessionStorage` and is cleared
  on logout or invalid expiry.
- Direct Cloud Run access with IAP but without a handoff/session displays
  `HUBログインが必要です。`
- `runtimeImport=DISABLED` and `productionWrite=DISABLED` are mandatory response
  and build invariants.

## Production and Staging boundary

The browser target and business-data source remain DBF Staging
(`zgkoofphhivesclehrom`). The durable handoff store and issue/exchange action
belong to the Production NOV HUB session authority (`nkmxevmioczcmnldreyo`).
That Production ref is never emitted into the browser build. Cloud Run receives
only a credential-free, server-only `NOV_HUB_HANDOFF_EXCHANGE_URL` environment
variable for the Production NOV HUB Edge endpoint. No Production business-data
write path or credential is added.

## Deployment boundary

Before a separately approved deploy, the route wrapper must be registered in
the Production NOV HUB Edge router with the existing HUB-session and canonical
authorization resolvers. The formal migration, Edge route, Pages launcher, BFF
image, and Cloud Run revision are reviewed and deployed as explicit, separately
gated operations. The full order and rollback boundaries are defined in the
deployment-package document.
