# Read-only inventory — 2026-09-05

Evidence source: authenticated Supabase catalog/aggregate read-only transactions against Production
`idea-nov-core`, Staging catalog, and main `406e3e97dc6a74d9e32fd88ead0504c86f58a1d0`.
No database mutation, Auth onboarding or deployment was performed. Counts are this audit's snapshot,
not permission to use them without a fresh preflight. Private UUIDs/subjects/credentials are omitted.

Pre-PR refetch found main advanced to `483d6d5fa6a1cbf722c1d66a49788a31ed3db638` through
PRs #188–#190. The 2026-09-05 follow-up incorporated latest main
`95474f11252016d63c77fcd5225cacf10e561e7e` through a normal merge (including PRs #192–#193).
All intervening changes are Master Admin frontend/employee-create contracts only; no overlapping
identity-access SQL/API or Portfolio Lock change was found. This branch retains its approved
`406e3e9` ancestry and now contains the full latest-main history without rebase or force push.

| Contract | main / Staging | Production before this PR | Alignment |
| --- | --- | --- | --- |
| employee authority | BDF core.employee_identities and core.employees, UAT population | public.employees operational source, incompatible legacy core.employees | canonical view over operational source |
| Auth identity | private UAT auth_identity_binding_decisions | existing auth.users, no common Production AUTH01 resolver | private append-only binding anchored to existing Auth and signed HUB subject |
| external identity | UAT external_subject_binding_decisions / enrollment | public employee Firebase UID differs from Auth UUID; legacy core.firebase_uid is Auth UUID | no namespace conflation; no bridge copy |
| Roles | UAT role_attestation_decisions | existing active public.employee_roles / roles | reuse source, no role write |
| M019 | BDF core.employee_store_assignments, accounting consumer contract | public.employee_store_assignments, own store relation | reusable dated scope port over current source |
| consumer access | accounting.consumer_access_contracts | absent | additive private consumer ledger |
| store master | core.store_identities / projection.store_master_v1 | public official20; legacy core store1, different UUID | public identity view + explicit optional alias namespace |
| Store Operations resolver | main production rollout gate + legacy read fallback; Staging private resolver | no Production identity-access RPC | service-only resolver, remove Production fallback |

## Owner candidate resolution

- Operational Owner source employee: exactly **1**, source employee code `1`, active/current/non-legacy.
- Operational Firebase subject: unique on that source row; not copied to the PR.
- Existing Auth candidate: exactly **1** from candidate email lookup, verified, nondeleted, not banned,
  one identity. Email lookup is **candidate discovery only**, never binding authority.
- Legacy Core row linked by exact Auth UUID: exactly **1**, corresponding name; no match between
  operational employee Firebase UID and legacy Core firebase_uid, as they represent different providers.
- Existing HUB login credential: exactly **1**, enabled, unlocked.
- Existing active operational roles include `executive` and `super_admin`, with all/null scope.
  Unrelated roles are ignored for this consumer. No duplicate Executive Role or 20-store grants needed.
- Owner Pilot Employee ID: **RESOLVED**, the existing operational employee UUID, not the Auth UUID
  and not a separately minted core identity. Retrieve it server-side from the approved source evidence.
- Final identity configuration must confirm the source-to-Auth crosswalk via Owner evidence and a
  verified native HUB session; this audit does not claim email alone proves it.

## Store readback

- Official active candidates: **20**, Direct **13**, FC **7**.
- Unique source UUIDs **20**, unique public keys **20**, duplicate grain **0**.
- HQ **1** excluded. Inactive direct source row excluded. Active candidates have active corporations;
  no active candidate closed or future-open by available profile dates.
- Production legacy Core has **1** store; official candidates matching its UUID **0**, exact code
  candidate **1**. This is explicitly **not** an approved alias, and is not auto-bound.
- Production BDF `core.store_identities` / `projection.store_master_v1` absent at readback. The
  existing legacy schema cannot take Staging M019 migrations blindly.

## Existing safety boundary

The prior Production Core containment is a separate completed package; its migration/ACLs are not
edited or reapplied here. No Store Operations mandatory four migrations are applied. All new
schema behavior in this PR is tested only on a disposable PostgreSQL 17 instance.
