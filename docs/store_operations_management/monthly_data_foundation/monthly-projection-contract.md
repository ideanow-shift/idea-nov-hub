# Monthly Projection Contract

## Consumer boundary

Store Operations receives only server-produced, published monthly records. It cannot
query a master table, upload history, or accounting source directly.

## Contract shape

```text
target_period
store_id
corporation_id
store_display_name
ownership_type                 # direct | fc
monthly_sales
operating_profit               # published/confirmed only; otherwise null
operating_margin               # derived only when both approved values exist
monthly_product_sales
monthly_ec_sales
am_scope_status                # assigned | unassigned
publication_status             # published | preparing | unavailable
published_version
published_at
source_file_hash
confirmed_through_period
```

FC profit is `unavailable` in V1. Headquarters allocation, customer counts, and
unit prices are outside V1. Every returned record is filtered by the resolved
server-side role and Store Scope.

## User display mapping

`publication_status` remains an internal contract value. The approved user-facing
labels are:

| Internal status | User display |
| --- | --- |
| `preparing` | 集計中 |
| `unavailable` | 利用不可 |
| `not_published` | 未公開 |
| `validation_failed` | 取込エラー |
