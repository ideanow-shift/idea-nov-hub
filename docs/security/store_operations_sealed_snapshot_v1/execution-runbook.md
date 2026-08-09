# Single-run Execution Runbook

## Named Human Responsibilities

| Responsibility | Required action |
|---|---|
| Owner | Approves one execution window and the exact package hashes. |
| Private-profile owner | Confirms Source/Target private identity profiles, role expiry, and revocation plan. |
| Operator | Starts one sealed run through the private broker only. |
| Reviewer | Independently checks identity/profile, Pack, Schema Contract, result hashes, and cleanup evidence. |
| Incident owner | Stops access, revokes profiles, preserves safe evidence, and requests a new approval. |

If a person performs more than one role, the operator action and reviewer
attestation must be recorded separately.

## Before the Window

1. Confirm the Owner approval references this package version and one window.
2. Confirm Source is `idea-nov-core`, Target is `idea-nov-staging`, and their
   private fingerprints are distinct and current.
3. Confirm both dedicated roles have the Read-only Role Contract and expiry.
4. Confirm exact private Pack manifest hash and Schema/Column Contract hash.
5. Confirm sanitizer/masking/mapping policy versions and sealed-artifact
   retention location.
6. Confirm no Source Snapshot, Master Population, Auth onboarding, anchor
   insert, M019-Corrective, binding, or Store Operations connection is included.

## During the Window

The operator starts one run. The runner's Stage 0 failure stops before Stage 1.
Any other mismatch triggers rollback and close. There is no manual re-query,
alternate SQL, retry, or partial artifact recovery.

## After the Window

1. Reviewer confirms query count, fixed IDs, rollback/close, cleanup, hash
   results, sanitizer result, and no mutation flag.
2. Private-profile owner revokes both expiring credentials.
3. Retain only approved safe evidence and the sealed artifact under the stated
   retention policy; remove temporary buffers immediately.
4. A successful Snapshot creates no further write permission. Population and
   every later write gate require their own Owner approval.

## Stop Conditions

Stop immediately for identity/environment/profile mismatch, writable role,
schema/Pack/hash mismatch, unexpected column, count/relationship failure,
PII/secret detection, stale approval, duplicate/orphan/unresolved official
Store, Target pre-state mismatch, rollback/close failure, or any attempt to
invoke an excluded write path.
