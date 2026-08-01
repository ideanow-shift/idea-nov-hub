# CI/CD Quality Gates

## Purpose

workflow実装前に、Staging/Productionへ進む必須gateと証跡を定義する。

## Current State

main pushでportalをPagesへdeployするworkflowのみ。Store Sales専用gate、environment approval、mock除外は未実装。

## Target State

| Gate | Trigger | Required | Approver | Failure behavior | Evidence retention |
|---|---|---:|---|---|---|
| unit/regression | PR/push | Yes | code owner | merge block | test report 90日候補 |
| contract test | PR | Yes | API owner | merge block | report＋contract artifact |
| DDL lint/migration review | migration change | Yes | DB/Security | deploy block | reviewed SQL＋hash |
| RLS negative/security | PR/staging | Yes | Security Owner | deploy block | results 1年候補 |
| mock fixture exclusion | production build | Yes | Platform Owner | artifact reject | manifest＋scan |
| production mode block | every non-approved build | Yes | CTO | build reject | config scan |
| secret/dependency scan | PR/scheduled | Yes | Security Owner | merge/deploy block | findings metadata |
| build | PR/tag | Yes | Platform Owner | deploy block | immutable artifact/SBOM |
| staging deploy approval | approved artifact | Yes | Platform+Security | no deploy | approval log |
| E2E/performance/rollback | staging release | Yes | UAT/Platform | promotion block | reports |
| production approval/deploy | release candidate | Yes | DEC-GO-001 approvers | no deploy | signed approval＋SHA |
| post-deploy smoke | production deploy | Yes | Platform/UAT | rollback evaluation | smoke report |

## Confirmed Decisions

Phase 5-5Aではworkflowを変更しない。production artifactにmock/fixture/preview contextを含めない。

## Proposed Decisions

artifactを一度buildしStagingからProductionへpromotionする。branchからproduction再buildしない。

## Unknowns

CI provider constraints、retention、SBOM/dependency tool、environment approver、artifact registry。

## Blocking Items

owner決定、environment分離、workflow review、secret scanning、rollback automation。

## Required Approvers

Platform Owner、Security Owner、UAT Owner、CTO。

## Evidence／Source

- `.github/workflows/deploy-pages.yml`
- [Preview Security](../phase5/phase5-3-nov-hub-preview-security.md)
- [Go-Live Checklist](production-go-live-checklist.md)

## Exit Criteria

全required gateがbranch protection/environment protectionで強制され、失敗時にpromotionできない。
