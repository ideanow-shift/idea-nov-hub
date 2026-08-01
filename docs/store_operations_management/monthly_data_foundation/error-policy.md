# Error Policy

## Fail closed

The import is rejected and cannot be published when any required identifier, period,
Workbook Profile, sheet mapping, numeric value, required column, canonical match, store-count invariant,
or publication-state rule fails. One malformed row does not become zero, an estimate,
or a partial published projection.

## Operator feedback

Operators receive a bounded error code, Workbook Profile, source sheet/row reference, and corrective
action. Messages must not disclose data belonging to another store, employee, or
corporation.

## Projection behavior

Published projections expose `null`, `preparing`, or `unavailable` for absent or
unconfirmed data. They never fabricate a sales, profit, customer, price, product,
EC, or AM value.

## Status presentation

Internal statuses are stable contract values. Store Operations must present the
following approved Japanese labels to users; this is a display mapping only and does
not rename an internal status.

| Internal status | User display |
| --- | --- |
| `preparing` | 集計中 |
| `unavailable` | 利用不可 |
| `not_published` | 未公開 |
| `validation_failed` | 取込エラー |
