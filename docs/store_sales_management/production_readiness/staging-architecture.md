# Staging Architecture

## Purpose

Productionへ影響しないStore Sales統合検証環境を定義する。

## Current State

repositoryには単一Supabase `project_id` とmain専用Pages workflowがある。これらをStagingとみなす根拠はなく、Staging URL・project ID・NOV HUB・ownerはUnknown。

## Target State

| Layer | Staging | Production | Isolation requirement |
|---|---|---|---|
| Supabase project/DB | 新規専用project（proposed、ID TBD） | 既存production | project、network、backupを分離 |
| Storage | private staging bucket | private production bucket | cross-project access禁止 |
| Edge Functions | staging deployment | production deployment | URL、secrets、logsを分離 |
| NOV HUB/domain | staging専用（方式TBD） | production | cookie/session audienceとoriginを分離 |
| CI/CD | staging workflow＋approval | production workflow＋final approval | environment protection |
| Audit/monitoring | staging sink | production sink | retention/access group分離 |
| Data | synthetic→masked→limited | approved production | copyは承認・記録・削除可能 |

## Confirmed Decisions

- 現行projectをStagingとして流用しない。
- ProductionとDB、Storage、Functions、secrets、URL、audit、monitoring、access groupを完全分離する。
- production deploy、GitHub Pages deployはPhase 5-5A対象外。

## Proposed Decisions

- Staging NOV HUBは認証を含む専用originとする。
- access groupは最小権限のUAT参加者＋運用者。
- synthetic fixtureはStaging専用artifactとしproduction buildから除外。

## Unknowns

project名、URL、region、予算、retention、masked data方式、identity provider、担当者。

## Blocking Items

DEC-STG-001/002、DEC-DATA-001、Security review、環境別secretsとdeployment approval。

## Required Approvers

CTO、Platform Owner、Security Owner、Accounting Owner（データ）、UAT Owner。

## Evidence／Source

- [CI/CD Quality Gates](ci-cd-quality-gates.md)
- [Security and RLS Review](security-and-rls-review.md)
- `.github/workflows/deploy-pages.yml`（main専用の現状証跡）

## Exit Criteria

環境資産台帳、owner、URL、secrets、access group、監視、削除/rollback手順がapprovedとなり、productionへの到達不能性をnegative testで証明する。
