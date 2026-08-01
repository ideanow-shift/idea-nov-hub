# Rollback Policy

Rollback never edits a published snapshot in place. The future operator selects the
last approved, compatible version for the exact CSV type and period, records a
reason, validates the full store invariants again, and obtains the required approval.

If no compatible prior version exists, the projection becomes `unavailable`; it does
not retain a known-bad value or substitute a synthetic value. Rollback must preserve
the immutable history and file hashes of both the withdrawn and restored versions.
