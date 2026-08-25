# Single Licensed Owner Technical UAT Corrective Proposal

Status: **OWNER APPROVED / IMPLEMENTED IN PR #185 / STAGING ONLY**

- Portfolio Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
- Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Environment: Staging only
- Google identity: `m.wakita@idea-nov.com` only
- Additional Google Workspace licenses: 0
- Production change: 0

## Decision

Use the existing licensed Wakita Google identity for controlled technical UAT. Do not create
`uat-area-manager@idea-nov.com` or `uat-store-manager@idea-nov.com`. Do not bind the Wakita subject to Toda,
Masumoto, or any other real employee.

The existing isolated canonical test principals remain the authorization targets:

| Technical scenario | Canonical test principal | Role | Scope |
|---|---|---|---|
| Area Manager | `uat-area-manager` | `area_manager` | assigned 1 store |
| Store Manager | `uat-store-manager` | `store_manager` | own 1 store |

This is explicit technical role assumption, not a real-user login and not evidence that Toda or Masumoto
performed UAT.

## Server-side contract

Use the Staging-private, append-only assumption decision contract implemented in PR #185. The
contract must satisfy all of the following:

1. The verified Firebase token must belong to the already approved Wakita Google subject.
2. The browser may not submit or select `employeeId`, role, scope, Store ID, Store UUID, or target principal.
3. A server-issued, one-time challenge identifies exactly one fixed target principal. The raw challenge is
   short-lived, stored only as a digest, and consumed atomically.
4. The server resolves the target employee, Role, Assignment, Scope, and Store from the existing canonical
   Staging contracts after challenge consumption.
5. Exactly one technical assumption may be active for the Wakita subject at a time.
6. Each assumption expires in at most 15 minutes and is closed by an append-only revoke decision after smoke.
7. Replay, expired challenge, target mismatch, existing active assumption, inactive canonical identity,
   assignment mismatch, and scope mismatch fail closed.
8. The signed application session records a non-PII audit marker such as
   `uat_actor=owner_controlled_technical_principal`; it must not claim to be Toda or Masumoto.
9. Service-role credentials remain server-only. `anon` and `authenticated` receive no direct RPC execution.
10. Production project refs, endpoints, Auth users, bindings, Roles, Assignments, and Store Operations access
    are excluded by contract and automated tests.

## Required sequence

1. Confirm normal Wakita Executive access still returns 20 official stores.
2. Issue one Area Manager technical assumption challenge.
3. Log in with `m.wakita@idea-nov.com`, complete browser E2E, and verify assigned 1 / out-of-scope 0.
4. Append an Area assumption revoke and confirm subsequent Area access is denied.
5. Issue one Store Manager technical assumption challenge only after step 4 passes.
6. Log in with `m.wakita@idea-nov.com`, complete browser E2E, and verify own 1 / other stores 0.
7. Append a Store assumption revoke and confirm subsequent Store access is denied.
8. Reconfirm normal Wakita Executive access returns 20 official stores.

Area and Store assumptions must never overlap. A failed step stops the sequence.

## Security test gate

- Wakita Firebase subject exact match: PASS required
- `google.com` and verified email: PASS required
- browser Role/Scope/Store self-assertion: rejected
- unknown or different subject: rejected
- target principal supplied by browser: rejected
- one-time challenge replay: rejected
- concurrent assumptions: rejected
- expired assumption: rejected
- revoke read-back: PASS required
- Executive regression before and after assumptions: 20 stores
- Area scope: assigned 1; out-of-scope 0
- Store scope: own 1; other stores 0
- raw Firebase token/subject in URL, HTML, response, or logs: 0
- raw Store UUID in public response: 0
- Store Operations business write: 0
- DBF canonical write: 0
- Core employee write: 0
- Production change: 0

## Explicitly rejected approaches

- Additional paid Google Workspace UAT users
- Email aliases presented as independent Google subjects
- Client-side Role switch or Mock Identity
- Binding the Wakita subject to Toda or Masumoto
- Reusing a real employee's identity, email, Role, or audit trail
- Custom JWT, fake session, impersonation, fixed password, or shared password
- Simultaneous Area and Store assumptions
- Production fallback or Production deployment

## Owner approval

Owner approved this exact contract as `SINGLE_LICENSED_OWNER_TECHNICAL_UAT_V1` on 2026-08-25. The approval confirms:

1. Wakita-controlled technical role assumption is accepted for development completion.
2. It is not real-user UAT and does not replace the deferred Toda/Masumoto acceptance gate.
3. Staging-only append-only assumption/audit storage is allowed.
4. Maximum assumption lifetime is 15 minutes and sequential revoke is mandatory.
5. Production remains fail-closed with zero change.
