# HUB Master Data Intake CSV contract v2 candidate 2026-07-18

## Purpose

This candidate closes the three write-contract gaps found before S2b. It is a review artifact only and does not change the current Master Admin UI or CSV templates.

## Candidate decisions

- Corporation creates require `法人コード`.
- Store creates require `店舗No`.
- Employee writes use typed reference columns instead of the combined display field `所属`.
- Natural keys and create identifiers are immutable after creation.
- Blank optional cells mean no change.
- Explicit clearing is not supported in Phase 1.
- Any unknown, missing, inactive, or ambiguous reference fails the complete batch.

## Pending metadata confirmation

The authoritative code columns and uniqueness contracts for departments, positions, and job types must be confirmed before the corresponding employee reference headers can be activated. The candidate deliberately records these as pending rather than inferring a name-based lookup.

## Static verification

```yaml
result: DATA_INTAKE_CONTRACT_V2_CANDIDATE_PASS
check_count: 9
target_count: 3
runtime_change_count: 0
production_access_count: 0
mutation_count: 0
```

## Required approval

Core DB and product ownership must approve or revise this CSV contract before:

- changing templates or frontend validation
- finalizing the S2a validator replacement
- implementing S2b atomic target writes
- enabling save
- importing a production CSV
