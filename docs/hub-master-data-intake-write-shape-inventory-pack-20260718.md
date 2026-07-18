# HUB Master Data Intake write-shape inventory pack 2026-07-18

## Purpose

Obtain the exact catalog shape required to design an atomic CSV import RPC without reading business rows or guessing writable columns.

## Query boundary

The candidate reads only PostgreSQL catalog and information-schema metadata for:

- employees
- stores
- corporations
- store and corporation business profiles
- master change logs

It returns column names/types/nullability/default-presence, constraints, indexes, relevant grants, and RLS booleans. Default expressions are deliberately reduced to a boolean and function bodies, policy expressions, table rows, identifiers, and personal values are not read.

## Candidate

- SQL: `supabase/master-data-intake-write-shape-select-only-inventory-20260718.sql`
- Validator: `tools/validate_master_data_intake_write_shape_inventory_20260718.mjs`

## Execution gate

The query is source-only and has not been executed against production. A future one-shot execution must:

1. use the already linked production project without relinking or changing credentials;
2. verify the reviewed SQL SHA before execution;
3. print no project identity, Secret, or raw business row;
4. execute exactly one SELECT/CTE statement;
5. stop after sanitized metadata capture.

## Next design step

After exact metadata is reviewed, create separate source-only packs for:

1. idempotency receipt table;
2. transactional commit RPC per target;
3. service-role-only execution and browser deny boundary;
4. rollback and aggregate post-check;
5. frontend save enablement.

No production SELECT, DDL, RPC, DML, Edge deploy, Pages publish, or CSV import is executed in this pack.
