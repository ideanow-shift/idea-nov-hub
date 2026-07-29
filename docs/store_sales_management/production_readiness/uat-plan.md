# Store Sales UAT Plan

## Purpose

actor、状態、導線、responsive、accessibility、障害復旧をStagingで証明する。

## Current State

synthetic PreviewのUI/ARIA/320px/Runtime確認は合格。正式session、実scope、Staging data、rollback後表示は未検証。

## Target State

各caseは`actual/evidence/approver/status`欄を実行時に追加する。

| ID | Actor / Case | Expected result | Evidence |
|---|---|---|---|
| UAT-01 | 代表取締役 login/HUB/直接URL | all_group内dashboard/list/detail表示 | TBD |
| UAT-02 | 執行役員 scope | approved scope以外を拒否 | TBD |
| UAT-03 | 部長 department | 担当部署のみ | TBD |
| UAT-04 | 店舗責任者 | own_store、全社UI/他店なし | TBD |
| UAT-05 | FC owner | own_fc_legal_entity、FC越境拒否 | TBD |
| UAT-06 | 権限なし社員 | カードなし、直接URL403 | TBD |
| UAT-07 | logout/session expired | session clear、401表示、業務画面なし | TBD |
| UAT-08 | 対象月≠会計確定月 | 両方を通常状態として明示 | TBD |
| UAT-09 | 税込売上/利益/利益率 | approved sourceのみ数値・単位表示 | TBD |
| UAT-10 | collecting/preparing/unavailable/validation_error | 異なる文言、数値なし、ARIA一致 | TBD |
| UAT-11 | Actions/Drivers/List/Detail | scope内、状態順、最大3action | TBD |
| UAT-12 | mobile/320px/keyboard/ARIA | 横依存なし、focus可視、label一致 | TBD |
| UAT-13 | timeout/offline/maintenance | Runtime状態、retry、秘密なし | TBD |
| UAT-14 | rollback後 | active restored versionのみ表示 | TBD |
| UAT-15 | Store/FC越境ID差替え | server-side 403、auditあり | TBD |

## Confirmed Decisions

UI表示とserver認可の双方を検証し、カード非表示だけで合格にしない。

## Proposed Decisions

synthetic→masked→limited realの各段階でcritical caseを反復する。

## Unknowns

UAT Owner、参加者、端末、evidence保管、limited real data承認。

## Blocking Items

Staging、正式role/scope、session、mapping/tax、API、monitoring。

## Required Approvers

UAT Owner、Sales Owner、Accounting Approver、Security Owner、FC Representative。

## Evidence／Source

- [UI review](../phase5/ui-review/ui-review-notes.md)
- [Role Scope](role-scope-approval.md)

## Exit Criteria

全必須case合格、blocking defect 0、actor別sign-offとevidence linkが記録される。
