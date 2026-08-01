# Accounting Core Phase 3 Prototype — Milestone 1

This milestone is an isolated SQLite/Python prototype. It does not connect to
Supabase, production databases, Storage, NOV HUB, or IDEA LINK.

Implemented:

- source-system-neutral domain facts and mapping/validation states;
- minimal 11-table SQLite schema;
- read-only Yayoi Excel adapter with formula/value-state separation;
- raw lineage (sheet, row, column, label, period and occurrence context);
- CSV mapping reader that never auto-approves existing candidates;
- canonical normalization with tax-exclusive amounts as the source of truth;
- B/S, major P/L equation, duplicate-period and mapping validations;
- synthetic workbook tests containing no real accounting data.

Safety:

- Excel, PDF, SQLite, private input and accounting output paths are ignored;
- no amount is logged;
- the adapter records only the supplied file hash outside raw staging;
- absolute source paths are not persisted;
- existing `finance_*` DDL remains Unknown and receives no writes.

Deferred until the next approval:

- version orchestration, approvals, publication, supersede and rollback;
- PostgreSQL/Supabase review DDL and RLS policies;
- actor-scope negative tests and consumer projections;
- PDF reconciliation (source PDFs not provided).

Real workbook evidence (amounts excluded):

- SHA-256 prefix matched the prior audit: `f18c9464`;
- 76 sheets and 38 source entity candidates were detected;
- 111,741 raw values produced 111,741 traceable canonical candidates;
- 0 facts were publishable because mappings and the target period are not approved;
- July remains blocked where the duplicate-period anomaly affects confirmation.
