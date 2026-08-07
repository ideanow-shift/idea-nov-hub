# PR002 / M014 Accounting Version Lifecycle — Release Gate

Authoring passes only when M014 creates exactly `accounting.scenario_contracts`, `accounting.measure_type_contracts`, and `accounting.accounting_versions`; keeps M001-M013/M061/M062 unchanged; and creates no M015+ object.

The Local PostgreSQL 17 gate must prove exact scenario/measure vocabularies, scenario/type matrix, monthly period, sequence and stream uniqueness, Actual source prerequisite, parent/reversal lineage, draft-only INSERT, valid draft-to-validating transition, pre-M016/pre-M017 fail-closed states, immutable content/DELETE, forced RLS, zero Consumer grants, M013/M062 regression, M014-only rollback, full rollback residue zero, reapply, and catalog equality.

Commit/Push/PR require a separate Owner decision after PASS. Staging Apply, data load, M015, Production, Store Operations, Finance and deploy remain prohibited.
