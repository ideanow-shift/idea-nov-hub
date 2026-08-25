# Production Rollback Plan

## Triggers

Login failure, repeated 5xx, store-count mismatch, role/scope leakage, unauthorized visibility, AUTH-01 resolution failure, migration inconsistency, Edge health failure, raw token/UUID exposure, synthetic data or any unexpected write.

## Frozen rollback point

- Current API: `nov-hub-api v127` / `3d7f46c34c6a2d11318bed859973127fdb2047f53f7b0f8de37ea3df341ccf69`.
- Capture the active Pages deployment ID and Production catalog immediately before release.

## Order

1. Set the separately approved server rollout gate to `DISABLED` and verify all Store Operations access is denied.
2. Restore the captured frontend artifact.
3. Restore API v127 and verify fail-close.
4. Revoke execute on the three new read RPCs.
5. If separately approved, drop only the exact three RPC signatures.
6. Preserve foundation tables and Canonical Facts; never delete or rewrite business rows.
7. Read back access denial, API version, Pages source, ACLs and zero writes.
8. Preserve incident evidence without secrets, raw tokens or personal data.

Config, Secret, IAM and database changes each require explicit Owner approval. No automatic fail-open rollback is allowed.
