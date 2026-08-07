# PR001-B1 Snapshot Metadata Foundation — Release Gate

## Authored artifacts

- M011 Forward Migration
- M011 exact Rollback SQL
- PR001-B1 catalog/contract Validation SQL
- PR001-B1 Static Contract Test
- Snapshot Metadata Schema Package

## Authoring gate

- [ ] Design review approved
- [ ] M001–M010 changes: 0
- [ ] Static Contract Test: all PASS
- [ ] `git diff --check`: PASS
- [ ] no Production/Staging connection or apply
- [ ] no Snapshot/raw/PII data in repository

## Fresh DB rehearsal gate

Run only after separate approval on a fresh non-Production database with PR001 objects initially zero:

1. Apply M001–M011 in order.
2. Validate all required objects, constraints, RLS/Grant, triggers and functions.
3. Prove duplicate source version, duplicate manifest, unknown Master, negative count and invalid hash rejection.
4. Prove activation rejection for missing manifest, count mismatch, mapping/masking failure, failed validation and incomplete/rejected approvals.
5. Prove successful activation only with five manifests, 25 passed validations, four approvals, and matching total count.
6. Prove header and child UPDATE/DELETE rejection.
7. Run M011 rollback without CASCADE; prove M001–M010 catalog remains unchanged.
8. Reapply M011 and prove catalog/validation result equality.

## Release decision

M011 authoring does not authorize idea-nov-staging apply. Staging remains **BLOCKED** until the Fresh DB rehearsal evidence, security review, rollback evidence, and explicit Owner approval are complete. Snapshot extraction/load and Production connection remain prohibited.
