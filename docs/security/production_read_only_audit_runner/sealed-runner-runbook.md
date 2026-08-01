# Sealed Runner Runbook

1. Obtain all human approvals listed in `human-approval-items.md`.
2. Verify runner, manifest, query catalog, and sanitizer hashes in the approved package.
3. Have the Platform owner perform the private profile check and make the audit credential available to the broker only.
4. Launch one audit pack with no more than twelve approved IDs and a sixty-second wall-clock limit.
5. Confirm the sanitized receipt records identity pass, read-only pass, rollback, close, query count, and zero mutations.
6. Revoke or expire the audit credential according to the approved window, then preserve only the sanitized evidence receipt.

Any mismatch, timeout, query policy failure, or missing approval is a safe stop. Do not substitute a console, a service role, a stronger role, or a second attempt.
