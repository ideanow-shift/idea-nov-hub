# Production Extraction Runbook

## Precondition

An approved manifest identity, all A01-A10 approvals, an approved runner source identity, and a credential valid only for the bounded read-only window are required. Without every precondition, do not start a session.

## One execution

1. Human operator verifies the private Production identity profile and the runner manifest identity.
2. Launch the sealed runner once with the approved read-only session adapter.
3. The adapter begins read-only, sets timeouts, executes only approved fixed query IDs, and returns aggregate rows.
4. The runner sanitizes, validates, hashes, creates the immutable candidate artifact and manifest, then rolls back and closes the session.
5. A human reviews only sanitized evidence and approves or rejects Sandbox transfer in a separate gate.

## Stop conditions

Identity mismatch, timeout, lock issue, unexpected query ID, query error, prohibited field, 20/13/7 mismatch, invalid crosswalk, confirmation failure, hash mismatch, or cleanup failure stops the process. Do not retry. Reapproval is required for any later execution.
