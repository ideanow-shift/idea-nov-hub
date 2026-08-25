# Controlled UAT Test Principals V1 Release Manifest

Status: **SUPERSEDED BY NO-ADDITIONAL-LICENSE CORRECTIVE / OWNER APPROVAL REQUIRED / NO FURTHER DEPLOY**

- Approval: `approval:OWNER-STORE-OPS-UAT-TEST-PRINCIPALS-2026-08-25-V1`
- Portfolio Lock: `CTO-PORTFOLIO-EXECUTION-ORDER-2026-08-22-V4`
- Phase: `PHASE_3_STORE_OPERATIONS_MANAGEMENT_V1`
- Base main: `4e59d09e568f47a2e65e63c7381b2cef4724a32f`
- Supabase Staging: `zgkoofphhivesclehrom`
- Edge baseline: `nov-hub-api` v15 ACTIVE
- Store Operations Cloud Run baseline: `idea-nov-store-operations-staging-ui-00018-yes`
- NOV HUB launcher baseline: `idea-nov-hub-staging-ui-00006-nx7`
- Production endpoint or project reference: 0

## Fixed principals

| Google account | Identity key | Canonical UAT role | Scope | Stores |
|---|---|---|---|---:|
| `m.wakita@idea-nov.com` | `uat-executive` | `executive` | `all` | 20 |
| `uat-area-manager@idea-nov.com` | `uat-area-manager` | `area_manager` | `assigned` | 1 |
| `uat-store-manager@idea-nov.com` | `uat-store-manager` | `store_manager` | `own` | 1 |

The verified email chooses only the fixed principal/identity key. Canonical Employee, AUTH-01 subject, Role,
Assignment, Scope and Store ID are resolved exclusively by the existing Staging server contracts. Browser claims
cannot expand access. UAT Area and Store identities are isolated canonical test principals and are not the real
employee identities of Toda or Masumoto.

## Database release unit

- Forward migration: `supabase/migrations/20260824232711_store_operations_uat_test_principals_v1.sql`
- Rollback: `supabase/rollback/20260824232711_store_operations_uat_test_principals_v1.rollback.sql`
- Existing migration mutation: 0
- New RPCs: `store_operations_external_enrollment_issue_v2`, `store_operations_external_enrollment_consume_v2`
- Old issue/consume RPC service execution: revoked by the corrective migration
- ACL: v2 RPCs are `service_role` only; `anon` and `authenticated` execute remain denied
- Binding lifetime: at most 14 days
- Binding history: append-only grant/revoke; UPDATE/DELETE prohibited
- Rollback behavior: revoke/drop v2 RPCs and restore v1 service-only execution; expanded CHECK domains remain so
  append-only audit rows are never deleted or rewritten

## Release gates

Migration apply and Edge deployment are prohibited until both UAT Google accounts are proven to exist, use
different Firebase subjects from each other and from the Executive, use `google.com`, and have verified email.
PostgreSQL 17 apply/rollback, CI, and all security tests must pass first. Area enrollment is issued alone and
completed before Store enrollment is issued. Production migration, deployment, secrets, Auth, Pages and writes
remain zero.

## Current hold

The two proposed independent UAT Google Workspace users are not available without additional paid licenses.
Do not create or enroll them. The replacement proposal is
`single-licensed-owner-technical-uat-corrective-proposal.md`, which uses the existing licensed Wakita Google
identity with sequential, explicit, Staging-only technical assumption. No implementation, further Migration,
assumption issuance, external binding, or Hosted UAT may be performed until that replacement contract receives
explicit Owner approval.
