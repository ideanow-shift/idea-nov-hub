# Role and Scope Approval

## Purpose

NOV HUB表示とStore Sales server-side認可を分離し、正式role/scope候補を承認する。

## Current State

prototypeはtrusted actor scopeを検証済みだが、正式role、利益閲覧範囲、承認責任者は未確定。

## Target State

`V`=proposed view、`N`=proposed deny、`S`=scope内のみ。すべて正式承認前。

| role | scope | HUB card | List | Detail | 売上 | 利益/率 | confirmed period | Actions/Drivers | direct URL | export | mobile |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| representative_director | all_group | V | V | V | V | V | V | V | V | TBD | V |
| director | all_group候補 | V | V | V | V | V | V | V | V | TBD | V |
| executive_officer | all_group/assigned_departments | V | S | S | S | S | S | S | S | TBD | V |
| department_manager | assigned_departments | V | S | S | S | S | S | S | S | TBD | V |
| store_manager | own_store | V | N | S | S | S（3指標候補） | S | S | S | N | V |
| franchise_owner | own_fc_legal_entity | V | S | S | S | S | S | S | S | TBD | V |
| employee | none | N | N | N | N | N | N | N | N | N | N |

scope registry候補: `all_group`、`assigned_departments`、`assigned_stores`、`own_store`、`own_fc_legal_entity`、`none`。

## Confirmed Decisions

- UI非表示は認可ではない。
- request body/queryのrole/scope自己申告を使わない。
- NOV HUBカードと直接URLは同じserver-side policyに従う。

## Proposed Decisions

employee非公開。store managerは自店舗のみ。FC ownerは自FC法人のみ。exportは別decisionとする。

## Unknowns

director/executiveの範囲、利益閲覧、兼務、代理、inactive employee、export。

## Blocking Items

DEC-ROLE-001、DEC-PROFIT-001、Directory assignment品質、FC legal entity mapping。

## Required Approvers

Management Approver、Sales Owner、Security Owner、Core Master Owner、FC Representative。

## Evidence／Source

- [Phase 5-2 Security](../phase5/phase5-2-security.md)
- [Accounting KPI Phase 4](../../accounting/accounting-kpi-phase4-final-report.md)

## Exit Criteria

全role/scopeがapprovedとなり、カード・直接URL・store/FC/department越境negative testとUATが一致する。
