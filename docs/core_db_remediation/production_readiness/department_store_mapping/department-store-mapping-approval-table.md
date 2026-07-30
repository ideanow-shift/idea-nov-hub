# Department to Store Mapping Approval Table

## Approval boundary

This is a candidate approval table, not an entitlement configuration. Every row
is `PENDING_HUMAN`; no candidate grants data or action access. The owner-provided
store baseline contains 13 direct stores and 7 FC stores. Its roster and
effective date still require owner confirmation. **Default deny** applies until
the accountable owner approves a complete row.

| department_name | department_entity_status | proposed_store_scope | proposed_store_count | direct_store_count | fc_store_count | proposed_data_scope | proposed_action_scope | effective_from | effective_to | confidence | approval_status | blocking_flag | human_question | evidence_source |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Sales / 営業部 | Formal in inspected department design | DIRECT_13_PENDING_FC_DECISION | 13 | 13 | 0 | store_sales_and_operational_kpi_read; finance_profit_denied_pending | read_only_pending | NOT_SET | NOT_SET | Medium | PENDING_HUMAN | true | Q01 | Formal department design; owner baseline; no Runtime department resolver |
| Education / 教育部 | Formal in inspected department design | ALL_20_PENDING_EDUCATION_OWNER | 20 | 13 | 7 | education_kpi_read_only; finance_profit_denied | read_only_pending | NOT_SET | NOT_SET | Medium | PENDING_HUMAN | true | Q03 | Formal department design; owner baseline; no Runtime department resolver |
| EC / EC事業部 | Formal in inspected department design | NO_STORE_SCOPE_PENDING | 0 | 0 | 0 | ec_business_aggregate_read_only; store_sales_not_allocated | read_only_pending | NOT_SET | NOT_SET | Medium | PENDING_HUMAN | true | Q04 | Formal department design; local intake treats EC as non-store; no authorization mapping |
| HR / 総務人事部 | Formal in inspected department design | NO_STORE_SCOPE_PENDING_EMPLOYEE_SCOPE | 0 | 0 | 0 | hr_personnel_aggregate_only; store_sales_and_profit_denied | read_only_pending | NOT_SET | NOT_SET | Medium | PENDING_HUMAN | true | Q05 | Formal department design; no department mapping or HR store scope source found |
| Accounting / 経理部 | Formal in inspected department design | ALL_20_PENDING_ACCOUNTING_OWNER | 20 | 13 | 7 | financial_aggregate_and_store_pl_read_only | read_only_pending | NOT_SET | NOT_SET | Medium | PENDING_HUMAN | true | Q06 | Formal department design; role-key accounting source is not department authorization |
| FC Business / FC事業部 | Not formal in inspected department design | FC_7_PENDING_ENTITY_AND_OWNER | 7 | 0 | 7 | fc_operational_and_contract_data_read_only; direct_finance_denied | read_only_pending | NOT_SET | NOT_SET | Low | PENDING_HUMAN | true | Q02 | Owner baseline only; inspected formal department design has no FC entity |

## Candidate count summary

| Category | Department count |
| --- | ---: |
| Full 20-store candidate | 2 |
| Direct 13-store candidate | 1 |
| FC 7-store candidate | 1 |
| No store scope candidate | 2 |
| Approval-ready mappings | 0 |
| Blocking mappings | 6 |

## Interpretation rules

- A department candidate does not grant a role, position, or individual access.
- `read_only_pending` is not executable access.
- Any missing effective period, owner confirmation, or approved data scope keeps
  the mapping unavailable.
- Direct and FC counts describe the owner-provided baseline only; they are not
  a verified store-master extract.
