# Single-run Execution Runbook

## Named Human Responsibilities

| Responsibility | Required action |
|---|---|
| Owner | Approves one execution window and the exact package hashes. |
| Source Read-only Role Owner | Attests the Source role's least privilege, expiry, revocation path, and one-session limit. |
| Target Read-only Role Owner | Attests the Target role's least privilege, expiry, revocation path, and one-session limit. |
| Private Broker Owner | Attests the broker reference, broker fingerprint, profile preflight, and no-secret output boundary. |
| Private Profile Custodian | Confirms Source/Target identity profile fingerprints, not-before, expiry, PostgreSQL policy, and revocation plan. |
| Operator | Starts one sealed run through the private broker only. |
| Reviewer | Independently checks identity/profile, Pack, Schema Contract, result hashes, and cleanup evidence. |
| Incident owner | Stops access, revokes profiles, preserves safe evidence, and requests a new approval. |

The Operator and Reviewer must be different principals. The Operator cannot
self-attest a Role Owner, Broker Owner, or Profile Custodian responsibility. An
exception requires a separate Owner approval and is outside this v1 Runner.

## Before the Window

1. Confirm the Owner approval references this package version and one window.
2. Confirm the exact `run_id`, package hash, private Query-registry hash,
   Operator, Reviewer, authorization time, and one execution window.
3. Confirm Source is `idea-nov-core`, Target is `idea-nov-staging`, their
   private profile fingerprints are distinct and current, and PostgreSQL major
   version 17 is permitted for both profiles.
4. Confirm both dedicated roles have the Read-only Role Contract and expiry.
5. Confirm exact private Query-registry hash and Schema/Column Contract hash.
6. Confirm sanitizer/masking/mapping policy versions and sealed-artifact
   retention location.
7. Confirm no Source Snapshot, Master Population, Auth onboarding, anchor
   insert, M019-Corrective, binding, or Store Operations connection is included.

## During the Window

The Owner's approved binding is pre-registered in the private execution ledger
before the window. The operator starts one run. The ledger must claim that exact
`run_id` and binding hash before a profile or database connection can be used.
The runner's Stage 0 failure stops before Stage 1. Any other mismatch triggers
rollback, close, prepared-bundle abort or committed-bundle revocation, and
cleanup. There is no manual re-query, alternate SQL, retry, or partial artifact
recovery.

## After the Window

1. Reviewer confirms the claimed `run_id`, fixed Query IDs/versions/hashes,
   PostgreSQL version gate, rollback/close, component cleanup receipt, hash
   results, sanitizer result, and no mutation flag.
2. Source/Target Role Owners and the Profile Custodian revoke both expiring
   credentials; the Broker Owner closes the broker execution context.
3. Retain only approved safe evidence and the committed sealed artifact under
   the stated retention policy. Delete raw results, canonical payloads,
   temporary manifests/evidence/logs, downloads, listeners, child processes,
   and temporary directories immediately.
4. A successful Snapshot creates no further write permission. Population and
   every later write gate require their own Owner approval.

## Stop Conditions

Stop immediately for identity/environment/profile mismatch, writable role,
schema/Pack/hash mismatch, unexpected column, count/relationship failure,
PII/secret detection, stale approval, duplicate/orphan/unresolved official
Store, Target pre-state mismatch, rollback/close failure, cleanup receipt
failure, duplicate `run_id`, or any attempt to invoke an excluded write path.
