# 14. Phase 4 Gate

## 総合判定

**Phase 4標準化設計: Conditional Go**

**共通認証の本番rollout: No-Go**

**店舗営業管理MVPの本番業務実装: No-Go**

文書契約を基にsandbox参照実装・検証へ進むことは可能だが、Identity Mapping、service role scope、既存アプリのUnknown、Decision Itemが未解消である。

| Gate | 条件 | 現在 | 判定 |
|---|---|---|---|
| A HUB handoff標準を設計可能か | 必須claim、交換、session、失効を定義 | 本文書で定義済み、実証前 | Go |
| B UID→employeeを現状運用可能か | UID一意、active紐付け、状態、assignment整合 | active 190中UIDなし184、email/auth_email両方なし104 | No-Go |
| C 新規appへ共通認可を適用可能か | server actor、role×scope×action、principal分離 | contractあり、shared verifier/sandboxなし | Conditional Go |
| D 完成appを段階移行できるか | app別flag、監査、rollback、owner | 良い個別例はあるがUnknownとowner未確定 | Conditional Go |
| E 店舗営業Phase 0へ進めるか | sandbox設計・mock・negative testに限定 | 業務実装と本番writeは別Gate | Conditional Go |

## Phase 3との優先関係

Phase 3で確認したライブ権限リスクとIdentity欠損が先行Blockerである。Phase 4のhandoffだけを導入しても、解決先employeeが欠損・曖昧、またはservice roleがscopeを迂回する状態は改善しない。したがってPhase 3是正計画とPhase 4 sandbox検証を並行し、本番Gateは合同で再判定する。

## 店舗営業管理の扱い

- Go: 用語、API契約、fixture、mock、negative test、rollback設計。
- Conditional: sandboxでCore Read Adapterとauth contractを接続する技術spike。業務データ更新なし、期限・owner付き。
- No-Go: 本番売上読取、売上Snapshot運用、書込み、service role本番利用、利用者rollout。

売上原本、税込/税抜、値引き、取消、返品、訂正、締め、営業日、KPI、検証環境、rollback ownerのPhase 3 Decision/Blockerも別途解消が必要。

## Gate解除条件

1. active employeeの認証可能率と例外を経営・HRが承認し、一意解決をfixtureと実数で証明。
2. P0 service role APIをallowlist化し、actor/employee/store/corporation scopeと監査を実証。
3. HUB handoffとapp sessionがNT-01〜24に合格。
4. 対象アプリのconformance evidenceをownerが承認。
5. D-01〜D-16のBlocker項目を決定。
6. 検証環境、monitoring、incident response、rollback ownerを実名で設定。

解除後も一括Goではなく、アプリ単位・principal type単位で再Gateする。
