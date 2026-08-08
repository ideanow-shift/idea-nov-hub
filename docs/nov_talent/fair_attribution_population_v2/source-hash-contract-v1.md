# Fair Attribution Source Hash Contract v1

## Purpose

This contract fixes the reproducible identity of the authorised source range before a Fair Attribution population dry-run. It replaces no business value and performs no semantic normalisation.

## Source

| Field | Fixed value |
| --- | --- |
| Contract version | `fair-attribution-source-hash-contract-v1` |
| Spreadsheet ID | `1nwlOIdQMmPq4ogXOTf-oinAQKnwSTlb3X7Dw8kWowCM` |
| Sheet ID | `1142586954` |
| Range | `G3:G530` |
| Google Sheets value mode | `UNFORMATTED_VALUE` |
| Retrieval mode | read-only |

## Canonicalisation

The runner receives the bounded range as 528 ordered cells. It creates exactly one object:

```json
{"contract_version":"fair-attribution-source-hash-contract-v1","spreadsheet_values":[{"row":3,"value":"..."}]}
```

Object keys are recursively sorted in Unicode code-point order and arrays retain their supplied order. The result is compact `JSON.stringify` JSON, encoded as UTF-8 without a BOM, and hashed with SHA-256 in lowercase hexadecimal.

- Rows are always ascending `3` through `530`; no rows are removed or reordered.
- An omitted API cell is represented as JSON `null`; an API `null` remains `null`.
- Strings are preserved exactly. There is no trim, case fold, whitespace collapse, full-width/half-width conversion, Unicode normalisation, Fair-name rewrite, or quote/escape rewrite.
- A cell-internal newline remains part of the JSON string as emitted by `JSON.stringify`.
- The canonical byte stream has no row delimiter and no final newline beyond JSON syntax.
- JSON quoting and escaping are exclusively those of the Node.js `JSON.stringify` implementation.

Any wrong range cardinality stops the runner. The contract hashes source identity only; it does not decide whether a value represents a Fair.

## Legacy boundary

The 2026-08-08 v1 Manifest and its former range hash remain historical evidence with status `LEGACY / HASH CONTRACT UNRECOVERABLE`. They are not a v2 release gate and are never overwritten.
