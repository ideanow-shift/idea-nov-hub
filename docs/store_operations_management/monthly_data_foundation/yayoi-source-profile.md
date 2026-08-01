# Yayoi Annual Trial Balance Source Profile

## Decision

Store Operations V1 has one physical monthly-accounting input candidate: the Yayoi
Accounting `残高試算表（年間推移）` workbook. It replaces the former four-file
CSV proposal. `monthly_sales`, `monthly_profit`, `monthly_ec_sales`, and
`monthly_product_sales` remain four logical metrics derived from approved P/L
records in one immutable workbook version; they are not four separate uploads.

This profile is a source contract only. It does not authorize a workbook import,
database change, migration, UI change, deployment, or Production access.

## Evidence and scope

The repository structure audit recorded one historical reference workbook with 76
sheets: 38 P/L and 38 B/S. Its P/L sheets used the annual-trial-balance report
anchor, a tax-excluded basis, and monthly columns. The reference audit is evidence
for this profile, not proof of the next received workbook. Every new workbook must
be profiled in dry-run before it is eligible for review.

V1 reads P/L sheets only. B/S, aggregate, headquarters, common-department, and
unmapped sheets are classified then excluded from Store Operations facts unless a
separately approved mapping explicitly permits a non-store aggregate.

## Workbook acceptance profile

| Control | Required result | Failure behavior |
| --- | --- | --- |
| Report identity | approved annual-trial-balance anchor and `勘定科目` header anchor | reject whole workbook |
| Statement type | P/L classifier confirms each enabled sheet; sheet ordinal alone is never evidence | reject enabled sheet and block publication |
| Tax basis | tax-excluded | reject whole workbook |
| Periods | actual month labels map unambiguously to `YYYY-MM` using the stated fiscal period | reject whole workbook |
| Mapping | each observed sheet has one effective mapping or an explicit excluded status | reject whole workbook |
| Store composition | enabled store rows resolve to canonical `store_id` and validate 20 / Direct 13 / FC 7 | reject whole workbook |
| Source integrity | immutable workbook SHA-256, profile version, sheet-map version, and account-map version | reject duplicate or drifted input |

The importer must not use sheet names as `store_id`, infer a corporation from a
name, or turn an unmapped sheet into a store. An input employee number is not part
of a P/L row; only the importing Accounting actor's employee number belongs in the
future audit record.

## Logical metric extraction

| Logical metric | Approved P/L account mapping candidate | Constraint |
| --- | --- | --- |
| `monthly_sales` | `売上高合計` | tax-excluded, period confirmed |
| `monthly_profit` | `営業損益金額` | published/confirmed only; otherwise `null` |
| `monthly_product_sales` | `商品売上高` | tax-excluded, period confirmed |
| `monthly_ec_sales` | `ECサイト商品売上高` | do not allocate an EC-department total to a store without an approved rule |
| supporting validation | `技術売上高`, `売上原価`, `売上総損益金額`, `販売管理費計` | validates P/L arithmetic and account context; not a substitute for a missing metric |

Account labels are resolved by a versioned account mapping with statement and
section context. Duplicate labels, changed labels, or a missing required mapping
are validation failures, never a best-effort match. `operating_margin` is derived
only when confirmed `operating_profit` and `monthly_sales` are both present.

## Period and aggregation rules

- Parse actual monthly headers from the workbook rather than fixed column positions.
- Half-year, cumulative, closing-adjustment, and closing-balance columns are not
  monthly facts.
- A future or unconfirmed period is `preparing` internally and shown as `集計中`;
  it is never published as zero.
- Aggregate, headquarters, common, FC-total, and EC-department sheets must not be
  summed with leaf stores. Their use requires an explicit aggregation contract.
- FC operating profit remains `unavailable` in V1 even if an accounting value is
  present. Headquarters allocation is outside V1.

## Version and publication rule

One workbook becomes one immutable import version. Re-importing the same target
period creates a later version after dry-run; it never overwrites a prior version.
Only the latest compatible, explicitly published workbook version may feed the
monthly projection. Any blocking error quarantines the entire workbook and issues
no projection.

## Open confirmations

1. Re-profile the actual first workbook: report anchors, actual sheet count, P/L
   count, period labels, and tax basis.
2. Obtain Accounting approval for the sheet mapping, account mapping, confirmed
   period, and treatment of EC department values.
3. Reconcile all enabled mappings against the approved current 20-store master;
   reference workbook sheet names contain historical/aggregate candidates and are
   not themselves a current-store proof.
