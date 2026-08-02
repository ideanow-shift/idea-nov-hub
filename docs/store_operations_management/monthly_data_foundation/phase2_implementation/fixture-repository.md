# Fixture Repository

The repository keeps versions and audit events only in process memory. It deliberately exposes copies, not mutable internal references. Its counters are fixed at database connections 0, production connections 0, and file writes 0.

It is a lifecycle test double, not a persistence design and not an Accounting Core replacement.
