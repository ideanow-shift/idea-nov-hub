# Fairきっかけ Human Review Workflow

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

## 今回実施しないこと

- 161件の候補登録
- 121件の自動CONFIRMED化
- 7件の内定Fair確定
- Non-Fair Origin 367件の強制投入
- Staging apply / Backfill / Deploy / Production変更
- Fair KPI正式公開

## 次のGate

Fresh/local DBでMigration、RLS、重複ORIGIN拒否、append-only監査を確認後にReady for Reviewとする。PR merge・Staging適用後、別PRで候補manifestを投入し、総務人事部が1件ずつ確認する。
