# 05. Core Master Contract

## Direction

`Store Runtime -> Store API -> Core Master -> Database` is read-first. A
runtime may display a store only after the API has returned a canonical
`store_uuid`; names and CSV labels are never identifiers.

## JSON Schema: canonical store projection

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://idea-nov.example/contracts/core-store-v1.json",
  "type": "object",
  "additionalProperties": false,
  "required": ["store_uuid", "store_no", "store_code", "store_name", "is_active"],
  "properties": {
    "store_uuid": { "type": "string", "format": "uuid" },
    "store_no": { "type": "string", "pattern": "^[0-9]{4}$" },
    "store_code": { "type": "string", "minLength": 1, "maxLength": 80 },
    "store_name": { "type": "string", "minLength": 1, "maxLength": 160 },
    "operating_entity_uuid": { "type": ["string", "null"], "format": "uuid" },
    "business_unit_uuid": { "type": ["string", "null"], "format": "uuid" },
    "area": { "type": ["string", "null"], "maxLength": 80 },
    "store_type": { "type": ["string", "null"], "maxLength": 80 },
    "is_active": { "type": "boolean" }
  }
}
```

## API contract

`GET /core/v1/stores/{store_uuid}` returns the projection above. A request
with an unknown UUID returns a fixed `STORE_NOT_FOUND`; a legacy UUID returns
`STORE_LEGACY_UUID_REQUIRES_CROSSWALK` until the crosswalk is approved. The
API must not infer identity by name. The bootstrap RPC’s existing fields map
as follows: `id -> store_uuid`, `storeNo -> store_no`, `storeCode ->
store_code`, `name -> store_name`.

## Write boundary

Only the Core Master write API may create a history event. Runtime clients do
not write tables directly; they submit a validated command with `store_uuid`,
operation type, date range, entity UUID, and reason. UUID replacement,
crosswalk activation, and store master edits require separate entity-approval
workflows.
