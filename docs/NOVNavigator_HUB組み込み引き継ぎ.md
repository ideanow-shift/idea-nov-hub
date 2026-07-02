# NOV Navigator HUB組み込み引き継ぎ

## 目的

IDEA NOV HUBに、NOV NavigatorをHUB内機能として組み込む。

NOV Navigatorは、資料室・FAQ集・リンク集ではなく、社員が最初に質問する社内OSの入口です。

社員は「どのアプリを使えばいいか」「誰に聞けばいいか」を考えず、まずNOV Naviに聞きます。

## 表記ルール

| 用途 | 表記 |
| --- | --- |
| スタッフ向け画面名 | NOV Navi |
| 正式名称・設計名 | NOV Navigator |
| 管理画面名 | NOV Navi 管理 |
| 旧名称 | NOV Concierge |

旧名称 `NOV Concierge` は画面表示では使わないでください。

ただし、既存URL、内部API、DB prefixは互換性維持のため当面そのままです。

| 種別 | 現状 |
| --- | --- |
| 公開パス | `/concierge/` |
| Edge Function | `concierge-api` |
| DB table prefix | `concierge_` |
| localStorage key | `novConcierge.*` |

## 現在の公開URL

```text
https://ideanow-shift.github.io/idea-nov-hub/concierge/
```

## HUBトップでの扱い

NOV NaviはHUBトップの目立つ位置に配置してください。

推奨カード文言:

| 項目 | 文言 |
| --- | --- |
| カード名 | NOV Navi |
| サブテキスト | 必要な情報、申請、アプリへ案内します |
| ボタン | 聞いてみる |
| 遷移先 | `/concierge/` |

## 現在の技術状態

- フロント: `portal/concierge/`
- API: Supabase Edge Function `concierge-api`
- DB: Supabase `concierge_` prefix tables
- 店舗ログイン: Phase1暫定
- 将来認証: HUB個人認証 + Firebase Auth + `public.employees.id`
- 店舗正本: Core DB `public.stores`
- スプレッドシート/GAS依存: 通常経路から除外済み
- NotebookLM: 本部運用のナレッジエンジンとして裏側で利用
- AI接続境界: `KnowledgeAdapter`

## HUB側で実施すること

1. HUBトップに `NOV Navi` カードを追加する
2. `/concierge/` への導線を設置する
3. NOVA Design Systemのトンマナに合わせる
4. 既存の `portal/concierge/` をHUB配下の機能として扱う
5. Phase1の店舗ID/PASSログインは暫定扱いにする
6. 将来、HUB個人認証へ寄せる設計を維持する

## 認証方針

Phase1では店舗ID/PASSログインを維持します。

ただし最終形は以下です。

```text
NOV HUB
  -> Firebase Auth
  -> public.employees.firebase_uid
  -> public.employees.id
  -> roles / employee_roles
```

店舗ID/PASSは移行期のみです。

HUBログイン済みの場合は、HUB ContextをNOV Naviへ渡し、店舗ID/PASSログインをスキップします。Contextがない場合のみ、Phase1 fallbackとして店舗ID/PASSログインを使います。

HUB Context対応の詳細は `HUB_Context対応設計_NOVNavi.md` を参照してください。

NOV NaviがHUBから受け取る主な値:

- `employees.id`
- `employees.firebase_uid`
- `roleKeys`
- `storeAssignments`
- `activeStoreId`

管理画面は `super_admin` / `admin` / `executive` / `backoffice` / `nov_navi.admin` のいずれかを持つ社員だけに表示してください。

## Supabase方針

NOV Navigator側で利用するテーブルは `concierge_` prefixで統一します。

主なテーブル:

- `concierge_store_credentials`
- `concierge_question_logs`
- `concierge_feedback`
- `concierge_knowledge_updates`
- `concierge_link_master`
- `concierge_answer_rules`
- `concierge_department_routes`
- `concierge_department_inquiries`

`stores` や `employees` は新規作成しません。

店舗・社員の正本は既存Core DBを参照してください。

## 社員属性の扱い

NOV Navi側で社員属性を独自マスタ化しないでください。

| 属性 | 正本 |
| --- | --- |
| 社員 | `public.employees.id` |
| 店舗 | `public.stores.id` |
| 部署 | `public.departments.id` |
| 役職 | `public.positions.id` |
| 職種 | `public.job_types.id` 新設後 |
| 雇用形態 | `employees.employment_type` |
| 就労ステータス | `employees.employment_status` |
| 休職種別 | `employees.leave_type` |
| 権限 | `public.roles` / `public.employee_roles` |

表示名はCore DBから参照します。部署名、役職名、職種名、店舗名などをNOV Navi側で正本として重複保存しない方針です。

## 部門問い合わせ / LINE WORKS連携

総務問い合わせ、経理問い合わせなどの各部門問い合わせは、NOV Navi内で受け付けます。

詳細なOS Notification Engine連携仕様は `OS_NotificationEngine連携仕様_NOVNavi.md` を参照してください。

Phase1の扱い:

- 問い合わせ先ルートは `concierge_department_routes`
- 問い合わせ本文は `concierge_department_inquiries`
- ステータスはまず `queued`
- NOV Navi側はLINE WORKSグループIDを正本として持たない

実送信の方針:

- LINE WORKS Bot秘密情報はフロントへ出さない
- 送信処理はEdge FunctionまたはHUB backend/service_roleで実行する
- 通知先は `os.notification_destinations` または `os.line_works_channel_mappings` で解決する
- Phase1の解決キーは `target_type = global`, `purpose = concierge.department_inquiry.{route_key}`
- 将来は `target_type = department`, `target_id = public.departments.id` へ寄せる
- 通知本体の正本は `os.notifications`
- 通知作成後は `notification_id` を保存する
- 通知成功時は `status = notified` を更新する
- 送信失敗時は `status = failed`, `notification_error` に理由を残す
- 対応完了時は `status = resolved` を更新する

HUB側では、部署別LINE WORKSグループIDの正本をOS共通Notification Engine側に置いてください。NOV Navi単体では `route_id` と問い合わせ履歴だけを持ちます。

初期purpose:

| route_id | purpose |
| --- | --- |
| `hr` | `concierge.department_inquiry.hr` |
| `accounting` | `concierge.department_inquiry.accounting` |
| `education` | `concierge.department_inquiry.education` |
| `sales` | `concierge.department_inquiry.sales` |
| `fc` | `concierge.department_inquiry.fc` |
| `system` | `concierge.department_inquiry.system` |

## NotebookLM運用

スタッフにはNotebookLM画面を見せません。

本部社員は裏側で以下を行います。

1. 正本資料をGoogle Driveに格納する
2. NotebookLMへソース追加・更新する
3. NotebookLM内で回答を確認する
4. NOV Naviで社員目線の質問をテストする
5. 管理画面で更新履歴を記録する

## 高リスク領域の扱い

以下はAI回答だけで結論を出さないでください。

- 給与
- 退職
- 社会保険
- 労務
- 評価
- 契約

回答では、正本資料・申請フォーム・本部確認導線を優先します。

## 未整備質問の扱い

回答ルールに一致しない質問は、通常回答として埋もれさせず、以下のように扱います。

- `source = fallback`
- `riskLevel = sensitive`
- `needsHumanCheck = true`

管理画面では `未整備候補` として表示し、本部が回答ルール追加やナレッジ更新の候補として確認します。

CSV出力にも `取得元` を含め、回答ルール由来か未整備候補かを分析できるようにします。

取得元の表示:

| DB値 | 管理画面表示 |
| --- | --- |
| `rule` | 回答ルール |
| `fallback` | 未整備候補 |
| `manual` | 手動 |
| `ai_adapter` | AI連携 |

## 禁止事項

- NOV Naviを資料室・FAQ集・リンク集として扱わない
- スタッフをNotebookLMへ直接遷移させない
- `service_role` やAPI秘密情報をフロントへ出さない
- `stores` / `employees` をNOV Navigator側で重複正本化しない
- 店舗ID/PASSを最終認証として固定しない
- 給与・退職・労務・評価をAIだけで断定回答しない

## 組み込み後の確認

- HUBトップに `NOV Navi` が表示される
- `/concierge/` へ遷移できる
- 表示名が `NOV Navi` になっている
- 旧名称 `NOV Concierge` が画面に出ていない
- 店舗ログインが動く
- HUB Contextがある場合は店舗ID/PASSをスキップできる
- 質問ログがSupabaseに保存される
- 回答評価がSupabaseに保存される
- 管理画面で質問ログ・ナレッジ更新履歴が見える

## 現在の判断

NOV Navigator側では先に単体機能を固めます。

HUB本体が他プロジェクトで構築中のため、HUB側へ直接大きく触らず、この引き継ぎ内容をもとに組み込みタイミングで統合します。
