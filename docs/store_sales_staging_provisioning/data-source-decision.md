# Store Sales Staging Data Source Decision

## Decision status

**Human approval required. Recommended option: B, approved sanitized Staging snapshot.**

No source was selected or connected in this sprint. The recommendation is based on the verified empty Sandbox, the Production-connection prohibition, and the requirement to prevent a request-time Production fallback.

## Options compared

| Dimension | A. Dedicated server-side Production read-only connection | B. Approved, sanitized Staging snapshot |
| --- | --- | --- |
| Request path | every Staging request reaches Production through a special port | Staging reads only its local approved snapshot/projection |
| Safety | high only with a narrowly scoped Production port, but cross-environment runtime dependency remains | higher isolation after snapshot creation; no request-time Production reachability |
| Availability | dependent on Production network, role, and read capacity | dependent on snapshot freshness and Staging availability |
| Operations | role lifetime, network allowlist, request audit, and emergency revocation for every E2E window | scheduled/manual snapshot approval, freshness evidence, and dataset lifecycle |
| Failure behavior | must fail closed if Production cannot be reached | must fail closed as stale/unavailable when snapshot is absent or past approved freshness |
| Data minimization | requires exact production query limits | snapshot can contain only approved Store Master fields and aggregate Accounting fields |
| Compatibility with current prohibitions | not available: it requires a separate Production read-only approval | not available yet: it requires a separate Production export/read approval and Sandbox data provisioning |

## Why B is recommended

Option B keeps Store Operations request handling inside the dedicated Sandbox boundary. It prevents an API configuration mistake from turning a Staging page into a live Production reader, and it makes rollback a disable/revert of the local Snapshot binding rather than a cross-environment access change.

Option B does **not** mean copying arbitrary Production data. The snapshot must be a separately approved, data-minimized artifact containing only the fixed Store Master projection and confirmed, aggregate Accounting projection required by the Store Sales contract. Individual, credential, source-query, and raw accounting-detail fields are excluded.

## Required human decision

The representative, Core DB Owner, Accounting Owner, and Security Owner must approve exactly one of the following before runtime work continues:

1. **Approve B:** authorize a one-way, approved Snapshot creation process under a separate Production read-only gate; or
2. **Reject B and approve A:** authorize a dedicated server-side Production read-only Port with a separate Production access approval pack.

Until one option is approved, the Store Sales API has no permitted source and must remain undeployed.

