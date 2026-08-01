# Sheet Selection Policy

## Selection order

1. Verify the workbook report identity, stated fiscal period, and tax-excluded
   basis without producing financial facts.
2. Load only the fixed, effective Sheet Mapping Contract for the target period.
3. Select mapped P/L rows for Direct 13 and FC 7; select headquarters and EC P/L
   rows only when their `import_enabled` purpose is explicitly approved.
4. Validate the selected rows' P/L anchors, permitted account contexts, and monthly
   columns.
5. Validate exactly 20 distinct canonical store IDs with a Direct 13 / FC 7 split.
6. Reject the workbook if any selected store P/L row is missing, duplicated,
   ineffective, ambiguous, or unmapped. Publish nothing on failure.

## Mapping quantities

The minimum enabled store mapping set is exactly 20 rows. Headquarters and EC have
zero or more approved non-store rows; each must identify an allowed purpose and
must not create a store projection by itself. Excluded workbook sheets have no V1
mapping obligation.

## Account and projection limits

Selected store P/L sheets may yield only the approved monthly sales, operating
profit, product sales, EC sales, and supporting validation metrics. Headquarters
and EC P/L rows may supply only their explicitly approved contextual metrics. Their
values cannot be summed into a store or used for allocation. The projection remains
server-produced and Store Scope-filtered.

## Effective-dated controls

`yayoi_sheet_name`, `store_id`, `corporation_id`, ownership, and `import_enabled`
must be effective for the target period. Sheet labels remain source labels, never
canonical identifiers. The Tokorozawa legacy UUID crosswalk is resolved only by the
Master boundary and is not present in workbook mappings.
