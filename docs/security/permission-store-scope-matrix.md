# Permission Store Scope Matrix

## Canonical scope classes

| store_scope | description | source-of-truth requirement | default result |
| --- | --- | --- | --- |
| ALL_20_STORES | Approved enterprise-wide 20-store set | Approved store roster and effective period | Deny until approved |
| DIRECT_13_STORES | Approved direct-operation 13-store set | Approved direct/FC classification and effective period | Deny until approved |
| FC_7_STORES | Approved FC 7-store set | Approved FC corporation/store relationship and effective period | Deny until approved |
| ASSIGNED_STORES | Effective-dated individual or approved group assignment | Approved assignment identity, target, and period | Deny when absent or expired |
| NONE | No store-targeted access | Explicit no-store outcome | Deny store data |

## Matching rules

- A request for a store-bound object must match exactly one approved target set
  or a safely intersected set. Ambiguous scope resolution is denied.
- `ALL_20_STORES`, `DIRECT_13_STORES`, and `FC_7_STORES` are business scope
  classes, not literal hard-coded lists in a client or JWT.
- `ASSIGNED_STORES` is not a substitute for a department mapping. Individual
  assignment and department scope remain independently evaluated.
- FC scope includes only the approved FC corporation relationship; it never
  expands to direct stores by name similarity or an implicit parent rule.
- A historical request uses the scope effective at the business-effective date;
  current access never rewrites historical scope.

## Candidate role use

| scope | candidate users | additional required layer |
| --- | --- | --- |
| ALL_20_STORES | Representative, Director, approved Executive, approved Accounting Head, approved Education Head | Organization mandate and data/action approval |
| DIRECT_13_STORES | Approved Sales Head | Department mapping approval |
| FC_7_STORES | Approved FC Owner or approved FC Business function | FC entity, corporation, and contract approval |
| ASSIGNED_STORES | Area Manager, Store Manager, Employee where needed | Individual assignment and operational policy |
| NONE | EC Head, HR Head where their approved data is entity or employee scoped | Separate non-store target model |

The provided 13-direct and 7-FC grouping is an approval input, not a verified
runtime roster. No implementation may materialize the classes before the owner
confirms their source, membership, and effective dates.
