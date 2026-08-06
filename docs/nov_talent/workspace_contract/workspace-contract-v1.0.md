# NOV Talent Workspace Contract v1.0

## 判定

Workspace Contract `1.0.0`を、求人管理の初期表示における唯一のレスポンス正本とする。
機械可読正本は `contracts/nov-talent/workspace/v1.schema.json` であり、Frontend ValidatorとEdge用Type／Validatorは生成物である。生成物の手編集は禁止する。

## 正本と生成先

| 用途 | 正本・生成物 |
| --- | --- |
| 唯一のSchema | `contracts/nov-talent/workspace/v1.schema.json` |
| Frontend Validator | `portal/talent/generated/workspace-contract-v1.mjs` |
| Edge Type / Validator | `supabase/functions/nov-talent-staging-api/workspace-contract-v1.generated.ts` |
| Generator | `scripts/generate-nov-talent-workspace-contract.mjs` |

`node scripts/generate-nov-talent-workspace-contract.mjs --check` が不一致を検出した場合、Releaseを停止する。

## 初期表示契約

初期表示はWorkspace API 1回だけを使用する。Dashboard Summary APIの同時呼出しは禁止する。

| 分類 | 正式なWorkspace field | 失敗時 |
| --- | --- | --- |
| Session確認 | 認証済みWorkspace HTTP 200と`meta.requestId` | 初期表示停止 |
| Permission | `accessProfile`, `canWrite` | 初期表示停止 |
| Candidates | `students` | 初期表示停止 |
| Candidate count | `overview.total`, `dashboard.candidateCount` | 初期表示停止 |
| Dashboard補助集計 | `dashboard`, `summary` | 該当カードを「集計準備中」 |
| Fair summary | `fairMasters` | 該当カードを「集計準備中」 |
| School summary | `schoolMasters` | 該当カードを「集計準備中」 |
| Next actions | `todayTasks` | 該当カードを「集計準備中」 |

Session token、個人情報、生の下流エラー本文は契約メタデータへ含めない。

## Partial契約

補助Viewの一時失敗は`partialStatus.state=partial`と`unavailableViews`で表現する。正式な0へ変換せず、関連カードだけ「集計準備中」とする。CandidateまたはPermission取得失敗だけがfatalである。

## Exact-key方針

unknown key拒否を維持する。追加・削除・nullable変更は必ず正本SchemaのVersion変更として行い、生成物を直接編集しない。`null`は未登録、`0`は確定値として区別する。
