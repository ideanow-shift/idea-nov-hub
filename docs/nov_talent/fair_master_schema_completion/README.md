# NOV Talent Fair Master Schema Completion

## 判定

Staging適用前のsource reviewはPASSです。Migrationはまだ適用しておらず、明示承認待ちです。

## NULLと0

- `NULL`: 未登録または不明
- `0`: 正式に0円または0件

既存行は一切更新しません。現行Stagingには46件（有効45件・無効1件）があり、既存0値が「実績0」か旧既定値由来かは安全に判定できません。そのため一律NULL変換はせず、既存値を保持して要確認とします。

## 正式列

既存命名規則を優先し、正本Sourceの「費用（税込）」は `participation_fee` へ対応させます。

| 正本項目 | Fair Master列 | 保存 |
|---|---|---|
| 名称 | `fair_name` | 必須 |
| 日付 | `event_date` | 必須 |
| 費用（税込） | `participation_fee` | nullable |
| 運営会社 | `organizer_name` | nullable |
| 形式 | `event_format` | nullable |
| 接触見込み数 | `expected_contacts` | nullable |
| 全体入場数 | `total_attendance` | nullable |
| 参加サロン数 | `participating_salons` | nullable |
| 接触数 | `contact_count` | nullable |
| LINE登録数 | `line_registration_count` | nullable |
| 見学取得数 | `salon_tour_count` | nullable |
| 備考 | `note` | nullable |

`assigned_to` は既存の担当者／参加担当者列として維持します。既存の `participant_count`、`interview_count`、`offer_count`、`hire_count` も未登録を保持できるnullable列へ変更します。

## 集計契約

率・単価は保存しません。原数がすべて登録済みで分母が0より大きい場合だけ計算します。

- LINE登録率: `line_registration_count / contact_count`
- 見学率: `salon_tour_count / line_registration_count`
- 接触単価: `participation_fee / contact_count`
- 採用率: 安全にFair IDへ紐付いたSelection Historyから得た採用数を分子に使用
- 採用単価: `participation_fee / hire_count`（`hire_count` は安全に紐付いた履歴由来のみ）

分子・分母のいずれかがNULL、または分母が0の場合はNULL（画面では「集計準備中」）です。未登録を0件・0%へ変換しません。

## 安全境界

- 対象: `idea-nov-staging` のみ
- `idea-nov-core` への適用: 禁止
- 既存FairのUPDATE/DELETE: なし
- Candidate、School、Selection: 変更なし
- RLS: 有効のまま
- Browser table grant: なし
- 書込みRPC: server-side `service_role` のみ、既存Role判定と監査ログを維持
- PR #51 Source Backfill: 未実行

## Remote適用前後の確認

適用前にMigration hashとStaging project identityを再確認します。適用後は46件（有効45件）が保持されること、追加6列、nullable/default、RLS、grant、RPC、NULLと明示的0の区別をread-onlyで確認します。
