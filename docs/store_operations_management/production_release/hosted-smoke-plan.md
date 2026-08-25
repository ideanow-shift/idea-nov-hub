# Production Hosted Smoke Plan

Execute only after Production release approval.

## Deployment identity

- Migration ledger and four checksums match.
- Edge version/source SHA and Pages source SHA match the approval.
- Runtime project ref is `nkmxevmioczcmnldreyo`; Staging endpoint references are zero.

## Security

- Unauthenticated request is denied.
- Invalid/expired NOV HUB session is denied.
- Browser role, scope, employee and store assertions are non-authoritative.
- Private RPC browser execution is denied.
- UAT/staging session markers and staging-only actions are denied.
- Raw tokens, raw Store UUIDs and secrets are absent from public responses/log evidence.

## Rollout

- Missing, unknown and `DISABLED` rollout states deny.
- `OWNER_PILOT` denies every employee except the one server-configured canonical Owner ID.
- Owner sees exactly 20 official stores and unauthorized stores zero.
- `GENERAL` is not enabled during Owner Pilot.

## Data/UI

- ACTUAL and COMPARISON contracts respond through the formal read path.
- Missing metrics/Budget display `準備中`, never zero or synthetic.
- Dashboard, Store List and Store Detail remain usable with partial data.
- Store Operations business write, DBF write and Production business write remain zero.
