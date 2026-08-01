# Yayoi Sheet Mapping Contract

## Purpose

This is the fixed mapping contract between a Yayoi workbook sheet label and
canonical Core Master identifiers. It prevents a sheet label from becoming an
implicit store identity. The table is an approval-controlled configuration design;
it is not a database table or seed.

## Required mapping fields

| Field | Rule |
| --- | --- |
| `yayoi_sheet_name` | exact workbook sheet label; unique within the profile version |
| `entity_type` | `store`, `corporation`, `headquarters`, `common_department`, `ec_department`, `fc_group`, or `excluded` |
| `corporation_id` | canonical Corporation Master identifier when applicable; never inferred from the label |
| `store_id` | canonical `public.stores` identifier for `entity_type=store`; otherwise `null` |
| `direct_or_fc` | `direct`, `fc`, or `not_applicable` |
| `import_enabled` | true only for an approved P/L leaf-store mapping |
| `effective_from` | inclusive mapping start in `YYYY-MM-DD` |
| `effective_to` | approved mapping end or `null`; boundary semantics require Core Master approval before implementation |

Recommended control fields are `statement_type`, `mapping_status`,
`mapping_version`, `approved_by`, `approved_at`, and `reason`. They make excluded
and historical rows auditable without retaining financial values.

## Mapping rules

1. Create one classification row for every observed workbook sheet. The historical
   reference structure requires 76 rows (38 P/L, 38 B/S); the actual incoming
   workbook is re-counted during dry-run and must match its submitted map.
2. Only mapped P/L leaf-store rows with `import_enabled=true` may create a Store
   Operations metric. The target approved composition is 20 enabled stores: Direct
   13 and FC 7.
3. B/S rows, whole-company totals, headquarters, common departments, FC groups,
   EC departments, and historical or inactive sheets remain classified but disabled
   unless another approved contract enables them.
4. The mapping must use the canonical current Store Master `store_id`; it must not
   use a sheet name, a raw UUID, an alias guess, or a historical `core.stores` UUID.
5. Tokorozawa's approved legacy UUID crosswalk is a Master-resolution control only.
   It does not belong in this mapping or expose a UUID to the workbook.
6. Overlapping effective mappings for one enabled sheet and period, an unmapped
   sheet, a mapping outside its effective period, or a non-20/13/7 composition
   blocks publication of the whole workbook.

## Minimum review evidence

The Accounting owner supplies the workbook inventory and confirms accounting-sheet
meaning. The Core Master owner validates `store_id`, `corporation_id`, ownership,
and effective dates. Both must approve the versioned table before a dry-run can
pass. A future import audit records the importer employee number only; it does not
require employee numbers in workbook rows.

## Current status

The historical structure audit identifies 38 P/L sheets but includes whole-company,
headquarters, common, EC, FC-group, and historical/store-candidate labels. It is
therefore insufficient to state how many are current leaf-store P/L sheets. The
current mapping has **zero approved enabled rows** until the actual workbook and
the 20-store master are jointly reconciled.
