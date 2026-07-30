# Permission Model Human Decisions

These are the only decisions required before implementation planning. A missing
or conflicting response keeps the related capability denied.

| decision_id | accountable owner | decision required | blocking scope |
| --- | --- | --- | --- |
| D01 | Board and Security | Confirm enterprise roles and their allowed data/action boundaries for Representative, Director, and Executive | Enterprise-wide authority |
| D02 | Organization owner | Confirm formal department and FC entity definitions, owners, and effective dates | Organization layer |
| D03 | Store governance owner | Confirm authoritative 20-store roster, direct/FC grouping, corporation links, and effective dates | Store scope layer |
| D04 | Department owners | Approve department-to-store outcomes for Sales, Education, EC, HR, Accounting, and FC | Department scope layer |
| D05 | Finance owner | Classify Sales, Profit, PL, and BS projections plus export and approval restrictions | Financial data/action scope |
| D06 | HR and Legal | Classify HR, Recruiting, Attendance, and Shift projections; approve self, manager, aggregate, and export boundaries | People data/action scope |
| D07 | Operations owner | Define Area Manager, Store Manager, FC Owner, and Employee action transitions and separation-of-duties rules | Operational action scope |
| D08 | Security and Platform | Approve server-side resolver ownership, JWT lifecycle/revocation design, and audit retention | API, JWT, and RLS implementation plan |
| D09 | Core DB owner | Approve the Core Master identity and scope-fact contracts used by the evaluator | Core Master integration |
| D10 | Security, DB, and domain owners | Approve live catalog evidence and test criteria before RLS/API implementation | Implementation gate |

## Non-decisions

This document does not approve a role, a department mapping, a JWT claim, an
RLS policy, an API route, a database table, or a production change. Those are
separate follow-on gates after D01 through D10 are resolved.
