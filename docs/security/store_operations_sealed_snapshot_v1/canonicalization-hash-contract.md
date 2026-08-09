# Canonicalization and Hash Contract

`SOCE-CANONICALIZATION-v1` defines the only byte representation used for Pack,
Stage 0, Snapshot, Target pre-state, and Manifest hashes.

| Property | Rule |
|---|---|
| Hash algorithm | SHA-256, lowercase hexadecimal. |
| Encoding | UTF-8. |
| BOM | Forbidden. |
| Unicode | NFC normalization. |
| Newlines | CRLF/CR normalize to LF. |
| Whitespace | Leading and trailing whitespace are preserved, not trimmed. |
| NULL | JSON `null`; missing/undefined is rejected. |
| Object keys | Sorted ascending before serialization. |
| Row order | Sort by declared semantic key, then full canonical record. |
| Dates/timestamps | Private Pack must emit its approved canonical date/timestamp form. |
| Final newline | Exactly one LF is appended before hashing. |

The contract avoids an implicit spreadsheet/database/locale formatter. A text
or date conversion not fixed in the private Schema/Column Contract is a stop
condition. Hashes are compared exactly; a mismatch never creates a substitute
manifest or a partial Snapshot.

`SOCE-MANIFEST-v1` includes the source identity status hash, Stage 0 evidence
hash, sealed Pack manifest hash, source Snapshot hash, Target pre-state hash,
canonical payload hash, and manifest-file hash. Existing artifacts are
immutable; a future corrected run creates a new version after a new approval.

## Fixed SQL Byte Contract

SQL hashing is deliberately separate from JSON canonicalization. Every fixed
artifact under `queries/` is hashed as its literal byte sequence: UTF-8, no
BOM, LF-only line endings, and exactly one final LF. The runner neither NFC
normalizes, trims, rewrites, nor assembles SQL. It reads the bytes at startup
and again immediately before use, passes those verified bytes with the decoded
UTF-8 text to the broker, and the broker rejects any re-encoding mismatch
before execution.

`execution-package-lock-v1.json` hashes the ordered execution artifact list
and derives `packageSha256` from the lock payload with the self hash excluded.
The manifest's canonical payload also binds `cleanupReceiptSha256`, cleanup
status, failed count, and not-created count.
