# Snapshot Rollback

## Trigger

Rollback is required for validation failure after transfer, discovered data-contract defect, confirmed wrong approval record, or an approved source correction. It is not a mechanism to bypass expiry or validation.

## Procedure design

1. Disable the candidate version before it becomes active, or remove it from the active pointer.
2. If a prior approved and unexpired version exists, validate its hashes and manifest again, then atomically restore that pointer.
3. If no valid prior version exists, disable Snapshot availability and return `503` / unavailable.
4. Record only version, hashes, timestamp, actor category, result, and rollback reason category.
5. Require a new approval for any corrected candidate.

## Non-actions

Rollback never reads Production, edits Production data, rewrites a Snapshot, changes UUIDs, modifies RLS, or restores data from an unverified backup.

## Success criteria

After rollback, Store Operations either reads the exact prior approved artifact or is fail-closed. It never serves mixed versions, stale expired content, or synthesized values.
