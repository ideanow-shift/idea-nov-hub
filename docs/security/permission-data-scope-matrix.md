# Permission Data Scope Matrix

## Canonical data domains

| data_scope | classification direction | candidate owning organization | minimum policy note |
| --- | --- | --- | --- |
| SALES | Commercial operational data | Sales or Accounting | Store scope required for store-level data |
| PROFIT | Sensitive financial data | Accounting | Separate from Sales; aggregation level must be approved |
| PL | Sensitive financial statement data | Accounting | Store or enterprise target required |
| BS | Highly sensitive financial statement data | Accounting | Enterprise governance decision required |
| KPI | Operational aggregate data | Sales, Education, EC, or Accounting | Metric definition and target scope required |
| EDUCATION | Learning and capability data | Education | Individual learner data needs additional privacy rule |
| HR | Sensitive personnel data | HR | Never granted merely by same corporation or store |
| RECRUITING | Sensitive candidate and recruitment data | HR | Individual candidate data needs explicit purpose rule |
| EC | EC business data | EC | Store scope may be NONE when target is the EC entity |
| ATTENDANCE | Sensitive employment and attendance data | HR or operational owner | Self, manager, and aggregate rules are distinct |
| SHIFT | Operational scheduling data | Operational owner | Self, assigned store, and approval rules are distinct |
| TASKS | Work coordination data | Applicable organization | Object ownership and store target required |
| THANKS | Recognition data | Applicable organization | Visibility, export, and moderation rules are separate |

## Domain rules

- A data scope is a named, versioned classification; it is not an application
  name, database table name, or a generic `all_data` escape hatch.
- A subject can receive only the minimum projection necessary for the approved
  purpose. Aggregate and individual projections are separate contracts.
- Data domain ownership defines the accountable policy owner, but does not
  automatically decide store or action scope.
- Finance and people domains require explicit approval before cross-department
  or cross-store access. UI visibility is not evidence of authorization.
