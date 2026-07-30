# Permission Action Scope Matrix

## Canonical actions

| action_scope | meaning | implied by lower action? | additional control |
| --- | --- | --- | --- |
| NONE | No operation is allowed | Not applicable | Default deny |
| READ | View an approved minimum projection | No | Data and target predicate required |
| CREATE | Create a bounded business object | No | Object ownership and validation required |
| UPDATE | Modify an approved object | No | State transition and concurrency checks required |
| DELETE | Remove or retire an approved object | No | Retention and audit policy required |
| APPROVE | Approve a governed business transition | No | Separation of duties and approval policy required |
| EXPORT | Produce an approved external or local extract | No | Field minimization, purpose, and audit required |
| ADMIN | Manage permission-bearing or system configuration | No | Separate privileged administration and audit required |

## Action evaluation

Actions are not a simple numeric ladder. For example, Read does not imply
Export, Update does not imply Approve, and Admin must not bypass data-scope or
store-scope checks. The future evaluator uses the explicit action requested by
the API contract, the object state, required separation of duties, and the
approved action grant.

Destructive actions are denied by default. Delete and Admin require separately
approved lifecycle, retention, and audit designs; this architecture does not
grant either action to any role.
