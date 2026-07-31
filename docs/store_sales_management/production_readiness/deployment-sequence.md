# Deployment Sequence

## Purpose

stacked PRとStaging導入の順番、停止点、rebase条件を固定する。

## Current State

| Phase | Branch / PR | Base | Status |
|---|---|---|---|
| 3 | `feat/accounting-core-phase3-prototype` | Unknown（PRなし） | remote branchあり |
| 4 | PR #6 / `feat/accounting-kpi-engine-phase4-prototype` | Phase 3 | draft/open |
| 5 | `feat/store-sales-management-phase5-prototype` | Phase 4候補 | remoteあり、PRなし |
| 5-5A | `chore/store-sales-production-readiness` | Phase 5 commit | local work |

Phase 3 compare URL: `https://github.com/ideanow-shift/idea-nov-hub/compare/main...feat/accounting-core-phase3-prototype?expand=1`

推奨タイトル: `feat: Accounting Core Phase 3 prototype`。推奨base: `main`。本文はimmutable import、validation、二段階approval、published projection、RLS review-only、28/28 tests、本番No-Go、Phase 4依存を明記する。

## Target State

1. Phase 3 Draft PR作成・review・merge
2. Phase 4を更新済みmainへrebaseまたはbase変更しreview・merge
3. Phase 5を更新済みmainへrebaseまたはbase変更しreview・merge
4. 5-5A文書PRをPhase 5へreviewし、依存解決後mainへretarget
5. Staging基盤→Core migration→KPI migration→Projection/session→E2E
6. production approval後のみproduction deploy

## Confirmed Decisions

依存順はPhase 3→4→5→Production Readiness。子branchへ親のmerge commitを重ねて順序を崩さない。

## Proposed Decisions

親PR merge後、子PRのbaseをmainへ変更し、必要なら`--force-with-lease`を使うrebaseはowner承認後のみ行う。

## Unknowns

Phase 3 PRが過去に別head/titleで存在するか、repositoryの正式merge strategy。

## Blocking Items

Phase 3 PR未作成、Phase 5 Draft PR未作成、shared NOV HUB filesの競合。

## Required Approvers

CTO、各phase owner、repository maintainer。

## Evidence／Source

remote refs、PR #6 metadata、local commit graph、[Assessment](production-readiness-assessment.md)。

## Exit Criteria

全PRのbase/head、merge順、review ownerが確定し、Phase 3/4/5が順序どおりmerge可能であること。
