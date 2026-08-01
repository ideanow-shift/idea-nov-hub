# Error Policy

## Fail closed

The import is rejected and cannot be published when any required identifier, period,
CSV type, numeric value, required column, canonical match, store-count invariant,
or publication-state rule fails. One malformed row does not become zero, an estimate,
or a partial published projection.

## Operator feedback

Operators receive a bounded error code, CSV type, source row number, and corrective
action. Messages must not disclose data belonging to another store, employee, or
corporation.

## Projection behavior

Published projections expose `null`, `preparing`, or `unavailable` for absent or
unconfirmed data. They never fabricate a sales, profit, customer, price, product,
EC, or AM value.
