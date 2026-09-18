# 12. Rollout Plan

| Phase | 対象・変更 | 影響 | Exit criteria | Rollback | Owner |
|---|---|---|---|---|---|
| A Inventory lock | 全アプリの入口、token、secret、actor、scopeを証跡付き確定 | 読取のみ | Unknownのowner・期限設定、P0経路100%把握 | 不要 | CTO / Security |
| B Contract sandbox | handoff、identity、authorization、auditの参照実装をsandbox検証 | 本番影響なし | NT-01〜24合格、秘密混入0 | sandbox破棄 | Platform |
| C HUB issuer pilot | HUBで一回限りhandoffをpilot発行 | pilot利用者のみ | 発行/交換/失効監査、replay 0、SLO達成 | flagで旧入口へ期限付き復帰 | HUB owner |
| D App migration | Shiftを基準にIDEA LINK、Expense、Managementを順次統合 | 対象アプリ単位 | app conformance `C`、support手順、owner承認 | app単位flag/session失効 | App owner |
| E Legacy containment | PIN、共有token、static contextを縮退 | 現場端末・旧利用者 | 代替導線採用率、例外0、廃止承認 | 期限付き旧経路復帰 | Business + App |
| F Enforcement | 共通contract未準拠経路の新規利用を停止 | 全体 | 監査・IR訓練・DR完了、Gate Go | 緊急break-glass | CTO / Security |

## 順序

Identity Mappingのactive employee欠損を先に解消しない限り、認証方式を切り替えない。service roleのscope強制と監査を、HUB入口統合より前または同時に実施する。高感度HR・経営アプリは一般アプリの成功後に独立承認する。

## 変更単位

- 1回のrolloutで1アプリまたは1principal typeに限定する。
- canary対象、成功率、401/403率、identity failure、replay、scope denyを観測する。
- 各phaseに実名owner、実施日時、復帰判断者、最大復旧時間を設定する。
- 旧sessionと新sessionを混用せず、切戻し時は対象sessionを失効する。

## 停止条件

越境成功、actor誤帰属、重複identityの誤解決、秘密漏えい、監査欠落、rollback不能のいずれかで即停止。店舗営業管理は共通auth基盤のPhase B合格までは設計・mockに限定し、本番業務実装を開始しない。
