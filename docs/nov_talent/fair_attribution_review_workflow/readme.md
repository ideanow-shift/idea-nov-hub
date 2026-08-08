# Fairきっかけ Human Review Workflow

Status: `STAGING_READY / POPULATION_NOT_EXECUTED`

Workflowのschema、RLS、server-side API、UIはStagingへ適用済みです。AttributionとAuditの実データは0件であり、候補PopulationはDB司令塔のData GateとOwner明示承認まで実行しません。

## 目的

学生とフェアの起点関係を、候補生成後の人間確認によって `PENDING` から `CONFIRMED` または `REJECTED` へ遷移させる。推測による自動確定、自動統合、自動削除は行わない。

Fair成果KPIへ利用できる帰属は `CONFIRMED ORIGIN` のみとする。1学生につき有効な `CONFIRMED ORIGIN` は最大1件で、DBの部分一意Indexとserver-side validationの両方で拒否する。

## 正本と責務

- `nov_talent_candidate_fair_attributions_v1`: 学生–フェア起点の独立正本
- `nov_talent_candidate_fair_attribution_audit_v1`: 判断履歴のappend-only ledger
- Candidate Master: 参照のみ。Reviewによる更新なし
- Fair Master: 参照のみ。Reviewによる更新なし
- legacy `interview_count` / `offer_count` / `hire_count`: 更新なし、正式KPIへの昇格なし

## 状態遷移

| 操作 | 遷移 | 用途 |
|---|---|---|
| 候補生成 | `null -> PENDING` | 別PRの候補投入で使用 |
| このフェアで確認 | `PENDING -> CONFIRMED` | 正式なFair起点 |
| このフェアではない | `PENDING -> REJECTED` | 帰属否認 |
| 保留 | `PENDING -> PENDING` | 根拠不足。versionと監査履歴は更新 |

全遷移は理由、根拠参照、担当者、日時、versionを同一transactionで記録する。競合version、二重CONFIRM、複数ORIGINはfail closedとする。

## 権限

- 操作可能: `super_admin`, `backoffice`, `hr.admin`
- 操作不可: `hr.staff`, `executive`, その他社員、未認証
- BrowserからDBへ直接アクセスしない
- Edge FunctionがHUB Sessionを検証し、service roleで許可済みRPCのみを実行する
- 新規2 tableはRLS enabled + forced、default deny、明示grantのみ
- Audit tableはUPDATE/DELETE triggerで変更拒否

## API

- `GET /api/talent/v1/fair-origin-review`: Review Queue / Candidate–Fair候補取得
- `GET /api/talent/v1/fair-origin-review/:id/history`: 判断履歴取得
- `POST /api/talent/v1/fair-origin-review/:id/decision`: CONFIRM / REJECT / HOLD

Review APIはWorkspace初期表示とは独立し、Workspace Contract `1.0.0`を変更しない。

## UI

管理ツール > データメンテナンス > フェアきっかけ確認に配置する。UIでは「帰属」「Canonical」「Projection」を表示せず、「この学生はこのフェアがきっかけで合っていますか？」という業務質問として提示する。

## 現在の禁止境界

- 161件の候補登録
- 121件の自動CONFIRMED化
- 7件の内定Fair確定
- Non-Fair Origin 367件の強制投入
- Data Gate未通過のPopulation / Backfill / Production変更
- Fair KPI正式公開

## 次のGate

Population用ManifestとSource Hash canonicalizationはDB司令塔の判定を正本とする。DB司令塔が `PASS — READY FOR POPULATION` と判定した後にのみOwner承認候補とし、承認後も全候補を`PENDING`で投入して総務人事部が1件ずつ確認する。求人管理側だけでPopulation READYを確定しない。
