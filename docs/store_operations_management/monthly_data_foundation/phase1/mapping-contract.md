# Fixture Mapping Contract

Each fixture mapping contains `yayoi_sheet_name`, `entity_type`, `corporation_id`,
`store_id`, `direct_or_fc`, `import_enabled`, `effective_from`, and `effective_to`.
The fixture IDs are non-production test IDs. The runner requires exactly 20 distinct
mapped store IDs: Direct 13 and FC 7. Headquarters and EC mappings have no store ID
and cannot allocate values to stores.
