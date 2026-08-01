# Store Operations V1 Scope Definition

## Formal source scope

Store Operations V1 is a store-operations monthly P/L product. The formal source
scope is limited to these P/L sheets and approved P/L account mappings:

| Source class | V1 scope | Purpose |
| --- | --- | --- |
| Direct stores | 13 store P/L sheets | store monthly P/L metrics |
| FC stores | 7 store P/L sheets | store monthly P/L metrics within the existing FC display restrictions |
| Headquarters | one or more explicitly approved P/L sheets, required accounts only | approved non-store context; never allocated to stores |
| EC business | one or more explicitly approved P/L sheets, required accounts only | EC context; never allocated to stores without a separate approval |

The authoritative Store Master composition remains 20 current stores: Direct 13 and
FC 7. P/L sheet labels are only matching inputs to the fixed mapping; they are not
store IDs or evidence of ownership.

## Explicit exclusions

The following are outside V1 intake, mapping, validation, and projection:

- all B/S sheets;
- half-year, cumulative, closing-adjustment, and closing-balance columns;
- comparison and reference material;
- unapproved aggregate, common, historical, or inactive sheets; and
- any data derived by summing excluded sheets.

An excluded sheet does not need a Store Operations mapping row and cannot block a
selected P/L sheet merely by existing in the workbook. A selected sheet that is
missing, duplicate, ineffective, or unmapped blocks publication.

## Existing constraints retained

The physical input remains one immutable Yayoi annual-trial-balance workbook. It
produces only approved monthly P/L metrics. Current V1 consumer rules remain in
force: unconfirmed profit is `null`, no unavailable value becomes zero, headquarters
allocation is excluded, and FC operating-profit display remains `unavailable` until
a separately approved change revises that rule.

No database, migration, deployment, UI, Production connection, or import is
authorized by this scope definition.
