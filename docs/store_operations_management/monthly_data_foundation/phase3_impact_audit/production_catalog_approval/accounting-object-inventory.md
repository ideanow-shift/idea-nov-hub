# Accounting Object Inventory

## Current Attestation State

No target database catalog request was approved or executed. Therefore every object below is **unverified**; it is not missing and it is not reusable yet.

| Logical object | Target existence | Required catalog facts | Reuse decision |
| --- | --- | --- | --- |
| import batch | unverified | schema, columns, keys, indexes, RLS, grants, triggers | pending |
| import file | unverified | schema, columns, keys, indexes, RLS, grants, triggers | pending |
| version | unverified | `version_number`, uniqueness, publication relationship | pending |
| facts | unverified | grain, keys, publication filter, immutability controls | pending |
| validation result | unverified | safe quarantine linkage and retention boundary | pending |
| approval | unverified | separate rollback approval support and append-only behavior | pending |
| publication | unverified | published/superseded/rollback state model | pending |
| audit | unverified | append-only control, structured transition fields, reader access | pending |
| import history | unverified | batch/file/version/audit relationship | pending |
| quarantine | unverified | raw Workbook/sheet/row boundary and safe metadata | pending |
| monthly projection | unverified | published-only access path and security owner | pending |

## Required Catalog Output

The later sanitized attestation may report object presence, metadata shape, key and policy counts, and boolean capability results only. It must not emit accounting rows, raw amounts, file contents, arbitrary SQL output, credentials, or production identifiers.

## Gap Result

There are no confirmed missing tables or columns. Migration count cannot be finalized until the attestation returns a compatible or incompatible result for each logical object.
