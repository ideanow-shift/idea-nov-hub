# Snapshot Refresh Policy

## Proposed schedule

The initial policy is one scheduled daily candidate at **04:00 Japan Standard Time**, followed by human approval before Sandbox activation. The schedule creates no automatic Production extraction or automatic activation; those require separately approved automation and audit controls.

## Refresh lifecycle

1. A separately authorized Production read-only gate produces a bounded candidate artifact.
2. Sanitization, hash generation, and manifest validation run outside the Store Operations request path.
3. Required owners review the candidate evidence.
4. An approved candidate is transferred to Sandbox and revalidated.
5. The active Snapshot pointer changes atomically to the approved version.

## Freshness

Default expiry is 30 hours after approval, allowing one daily cycle plus controlled recovery. An expired Snapshot is unavailable until a newer approved version exists. Manual emergency refresh is possible only through a new bounded approval window; retries are not implied.

## Period behavior

Monthly financial metrics become available only when their source declares the period published/confirmed. Unconfirmed values remain `null` even when the Snapshot itself is fresh.

