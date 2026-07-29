# ADR: KPI Import Profile boundary

Status: accepted for isolated prototype review.

Accounting KPI Engine does not parse Yayoi Excel or own account aliases. It consumes
only the Accounting Core active published projection, with an immutable
`accounting_version_id`, confirmed period, canonical account, single amount basis,
entity/scope and provenance reference.

An Import Profile remains an Accounting Core concern. It may version source sheet,
header, month/closing columns, aliases and entity mappings. KPI definitions refer
only to versioned canonical account groups. A new source format therefore creates a
new or superseding Import Profile and Accounting version, not a KPI adapter fork.

The KPI run key includes Accounting version, definition-set version, entity, scope,
period and amount basis. A profile change that changes canonical facts produces a
new Accounting version and consequently a new KPI run. Old results are retained and
superseded; rollback restore also creates a new run.

Unknown profiles, pending periods, carry-forward rows, mixed amount bases and
leaf/summary mixtures must fail closed before calculation. Profile auto-approval,
source-name-only entity identity and direct KPI access to raw workbooks are rejected.
